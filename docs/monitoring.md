# Monitoring

## Coverage

Baseline taken 2026-09-25 against the live cluster: 87 Flux Kustomizations across
16 namespaces, 48 Gatus endpoints, 296 alerting rules, 25 ReplicationSources.

### How each layer gets wired

Three layers, and only one of them is opt-in per app.

**Availability — Gatus.** `gatus-sidecar` runs with `--auto-httproute`, so *every*
HTTPRoute in the cluster becomes an endpoint with no annotation needed. Adding
`gatus.home-operations.com/endpoint` to a route only overrides the generated
check — it is not what turns it on. Two idioms are in use:

- `conditions: ["[STATUS] == 200"]` — plain availability.
- `conditions: ["len([BODY]) == 0"]` with `dns.query-name` and `url: 1.1.1.1` —
  asserts an internal hostname does **not** resolve publicly. Failure means
  exposure, not downtime. 25 of the 48 endpoints are this kind.

Apps with no HTTPRoute get no Gatus check. To probe one, annotate a Service the
repo owns — the sidecar also runs `--enable-service`, which *does* require
`gatus.home-operations.com/enabled: "true"`. See
`kubernetes/apps/databases/cloudnative-pg/cluster/service.yaml`.

`gatus.rules` (`kubernetes/apps/observability/gatus/app/prometheusrule.yaml`)
selects on the `type` label so every endpoint is covered by exactly one rule.
Do not gate those rules on `group`: nothing sets a group, and the sidecar has no
`--default-group` flag.

**Alerting — Prometheus.** Two tiers:

- Cluster-wide, automatic. `kube-prometheus-stack` ships `defaultRules` (`KubePodCrashLooping`,
  `KubePodNotReady`, `KubeDeploymentReplicasMismatch`, node, etcd, storage…).
  Every workload is covered against crash-looping and failed rollout without any
  per-app manifest. **No app is unmonitored in this sense.**
- App-specific, opt-in. A `prometheusrule.yaml` next to the HelmRelease for
  metric-based rules, or a `lokirule.yaml` for log-pattern rules (`plex`,
  `prowlarr`, `radarr`, `sonarr` use this for `database is locked`).

**Backups — VolSync.** Add `../../../../components/volsync` to the app's
`components:` in `ks.yaml` plus `VOLSYNC_CAPACITY` and `VOLSYNC_SCHEDULE_MINUTE`
under `postBuild.substitute`. The component creates the PVC, so a hand-written
`pvc.yaml` alongside it is data VolSync is *not* backing up.

### Open gaps

Ranked by what breaks if it goes unnoticed.

**No probe, and failure is amplifying.** Generic pod alerts catch the crash but
not degraded-but-running, and both of these take a lot down with them:

| App | Why it matters |
|---|---|
| `external-secrets/onepassword-connect` | Every ExternalSecret in the cluster refreshes through it |
| `kyverno/kyverno` | Admission webhook — a wedged failure policy blocks deploys cluster-wide |

**Data with no VolSync ReplicationSource.** These have a hand-written PVC and no
`components/volsync`:

| PVC | Notes |
|---|---|
| `default/paperless-nfs` | Scanned documents. NFS-backed — confirm whether the NAS covers it before adding a second copy |
| `default/billionmail-vmail` | Mail store. Also `-ssl`, `-rspamd` |
| `default/open-webui` | Chat history |
| `default/data-mosquitto-0` | MQTT persistence |
| `dev/harbor-registry` | Images. Rebuildable, so lower than the rest |
| `dev/gitea-shared-storage` | `dev/gitea` itself is backed up; this volume is not |
| `observability/grafana-pvc` | Dashboards are in git (`grafanadashboards.yaml`); only ad-hoc state is at risk |

Deliberately excluded: `volsync-src-*-cache` (VolSync's own cache), `*-cache`
app caches, runner work dirs, `postgres16-*` (barman to S3 via
`scheduledbackup.yaml`), and `redis-*` (cache).

**No probe, lower stakes.** `default/mosquitto`, `default/notifier`,
`default/kometa`, `default/recyclarr`, `network/nebula-sync`,
`network/cloudflare-tunnel`, `observability/uptimerobot-heartbeat`. All covered
by generic pod alerts; none has an availability or liveness signal of its own.

**Not gaps, despite looking like one.** `network/envoy-gateway` has routes but no
check of its own — every app check runs through it, so it is covered
transitively. `flux-system/flux-instance` is probed as `github-webhook`, not as
`flux-instance`. Most `kube-system` components have a ServiceMonitor and are
covered by `defaultRules`.

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

**Location in Repository**: `kubernetes/apps/observability/grafana/instance/grafanadashboards.yaml:213-225`

**Accessing the Dashboard**:
1. Navigate to https://grafana.g-eye.io
2. Search for "Kubernetes Volumes" or browse to the dashboard directly
3. Select namespace and PVC to view detailed metrics
