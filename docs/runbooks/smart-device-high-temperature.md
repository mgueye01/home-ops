# SMART/NVMe High Temperature Runbook

## Alert: SmartDeviceHighTemperature

### Symptoms

- The alert identifies `k8s-1/nvme0` or `k8s-2/nvme0` above its configured temperature threshold.
- The same device may alert hourly while the node and workloads remain Ready.
- Sustained heat can precede throttling, media errors, or device failure; do not treat recurrence as noise.

### Confirm the Cause

1. Confirm the alert is active, its start time, current value, and device labels. Check recent history so a recovered spike is not mistaken for sustained heat.
2. Inspect the exporter and node without restarting either:

   ```bash
   kubectl -n observability get pods -l app.kubernetes.io/name=prometheus-smartctl-exporter -o wide
   kubectl -n observability logs <smartctl-exporter-pod-on-node> --since=2h
   talosctl -n <node-ip> disks
   talosctl -n <node-ip> dmesg | grep -iE 'nvme|temperature|thermal|media|I/O error'
   ```

3. In Prometheus/Grafana, compare the current temperature with the device warning/critical threshold and review at least 24 hours. Correlate the episode with node CPU, disk I/O, backup jobs, ambient temperature, and fan state.
4. Inspect SMART/NVMe health fields through the approved Talos or exporter path: critical warning, composite temperature, available spare, percentage used, media/data-integrity errors, error-log entries, and unsafe shutdowns.
5. Distinguish one bad sensor/exporter series from a real device event by comparing exporter metrics, node logs, and another reading. Preserve the evidence; a blind restart can erase the useful time correlation.

### Safe Fix

- Remove any physical airflow obstruction and correct room/rack cooling without disturbing disks or cables.
- Pause or reschedule an optional high-I/O job only when its ownership and recovery behavior are known. Do not stop Ceph daemons or databases as a cooling shortcut.
- If the temperature has recovered and no SMART error counter advanced, leave the node running and watch through at least the previous recurrence interval.
- Prepare a node-drain and device-replacement plan if temperature remains above the device limit, critical-warning/media-error counters advance, throttling is sustained, or episodes become more frequent.

### Verify Afterwards

- Temperature remains below the warning threshold through a representative workload period.
- SMART critical-warning and media/data-integrity error counters are stable.
- The node stays `Ready`; Ceph is `HEALTH_OK`; all OSDs are up/in; Flux has no new failures.
- No new `SmartDeviceHighTemperature` episode appears during the agreed quiet period.

### Escalate Instead

Notify Mehdi promptly for a sustained critical temperature, thermal shutdown, I/O error, advancing media-error counter, missing device, or Ceph degradation. Draining/rebooting a node, changing Talos machine configuration, moving Ceph topology, or replacing a device requires approval. Never remove an OSD, PVC, PV, or Ceph pool as part of temperature triage.
