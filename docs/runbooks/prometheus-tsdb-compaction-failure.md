# Prometheus TSDB Compaction/WAL Failure Runbook

## Alert: PrometheusTSDBCompactionsFailing

### Symptoms

- `observability/prometheus-kube-prometheus-stack-0` reports repeated compaction failures.
- Queries may still work while ingestion, retention, and future compactions are at risk.
- A prolonged failure can hide other incidents by degrading the monitoring system itself.

### Confirm the Cause

1. Confirm whether the alert is still active and review its 24-hour history.
2. Inspect Prometheus readiness, restarts, PVC, events, and logs:

   ```bash
   kubectl -n observability get pod prometheus-kube-prometheus-stack-0 -o wide
   kubectl -n observability get pvc prometheus-kube-prometheus-stack-db-prometheus-kube-prometheus-stack-0
   kubectl -n observability describe pod prometheus-kube-prometheus-stack-0
   kubectl -n observability logs prometheus-kube-prometheus-stack-0 -c prometheus --since=6h \
     | grep -iE 'compact|compaction|wal|block|corrupt|no space|read-only|I/O'
   ```

3. Check filesystem bytes and inodes from the Prometheus container when available, and compare current usage with growth history. A healthy-looking PVC object does not prove free filesystem space.
4. Check Prometheus metrics for failed compactions, WAL corruption, head-series growth, sample ingestion, query errors, memory pressure, and process restarts. Confirm scrape and rule-evaluation timestamps continue advancing.
5. Classify the failure before changing anything: full filesystem/inodes, corrupt block or WAL segment, transient I/O/Ceph fault, memory/OOM pressure, permissions/read-only mount, or retention unable to keep pace.
6. Record the exact block ULID or WAL segment named in logs and preserve logs/events before a restart.

### Safe Fix

- For a recovered transient I/O or Ceph event, keep Prometheus running and verify the next compaction succeeds.
- Reconcile the owning Kustomization/HelmRelease only when live state drifted from Git; do not repeatedly restart a pod that reports the same data error.
- Prepare a focused GitOps change for retention, resource limits, or PVC expansion only after proving that capacity or memory is the cause.
- Preserve a TSDB snapshot or other recoverable evidence before any approved data repair when Prometheus is healthy enough to create one.

### Verify Afterwards

- The next compaction completes and the failure counter stops increasing.
- Prometheus is Ready, ingestion and rule evaluation advance, targets remain scraped, and representative queries succeed.
- Filesystem bytes/inodes have safe headroom and the PVC is healthy.
- Alertmanager delivery and Gatus/independent monitoring still work; do not rely only on the repaired Prometheus instance to declare itself healthy.

### Escalate Instead

Ask Mehdi before deleting or moving WAL segments/TSDB blocks, running repair tools, reducing retention, resizing storage, restoring data, or restarting broad observability components. Escalate immediately if Prometheus cannot ingest/query, the PVC is read-only/corrupt, Ceph is degraded, or monitoring coverage is unavailable. Never delete the Prometheus PVC or PV.
