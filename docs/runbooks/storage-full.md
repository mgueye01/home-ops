# Storage Full Runbook

## Alerts: PersistentVolumeCriticallyFull / KubePersistentVolumeFillingUp

### Symptoms

- A PVC is above its byte or inode threshold, or is predicted to fill within four days.
- Applications fail writes, become read-only, or enter `CrashLoopBackOff`.
- Shared NFS can expose the same underlying capacity through multiple PVC metrics, including `default/paperless-nfs` and `dev/harbor-registry`.
- Runner PVCs may be intentionally short lived; Harbor project quota is a logical limit distinct from registry filesystem capacity.

### Confirm the Cause

1. Identify the alert namespace/PVC, storage class, mounted workload, backing volume, and whether the series is bytes, inodes, or predicted growth:

   ```bash
   kubectl get pvc -A
   kubectl -n <namespace> describe pvc <pvc-name>
   kubectl -n <namespace> get pods -o wide
   ```

2. Check current filesystem usage from the owning pod when the image supports it:

   ```bash
   kubectl -n <namespace> exec <pod-name> -- df -h /path/to/mount
   kubectl -n <namespace> exec <pod-name> -- df -i /path/to/mount
   ```

3. Use the Kubernetes volumes dashboard and Prometheus history to distinguish a sudden spike, stable high-water mark, and sustained growth. Confirm the metric still exists and is not stale.
4. Map duplicate shared-NFS series to their backing export before adding percentages. `default/paperless-nfs` and `dev/harbor-registry` may describe the same physical headroom.
5. For Harbor, separately inspect project quota and `dev/harbor-registry` filesystem usage; follow `harbor-quota-registry-capacity.md`.
6. For actions-runner claims, verify owner references and runner/job lifecycle. Do not assume an old-looking claim is orphaned.
7. Identify large directories read-only and capture application logs/events. Do not run recursive deletion, truncate, database maintenance, or cleanup commands during diagnosis.

### Safe Fix

- Stop or defer an optional writer only when its ownership and recovery behavior are known.
- Let an expected short-lived runner/job complete and its controller perform normal cleanup; verify ownership before touching anything.
- Prepare a focused GitOps PVC expansion when the storage class supports expansion and sustained growth justifies it. VolSync-managed volumes use the application's `VOLSYNC_CAPACITY`; direct PVCs use `spec.resources.requests.storage`.
- Prepare application-native retention, archival, or cache-cleanup changes only after inventorying exactly what they remove. Database vacuuming, artifact deletion, and log truncation are not generic routine fixes.
- For shared NFS, fix the underlying capacity/retention cause once rather than changing each duplicate PVC metric.

### Verify Afterwards

- PVC/filesystem byte and inode usage return to safe headroom and the predicted-fill alert clears.
- The application can perform a representative write/read and its pods are Ready.
- Any approved expansion is reflected in the PVC capacity and inside the filesystem.
- VolSync creates a newer successful recovery point for protected data after the change.
- Shared-NFS duplicate metrics agree and Harbor logical quota remains distinct from physical capacity.

### Escalate Instead

Ask Mehdi before deleting application data, images/artifacts, snapshots, runner claims, or scratch restore claims; changing retention; resizing/migrating storage; or running database maintenance with downtime/space amplification risk. Never delete a PVC, PV, VolumeSnapshot, or Ceph pool. Escalate immediately for a read-only/corrupt filesystem, failed restore/integrity check, exhausted storage blocking writes, or Ceph degradation.

### Prevention

- Monitor byte, inode, and predicted growth rather than a single percentage.
- Set application-native retention and conservative initial capacities.
- Keep `docs/monitoring.md` and VolSync coverage current when storage is added or removed.
- Test alerts after storage changes and perform regular scratch-PVC restore drills.

### Related Incidents

- 2025-11-11: Rybbit ClickHouse filled 20 GiB and was expanded to 200 GiB (`0af1d334`). The gap was missing metrics/alerting; the volume remained impacted for ten days.
