# Network Map - G-Eye Homelab

## Network Topology

```mermaid
graph TB
    %% ============================================
    %% STYLES
    %% ============================================
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
    classDef monitoring fill:#9b59b6,stroke:#7d3c98,color:#fff,stroke-width:2px
    classDef power fill:#e74c3c,stroke:#c0392b,color:#fff,stroke-width:1px

    %% ============================================
    %% INTERNET & CLOUDFLARE
    %% ============================================
    INTERNET((Internet)):::internet
    CF[/"Cloudflare Tunnel<br/>QUIC + Post-Quantum<br/>*.g-eye.io"/]:::cloudflare

    INTERNET <-->|HTTPS| CF

    %% ============================================
    %% MAIN ROUTER
    %% ============================================
    subgraph NETWORK_CORE["Network Core - 192.168.0.0/16"]
        direction TB
        UDM["UniFi Dream Machine SE<br/>192.168.0.1<br/>Router / Firewall / WiFi<br/>BGP ASN 64513"]:::router
    end

    CF <-->|"Cloudflare Tunnel<br/>(no port forward)"| UDM

    %% ============================================
    %% SUBNET 192.168.0.x - MANAGEMENT & IOT
    %% ============================================
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

    %% ============================================
    %% SUBNET 192.168.1.x - POWER & INFRA
    %% ============================================
    subgraph POWER_NET["Power & Infrastructure - 192.168.1.x"]
        direction LR
        UPS["APC UPS<br/>192.168.1.80<br/>SNMP Monitored"]:::power
        DELL["Dell Device<br/>192.168.1.82<br/>SNMP Monitored"]:::power
    end

    UDM --- UPS & DELL

    %% ============================================
    %% SUBNET 192.168.10.x - KUBERNETES & SERVICES
    %% ============================================
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

    %% ============================================
    %% THUNDERBOLT 4 MESH - 10.0.100.x
    %% ============================================
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

## Kubernetes Internal Networks

```mermaid
graph TB
    classDef pod fill:#3498db,stroke:#2471a3,color:#fff
    classDef svc fill:#e67e22,stroke:#d35400,color:#fff
    classDef ns fill:#2c3e50,stroke:#1a252f,color:#fff,stroke-width:2px
    classDef ceph fill:#e74c3c,stroke:#c0392b,color:#fff

    subgraph K8S_INTERNAL["Kubernetes Overlay Networks"]
        direction TB

        subgraph POD_NET["Pod Network - 10.42.0.0/16"]
            direction LR
            POD1["Pods on k8s-1<br/>10.42.0.x"]:::pod
            POD2["Pods on k8s-2<br/>10.42.1.x"]:::pod
            POD3["Pods on k8s-3<br/>10.42.2.x"]:::pod
        end

        subgraph SVC_NET["Service Network - 10.43.0.0/16"]
            direction LR
            COREDNS["CoreDNS<br/>10.43.0.10<br/>→ 192.168.0.1"]:::svc
            CILIUM["Cilium CNI<br/>Native Routing · BPF netkit<br/>DSR · Maglev · Gateway API"]:::svc
        end

        subgraph CEPH_NET["Ceph Storage"]
            direction LR
            CEPH_PUB["Public Network<br/>192.168.10.0/24<br/>Client I/O"]:::ceph
            CEPH_CLUSTER["Cluster Network<br/>10.0.100.0/24 (TB4)<br/>OSD Replication"]:::ceph
        end
    end
```

## Services & Applications Map

```mermaid
graph LR
    classDef external fill:#e74c3c,stroke:#c0392b,color:#fff
    classDef internal fill:#2980b9,stroke:#1a5276,color:#fff
    classDef both fill:#8e44ad,stroke:#6c3483,color:#fff

    subgraph EXT["External Access (via Cloudflare)"]
        direction TB
        AUTH["auth.g-eye.io<br/>Authelia SSO"]:::external
        TWENTY_E["twenty.g-eye.io<br/>Twenty CRM"]:::external
        LELABO["lelabo-crm.g-eye.io<br/>LeLabo CRM"]:::external
        PLEX_E["plex.g-eye.io<br/>Plex"]:::external
        PAPERLESS_E["paperless.g-eye.io<br/>Paperless-ngx"]:::external
        ANALYTICS["analytics.g-eye.io<br/>Rybbit"]:::external
        STATUS["status.g-eye.io<br/>Gatus"]:::external
        ME["me.g-eye.io<br/>Littlelinks"]:::external
        LN["ln.g-eye.io<br/>Shlink"]:::external
        MAIL_E["mail.g-eye.io<br/>Billionmail"]:::external
        CHANGE["change.g-eye.io<br/>Changedetection"]:::external
        CHATGPT["chatgpt.g-eye.io<br/>Open WebUI"]:::external
    end

    subgraph INT["Internal Access Only"]
        direction TB

        subgraph MEDIA["Media Stack"]
            SONARR["sonarr"]:::internal
            RADARR["radarr"]:::internal
            BAZARR["bazarr"]:::internal
            PROWLARR["prowlarr"]:::internal
            SAB["sabnzbd"]:::internal
            TAUTULLI["tautulli"]:::internal
            RECOMMEND["recommendarr"]:::internal
            REQUESTS["requests (Jellyseerr)"]:::internal
        end

        subgraph OBS["Observability"]
            GRAFANA["grafana"]:::internal
            PROM["prometheus"]:::internal
            ALERT["alertmanager"]:::internal
            KARMA_S["karma"]:::internal
            TESLA["teslamate"]:::internal
            VLOGS["victoria-logs"]:::internal
        end

        subgraph INFRA_S["Infrastructure"]
            ROOK["rook (Ceph)"]:::internal
            PGADMIN["pgadmin"]:::internal
            GARAGE["garage-webui"]:::internal
            KOPIA_S["kopia"]:::internal
            LLDAP_S["lldap"]:::internal
            HOMEPAGE["homepage"]:::internal
        end

        subgraph DEV["Development"]
            GITEA_S["gitea"]:::internal
            HARBOR_S["harbor"]:::internal
            N8N_S["n8n"]:::internal
            TWENTY_MCP["twenty-mcp"]:::internal
            FLUX["flux-webhook"]:::internal
        end

        subgraph SMART["Smart Home"]
            HASS["Home Assistant"]:::internal
            MQTT_S["Mosquitto MQTT"]:::internal
        end
    end
```

## IP Address Allocation

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

## Domains & DNS

| Domain | Provider | Purpose |
|--------|----------|---------|
| `*.g-eye.io` | Cloudflare (external) + UniFi (internal) | All Kubernetes services |
| `*.g-eye.tech` | Manual/static | Non-K8s infrastructure devices |

### g-eye.tech Hostnames

| Hostname | Target | Device |
|----------|--------|--------|
| `nas.g-eye.tech` | 192.168.0.18 | Synology NAS |
| `pi-hole.g-eye.tech` | 192.168.0.197 | Pi-hole 1 |
| `pikvm.g-eye.tech` | PiKVM | KVM over IP |
| `unifi.g-eye.tech` | 192.168.0.1 | UniFi UDM SE |
| `enviro.g-eye.tech` | Enviro sensor | Environmental sensor |
| `zigbee-controller.g-eye.tech` | Zigbee coordinator | Smart home gateway |

### Key g-eye.io Subdomains (60+)

| Category | Subdomains |
|----------|-----------|
| **Business** | twenty, lelabo-crm, analytics, ln, me |
| **Media** | plex, sonarr, radarr, bazarr, prowlarr, sabnzbd, tautulli, requests, recommendarr |
| **Productivity** | paperless, paperless-ai, paperless-gpt, n8n, karakeep, chatgpt, feeds, change |
| **Observability** | grafana, prometheus, alertmanager, karma, status, teslamate, victoria-logs |
| **Infrastructure** | rook, pgadmin, garage-webui, kopia, auth, lldap, sh, mail |
| **Development** | gitea, harbor, twenty-mcp, flux-webhook |
| **Network** | internal, external, echo, kromgo, homepage |
| **Smart Home** | hass (Home Assistant) |
