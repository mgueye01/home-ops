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
  - [Network Topology](#network-topology)
  - [IP Address Allocation](#ip-address-allocation)
  - [Domains & DNS](#domains--dns)
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

### Network Topology

```mermaid
graph TB
    classDef internet fill:#e74c3c,stroke:#c0392b,color:#fff,stroke-width:2px
    classDef cloudflare fill:#f39c12,stroke:#e67e22,color:#fff,stroke-width:2px
    classDef router fill:#2980b9,stroke:#1a5276,color:#fff,stroke-width:2px
    classDef infra fill:#8e44ad,stroke:#6c3483,color:#fff,stroke-width:2px
    classDef node fill:#27ae60,stroke:#1e8449,color:#fff,stroke-width:2px
    classDef storage fill:#d35400,stroke:#a04000,color:#fff,stroke-width:2px
    classDef iot fill:#16a085,stroke:#0e6655,color:#fff,stroke-width:2px
    classDef service fill:#2c3e50,stroke:#1a252f,color:#fff,stroke-width:2px
    classDef gateway fill:#e67e22,stroke:#d35400,color:#fff,stroke-width:2px
    classDef dns fill:#1abc9c,stroke:#148f77,color:#fff,stroke-width:2px
    classDef power fill:#e74c3c,stroke:#c0392b,color:#fff,stroke-width:1px

    INTERNET((Internet)):::internet
    CF[/"Cloudflare Tunnel<br/>QUIC + Post-Quantum<br/>*.g-eye.io"/]:::cloudflare

    INTERNET <-->|HTTPS| CF

    subgraph NETWORK_CORE["Network Core - 192.168.0.0/16"]
        direction TB
        UDM["UniFi Dream Machine SE<br/>192.168.0.1<br/>Router / Firewall / WiFi<br/>BGP ASN 64513"]:::router
    end

    CF <-->|"Cloudflare Tunnel<br/>(no port forward)"| UDM

    subgraph MGMT_NET["Management & IoT - 192.168.0.x"]
        direction LR

        subgraph DNS_BLOCK["DNS / Ad Blocking"]
            PIHOLE1["Pi-hole 1<br/>192.168.0.197<br/>Primary DNS"]:::dns
            PIHOLE2["Pi-hole 2<br/>192.168.0.214<br/>Secondary DNS"]:::dns
        end

        subgraph KVM_BLOCK["Remote KVM"]
            PIKVM["PiKVM<br/>pikvm.g-eye.tech<br/>KVM over IP"]:::infra
            JETKVM["JetKVM<br/>192.168.0.165<br/>KVM over IP"]:::infra
        end

        subgraph IOT_BLOCK["IoT & Sensors"]
            ZIGBEE["Zigbee Controller<br/>zigbee-controller.g-eye.tech<br/>Zigbee Coordinator"]:::iot
            ENVIRO["Enviro Sensor<br/>enviro.g-eye.tech:8000<br/>Temp/Humidity/Air Quality"]:::iot
        end
    end

    UDM --- PIHOLE1 & PIHOLE2
    UDM --- PIKVM & JETKVM
    UDM --- ZIGBEE & ENVIRO

    subgraph POWER_NET["Power & Infrastructure - 192.168.1.x"]
        direction LR
        UPS["APC UPS<br/>192.168.1.80<br/>SNMP Monitored"]:::power
        DELL["Dell Device<br/>192.168.1.82<br/>SNMP Monitored"]:::power
    end

    UDM --- UPS & DELL

    subgraph K8S_NET["Kubernetes Network - 192.168.10.0/24 - MTU 9000"]
        direction TB

        subgraph LB_BLOCK["K8s API Load Balancers (Active/Standby)"]
            direction LR
            HAPROXY1["HAProxy 1<br/>192.168.10.2"]:::infra
            K8S_VIP["VIP<br/>192.168.10.250:6443"]:::service
            HAPROXY2["HAProxy 2<br/>192.168.10.3"]:::infra
            HAPROXY1 ---|VIP| K8S_VIP
            HAPROXY2 ---|VIP| K8S_VIP
        end

        subgraph NODES["Kubernetes Cluster - Talos v1.12.5 / K8s v1.35.2"]
            direction LR
            K8S1["k8s-1<br/>192.168.10.11<br/>Intel NUC 12<br/>Control Plane<br/>enp100s0 2.5GbE"]:::node
            K8S2["k8s-2<br/>192.168.10.12<br/>Intel NUC 12<br/>Control Plane<br/>enp86s0 2.5GbE"]:::node
            K8S3["k8s-3<br/>192.168.10.13<br/>Intel NUC 12<br/>Control Plane<br/>enp100s0 2.5GbE"]:::node
        end

        NAS["Synology NAS<br/>192.168.0.18 / nas.g-eye.tech<br/>DSM :5377 · S3/Garage :3900<br/>NFS :2049 · NZBGet :6789"]:::storage

        subgraph GW_BLOCK["Cilium Gateways"]
            direction LR
            GW_INT["Internal Gateway<br/>192.168.10.50<br/>internal.g-eye.io"]:::gateway
            GW_EXT["External Gateway<br/>192.168.10.60<br/>external.g-eye.io"]:::gateway
        end

        subgraph LB_SVC["Service LoadBalancers"]
            direction LR
            LB_PLEX["Plex<br/>192.168.10.68:32400"]:::service
            LB_MQTT["Mosquitto MQTT<br/>192.168.10.72:1883"]:::service
            LB_MAIL["Billionmail<br/>192.168.10.75<br/>SMTP/IMAP"]:::service
            LB_PG["PostgreSQL<br/>192.168.10.76"]:::service
        end
    end

    UDM ---|"2.5GbE"| K8S_NET
    UDM <-->|"BGP ASN 64514<br/>LB IP Advertisements"| K8S1 & K8S2 & K8S3
    K8S_VIP -->|":6443"| K8S1 & K8S2 & K8S3
    K8S1 & K8S2 & K8S3 --- NAS

    subgraph TB4_MESH["Thunderbolt 4 Full Mesh - 10.0.100.0/24 - MTU 65520 - 15.8 Gbps"]
        direction LR
        TB4_1["k8s-1<br/>10.0.100.1 ↔ k8s-2<br/>10.0.100.3 ↔ k8s-3"]:::node
        TB4_2["k8s-2<br/>10.0.100.2 ↔ k8s-1<br/>10.0.100.5 ↔ k8s-3"]:::node
        TB4_3["k8s-3<br/>10.0.100.4 ↔ k8s-1<br/>10.0.100.6 ↔ k8s-2"]:::node
        TB4_1 <-->|"Cable 1"| TB4_2
        TB4_1 <-->|"Cable 2"| TB4_3
        TB4_2 <-->|"Cable 3"| TB4_3
    end

    K8S1 -.-|"TB4"| TB4_1
    K8S2 -.-|"TB4"| TB4_2
    K8S3 -.-|"TB4"| TB4_3
```

### IP Address Allocation

```mermaid
graph LR
    classDef subnet fill:#34495e,stroke:#2c3e50,color:#fff,stroke-width:2px
    classDef ip fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef reserved fill:#e74c3c,stroke:#c0392b,color:#fff
    classDef vip fill:#f39c12,stroke:#e67e22,color:#fff

    subgraph S0["192.168.0.x — Management"]
        direction TB
        A1["0.1 — UniFi UDM SE (Router)"]:::ip
        A2["0.18 — Synology NAS"]:::ip
        A3["0.165 — JetKVM"]:::ip
        A4["0.197 — Pi-hole 1"]:::ip
        A5["0.214 — Pi-hole 2"]:::ip
    end

    subgraph S1["192.168.1.x — Power/SNMP"]
        direction TB
        B1["1.80 — APC UPS"]:::ip
        B2["1.82 — Dell Device"]:::ip
    end

    subgraph S10["192.168.10.x — Kubernetes"]
        direction TB
        C0["10.1 — UniFi (BGP Peer)"]:::ip
        C1["10.2 — HAProxy 1 (K8s API LB)"]:::ip
        C2["10.3 — HAProxy 2 (K8s API LB)"]:::ip
        C3["10.11 — k8s-1"]:::ip
        C4["10.12 — k8s-2"]:::ip
        C5["10.13 — k8s-3"]:::ip
        C6["10.50 — Internal Gateway"]:::vip
        C7["10.60 — External Gateway"]:::vip
        C8["10.68 — Plex LB"]:::vip
        C9["10.72 — Mosquitto LB"]:::vip
        C10["10.75 — Billionmail LB"]:::vip
        C11["10.76 — PostgreSQL LB"]:::vip
        C12["10.250 — K8s API VIP (HAProxy 1+2)"]:::reserved
    end

    subgraph STB["10.0.100.x — Thunderbolt 4"]
        direction TB
        D1["100.1 — k8s-1 ↔ k8s-2"]:::ip
        D2["100.2 — k8s-2 ↔ k8s-1"]:::ip
        D3["100.3 — k8s-1 ↔ k8s-3"]:::ip
        D4["100.4 — k8s-3 ↔ k8s-1"]:::ip
        D5["100.5 — k8s-2 ↔ k8s-3"]:::ip
        D6["100.6 — k8s-3 ↔ k8s-2"]:::ip
    end
```

### Network Summary

| Network | Subnet | MTU | Purpose |
|---------|--------|-----|---------|
| Management | 192.168.0.0/24 | 1500 | DNS, KVM, IoT, NAS |
| Power/SNMP | 192.168.1.0/24 | 1500 | UPS, infrastructure monitoring |
| Kubernetes | 192.168.10.0/24 | 9000 | K8s nodes, API, services, Ceph public |
| Thunderbolt 4 | 10.0.100.0/24 | 65520 | Ceph OSD replication (15.8 Gbps) |
| Pod CIDR | 10.42.0.0/16 | — | Kubernetes pod network |
| Service CIDR | 10.43.0.0/16 | — | Kubernetes service network |

### Domains & DNS

| Domain | Provider | Purpose |
|--------|----------|---------|
| `*.g-eye.io` | Cloudflare (external) + UniFi (internal) | All Kubernetes services (60+ subdomains) |
| `*.g-eye.tech` | Manual/static | Non-K8s infrastructure (NAS, Pi-hole, PiKVM, UniFi, Enviro, Zigbee) |

### External Ingress
- **Cloudflare Tunnel** (QUIC, post-quantum) provides secure ingress without exposing ports
- **Cilium Gateway API** with internal (192.168.10.50) and external (192.168.10.60) gateways
- **BGP** between Cilium (ASN 64514) and UniFi (ASN 64513) for LoadBalancer IP advertisements

> Full network documentation with service maps: [`docs/network-map.md`](docs/network-map.md)

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

- [`docs/network-map.md`](docs/network-map.md) - Full network cartography with service maps and DNS inventory
- [`docs/volsync-migration-guide.md`](docs/volsync-migration-guide.md) - Cluster migration with zero data loss (2,150+ lines)
- [`docs/monitoring.md`](docs/monitoring.md) - Monitoring and dashboard setup
- [`docs/runbooks/storage-full.md`](docs/runbooks/storage-full.md) - Storage full remediation
- [Flux Documentation](https://fluxcd.io/docs/)
- [Talos Linux Documentation](https://www.talos.dev/latest/)
- [Rook-Ceph Documentation](https://rook.io/docs/rook/latest/)
- [Volsync Documentation](https://volsync.readthedocs.io/)
