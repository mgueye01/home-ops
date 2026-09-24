# Talos Root Filesystem Pressure Runbook

## Alert: CephNodeDiskspaceWarning on `/dev/sda4`

### Symptoms

- Alerts reference `/dev/sda4` mounted at `/var` and possibly duplicate bind mounts such as `/etc/nfsmount.conf` on `k8s-1`, `k8s-2`, or `k8s-3`.
- Ceph may still report ample raw capacity. The alert name can therefore mislead responders into treating Talos EPHEMERAL/root pressure as OSD-pool pressure.
- Image pulls, container logs, and kubelet operations may fail as the filesystem fills.

### Confirm the Cause

1. Group alerts by node and backing device. Treat multiple mountpoints backed by `/dev/sda4` as one capacity problem, not multiple disks.
2. Compare node/root usage with Ceph raw and pool usage:

   ```bash
   kubectl get nodes
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph status
   kubectl -n rook-ceph exec deploy/rook-ceph-tools -- ceph df detail
   talosctl -n <node-ip> usage
   talosctl -n <node-ip> mounts
   ```

3. Review node conditions, DiskPressure, image filesystem metrics, pod ephemeral-storage use, and recent evictions. Inspect Talos/containerd logs for image-GC or no-space errors.
4. Attribute growth among container images/snapshots, logs, ephemeral volumes, failed pods/jobs, and Talos system state. Do not run recursive deletion commands on an unknown Talos path.
5. Check whether a backup, upgrade, runner, or image-pull burst explains a short-lived increase. Confirm Ceph OSD devices/pools independently before proposing storage action.

### Safe Fix

- Allow kubelet/containerd's normal garbage collection to run when thresholds are not critical, and verify that usage falls.
- Remove only controller-owned, clearly disposable failed pods/jobs through their normal lifecycle policy; do not delete their PVCs.
- Reduce an optional image-pull or runner burst after confirming ownership and impact.
- Prepare a narrow retention, log-rotation, ephemeral-storage-limit, or image-GC policy change in Git when the growth source is known.

### Verify Afterwards

- `/dev/sda4` has safe byte and inode headroom and the duplicate mount metrics agree.
- The node is Ready without DiskPressure; image pulls and pod starts work; no new eviction/no-space events appear.
- Ceph remains `HEALTH_OK`, OSDs are up/in, and raw/pool headroom is unchanged except for expected workload activity.
- Flux resources and system-upgrade plans remain healthy.

### Escalate Instead

Ask Mehdi before draining/rebooting a node, changing Talos machine configuration or partitioning, forcing containerd cleanup, or changing Ceph topology. Never remove OSDs/pools or delete PVCs/PVs in response to `/dev/sda4` pressure. Escalate immediately if a node reaches critical free space, becomes NotReady, or reports filesystem/I/O corruption.
