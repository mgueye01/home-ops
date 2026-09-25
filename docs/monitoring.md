# Monitoring

## Coverage

Counts refreshed 2026-09-25 against the live cluster. Each is reproducible — run
the command before trusting the number, this table goes stale on its own.

| What | Count | How to reproduce |
|---|---|---|
| Flux Kustomizations | 100 | `kubectl get kustomizations -A` |
| Namespaces under `kubernetes/apps` | 16 | `ls kubernetes/apps` |
| Gatus endpoints | 51 | `count(gatus_results_endpoint_success)` |
| Alerting rules | 302 | `/api/v1/rules?type=alert` |
| VolSync ReplicationSources | 21 | `kubectl get replicationsources -A` |

Count Kustomizations with `kubectl`, not with `grep`: 98 come from an app
`ks.yaml`, plus `flux-system/cluster-apps` and `flux-system/flux-system`, which
bootstrap the rest and are not in any app directory. The first revision of this
file said 87 from a repo-side grep, which was simply wrong.

The Gatus and ReplicationSource counts both moved on 2026-09-25 and neither
movement was drift: +3 endpoints (`postgres-lb`, `garage-s3`, `garage-health`)
and −4 ReplicationSources (`atuin`, `lelabo-crm`, `twenty`, `teslamate` — PVCs
no app ever wrote to, dropped in `404bc28e`).

### How each layer gets wired

Three layers, and only one of them is opt-in per app.

**Availability — Gatus.** `gatus-sidecar` runs with `--auto-httproute`, so *every*
HTTPRoute in the cluster becomes an endpoint with no annotation needed. Adding
`gatus.home-operations.com/endpoint` to a route only overrides the generated
check — it is not what turns it on. Two idioms are in use:

- `conditions: ["[STATUS] == 200"]` — plain availability.
- `conditions: ["len([BODY]) == 0"]` with `dns.query-name` and `url: 1.1.1.1` —
  asserts an internal hostname does **not** resolve publicly. Failure means
  exposure, not downtime. 26 of the 51 endpoints are this kind.

Apps with no HTTPRoute get no check from `--auto-httproute`. Two ways to add one,
in order of preference:

1. **Annotate a Service the repo owns.** The sidecar also runs `--enable-service`,
   which *does* require `gatus.home-operations.com/enabled: "true"` — unlike the
   HTTPRoute path, this one is opt-in. See
   `kubernetes/apps/databases/cloudnative-pg/cluster/service.yaml`, the TCP check
   on postgres. A ConfigMap labelled `gatus.io/enabled` does **not** work; the
   sidecar has no ConfigMap discovery mode, and a check written that way is inert.
2. **Declare it statically** in `gatus/app/resources/config.yaml`, for targets with
   no in-cluster object to annotate at all — the DNS canaries, and `garage-s3` /
   `garage-health`, which run on the NAS outside the cluster.

So an endpoint reaches Gatus three ways, and `resource=` in the sidecar log tells
you which:

```
kubectl -n observability logs deploy/gatus -c gatus-sidecar | grep 'updated endpoint'
# resource=httproutes  -> auto, 48 of them
# resource=services    -> annotated Service, currently just postgres-lb
# (absent)             -> static config.yaml
```

`gatus.rules` (`kubernetes/apps/observability/gatus/app/prometheusrule.yaml`)
selects on the `type` label so every endpoint is covered by exactly one rule.
Verified 2026-09-25: `type!="DNS"` 25, `type="DNS", group!="public-path"` 25,
`type="DNS", group="public-path"` 1 — 51 of 51, no series counted twice, none
missed. Re-run that sum after any change to the rules or to `config.yaml`.

Select on `type`, never on `group`, and keep the rules default-on. A
sidecar-discovered endpoint has **no** `group` at all — the sidecar only learns
one from a per-resource `gatus.home-operations.com/endpoint` annotation and has
no `--default-group` flag — so a `group="..."` selector silently matches nothing
and a new app is uncovered until someone remembers to label it. Only the four
statically declared endpoints carry a group (`public-path`, `storage`), and they
are there to carve an exception *out* of a rule that already matches everything,
never to opt an endpoint in. Gating on `group` is the exact bug `cac488df` fixed:
`gatus.rules` selected `external` and `guarded`, nothing had ever set either, and
all 48 endpoints paged on nothing while the dashboard stayed green.

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

### Closed since the baseline

Every amplifying gap the baseline ranked — the ones where one failure takes a lot
down with it — now has a signal. All `health: ok` in Prometheus as of 2026-09-25,
all inactive:

| Was uncovered | Now covered by | Rule |
|---|---|---|
| `external-secrets/onepassword-connect` | `onepassword-connect.rules` | `OnePasswordConnectStoreAbsent`, `OnePasswordConnectStoreNotReady` |
| `external-secrets` refresh path | `external-secrets.rules` | `ExternalSecretsAbsent`, `ExternalSecretNotReady` |
| `kyverno/kyverno` | `kyverno.rules` | `KyvernoWebhookFailingOpen` |
| `databases` postgres connectivity | Gatus, Service-sourced | `GatusEndpointDown` |
| `garage` (S3 behind every durable store) | Gatus, static config | `GatusEndpointDown` |

The reasoning is worth keeping, because it generalises: **probe the consumer, not
the dependency.** Neither of the first two wanted a Gatus check — each is covered
by a metric something else already scrapes, read on the consumer side.

- `onepassword-connect` — the `Ready` condition on the `onepassword`
  ClusterSecretStore. ESO sets it by calling Connect, so it catches the case the
  pod probes miss: `api` and `sync` stay Ready on `/health` while the path to the
  1Password API is broken. Note `externalsecret_status_condition` carries the
  ExternalSecret's own namespace as `exported_namespace` — `namespace` is
  `external-secrets`, where the controller runs.
- `kyverno` — `apiserver_admission_webhook_fail_open_count`, from the apiserver's
  ServiceMonitor. Kyverno's own metrics have no failure dimension:
  `request_allowed="false"` means a policy correctly denied a request, not that
  the webhook broke. Its resource webhooks are `failurePolicy: Ignore`, so a
  wedge does not block deploys — it silently stops enforcing policy, which is why
  the pod alerts never catch it.

### Open gaps

**Data with no VolSync ReplicationSource.** These have a hand-written PVC and no
`components/volsync`. Re-verified 2026-09-25: all seven are still `Bound` and
none appears as a `sourcePVC` in `kubectl get replicationsources -A`. Tracked on
`ELG-13`, which is blocked on the `paperless-nfs` question below.

| PVC | Notes |
|---|---|
| `default/paperless-nfs` | Scanned documents. NFS-backed — confirm whether the NAS covers it before adding a second copy |
| `default/billionmail-vmail` | Mail store. Also `-ssl`, `-rspamd` |
| `default/open-webui` | Chat history |
| `default/data-mosquitto-0` | MQTT persistence |
| `dev/harbor-registry` | Images. Rebuildable, so lower than the rest |
| `dev/gitea-shared-storage` | `dev/gitea` itself is backed up; this volume is not |
| `observability/grafana-pvc` | Dashboards are in git (`grafanadashboards.yaml`); only ad-hoc state is at risk |

Do not close these by adding `components/volsync` in place. The component owns
the PVC and gives it a `dataSourceRef` pointing at its ReplicationDestination
(`kubernetes/components/volsync/pvc.yaml`). Adding it to an app that already has
a PVC of the same name asks Flux to mutate immutable spec fields on a bound
claim, and the Kustomization wedges — it does not fall back, and the app keeps
running unbacked while reconciliation fails. Adopting an existing volume needs a
migration (back up out of band, delete the claim, let the component recreate it),
which is per-app work and why `ELG-13` is a separate issue rather than seven
lines added here.

Deliberately excluded: `volsync-src-*-cache` (VolSync's own cache), `*-cache`
app caches, runner work dirs, `postgres16-*` (barman to S3 via
`scheduledbackup.yaml`), and `redis-*` (cache). Four more were removed on
2026-09-25 (`atuin`, `lelabo-crm`, `twenty`, `teslamate`, commit `404bc28e`):
each had a ReplicationSource against a PVC the app never wrote to, so the backups
were real, green, and empty. If you are re-adding one of these, confirm the app
actually writes to that claim first.

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

## Backup Restore Validation

VolSync/Kopia backup jobs are supplemented by a monthly restore drill. Each drill rotates through protected applications,
restores a real snapshot to a Pod-owned generic ephemeral volume, and verifies the restored content read-only with format-specific
checks. Results are recorded on Paperclip issue `ELG-6`; restore or integrity failures are escalated immediately over
Telegram as data-loss-risk findings.

- **Schedule**: monthly, on the first day at 04:00 local time
- **Runbook**: [VolSync/Kopia Restore Drill](./runbooks/volsync-kopia-restore-drill.md)
- **Coverage**: restore completion, full-file readability, SQLite integrity where present, and Git object integrity where present
