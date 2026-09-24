# Monitoring Coverage Loss Runbook

## Alert: monitoring, logging, synthetic-check, or delivery heartbeat missing

### Symptoms

- Scrape targets, alert evaluations, VictoriaLogs ingestion, Gatus checks, or Alertmanager delivery stop advancing without an application-specific alert.
- Observability components such as `blackbox-exporter`, `fluent-bit`, `grafana-app`, `keda`, `silence-operator`, `unpoller`, `uptimerobot-heartbeat`, `victoria-logs`, or `vlogs-vmalert` become unavailable.
- A green dashboard may reflect missing data rather than health.

### Confirm the Cause

1. Use an independent path first: Gatus/UptimeRobot, Alertmanager API, Kubernetes readiness, and direct service probes. Do not trust only the component suspected of being blind.
2. Check observability workloads and Flux:

   ```bash
   kubectl -n observability get pods,helmreleases
   flux -n observability get kustomizations,helmreleases
   kubectl -n observability get events --sort-by=.lastTimestamp
   ```

3. Verify timestamps/counters advance for Prometheus scrape samples and rule evaluations, VictoriaLogs ingestion and vmalert evaluation, Gatus result series, and Alertmanager notifications. Distinguish `0` from absent/stale series.
4. For each critical rule family, evaluate its selector directly and confirm it matches the expected live series and labels. A green evaluator with a zero-series selector is blind. For Gatus specifically, compare the alert rule's `group` selector with labels on all 48 live endpoint series; the 2026-09-25 baseline found rules selecting `group="external"` / `group="guarded"` while endpoints emitted no group label.
5. Inspect target/service discovery, rule-loading, sidecars/config reloaders, persistent storage, DNS/network, and receiver logs. Check for a selector mismatch: a rule that selects labels no series emits is silent, not healthy.
6. Send only an approved synthetic/test notification; do not create an incident by paging arbitrary receivers.

### Safe Fix

- Restart one stuck stateless collector/evaluator pod only after preserving logs and confirming its controller/configuration is healthy.
- Reconcile one drifted observability Kustomization or HelmRelease.
- Correct a narrow selector or scrape/config error through GitOps and verify the expected series/rules appear.
- Keep at least one independent heartbeat outside the primary Prometheus/Alertmanager path.

### Verify Afterwards

- Scrape, log-ingestion, rule-evaluation, synthetic-check, and notification timestamps advance.
- A controlled test traverses the expected evaluator and delivery path without leaking secrets or spamming receivers.
- Dashboards distinguish missing data from zero; all observability Flux resources are Ready.
- `docs/monitoring.md` reflects actual coverage and any newly added/removed check.

### Escalate Instead

Escalate immediately when alert delivery or all independent monitoring paths are unavailable, because other incidents may be hidden. Ask before changing external notification credentials, DNS/networking, persistent storage, retention, or broad alert routing. Never permanently silence a symptom to make monitoring appear healthy.
