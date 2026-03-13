<div align="center">

<img src="https://github.com/mgueye01/home-ops/blob/main/_assets/images/logo.png?raw=true" width="144px" height="144px"/>

## My Home Operations repository

_... managed by Flux, Renovate and GitHub Actions_ :robot:

<div align="center">

[![Home-Internet](https://img.shields.io/uptimerobot/status/m793494864-dfc695db066960233ac70f45?color=brightgreeen&label=Home%20Internet&style=for-the-badge&logo=v&logoColor=white)](https://status.g-eye.io)&nbsp;&nbsp;
[![Status-Page](https://img.shields.io/uptimerobot/status/m793599155-ba1b18e51c9f8653acd0f5c1?color=brightgreeen&label=Status%20Page&style=for-the-badge&logo=statuspage&logoColor=white)](https://status.g-eye.io)&nbsp;&nbsp;
[![Alertmanager](https://img.shields.io/uptimerobot/status/m793494864-dfc695db066960233ac70f45?color=brightgreeen&label=Alertmanager&style=for-the-badge&logo=prometheus&logoColor=white)](https://status.g-eye.io)

</div>

</div>

<div align="center">

[![Talos](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dtalos_version&style=flat-square&label=Talos)](https://github.com/kashalls/kromgo)
[![Kubernetes](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dkubernetes_version&style=flat-square&label=Kubernetes)](https://github.com/kashalls/kromgo)
[![Flux](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dflux_version&style=flat-square&label=Flux)](https://github.com/kashalls/kromgo)
[![GitHub last commit](https://img.shields.io/github/last-commit/mgueye01/home-ops?style=flat-square)](https://github.com/mgueye01/home-ops/commits/main)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white&style=for-the-badge?style=flat-square)](https://github.com/pre-commit/pre-commit)
[![Renovate](https://img.shields.io/github/actions/workflow/status/mgueye01/home-ops/renovate.yaml?branch=main&label=&logo=renovatebot&style=for-the-badge?style=flat-square&color=brightgreen)](https://github.com/mgueye01/home-ops/actions/workflows/renovate.yaml)
<!-- [![renovate](https://img.shields.io/badge/renovate-enabled-brightgreen?style=flat-square&logo=renovatebot&logoColor=white)](https://github.com/renovatebot/renovate) -->

</div>

<div align="center">

Main k8s cluster stats:

[![Age-Days](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_age_days&style=flat-square&label=Age)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![Uptime-Days](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_uptime_days&style=flat-square&label=Uptime)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![Node-Count](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_node_count&style=flat-square&label=Nodes)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![Pod-Count](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_pod_count&style=flat-square&label=Pods)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![CPU-Usage](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_cpu_usage&style=flat-square&label=CPU)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![Memory-Usage](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_memory_usage&style=flat-square&label=Memory)](https://github.com/kashalls/kromgo)&nbsp;&nbsp;
[![Alerts](https://img.shields.io/endpoint?url=https%3A%2F%2Fkromgo.g-eye.io%2Fquery%3Fformat%3Dendpoint%26metric%3Dcluster_alert_count&style=flat-square&label=Alerts)](https://github.com/kashalls/kromgo)

---

</div>

A GitOps-managed Kubernetes home lab running production-grade infrastructure for home automation, media services, and personal applications on a 3-node Intel NUC cluster.

## Table of Contents

- [Architecture](#architecture)
- [Hardware](#hardware)
- [Networking](#networking)
- [Storage](#storage)
- [Directory Structure](#directory-structure)
- [Applications](#applications)
- [GitOps Workflow](#gitops-workflow)
- [Secrets Management](#secrets-management)
- [Observability](#observability)
- [Build System](#build-system)
- [Conventions](#conventions)
- [Further Reading](#further-reading)

## Architecture

| Layer | Technology |
|-------|-----------|
| OS | Talos Linux v1.12.x |
| Kubernetes | v1.35.x |
| CNI | Cilium (Direct Routing, kube-proxy replacement) |
| GitOps | Flux CD v2 |
| Storage | Rook-Ceph, OpenEBS, NFS CSI |
| Databases | CloudNative-PG (PostgreSQL), Redis |
| Secrets | SOPS + age encryption, 1Password via External Secrets |
| Certificates | cert-manager |
| Backups | Volsync + Kopia (hourly snapshots, 7-day retention) |
| Monitoring | Prometheus, Grafana, Victoria Logs, Fluent-Bit |
| Dependency Updates | Renovate |
| CI/CD | GitHub Actions (self-hosted runners) |
| Build System | Just |

All three nodes serve as control-plane members with workload scheduling enabled (`allowSchedulingOnControlPlanes: true`), forming a fully converged cluster with no dedicated workers.

## Hardware

**3x Intel NUC 12 (Wall Street Canyon)**

| Node | Role | Storage | Network |
|------|------|---------|---------|
| k8s-1 | Control-plane + worker | Crucial CT480BX500SSD1 | 2.5GbE + Thunderbolt 4 |
| k8s-2 | Control-plane + worker | Crucial CT480BX500SSD1 | 2.5GbE + Thunderbolt 4 |
| k8s-3 | Control-plane + worker | Crucial CT480BX500SSD1 | 2.5GbE + Thunderbolt 4 |

All nodes include Intel iGPU (Meteor Lake) with hardware acceleration support via the Intel Device Plugin Operator.

## Networking

The cluster uses a dual-network architecture:

### Primary Network (2.5GbE) - 192.168.10.0/24
- MTU 9000 (jumbo frames)
- Carries all Kubernetes traffic via Cilium Direct Routing
- Ceph public network (client I/O)
- etcd communication
- Kubernetes API VIP: 192.168.10.250

### Thunderbolt 4 Mesh - 10.0.100.0/24
- MTU 65520
- Full mesh topology: every node directly connected to every other node
- Dedicated to Ceph cluster network (OSD replication)
- Measured throughput: 15.8 Gbps (6.4x over 2.5GbE)
- Measured latency: ~0.35ms (2x improvement over 2.5GbE)

Cilium operates on `enp+` interfaces only and does not manage the Thunderbolt links. The TB4 mesh is exclusively used by Ceph for inter-OSD replication traffic.

### External Ingress
- **Cloudflare Tunnel** provides secure ingress without exposing ports
- **Cloudflare DNS** for external name resolution
- Domain: `g-eye.io`

## Storage

| System | Purpose |
|--------|---------|
| Rook-Ceph | Distributed block/object storage across all nodes |
| OpenEBS | Alternative local storage provisioner |
| NFS CSI | Network-attached storage for bulk data |
| Volsync + Kopia | PVC backup and cross-cluster migration |

**Backup stats**: 23 applications backed up, 350+ Gi protected, hourly snapshots with 7-day retention. RPO: 1 hour, RTO: minutes to hours.

Volsync components are reusable across applications via Kustomize templates in `kubernetes/components/volsync/`.

## Directory Structure

```
home-ops/
├── talos/                         # Talos Linux node configuration
│   ├── machineconfig.yaml.j2      #   Shared machine config (Jinja2 template)
│   ├── nodes/                     #   Per-node patches (k8s-1, k8s-2, k8s-3)
│   │   └── *.yaml.j2
│   ├── schematic.yaml             #   Extensions and kernel arguments
│   └── mod.just                   #   Talos-specific just commands
│
├── kubernetes/                    # All Kubernetes manifests
│   ├── apps/                      #   Application deployments by namespace
│   │   ├── default/               #     User-facing apps (~35 applications)
│   │   ├── databases/             #     PostgreSQL, Redis
│   │   ├── observability/         #     Monitoring and logging stack
│   │   ├── network/               #     Cloudflare, DNS, tunnels
│   │   ├── kube-system/           #     Core cluster services
│   │   ├── security/              #     cert-manager, etc.
│   │   ├── dev/                   #     Development tools
│   │   ├── rook-ceph/             #     Ceph storage cluster
│   │   ├── flux-system/           #     Flux CD itself
│   │   └── volsync-system/        #     Backup orchestration
│   ├── components/                #   Reusable Kustomize components
│   │   ├── common/                #     Shared patches
│   │   ├── volsync/               #     Backup templates (PVC, etc.)
│   │   └── keda/                  #     Autoscaling configs
│   └── flux/                      #   Flux GitOps configuration
│       └── mod.just               #   Kubernetes just commands
│
├── bootstrap/                     # Cluster bootstrapping
│   ├── helmfile.d/                #   Declarative Helm releases for initial setup
│   └── resources.yaml.j2          #   Bootstrap resource template
│
├── docs/                          # Extended documentation
│   ├── README.md                  #   Documentation index
│   ├── volsync-migration-guide.md #   Cluster migration (2,150+ lines)
│   ├── monitoring.md              #   Monitoring setup
│   └── runbooks/                  #   Operational runbooks
│
├── openclaw-custom/               # Custom Docker image with Git integration
├── .justfile                      # Main build system entrypoint
├── .renovaterc.json5              # Automated dependency update config
├── .sops.yaml                     # Secrets encryption configuration
└── .pre-commit-config.yaml        # Git hooks (shellcheck, etc.)
```

### Application Layout Pattern

Each application follows a consistent structure:

```
kubernetes/apps/<namespace>/<app-name>/
├── ks.yaml                # Flux Kustomization resource
└── app/
    ├── kustomization.yaml # Kustomize config (resources, generators)
    ├── helmrelease.yaml   # Helm chart configuration
    ├── ocirepository.yaml # OCI Helm chart source (or helmrepository.yaml)
    └── pvc.yaml           # Persistent volume claim (if stateful)
```

Namespace-level `kustomization.yaml` files aggregate all apps in that namespace. Applications can be enabled/disabled by commenting entries in these files.

## Applications

### Media & Entertainment
Plex, Radarr, Sonarr, Bazarr, Prowlarr, SABnzbd, Jellyseerr, Tautulli, Beets, Kometa, RecyclArr, Recommendarr

### Home Automation
Home Assistant, Mosquitto (MQTT broker)

### Productivity & Content
Nextcloud (files/contacts/calendar), Paperless + Paperless-AI (document management), Blog, Atuin (shell history sync)

### Workflow Automation
N8N (visual workflow automation), OpenClaw

### CRM & Business
LeLabo CRM, Twenty (CRM/ERP), Fusion

### Utilities
Homepage (dashboard), Changedetection (website monitoring), Shlink (URL shortener), LittleLinks, Open-WebUI (LLM interface), Notifier, Rybbit

### Databases
CloudNative-PG (PostgreSQL operator), PGAdmin, Redis (general + dedicated LeLabo instance)

### Observability
Prometheus + kube-prometheus-stack, Grafana, Victoria Logs, Fluent-Bit, Karma, Gatus, SmartCTL Exporter, SNMP Exporter, Blackbox Exporter, Unpoller, Teslamate, Kromgo, KEDA, Silence Operator, UptimeRobot

### Network
Cloudflare DNS, Cloudflare Tunnel, Unifi DNS, Echo

### System
cert-manager, CSI NFS Driver, Intel Device Plugin Operator, Metrics Server, Reloader, Snapshot Controller, Actions Runner System, Volsync, Flux

## GitOps Workflow

All cluster state is declared in this repository and reconciled by **Flux CD**.

### How Changes Are Applied

1. Push a commit to the `main` branch
2. Flux detects the change via its `GitRepository` source (polled or webhook-triggered)
3. Flux reconciles `Kustomization` resources, applying manifests to the cluster
4. Helm charts are deployed via `HelmRelease` resources referencing OCI or Helm repositories

### Flux Configuration

- **Reconciliation interval**: 1 hour (with 2-minute retry on failure)
- **Timeout**: 5 minutes
- **Decryption**: SOPS with age keys for encrypted secrets
- **Dependency ordering**: Child Kustomizations inherit SOPS decryption from the root

### Dependency Updates

**Renovate** automatically opens PRs for:
- Helm chart version bumps
- Container image tag updates
- GitHub Actions version updates
- Kubernetes manifest references

Configuration: `.renovaterc.json5` (semantic commits, Europe/Paris timezone, auto-merge capable)

## Secrets Management

Secrets follow a layered approach:

1. **SOPS + age**: Encrypts Kubernetes secrets in-repo (`.sops.yaml` defines encryption rules)
2. **External Secrets Operator**: Pulls secrets from 1Password at runtime using `op://` references
3. **Jinja2 templates**: Talos configs use `op inject` to resolve 1Password references during rendering

Secrets are never stored in plaintext in the repository.

## Observability

### Monitoring
- **Metrics**: Prometheus via kube-prometheus-stack, with specialized exporters (SmartCTL, SNMP, Blackbox, Unpoller)
- **Dashboards**: Grafana with pre-configured dashboards (e.g., K8s Volumes dashboard ID 11454)
- **Autoscaling**: KEDA for event-driven pod autoscaling

### Logging
- **Collection**: Fluent-Bit aggregates container and node logs
- **Storage**: Victoria Logs for centralized log querying
- **Application rules**: Loki monitoring rules generated via ConfigMap generators per application

### Alerting & Status
- **Alertmanager** with Karma UI for alert management
- **Silence Operator** for programmatic alert silencing
- **Gatus** for endpoint health monitoring
- **UptimeRobot** for external status page (status.g-eye.io)

## Build System

The repository uses [Just](https://github.com/casey/just) as its task runner, organized into modules:

| Module | File | Purpose |
|--------|------|---------|
| Main | `.justfile` | Entrypoint, imports modules |
| Talos | `talos/mod.just` | Node config rendering and application |
| Kubernetes | `kubernetes/flux/mod.just` | Flux sync, PVC browsing, pod management |
| Bootstrap | `bootstrap/` | Initial cluster setup with Helmfile |

### Key Commands

```bash
# Talos node management
just talos render-config <node>    # Render node config (requires 1Password)
just talos apply-node <node>      # Render + apply via talosctl

# Flux operations
just flux sync                    # Sync all Flux resources
just flux reconcile <resource>    # Force reconcile a specific resource

# Cluster utilities
just kubernetes browse-pvc        # Browse PVC contents
just kubernetes node-shell        # Open shell on a node
```

## Conventions

### Git
- **Branch**: `main` is production; all changes go directly to main
- **Commit style**: Conventional commits - `feat(scope)`, `fix(scope)`, `chore(scope)`
- **No co-authoring** on commits

### Kubernetes Manifests
- Applications are organized by namespace under `kubernetes/apps/`
- Each app has a `ks.yaml` (Flux Kustomization) and an `app/` directory for resources
- Reusable patterns live in `kubernetes/components/`
- Name suffix hashing is disabled in Kustomize configs
- Flux substitutions are disabled per-app to maintain predictable resource names

### Talos Configuration
- Shared config in `talos/machineconfig.yaml.j2`, per-node overrides in `talos/nodes/`
- Jinja2 templates with 1Password injection via `op inject`
- Node labels include GPU capability and topology zone information

### Application Patterns
- Stateful apps use Volsync for backup via reusable PVC components
- Helm charts are sourced from OCI registries where possible
- External Secrets pull credentials from 1Password
- Loki monitoring rules are generated per-app via ConfigMap generators

## Further Reading

- [`docs/volsync-migration-guide.md`](docs/volsync-migration-guide.md) - Cluster migration with zero data loss (2,150+ lines)
- [`docs/monitoring.md`](docs/monitoring.md) - Monitoring and dashboard setup
- [`docs/runbooks/storage-full.md`](docs/runbooks/storage-full.md) - Storage full remediation
- [Flux Documentation](https://fluxcd.io/docs/)
- [Talos Linux Documentation](https://www.talos.dev/latest/)
- [Rook-Ceph Documentation](https://rook.io/docs/rook/latest/)
- [Volsync Documentation](https://volsync.readthedocs.io/)
