# Flux Reconciliation Failure Runbook

## Alerts: FluxControllerErrorSpike / FluxInstanceNotReady / FluxInstanceAbsent

### Symptoms

- A Flux `Kustomization` or `HelmRelease` reports `Ready=False`, `Stalled=True`, or remains `Reconciling` past its normal interval.
- Downstream Kustomizations may report dependency failures even though only one resource is the root cause.
- The workload may be unavailable, partially rolled out, or healthy while Flux status is stale.

### Confirm the Cause

1. Find the first failed resource rather than treating every downstream failure separately:

   ```bash
   flux get all -A --status-selector ready=false
   kubectl get kustomizations,helmreleases -A
   ```

2. Inspect its conditions and events:

   ```bash
   kubectl -n <namespace> describe kustomization <name>
   kubectl -n <namespace> describe helmrelease <name>
   kubectl get events -A --sort-by=.lastTimestamp
   ```

3. Check the relevant controller logs and the live workload:

   ```bash
   kubectl -n flux-system logs deploy/kustomize-controller --since=30m
   kubectl -n flux-system logs deploy/helm-controller --since=30m
   kubectl -n <namespace> get pods,deployments,statefulsets
   ```

4. Compare the attempted revision with Git. If many unrelated resources fail with API errors such as `unexpected EOF`, `context canceled`, or timeouts, first investigate API server or etcd health; this is not proof of a manifest defect.

### Safe Fix

- If Git is valid, the workload is healthy, and the failure was transient, allow the normal retry first.
- For one clearly drifted or stale resource, perform one targeted reconciliation:

  ```bash
  flux -n <namespace> reconcile kustomization <name> --with-source
  # or
  flux -n <namespace> reconcile helmrelease <name> --with-source
  ```

- If a single stuck application pod is preventing the health check and its controller has healthy replacements, delete only that pod so its controller recreates it.
- If Git contains a bad desired state, prepare a narrow GitOps fix or rollback. Do not patch the live object as the durable repair.

### Verify Afterwards

```bash
flux get all -A --status-selector ready=false
kubectl -n <namespace> get kustomization,helmrelease
kubectl -n <namespace> rollout status deployment/<name> --timeout=5m
kubectl -n <namespace> rollout status statefulset/<name> --timeout=5m
```

Confirm the resource applied the expected Git revision, its workload is Ready, old pods are gone, and no new controller errors appear during a short quiet period.

### Escalate Instead

Escalate before acting when the fix requires storage or PVC mutation, DNS/Ingress/Gateway changes, secrets, Authelia/LLDAP, CRD replacement, Talos/control-plane work, broad restarts, or deletion of stateful resources. Escalate immediately if failures are cluster-wide, the API server or etcd is unhealthy, rollback has no known-good target, or data integrity may be affected.
