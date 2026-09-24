# Monitoring

## Grafana Dashboards

### Kubernetes Volumes Dashboard

The Kubernetes Volumes dashboard provides visibility into persistent volume (PVC) usage across the cluster.

- **Dashboard ID**: 11454
- **URL**: https://grafana.g-eye.io/d/kubernetes-volumes
- **Data Source**: Prometheus
- **Metrics Displayed**:
  - PVC capacity and usage
  - Volume utilization percentages
  - Available storage per volume
  - Storage trends over time

**Location in Repository**: `/Users/tapha/home-ops/kubernetes/apps/observability/grafana/instance/grafanadashboards.yaml:213-225`

**Accessing the Dashboard**:
1. Navigate to https://grafana.g-eye.io
2. Search for "Kubernetes Volumes" or browse to the dashboard directly
3. Select namespace and PVC to view detailed metrics

## Backup Restore Validation

VolSync/Kopia backup jobs are supplemented by a monthly restore drill. Each drill rotates through protected applications,
restores a real snapshot to a separate scratch PVC, and verifies the restored content read-only with format-specific
checks. Results are recorded on Paperclip issue `ELG-6`; restore or integrity failures are escalated immediately over
Telegram as data-loss-risk findings.

- **Schedule**: monthly, on the first day at 04:00 local time
- **Runbook**: [VolSync/Kopia Restore Drill](./runbooks/volsync-kopia-restore-drill.md)
- **Coverage**: restore completion, full-file readability, SQLite integrity where present, and Git object integrity where present
