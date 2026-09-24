# VolSync Backup Failure Runbook

## Alerts: VolSyncVolumeOutOfSync / VolSyncComponentAbsent

### Symptoms

- A `ReplicationSource` has no recent successful synchronization or its latest mover Job failed.
- VolSync or Kopia reports repository, snapshot, credential, cache PVC, or connectivity errors.
- The application is running, but its recovery point is older than the expected hourly schedule.

### Confirm the Cause

1. List backup sources and inspect the affected source. This repository normally schedules backups hourly:

   ```bash
   kubectl get replicationsources -A
   kubectl -n <namespace> describe replicationsource <app>
   kubectl -n <namespace> get replicationsource <app> -o yaml
   ```

2. Find the most recent mover Jobs and pods, including completed and failed objects:

   ```bash
   kubectl -n <namespace> get jobs,pods --sort-by=.metadata.creationTimestamp
   kubectl -n <namespace> logs job/<latest-mover-job> --all-containers
   kubectl -n <namespace> describe job/<latest-mover-job>
   ```

3. Check VolSync controller health and events:

   ```bash
   kubectl -n volsync-system get pods
   kubectl -n volsync-system logs deploy/volsync --since=2h
   kubectl get events -A --sort-by=.lastTimestamp
   ```

4. Confirm the source PVC, snapshot class, cache PVC, and repository Secret exist without printing Secret values:

   ```bash
   kubectl -n <namespace> get pvc <app>
   kubectl get volumesnapshotclass csi-ceph-blockpool
   kubectl -n <namespace> get secret <app>-volsync-secret
   ```

5. Treat controller status as a claim, not proof. Compare `.status.latestMoverStatus.result` with the latest mover logs:

   ```bash
   kubectl -n <namespace> get replicationsource <app> \
     -o jsonpath='{.status.lastSyncTime}{"|"}{.status.latestMoverStatus.result}{"\n"}'
   kubectl -n <namespace> logs job/<latest-mover-job> --all-containers \
     | grep -E 'OPERATION_RESULT|snapshot|empty|failure|error'
   ```

   `latestMoverStatus.result=Successful` is falsely green when logs report `OPERATION_RESULT: FAILURE`, an empty source, or no snapshot. This pattern was observed on `default/atuin`, `default/lelabo-crm`, `default/twenty`, and `observability/teslamate`.

6. Prove a current Kopia snapshot exists for the source and inspect repository maintenance/index health without printing credentials. Confirm where the application's real data lives: the mounted PVC, PostgreSQL, or external S3. An empty PVC may be intentional, or it may prove that the wrong path is protected.

A current synchronization timestamp and completed mover Job are insufficient by themselves. Success requires consistent CR status and logs, a real snapshot for non-empty protected data, and periodic restore validation.

### Safe Fix

- If the controller or one mover pod is stuck but the cause is transient, restart only that pod and let its controller recreate it.
- Reconcile the owning application Kustomization if the live `ReplicationSource` drifted from Git:

  ```bash
  flux -n <namespace> reconcile kustomization <app> --with-source
  ```

- For a failed scheduled run caused by a transient repository or network outage, leave the failed evidence in place until logs are captured, then observe the next scheduled run. If waiting would breach the recovery-point objective, nudge the source using the VolSync-supported trigger for the installed version rather than editing its status or schedule ad hoc.
- Credential, repository, NAS/NFS, DNS, or network configuration changes require approval. When approved, make them only through 1Password/External Secrets and GitOps; never paste or log secret values.

### Verify Afterwards

```bash
kubectl -n <namespace> get replicationsource <app> -o yaml
kubectl -n <namespace> get jobs,pods --sort-by=.metadata.creationTimestamp
kubectl -n <namespace> logs job/<new-mover-job> --all-containers
```

Confirm a newer mover Job completed successfully, the synchronization timestamp advanced, and the application PVC remained mounted and healthy. A temporary `VolumeSnapshot` only needs to be `readyToUse` while the run is active; it may be cleaned up after completion. A successful backup does not replace the monthly scratch-PVC restore drill.

### Escalate Instead

Escalate immediately over Telegram when a restore fails, restored data is incomplete, the repository is unreadable, or multiple recovery points are missing. Ask before deleting snapshots, Kopia content, PVCs, PVs, VolumeSnapshots, or repository data, and before changing storage classes, Ceph topology, retention, encryption, credentials, External Secrets, 1Password items, NAS/NFS, DNS, or networking. Never restore over a live PVC.
