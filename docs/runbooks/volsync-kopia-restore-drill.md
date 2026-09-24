# VolSync/Kopia Restore Drill Runbook

## Purpose

Prove that a real Kopia snapshot can be restored and read without touching the live application PVC. Run monthly and rotate applications, prioritising data that cannot be regenerated.

## Failed or False-Green Restore Incident

### Symptoms

- A mover reports `Successful` while logs report `OPERATION_RESULT: FAILURE`, an empty source, or no snapshot.
- A ReplicationDestination fails, the scratch PVC cannot be read, or an integrity check fails.

### Confirm the Cause

Compare source/destination CR status with mover logs, prove the expected snapshot exists, and identify whether application data lives on the protected PVC, PostgreSQL, or external S3. Preserve scratch resources and evidence after any failed restore.

### Safe Fix

Retry only after a proven transient mover/controller failure, using a new manual token and the existing scratch destination. Never restore over the live PVC and never rewrite status to appear successful.

### Verify Afterwards

Require non-zero expected content plus application-specific integrity checks. Record snapshot age, restore duration, file/byte counts, and every integrity result; pod exit status alone is insufficient.

### Escalate Instead

A failed restore, missing snapshot, incomplete data, repository/index error, or failed integrity check is immediate data-loss risk: notify over Telegram, preserve evidence, and ask before credentials, repository, storage, or cleanup changes.

## Safety rules

- Never restore over the live PVC.
- Use a uniquely named scratch PVC created from the ReplicationDestination's output VolumeSnapshot.
- Mount the scratch PVC read-only for verification.
- Never expose repository credentials or secret contents in logs.
- Treat a failed restore, unreadable file, failed database integrity check, or failed Git object check as an immediate data-loss-risk incident. Notify over Telegram immediately and preserve the scratch resources for investigation.
- Never delete a live PVC, PV, VolumeSnapshot, or Ceph pool. Before scratch cleanup, verify the resource name and `restore-drill` label. Hermes must leave PVC deletion to an authorised human under the homelab safety policy.

## Select the monthly target

List protected applications and their last successful backup:

```bash
kubectl get replicationsources -A -o wide
```

Choose one application that has not been tested recently. Prefer source data such as Git repositories, uploaded documents, automation definitions, or application databases over reproducible caches and media indexes. Record the namespace, ReplicationSource, source PVC, last sync time, and the expected data type.

## Restore

The examples below use `dev/gitea`. Replace all names for the selected application.

1. Confirm the latest source backup is successful in both CR status and mover logs:

   ```bash
   kubectl -n dev get replicationsource gitea \
     -o jsonpath='{.status.lastSyncTime}{"|"}{.status.latestMoverStatus.result}{"\n"}'
   kubectl -n dev get jobs --sort-by=.metadata.creationTimestamp
   kubectl -n dev logs job/<latest-mover-job> --all-containers \
     | grep -E 'OPERATION_RESULT|snapshot|empty|failure|error'
   ```

   Do not continue when status says `Successful` but logs report `OPERATION_RESULT: FAILURE`, an empty source, or no snapshot. Confirm the application really stores recoverable data on this PVC rather than PostgreSQL or external S3, and prove the expected Kopia snapshot exists. This false-green pattern was observed on `default/atuin`, `default/lelabo-crm`, `default/twenty`, and `observability/teslamate` in the 2026-09-25 baseline.

2. Trigger the existing scratch ReplicationDestination with a new token:

   ```bash
   token="drill-$(date -u +%Y%m%d-%H%M%S)"
   kubectl -n dev patch replicationdestination gitea-dst --type=merge \
     -p "{\"spec\":{\"trigger\":{\"manual\":\"$token\"}}}"
   ```

3. Wait until `.status.lastManualSync` matches the token and `.status.latestMoverStatus.result` is `Successful`. Record `.status.lastSyncDuration`, `.status.lastSyncTime`, and `.status.latestImage.name`.

4. Create a uniquely named scratch PVC from that output VolumeSnapshot. Use the destination capacity and storage class. Label it so it cannot be confused with a live claim:

   ```yaml
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: restore-drill-gitea-YYYYMMDD
     namespace: dev
     labels:
       app.kubernetes.io/name: restore-drill
       restore-drill/app: gitea
   spec:
     accessModes: [ReadWriteOnce]
     storageClassName: ceph-block
     resources:
       requests:
         storage: 10Gi
     dataSource:
       name: <latest-image-volume-snapshot>
       kind: VolumeSnapshot
       apiGroup: snapshot.storage.k8s.io
   ```

5. Wait for the scratch claim to become `Bound`. Do not modify the live workload or live PVC.

## Verify the restored data

Create a short-lived verification pod that mounts only the scratch PVC with `readOnly: true`. Verification must test content, not only pod exit status:

1. Count files and bytes and require at least one file.
2. Read every regular file completely (for example, `dd if=<file> of=/dev/null`).
3. For SQLite files, run `PRAGMA quick_check;` in immutable/read-only mode and require `ok`.
4. For Git repositories, run `git fsck --full --no-progress` and require success.
5. Add an application-specific check when the data format supports one.

A successful Gitea check should therefore report non-zero files/bytes and successful `git fsck` for every restored repository. If any check fails, stop cleanup, notify Telegram immediately in French, and add a detailed English comment to Paperclip issue `ELG-6`.

## Record the drill

Comment on Paperclip issue `ELG-6` with:

- application, namespace, ReplicationSource, and snapshot/output image;
- source snapshot time and age at restore;
- Kopia restore duration and verification duration;
- file/byte counts and application-specific integrity results;
- anything surprising;
- resources already cleaned up and any cleanup requiring Mehdi.

## Cleanup

1. Delete the verification Pod after logs and timestamps are recorded.
2. Confirm the scratch PVC name and labels twice:

   ```bash
   kubectl -n <namespace> get pvc <scratch-pvc> \
     -o jsonpath='{.metadata.name}{"|"}{.metadata.labels.app\.kubernetes\.io/name}{"|"}{.spec.dataSource.name}{"\n"}'
   ```

3. Hermes does not delete PVCs under the homelab safety policy. Ask Mehdi to delete only the named, labelled scratch PVC after a successful drill. Never delete the live claim, a PV, an output VolumeSnapshot, or a Ceph pool.
4. Once authorised cleanup is complete, verify the scratch Pod and PVC are absent. Keep the ReplicationDestination and its latest output VolumeSnapshot available for recovery.

## First recorded drill

On 2026-09-25, `dev/gitea` restored successfully from a source snapshot taken at `2026-09-24T22:12:48Z`. The restore started at `2026-09-24T22:47:21Z`, so the snapshot was 34m33s old. Kopia completed in 35.113s. Read-only verification found 156 files (468,119,552 bytes) and all 3 Git repositories passed `git fsck`. No SQLite database was present in this volume. The first verification attempt exposed Git's `safe.directory` guard; rerunning with an explicit per-repository safe-directory setting passed without changing the restored data.
