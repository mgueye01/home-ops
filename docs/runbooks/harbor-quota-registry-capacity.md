# Harbor Quota and Registry Capacity Runbook

## Alerts: HarborProjectQuotaAlmostFull / registry filesystem filling

### Symptoms

- Harbor project `openclaw` approaches its project quota.
- PVC `dev/harbor-registry` reports high use, currently on storage also observed through `default/paperless-nfs`.
- Pushes can fail because of either the logical Harbor quota or physical registry/NFS capacity; these are separate limits.

### Confirm the Cause

1. Confirm the active alert, project name, quota percentage, and PVC/filesystem labels. Deduplicate series that describe the same shared NFS backing store.
2. Check Harbor and registry health:

   ```bash
   kubectl -n dev get pods,helmrelease -l app.kubernetes.io/name=harbor
   kubectl -n dev get pvc harbor-registry
   kubectl -n dev logs deploy/harbor-core --since=2h
   kubectl -n dev logs deploy/harbor-registry --since=2h
   ```

3. Query Harbor's project quota and artifact inventory through the authenticated API/UI without exposing credentials. Identify which repositories, tags, and untagged artifacts consume quota and which have current workload references.
4. Check the registry filesystem's actual bytes/inodes and trend. Compare `dev/harbor-registry` and `default/paperless-nfs` metrics to determine whether they are views of the same NFS capacity.
5. Check retention-policy and garbage-collection history. A retention run marks/removes eligible artifacts; garbage collection reclaims blob storage separately.

### Safe Fix

- Stop or defer optional bulk image pushes when either limit is close.
- Prepare a retention-policy or quota adjustment proposal with an inventory of affected repositories and rollback/restore implications.
- Run only non-destructive inventory/reporting operations autonomously. Treat unreferenced/untagged as candidates, not permission to delete.
- If the underlying shared filesystem is the constraint, use the storage-full runbook; do not raise only the Harbor quota and hide the physical limit.

### Verify Afterwards

- The `openclaw` project has agreed logical quota headroom and representative authenticated push/pull checks pass.
- Registry filesystem bytes/inodes have safe headroom and the trend is stable.
- Harbor core, registry, scanner, and jobs remain Ready; Flux is healthy.
- Required image tags and digests used by workloads are still present. Monitor through the next retention/garbage-collection window.

### Escalate Instead

Mehdi must approve deleting images/artifacts, changing retention or project quotas, running garbage collection that removes blobs, resizing/migrating NFS storage, or changing registry credentials. Never delete `dev/harbor-registry`, `default/paperless-nfs`, any PVC/PV, or underlying NAS data during cleanup.
