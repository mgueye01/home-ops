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
