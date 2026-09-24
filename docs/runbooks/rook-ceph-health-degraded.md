# Rook-Ceph Health Degraded Runbook

## Alerts: CephHealthWarning / CephHealthError and related Rook-Ceph alerts

### Symptoms

- `CephCluster/rook-ceph` reports `HEALTH_WARN` or `HEALTH_ERR`.
- Alerts report monitor quorum loss, OSD or host down, degraded placement groups, slow operations, or low capacity.
- PVC-backed applications may have slow or failed I/O, Pending mounts, or repeated restarts.

### Confirm the Cause

1. Confirm Kubernetes and Rook state:

   ```bash
   kubectl -n rook-ceph get cephcluster rook-ceph -o wide
   kubectl -n rook-ceph get pods -o wide
   kubectl -n rook-ceph get helmrelease rook-ceph-operator rook-ceph-cluster
   ```

2. Query Ceph from the enabled toolbox and record the exact health detail before changing anything:

   ```bash
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph status
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph health detail
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph osd tree
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph df detail
   ```

3. Correlate the finding with nodes, events, and Rook logs:

   ```bash
   kubectl get nodes -o wide
   kubectl get events -A --sort-by=.lastTimestamp
   kubectl -n rook-ceph logs deploy/rook-ceph-operator --since=1h
   ```

Distinguish a recovered transient monitor/OSD flap from persistent degradation. During upgrades, Pending storage pods can be caused by scheduler or node-version problems rather than disk failure.

### Safe Fix

- If Ceph is already `HEALTH_OK`, all OSDs are up/in, quorum is complete, and the alert has cleared, take no disruptive action; document and monitor recurrence.
- Restart only a single clearly stuck, controller-managed Rook pod when logs show a transient process failure. For a monitor or OSD pod, also require every placement group to be `active+clean`, all other expected OSDs to be up/in, and confirmation that the restart cannot break monitor quorum; otherwise escalate.
- Reconcile a drifted Rook Kustomization only when Git is known-good and the failure is a Flux state problem.
- For capacity warnings, identify the growing pool and workload first. Prefer a reviewed application retention or PVC-capacity change through GitOps; do not treat predicted growth alone as proof that raw storage is exhausted.

### Verify Afterwards

```bash
kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph status
kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph health detail
kubectl -n rook-ceph get pods
kubectl -n rook-ceph get cephcluster rook-ceph -o wide
```

Confirm monitor quorum, all expected OSDs up/in, placement groups active+clean, raw capacity headroom acceptable, Rook resources Ready, and affected PVC workloads able to read and write. Observe a quiet period before closing a recurring flap.

### Escalate Instead

Ask before changing Ceph topology, adding/removing OSDs, changing replication, touching disks, replacing monitors, changing pool settings, Talos or node configuration, Ceph networking/routing/DNS, or restarting multiple storage components. Escalate immediately for `HEALTH_ERR`, quorum loss, unavailable or undersized placement groups, repeated I/O errors, rapidly shrinking capacity, suspected hardware failure, or any data-loss risk. Never delete a PVC, PV, Ceph pool, OSD data directory, or recovery object as cleanup.
