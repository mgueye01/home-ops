# External Secrets / 1Password Provider Outage Runbook

## Trigger: ExternalSecret refresh failures or dependency-blocked Flux resources

### Symptoms

- `ExternalSecret` objects stop refreshing or report `Ready=False` across namespaces.
- `external-secrets/external-secrets` or `external-secrets/onepassword-connect` is unavailable.
- New pods fail with missing Secret keys while existing pods may continue using an older generated Secret.
- Many unrelated Flux resources can fail behind the same provider dependency.

### Confirm the Cause

1. Determine scope and first failure; never print Secret data:

   ```bash
   kubectl get externalsecrets -A
   kubectl get clustersecretstores
   kubectl -n external-secrets get pods,helmreleases
   kubectl -n external-secrets logs deploy/external-secrets --since=2h
   kubectl -n external-secrets logs deploy/onepassword-connect --since=2h
   ```

2. Inspect the affected `ExternalSecret` conditions, refresh time, provider reference, and generated Secret metadata:

   ```bash
   kubectl -n <namespace> describe externalsecret <name>
   kubectl -n <namespace> get externalsecret <name> \
     -o jsonpath='{.status.refreshTime}{"\n"}{range .status.conditions[*]}{.type}={.status}:{.reason}:{.message}{"\n"}{end}'
   kubectl -n <namespace> get secret <target-name> -o jsonpath='{.metadata.name}{"|"}{.metadata.creationTimestamp}{"|"}{.metadata.resourceVersion}{"\n"}'
   ```

3. Verify only expected key names, not values, when key shape matters. Do not use commands that render `.data`, decoded values, tokens, credentials, or 1Password item contents into logs.
4. Check the `ClusterSecretStore` condition and connectivity from the controller to `onepassword-connect`. Separate DNS/network/IPv6 failures from provider authentication, missing items/fields, and rate limits.
5. Identify dependency fan-out with `flux get all -A --status-selector ready=false`; start with the earliest provider failure, not every blocked application.

### Safe Fix

- If one controller pod is stuck after a proven transient and replicas/desired state are healthy, restart only that pod and let its controller recreate it.
- Reconcile the affected `ExternalSecret` or owning Kustomization after provider health returns; do not rewrite generated Secrets manually.
- Correct a narrow live drift through GitOps. Credential or item changes must use the approved 1Password/External Secrets path and must never expose values in Git, commands, comments, or logs.
- Observe natural retries first when the outage has recovered; avoid reconciling every application at once.

### Verify Afterwards

- `onepassword-connect`, `external-secrets`, and the `ClusterSecretStore` are Ready.
- Affected `ExternalSecret` refresh times advance and conditions become `Ready=True`.
- Generated Secrets contain the expected key names and dependent workloads recover without revealing values.
- Root Flux resources and their downstream dependencies become Ready; logs remain free of provider/authentication errors through a refresh interval.

### Escalate Instead

Ask Mehdi before rotating the 1Password service account, editing provider credentials/items, changing DNS/network policy, or replacing generated Secrets. Escalate immediately if credentials may be exposed, a required item is missing, or the outage blocks recovery/backup/authentication. Never paste secret values into Paperclip, Telegram, Git, or terminal output.
