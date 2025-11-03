# Volsync: Kubernetes Cluster Migration to K0s Guide

> **Complete guide for migrating to K0s from any Kubernetes distribution without data loss using Volsync and Kopia**

## Table of Contents

- [Executive Summary](#executive-summary)
- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Migration Strategies](#migration-strategies)
- [Step-by-Step Migration Procedures](#step-by-step-migration-procedures)
- [Application-Specific Considerations](#application-specific-considerations)
- [Troubleshooting](#troubleshooting)
- [Monitoring and Validation](#monitoring-and-validation)
- [Quick Reference](#quick-reference)

---

## Executive Summary

This repository implements **Volsync v0.16.13** with **Kopia v0.21.1** for automated backup and disaster recovery of 23 Kubernetes applications totaling over 350Gi of persistent data. The system enables **zero-data-loss cluster migration** between different Kubernetes distributions while maintaining application state.

### Key Statistics

| Metric | Value |
|--------|-------|
| **Applications Backed Up** | 23 |
| **Total Data Volume** | ~350+ Gi |
| **Backup Frequency** | Hourly (0 * * * *) |
| **Retention** | 24 hourly + 7 daily snapshots |
| **Recovery Time Objective (RTO)** | Minutes to hours (size-dependent) |
| **Recovery Point Objective (RPO)** | 1 hour |
| **Supported Migrations** | To K0s from K3s, K8s, or any distribution |

### What This Enables

✅ **Migrate TO K0s from K3s, K8s, vanilla Kubernetes, or any distribution**
✅ **Zero data loss during migration**
✅ **Granular recovery (per-application or full cluster)**
✅ **Test K0s environment with production data before cutover**
✅ **Roll back to any snapshot within 7 days**

---

## Overview

### What is Volsync?

Volsync is a Kubernetes operator that asynchronously replicates persistent volumes using various backends. In this implementation, it uses:

- **Kopia**: Content-addressable backup with deduplication and encryption
- **Ceph RBD Snapshots**: Fast, space-efficient volume snapshots
- **NFS Storage**: Centralized repository accessible from multiple clusters

### How It Works

```
┌─────────────────────┐
│  Application PVC    │
│  (source cluster)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  ReplicationSource  │ ◄── Hourly schedule (0 * * * *)
│  (Volsync)          │
└──────────┬──────────┘
           │
           ├── 1. Create Ceph RBD Snapshot
           │
           ├── 2. Kopia reads from snapshot
           │
           ├── 3. Deduplicate + Compress (zstd)
           │
           ├── 4. Encrypt (AES256-GCM)
           │
           ▼
┌─────────────────────┐
│   Kopia Repository  │
│   (NFS: nas.g-eye.  │
│    tech)            │
└──────────┬──────────┘
           │
           │ [Migration to K0s cluster]
           │
           ▼
┌─────────────────────┐
│ ReplicationDest     │ ◄── Manual trigger
│ (K0s cluster)       │
└──────────┬──────────┘
           │
           ├── 1. Kopia restores from repository
           │
           ├── 2. Decompress + Decrypt
           │
           ├── 3. Create PVC from snapshot
           │
           ▼
┌─────────────────────┐
│  Application PVC    │
│  (dest cluster)     │
└─────────────────────┘
```

### Current Implementation Details

**File Locations:**
- System: `/kubernetes/apps/volsync-system/`
- Templates: `/kubernetes/components/volsync/`
- Per-app configuration: Each app's `ks.yaml` includes the volsync component

**Storage Backend:**
- **Type**: Kopia filesystem repository
- **Location**: `nas.g-eye.tech:/volume1/minio/volsynckopia`
- **Mount**: Injected via MutatingAdmissionPolicy to all backup jobs
- **Encryption**: Password-protected from OnePassword

**Backup Configuration:**
- **Schedule**: `0 * * * *` (every hour at top of hour)
- **Method**: Ceph RBD snapshot → Kopia deduplication
- **Compression**: zstd-fastest
- **Retention**: 24 hourly + 7 daily
- **Security**: AES256-GCM encryption, UID/GID 1000

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Source Cluster                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Application │  │ Application  │  │ Application     │   │
│  │ Pod         │  │ PVC (5Gi)    │  │ (nextcloud)     │   │
│  │             │  │              │  │ PVC (100Gi)     │   │
│  └─────────────┘  └──────┬───────┘  └──────┬──────────┘   │
│                          │                 │               │
│                          ▼                 ▼               │
│  ┌───────────────────────────────────────────────────┐    │
│  │          ReplicationSource (Volsync)              │    │
│  │  - Schedule: 0 * * * *                            │    │
│  │  - Snapshot: csi-ceph-blockpool                   │    │
│  │  - Compression: zstd-fastest                      │    │
│  │  - Encryption: Kopia (AES256-GCM)                 │    │
│  └─────────────────────┬─────────────────────────────┘    │
│                        │                                   │
│                        ▼                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │     Volsync Mover Pod (per backup job)            │   │
│  │  - NFS mount injected: /repository                │   │
│  │  - Kopia client                                   │   │
│  │  - Cache: OpenEBS hostpath                        │   │
│  └─────────────────────┬──────────────────────────────┘   │
│                        │                                   │
└────────────────────────┼───────────────────────────────────┘
                         │
                         │ Writes to NFS repository
                         │
                         ▼
         ┌──────────────────────────────────┐
         │     NAS (nas.g-eye.tech)        │
         │  /volume1/minio/volsynckopia    │
         │                                  │
         │  ┌────────────────────────────┐ │
         │  │  Kopia Repository          │ │
         │  │  - Deduplicated blocks     │ │
         │  │  - Encrypted snapshots     │ │
         │  │  - Compression metadata    │ │
         │  │  - Retention policy data   │ │
         │  └────────────────────────────┘ │
         └──────────────┬───────────────────┘
                        │
                        │ Reads from NFS repository
                        │
┌────────────────────────┼───────────────────────────────────┐
│                        │                                   │
│  ┌─────────────────────┴──────────────────────────────┐   │
│  │     Volsync Mover Pod (restore job)               │   │
│  │  - NFS mount injected: /repository                │   │
│  │  - Kopia client                                   │   │
│  │  - Restores to new PVC                            │   │
│  └─────────────────────┬──────────────────────────────┘   │
│                        │                                   │
│                        ▼                                   │
│  ┌───────────────────────────────────────────────────┐    │
│  │       ReplicationDestination (Volsync)            │    │
│  │  - Trigger: manual (restore-once)                 │    │
│  │  - Creates PVC from snapshot                      │    │
│  │  - Cleanup: cache + temp PVCs                     │    │
│  └─────────────────────┬─────────────────────────────┘    │
│                        │                                   │
│                        ▼                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Application  │  │ Application  │  │ Application     │ │
│  │ Pod          │  │ PVC (5Gi)    │  │ (nextcloud)     │ │
│  │              │  │ ✓ Restored   │  │ PVC (100Gi)     │ │
│  └──────────────┘  └──────────────┘  └─────────────────┘ │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                    K0s Cluster (Destination)               │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
[App PVC]
    ↓
[Ceph RBD Snapshot] ← Fast, CoW snapshot
    ↓
[Kopia Dedup Engine] ← Content-addressable chunking
    ↓
[Compression] ← zstd-fastest (~40-60% compression)
    ↓
[Encryption] ← AES256-GCM with password from OnePassword
    ↓
[NFS Repository] ← Central storage accessible by all clusters
    ↓
[Kopia Restore] ← Retrieves blocks, decompresses, decrypts
    ↓
[New PVC] ← Populated via Kubernetes dataSourceRef
    ↓
[App Pod Restart] ← Mounts restored PVC
```

---

## Prerequisites

### Source Cluster Requirements

Before migration, your source cluster must have:

- ✅ **Volsync v0.16.13** (or compatible) installed
- ✅ **Backup jobs running successfully** for 24+ hours
- ✅ **Ceph RBD CSI driver** with snapshot support
- ✅ **External Secrets Operator** with OnePassword integration
- ✅ **Network access** to NAS (nas.g-eye.tech:2049 NFS)
- ✅ **MutatingAdmissionPolicy** support (Kubernetes 1.26+)

### K0s Cluster Requirements (Destination)

The new K0s cluster must provide:

- ✅ **K0s v1.26+** (https://k0sproject.io/)
- ✅ **Ceph RBD CSI driver** or compatible block storage with snapshot support
- ✅ **Storage classes**:
  - `ceph-block` (or equivalent for primary PVCs)
  - `openebs-hostpath` (for Volsync cache)
  - `csi-ceph-blockpool` (snapshot class)
- ✅ **External Secrets Operator** configured with OnePassword
- ✅ **Snapshot Controller** installed
- ✅ **Network access** to NAS (nas.g-eye.tech:2049 NFS)
- ✅ **MutatingAdmissionPolicy** support (available in K0s v1.26+)

**K0s-Specific Considerations:**

- **Installation Method**: Can use `k0sctl` for automated cluster deployment
- **Controller + Worker Architecture**: K0s supports single-node or multi-node configurations
- **Default CNI**: K0s uses Kube-router by default, but can be configured with Cilium (as used in this repo)
- **Bundled Components**: K0s includes CoreDNS and metrics-server by default
- **Extensions**: Rook-Ceph, External Secrets, and other operators deploy the same way as any Kubernetes
- **No etcd Management**: K0s manages etcd automatically (or can use external etcd)
- **Autopilot**: K0s supports automated upgrades via Autopilot (optional)

### Infrastructure Requirements

- ✅ **NAS accessible from both clusters** (nas.g-eye.tech)
- ✅ **NFS share** at `/volume1/minio/volsynckopia` readable/writable
- ✅ **OnePassword** with `volsync-template` secret containing `KOPIA_PASSWORD`
- ✅ **Sufficient storage** in destination cluster (~350Gi+ for full migration)

---

## Migration Strategies

### Strategy 1: Cold Migration (Recommended for Production)

**Best for:** Complete cluster replacement, maximum safety

**Downtime:** Hours (application-dependent)

**Process:**
1. Stop applications on source cluster
2. Trigger final backups for all apps
3. Wait for all backups to complete
4. Deploy K0s cluster
5. Install infrastructure (Rook-Ceph, Volsync, etc.)
6. Restore all PVCs
7. Start applications on K0s cluster
8. Update DNS/routing
9. Validate and decommission source cluster

**Pros:**
- Maximum data consistency
- Simple rollback (keep source cluster)
- No split-brain scenarios

**Cons:**
- Full application downtime
- Requires maintenance window

### Strategy 2: Hot Migration (Blue-Green)

**Best for:** Critical services requiring minimal downtime

**Downtime:** Minutes to seconds (DNS cutover)

**Process:**
1. Deploy K0s cluster in parallel with source
2. Install infrastructure on K0s (Rook-Ceph, Volsync, etc.)
3. Restore all PVCs from latest backups (applications still running on source)
4. Test applications on K0s cluster
5. Stop writes on source cluster applications
6. Trigger incremental backup for changed data
7. Final incremental restore on K0s
8. Start applications on K0s
9. DNS cutover to K0s cluster
10. Monitor and decommission source cluster

**Pros:**
- Minimal downtime (DNS TTL)
- Safe rollback available
- Can test before cutover

**Cons:**
- More complex coordination
- Requires stopping writes before final sync
- Requires duplicate resources

### Strategy 3: Gradual Migration (Per-Application)

**Best for:** Large clusters, risk mitigation, learning/testing

**Downtime:** Per-application only

**Process:**
1. Deploy destination cluster
2. Select low-risk application to migrate
3. Stop application on source cluster
4. Restore PVC on destination cluster
5. Start application on destination cluster
6. Validate functionality
7. Update routing for that application
8. Repeat for next application

**Pros:**
- Lowest risk (failures isolated to one app)
- Learn lessons before migrating critical apps
- Rollback is per-application

**Cons:**
- Longest total migration time
- Need to manage routing per-app
- Source and destination clusters coexist longer

### Strategy Comparison Matrix

| Strategy | Downtime | Complexity | Risk | Rollback | Best For |
|----------|----------|------------|------|----------|----------|
| **Cold** | Hours | Low | Low | Easy | Small clusters, maintenance windows available |
| **Hot (Blue-Green)** | Minutes | High | Medium | Easy | Production, critical services |
| **Gradual** | Per-app | Medium | Very Low | Per-app | Large clusters, risk-averse organizations |

---

## Step-by-Step Migration Procedures

### Procedure A: Cold Migration (Full Cluster)

#### Phase 1: Pre-Migration Validation (Source Cluster)

**Time: 1-2 hours**

```bash
# 1. Verify all ReplicationSources are healthy
kubectl get replicationsource -A
# Expected: All show recent lastSyncTime (within last hour)

# 2. Check for failing backups
kubectl get rs -A -o json | jq -r '.items[] | select(.status.lastSyncTime == null) | "\(.metadata.namespace)/\(.metadata.name)"'
# Expected: No output (all backups successful)

# 3. Verify backup jobs completed successfully
kubectl get jobs -n volsync-system | grep volsync-src
# Expected: All Completed

# 4. Check Kopia repository status
kubectl exec -n volsync-system deploy/kopia -- kopia repository status
# Expected: No errors, shows repository statistics

# 5. List all backed-up applications
kubectl get rs -A --no-headers | awk '{print $1"/"$2}'
# Expected: 23 applications listed
```

**Validation Checklist:**

- [ ] All 23 ReplicationSources show recent sync
- [ ] No backup jobs in Error or Failed state
- [ ] Kopia repository is accessible
- [ ] OnePassword integration working (check ExternalSecrets)
- [ ] NFS mount accessible from cluster

#### Phase 2: Final Backup (Source Cluster)

**Time: 1-2 hours (depending on data size)**

```bash
# 1. Stop all applications to ensure data consistency
# For each namespace with backed-up apps:
kubectl scale deployment --all --replicas=0 -n default
kubectl scale deployment --all --replicas=0 -n observability
kubectl scale deployment --all --replicas=0 -n databases

# 2. Trigger manual backup for all applications
# This ensures the latest state is captured
for app in home-assistant nextcloud radarr plex sonarr jellyseerr atuin bazarr changedetection prowlarr sabnzbd tautulli recyclarr kometa n8n twenty lelabo-crm rybbit fusion paperless-ai recommendarr teslamate pgadmin; do
  namespace=$(kubectl get rs $app -A --no-headers | awk '{print $1}')
  echo "Triggering backup for $app in $namespace..."
  kubectl patch rs $app -n $namespace --type merge -p '{"spec":{"trigger":{"manual":"backup-now"}}}'
done

# 3. Monitor backup progress
watch "kubectl get jobs -n volsync-system | grep volsync-src"
# Wait until all jobs show "Completed"

# 4. Verify all backups succeeded
kubectl get rs -A -o json | jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name): \(.status.lastSyncTime)"'
# Expected: All show timestamps within last few minutes
```

**Critical:** Do not proceed until all backups show "Completed" status.

#### Phase 3: K0s Cluster Setup

**Time: 2-4 hours (depending on cluster size)**

```bash
# 1. Install K0s on your nodes
# Option A: Using k0sctl (recommended for multi-node)
# Create k0sctl.yaml configuration file:
cat > k0sctl.yaml <<EOF
apiVersion: k0sctl.k0sproject.io/v1beta1
kind: Cluster
metadata:
  name: k0s-cluster
spec:
  hosts:
  - role: controller+worker
    ssh:
      address: <node-ip>
      user: root
      keyPath: ~/.ssh/id_rsa
  k0s:
    version: v1.29.1+k0s.0
EOF

# Deploy K0s cluster
k0sctl apply --config k0sctl.yaml

# Get kubeconfig
k0sctl kubeconfig --config k0sctl.yaml > ~/.kube/k0s-config
export KUBECONFIG=~/.kube/k0s-config

# Option B: Single-node K0s installation
# On the target node:
# curl -sSLf https://get.k0s.sh | sudo sh
# sudo k0s install controller --single
# sudo k0s start
# sudo k0s kubeconfig admin > ~/.kube/k0s-config

# Verify K0s cluster is running
kubectl get nodes
kubectl get pods -A
# Expected: All nodes Ready, all system pods Running

# 2. Install Rook-Ceph with block storage
# Apply Rook-Ceph manifests (this repo uses Rook)
kubectl apply -k kubernetes/apps/storage-system/rook-ceph/

# 3. Verify Ceph cluster is healthy
kubectl get cephcluster -n rook-ceph
kubectl get cephblockpool -n rook-ceph
# Expected: HEALTH_OK

# 4. Install snapshot controller
kubectl apply -k kubernetes/apps/kube-system/snapshot-controller/

# 5. Install External Secrets Operator
kubectl apply -k kubernetes/apps/external-secrets/external-secrets/

# 6. Create OnePassword ClusterSecretStore
kubectl apply -f kubernetes/apps/external-secrets/external-secrets/app/clustersecretstore.yaml

# 7. Verify OnePassword connectivity
kubectl get clustersecretstore onepassword -o json | jq .status
# Expected: status.conditions[].status = "True"

# 8. Install OpenEBS for cache storage
kubectl apply -k kubernetes/apps/storage-system/openebs/

# 9. Install Volsync system
kubectl apply -k kubernetes/apps/volsync-system/volsync/
kubectl apply -k kubernetes/apps/volsync-system/kopia/

# 10. Verify Volsync installation
kubectl get pods -n volsync-system
# Expected: volsync-xxx and kopia-xxx pods Running

# 11. Verify NFS repository access
kubectl exec -n volsync-system deploy/kopia -- ls -la /repository
# Expected: Shows existing Kopia repository files
```

**Validation Checklist:**

- [ ] K0s cluster deployed and nodes Ready
- [ ] K0s system pods running (kube-router, CoreDNS, metrics-server)
- [ ] Ceph cluster healthy (HEALTH_OK)
- [ ] Storage classes available (ceph-block, openebs-hostpath)
- [ ] Snapshot controller running
- [ ] External Secrets Operator connected to OnePassword
- [ ] Volsync and Kopia pods Running
- [ ] NFS repository accessible from K0s cluster

#### Phase 4: Restore Applications (K0s Cluster)

**Time: 2-8 hours (size-dependent, can parallelize)**

```bash
# 1. Deploy application manifests (without starting pods yet)
# This creates ReplicationDestination and PVC resources
flux reconcile kustomization cluster-apps --with-source

# 2. Verify ReplicationDestination resources created
kubectl get replicationdestination -A
# Expected: 23 resources (one per application)

# 3. Trigger restore for all applications
# Small apps (1-5Gi) - can do in parallel
for app in changedetection prowlarr sabnzbd recyclarr fusion; do
  namespace=$(kubectl get rd ${app}-dst -A --no-headers | awk '{print $1}')
  echo "Restoring $app in $namespace..."
  kubectl patch rd ${app}-dst -n $namespace --type merge -p '{"spec":{"trigger":{"manual":"restore-once"}}}'
done

# Medium apps (5-20Gi) - batch by size
for app in home-assistant radarr sonarr jellyseerr atuin bazarr tautulli n8n twenty lelabo-crm teslamate pgadmin paperless-ai recommendarr; do
  namespace=$(kubectl get rd ${app}-dst -A --no-headers | awk '{print $1}')
  echo "Restoring $app in $namespace..."
  kubectl patch rd ${app}-dst -n $namespace --type merge -p '{"spec":{"trigger":{"manual":"restore-once"}}}'
  sleep 30  # Stagger starts to avoid overwhelming cluster
done

# Large apps (20Gi+) - restore sequentially
for app in rybbit kometa plex nextcloud; do
  namespace=$(kubectl get rd ${app}-dst -A --no-headers | awk '{print $1}')
  echo "Restoring $app in $namespace (large volume)..."
  kubectl patch rd ${app}-dst -n $namespace --type merge -p '{"spec":{"trigger":{"manual":"restore-once"}}}'

  # Wait for this restore to complete before starting next
  echo "Waiting for $app restore to complete..."
  kubectl wait --for=condition=LatestMoverStatus=Succeeded rd/${app}-dst -n $namespace --timeout=3600s
done

# 4. Monitor restore progress
watch "kubectl get rd -A | grep -v NAME | awk '{print \$1\"/\"\$2\": \"\$3}'"
# Wait for all to show completed status

# 5. Verify all PVCs are bound
kubectl get pvc -A | grep -E "(home-assistant|nextcloud|plex|...)"
# Expected: All show STATUS=Bound

# 6. Check PVC sizes match expectations
kubectl get pvc -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,SIZE:.spec.resources.requests.storage,STATUS:.status.phase
```

**Restore Time Estimates:**

| Application | Size | Estimated Time |
|-------------|------|----------------|
| changedetection, prowlarr, sabnzbd, recyclarr, fusion | 1Gi | 5-10 min |
| home-assistant, radarr, sonarr, jellyseerr, etc. | 5Gi | 15-30 min |
| rybbit | 20Gi | 45-90 min |
| kometa | 30Gi | 1-2 hours |
| plex | 50Gi | 2-3 hours |
| nextcloud | 100Gi | 4-6 hours |

#### Phase 5: Application Startup and Validation

**Time: 1-2 hours**

```bash
# 1. Start applications on destination cluster
# Applications will automatically mount the restored PVCs
flux reconcile kustomization cluster-apps

# 2. Verify all pods are running
kubectl get pods -A | grep -v kube-system | grep -v Running
# Expected: No output (all pods Running)

# 3. Check application logs for errors
for app in home-assistant nextcloud plex radarr sonarr; do
  namespace=$(kubectl get pod -A -l app.kubernetes.io/name=$app --no-headers | awk '{print $1}' | head -1)
  echo "=== Logs for $app ==="
  kubectl logs -n $namespace -l app.kubernetes.io/name=$app --tail=50
done

# 4. Validate data integrity spot checks
# Examples (adjust for your apps):

# Home Assistant - check database exists
kubectl exec -n default -it $(kubectl get pod -n default -l app.kubernetes.io/name=home-assistant -o name | head -1) -- ls -lh /config/home-assistant_v2.db

# Plex - check library database
kubectl exec -n default -it $(kubectl get pod -n default -l app.kubernetes.io/name=plex -o name | head -1) -- ls -lh /config/Library/Application\ Support/Plex\ Media\ Server/Plug-in\ Support/Databases/

# Nextcloud - run occ status
kubectl exec -n default -it $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name | head -1) -- su -s /bin/bash www-data -c "php /var/www/html/occ status"

# 5. Test application access (if you have port-forwards or test domains)
# Example for Home Assistant:
kubectl port-forward -n default svc/home-assistant 8123:80 &
curl -s http://localhost:8123 | grep "Home Assistant"
```

**Application Validation Checklist:**

For each critical application:
- [ ] Pod is Running
- [ ] PVC is mounted correctly
- [ ] Application logs show successful startup
- [ ] Database/config files exist and have expected size
- [ ] Application responds to HTTP requests
- [ ] Login works with existing credentials

#### Phase 6: DNS/Routing Cutover

**Time: 30 minutes (plus DNS TTL)**

```bash
# 1. Update external DNS records to point to new cluster
# This depends on your DNS provider and setup

# 2. If using external-dns, update gateway IP addresses
kubectl patch gateway external -n kube-system --type merge -p '{"spec":{"addresses":[{"type":"IPAddress","value":"<NEW_CLUSTER_IP>"}]}}'

# 3. Verify ingress/gateway configuration
kubectl get gateway -A
kubectl get httproute -A

# 4. Test access via new DNS
# Wait for DNS TTL to expire, then test each application:
curl -I https://home-assistant.g-eye.io
curl -I https://nextcloud.g-eye.io
curl -I https://plex.g-eye.io
# Expected: All return HTTP 200 or redirects

# 5. Monitor traffic on new cluster
kubectl top pods -A
# Should see increasing CPU/memory as traffic shifts
```

**DNS Cutover Checklist:**

- [ ] External DNS records updated
- [ ] Gateway/Ingress configured with new IPs
- [ ] TLS certificates valid for all domains
- [ ] Health checks passing
- [ ] Monitoring shows traffic on new cluster
- [ ] Old cluster traffic declining

#### Phase 7: Monitoring and Validation

**Time: 24-72 hours**

```bash
# 1. Monitor application health
kubectl get pods -A -w

# 2. Check for CrashLoopBackOff or errors
kubectl get pods -A | grep -v Running | grep -v Completed

# 3. Monitor Prometheus alerts (if configured)
kubectl get prometheusrule -A

# 4. Verify backups running on new cluster
kubectl get replicationsource -A
# All should show recent lastSyncTime (within 1 hour)

# 5. Check backup jobs on new cluster
kubectl get jobs -n volsync-system | grep volsync-src
# Should see hourly backup jobs completing

# 6. Validate new backups are being stored
kubectl exec -n volsync-system deploy/kopia -- kopia snapshot list
# Should show new snapshots with today's date
```

**Post-Migration Monitoring (First 24 Hours):**

- [ ] All applications accessible and functional
- [ ] No errors in application logs
- [ ] Backups running hourly on new cluster
- [ ] Kopia repository growing with new snapshots
- [ ] User reports no data loss or issues
- [ ] Performance metrics within expected ranges

#### Phase 8: Decommission Source Cluster

**Time: Variable (only after successful validation)**

⚠️ **Wait at least 7 days before decommissioning source cluster** to ensure:
- New cluster stability
- No data integrity issues discovered
- Rollback option remains available

```bash
# 1. Stop all pods on source cluster
kubectl delete kustomization cluster-apps -n flux-system

# 2. Stop Flux reconciliation
kubectl delete kustomization --all -n flux-system

# 3. Scale down Volsync (stop backups to avoid confusion)
kubectl scale deployment volsync -n volsync-system --replicas=0

# 4. (Optional) Archive source cluster data for auditing
# Backup etcd, PVs, or other critical data for compliance

# 5. Decommission source cluster nodes
# Follow your cluster distribution's teardown procedures

# 6. Update documentation
# Record migration date, new cluster details, any lessons learned
```

---

### Procedure B: Hot Migration (Blue-Green)

#### Overview

Hot migration maintains service availability by running both clusters in parallel, testing the destination cluster thoroughly before cutting over traffic.

#### Phase 1: Source Cluster Preparation

**Time: 30 minutes**

```bash
# 1. Ensure backups are current (same as Cold Migration Phase 1)
kubectl get replicationsource -A

# 2. Verify applications are healthy and stable
kubectl get pods -A | grep -v Running

# 3. Document current application versions for destination
kubectl get helmreleases -A -o custom-columns=NAME:.metadata.name,VERSION:.spec.chart.spec.version

# 4. Note current resource utilization baseline
kubectl top pods -A | sort -k3 -rn | head -20
```

#### Phase 2: Destination Cluster Setup (Same as Cold Migration Phase 3)

Install all infrastructure components on the destination cluster without stopping the source cluster.

#### Phase 3: Initial Restore (Parallel Operation)

**Time: 2-8 hours**

```bash
# 1. Restore all applications to destination cluster
# Use the restore commands from Cold Migration Phase 4

# NOTE: Source cluster continues running during this time

# 2. Applications on destination cluster are NOT exposed externally yet
# They use internal DNS/IPs for testing

# 3. Monitor both clusters simultaneously
# Terminal 1: Source cluster
kubectl get pods -A -w --context=source-cluster

# Terminal 2: Destination cluster
kubectl get pods -A -w --context=dest-cluster
```

#### Phase 4: Parallel Testing

**Time: 2-24 hours (as thorough as needed)**

```bash
# 1. Access destination cluster applications via port-forward or test domains
kubectl port-forward -n default svc/home-assistant 8123:80 --context=dest-cluster

# 2. Test each application thoroughly:
# - Login with existing credentials
# - Verify data is accessible
# - Test critical workflows
# - Check integrations and automations
# - Validate database queries return expected results

# 3. Run automated tests (if you have them)
# Example: API tests, smoke tests, integration tests

# 4. Load test destination cluster
# Use tools like k6, locust, or Apache Bench to simulate production load

# 5. Compare metrics between source and destination
# - Response times
# - Error rates
# - Resource utilization
```

**Parallel Testing Checklist:**

For each application:
- [ ] UI accessible via test URL/port-forward
- [ ] Login successful with existing credentials
- [ ] Historical data visible and accurate
- [ ] Integrations working (APIs, webhooks, etc.)
- [ ] Performance acceptable under load
- [ ] No errors in logs during testing

#### Phase 5: Pre-Cutover Data Sync

**Time: 30 minutes - 2 hours**

⚠️ **This is the critical step to minimize data loss**

```bash
# 1. Enable read-only mode on source cluster applications (if supported)
# This prevents new writes while we sync final changes
# Example for Nextcloud:
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ maintenance:mode --on"

# 2. For applications without read-only mode, scale to 0 replicas
kubectl scale deployment nextcloud -n default --replicas=0 --context=source-cluster
kubectl scale deployment home-assistant -n default --replicas=0 --context=source-cluster
# Repeat for all critical applications

# 3. Trigger final backup on source cluster
for app in home-assistant nextcloud plex radarr sonarr jellyseerr atuin bazarr changedetection prowlarr sabnzbd tautulli recyclarr kometa n8n twenty lelabo-crm rybbit fusion paperless-ai recommendarr teslamate pgadmin; do
  namespace=$(kubectl get rs $app -A --no-headers --context=source-cluster | awk '{print $1}')
  echo "Final backup for $app..."
  kubectl patch rs $app -n $namespace --type merge --context=source-cluster \
    -p '{"spec":{"trigger":{"manual":"final-backup"}}}'
done

# 4. Wait for all final backups to complete
watch "kubectl get jobs -n volsync-system --context=source-cluster | grep volsync-src"

# 5. Trigger final restore on destination cluster
for app in home-assistant nextcloud plex radarr sonarr jellyseerr atuin bazarr changedetection prowlarr sabnzbd tautulli recyclarr kometa n8n twenty lelabo-crm rybbit fusion paperless-ai recommendarr teslamate pgadmin; do
  namespace=$(kubectl get rd ${app}-dst -A --no-headers --context=dest-cluster | awk '{print $1}')
  echo "Final restore for $app..."
  kubectl patch rd ${app}-dst -n $namespace --type merge --context=dest-cluster \
    -p '{"spec":{"trigger":{"manual":"final-restore"}}}'
done

# 6. Wait for all final restores to complete
watch "kubectl get rd -A --context=dest-cluster"

# 7. Restart applications on destination cluster
flux reconcile kustomization cluster-apps --context=dest-cluster
```

**Data Sync Window:**

The time between stopping writes on source and starting applications on destination is the **true downtime**. Optimize by:
- Parallelize final backups where possible
- Use incremental restore if Kopia supports it
- Restore smaller apps first to reduce perceived downtime

#### Phase 6: Traffic Cutover

**Time: 5-30 minutes (depending on DNS TTL and monitoring duration)**

```bash
# 1. Update DNS records to point to destination cluster
# Use your DNS provider's API or web interface

# Example with external-dns annotation:
kubectl annotate gateway external -n kube-system \
  external-dns.alpha.kubernetes.io/target=dest-cluster-ip \
  --overwrite \
  --context=dest-cluster

# 2. Monitor traffic shift
# Terminal 1: Watch traffic decline on source cluster
kubectl top pods -A --context=source-cluster

# Terminal 2: Watch traffic increase on destination cluster
kubectl top pods -A --context=dest-cluster

# 3. Check application logs for errors on destination
kubectl logs -n default -l app.kubernetes.io/name=nextcloud --context=dest-cluster --tail=100 -f

# 4. Monitor alerts and error rates
kubectl get prometheusrule -A --context=dest-cluster

# 5. Verify user access via production URLs
curl -I https://nextcloud.g-eye.io
curl -I https://home-assistant.g-eye.io
# Should return responses from destination cluster
```

**Cutover Checklist:**

- [ ] DNS updated to destination cluster
- [ ] Traffic shifting to destination (monitor metrics)
- [ ] No spike in error rates on destination
- [ ] Application logs clean on destination
- [ ] User reports confirm services working
- [ ] Source cluster traffic approaching zero

#### Phase 7: Rollback Procedures (If Needed)

**Only if critical issues are discovered during cutover**

```bash
# 1. Immediately revert DNS to source cluster
# Update DNS records back to source cluster IPs

# 2. Scale source cluster applications back up
kubectl scale deployment --all --replicas=1 -n default --context=source-cluster

# 3. Verify source cluster applications start successfully
kubectl get pods -A --context=source-cluster

# 4. For applications with read-only mode, disable it
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name --context=source-cluster) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ maintenance:mode --off"

# 5. Monitor source cluster recovery
kubectl logs -n default -l app.kubernetes.io/name=nextcloud --context=source-cluster --tail=100 -f

# 6. Communicate rollback to users (if needed)
# Document issues encountered for troubleshooting
```

**Rollback Decision Criteria:**

Trigger rollback if:
- Critical data corruption detected
- Application errors affecting >50% of users
- Performance degradation >5x normal
- Integration failures with external systems
- Database connection errors

#### Phase 8: Post-Cutover Monitoring (Same as Cold Migration Phase 7)

Monitor destination cluster for 24-72 hours before decommissioning source cluster.

---

### Procedure C: Gradual Migration (Per-Application)

#### Overview

Migrate one application at a time, validating each before moving to the next. This minimizes risk and allows learning from each migration.

#### Application Migration Priority

**Recommended Order:**

1. **Tier 1 - Test Apps (Low Risk):**
   - changedetection (1Gi)
   - recyclarr (1Gi)
   - fusion (1Gi)

2. **Tier 2 - Non-Critical Automation:**
   - prowlarr (1Gi)
   - sabnzbd (1Gi)
   - tautulli (5Gi)
   - bazarr (5Gi)

3. **Tier 3 - Media Management:**
   - radarr (5Gi)
   - sonarr (5Gi)
   - jellyseerr (5Gi)

4. **Tier 4 - Large Non-Critical:**
   - kometa (30Gi)
   - plex (50Gi) ← Test large restores before critical apps

5. **Tier 5 - Databases:**
   - teslamate (5Gi)
   - pgadmin (5Gi)
   - rybbit (20Gi)

6. **Tier 6 - Critical Applications:**
   - home-assistant (5Gi) ← Home automation hub
   - n8n (1Gi) ← Workflow automation
   - twenty (5Gi) ← CRM
   - lelabo-crm (5Gi)

7. **Tier 7 - Mission Critical:**
   - nextcloud (100Gi) ← File storage and collaboration
   - paperless-ai (5Gi) ← Document management

#### Per-Application Migration Template

**Use this template for each application:**

```bash
APP=changedetection  # Replace with application name
NAMESPACE=default    # Replace with namespace
SIZE=1Gi            # Replace with PVC size

echo "=== Starting migration for $APP ==="

# Step 1: Verify current backup status
kubectl get rs $APP -n $NAMESPACE -o json | jq -r '.status.lastSyncTime'
# Expected: Recent timestamp (within last hour)

# Step 2: Scale down application on source cluster
kubectl scale deployment $APP -n $NAMESPACE --replicas=0 --context=source-cluster

# Step 3: Trigger final backup on source cluster
kubectl patch rs $APP -n $NAMESPACE --type merge --context=source-cluster \
  -p '{"spec":{"trigger":{"manual":"migrate-backup"}}}'

# Step 4: Wait for backup to complete
kubectl wait --for=condition=LatestMoverStatus=Succeeded rs/$APP -n $NAMESPACE --timeout=600s --context=source-cluster

# Step 5: Deploy application manifest on destination cluster
# (Ensure ReplicationDestination and PVC resources exist)
flux reconcile helmrelease $APP -n $NAMESPACE --context=dest-cluster

# Step 6: Trigger restore on destination cluster
kubectl patch rd ${APP}-dst -n $NAMESPACE --type merge --context=dest-cluster \
  -p '{"spec":{"trigger":{"manual":"migrate-restore"}}}'

# Step 7: Wait for restore to complete
kubectl wait --for=condition=LatestMoverStatus=Succeeded rd/${APP}-dst -n $NAMESPACE --timeout=1800s --context=dest-cluster

# Step 8: Verify PVC is bound on destination cluster
kubectl get pvc $APP -n $NAMESPACE --context=dest-cluster
# Expected: STATUS=Bound, SIZE=$SIZE

# Step 9: Start application on destination cluster
kubectl rollout restart deployment/$APP -n $NAMESPACE --context=dest-cluster

# Step 10: Wait for pod to be ready
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=$APP -n $NAMESPACE --timeout=300s --context=dest-cluster

# Step 11: Validate application functionality
kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=$APP --tail=50 --context=dest-cluster

# Step 12: Update routing/DNS for this application (if using per-app routing)
# Example with HTTPRoute annotation:
kubectl annotate httproute $APP -n $NAMESPACE \
  migration.status=completed-$(date +%Y%m%d) \
  --context=dest-cluster

echo "=== Migration complete for $APP ==="
echo "=== Monitoring for 1 hour before proceeding to next app ==="
sleep 3600
```

#### Gradual Migration Tracking

Create a migration status file to track progress:

```bash
# migration-status.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: migration-status
  namespace: default
data:
  tier1: "completed"  # changedetection, recyclarr, fusion
  tier2: "in-progress"  # prowlarr, sabnzbd, tautulli, bazarr
  tier3: "pending"  # radarr, sonarr, jellyseerr
  tier4: "pending"  # kometa, plex
  tier5: "pending"  # teslamate, pgadmin, rybbit
  tier6: "pending"  # home-assistant, n8n, twenty, lelabo-crm
  tier7: "pending"  # nextcloud, paperless-ai
  last-migrated: "2025-11-03T10:00:00Z"
  currently-migrating: "tautulli"
```

Update after each application migration:

```bash
kubectl create configmap migration-status --from-file=migration-status.yaml -n default --dry-run=client -o yaml | kubectl apply -f -
```

---

## Application-Specific Considerations

### Large Applications (>20Gi)

#### Nextcloud (100Gi)

**Estimated Restore Time:** 4-6 hours

**Special Considerations:**
- Enable maintenance mode before final backup
- Verify database consistency after restore
- Clear Redis cache after migration
- Run `occ` commands to repair file locks

**Post-Restore Commands:**

```bash
# Enable maintenance mode on source before final backup
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name --context=source) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ maintenance:mode --on"

# After restore on destination, verify database
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name --context=dest) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ db:convert-mysql-charset"

# Repair file locks
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name --context=dest) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ files:cleanup"

# Disable maintenance mode
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=nextcloud -o name --context=dest) -- \
  su -s /bin/bash www-data -c "php /var/www/html/occ maintenance:mode --off"
```

#### Plex (50Gi)

**Estimated Restore Time:** 2-3 hours

**Special Considerations:**
- Verify library database integrity
- Re-scan libraries after migration (can be slow)
- Check transcoder temporary files path
- Verify hardware transcoding (GPU) configuration

**Post-Restore Commands:**

```bash
# Check Plex database
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=plex -o name) -- \
  sqlite3 /config/Library/Application\ Support/Plex\ Media\ Server/Plug-in\ Support/Databases/com.plexapp.plugins.library.db "PRAGMA integrity_check;"
# Expected: ok

# Trigger library scan (will take time)
# Do this via Plex UI: Settings > Libraries > Scan Library Files
```

#### Kometa (30Gi)

**Estimated Restore Time:** 1-2 hours

**Special Considerations:**
- Metadata management for media libraries
- Cache files can be large
- Verify connection to Plex after migration

#### Rybbit (20Gi)

**Estimated Restore Time:** 45-90 minutes

**Special Considerations:**
- Database-backed application
- Verify PostgreSQL connection
- Check database migrations ran successfully

**Post-Restore Commands:**

```bash
# Verify database connectivity
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=rybbit -o name) -- \
  env | grep DATABASE_URL

# Check application logs for database errors
kubectl logs -n default -l app.kubernetes.io/name=rybbit --tail=100 | grep -i database
```

### Database Applications

#### Teslamate (5Gi)

**Special Considerations:**
- PostgreSQL database
- Requires CloudNativePG operator
- Verify database restore from Volsync
- Check Grafana dashboard connectivity

**Post-Restore Commands:**

```bash
# Verify PostgreSQL cluster health
kubectl get postgresql teslamate -n observability
# Expected: STATUS=ready

# Check database size and tables
kubectl exec -n observability teslamate-1 -- psql -U teslamate -c "\dt"
```

#### PgAdmin (5Gi)

**Special Considerations:**
- Admin interface for PostgreSQL
- Verify connection credentials
- Re-add database connections if needed

### Media Management Applications

#### Radarr, Sonarr, Bazarr (5Gi each)

**Special Considerations:**
- Verify download client connections (sabnzbd, qBittorrent, etc.)
- Check indexer connectivity (Prowlarr)
- Verify media root paths match
- Re-scan libraries to update paths if needed

**Post-Restore Commands:**

```bash
# Verify media paths
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=radarr -o name) -- ls -la /media
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=sonarr -o name) -- ls -la /media

# Test indexer connections via API
APP=radarr
API_KEY=$(kubectl get secret radarr-secret -n default -o jsonpath='{.data.RADARR__API_KEY}' | base64 -d)
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=$APP -o name) -- \
  curl -s http://localhost/api/v3/system/status -H "X-Api-Key: $API_KEY"
```

#### Jellyseerr (5Gi)

**Special Considerations:**
- Request management system
- Verify Plex/Radarr/Sonarr connections
- Check user permissions and quotas

### Automation Applications

#### n8n (1Gi)

**Special Considerations:**
- Workflow automation
- Verify webhook URLs still valid
- Check credential encryption keys match
- Test workflow executions after migration

**Post-Restore Commands:**

```bash
# Verify n8n database
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=n8n -o name) -- ls -la /data/database.sqlite

# Check workflow count
kubectl logs -n default -l app.kubernetes.io/name=n8n --tail=100 | grep -i workflow
```

#### Home Assistant (5Gi)

**Special Considerations:**
- Critical home automation hub
- Verify database migration
- Check integrations and automations
- Validate MQTT broker connection (if using Mosquitto)

**Post-Restore Commands:**

```bash
# Verify Home Assistant database
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=home-assistant -o name) -- \
  ls -lh /config/home-assistant_v2.db
# Should show non-zero size

# Check configuration
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=home-assistant -o name) -- \
  cat /config/configuration.yaml

# Verify automations loaded
kubectl logs -n default -l app.kubernetes.io/name=home-assistant --tail=200 | grep -i automation
```

### Business Applications

#### Twenty (5Gi)

**Special Considerations:**
- CRM application
- Verify database migrations
- Check API connectivity

#### Lelabo-CRM (5Gi)

**Special Considerations:**
- Custom CRM
- Verify Redis connection
- Check API endpoints

### Document Management

#### Paperless-AI (5Gi)

**Special Considerations:**
- Document management with AI features
- RAG functionality requires cache directories
- Verify NLTK data and HuggingFace models
- Check OpenAI API key configuration

**Post-Restore Commands:**

```bash
# Verify paperless database
kubectl exec -n default $(kubectl get pod -n default -l app.kubernetes.io/name=paperless-ai -o name) -- \
  ls -la /app/data/

# Check RAG service startup
kubectl logs -n default -l app.kubernetes.io/name=paperless-ai --tail=100 | grep -i "RAG service"
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Backup Job Fails with "Read-only file system"

**Symptoms:**
```
Error: [Errno 30] Read-only file system: '/repository'
```

**Cause:** NFS mount not injected by MutatingAdmissionPolicy

**Solution:**

```bash
# Verify admission policy is applied
kubectl get mutatingadmissionpolicy -A

# Check if admission webhooks are running
kubectl get validatingwebhookconfiguration
kubectl get mutatingwebhookconfiguration

# Verify NFS is accessible from cluster
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  mount -t nfs nas.g-eye.tech:/volume1/minio/volsynckopia /mnt

# Manually patch job to add NFS volume (temporary workaround)
kubectl edit job volsync-src-<app-name>-<timestamp> -n volsync-system
# Add NFS volume mount to spec.template.spec.volumes
```

#### Issue 2: Restore Times Out

**Symptoms:**
```
Error: timed out waiting for condition
```

**Cause:** Large volume taking longer than default timeout

**Solution:**

```bash
# Increase timeout for large volumes
kubectl wait --for=condition=LatestMoverStatus=Succeeded \
  rd/${APP}-dst -n ${NAMESPACE} --timeout=7200s  # 2 hours

# Monitor restore progress
kubectl logs -n volsync-system -l job-name=volsync-dst-${APP}-* -f

# Check Kopia restore logs
kubectl exec -n volsync-system deploy/kopia -- \
  kopia snapshot list --show-identical
```

#### Issue 3: PVC Stuck in "Pending"

**Symptoms:**
```
NAME      STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
myapp     Pending                                      ceph-block
```

**Cause:** Storage class not available or PV provisioning failed

**Solution:**

```bash
# Check storage class exists
kubectl get storageclass ceph-block

# Check Ceph cluster health
kubectl get cephcluster -n rook-ceph
kubectl get cephblockpool -n rook-ceph

# Describe PVC to see error
kubectl describe pvc ${APP} -n ${NAMESPACE}

# Check CSI driver pods
kubectl get pods -n rook-ceph | grep csi

# If Ceph is unhealthy, check Ceph status
kubectl exec -n rook-ceph -it $(kubectl get pod -n rook-ceph -l app=rook-ceph-tools -o name) -- \
  ceph status
```

#### Issue 4: Application Pod CrashLoopBackOff After Restore

**Symptoms:**
```
NAME                    READY   STATUS             RESTARTS   AGE
myapp-7d5f8b6c-abc123   0/1     CrashLoopBackOff   5          5m
```

**Cause:** Data corruption, missing dependencies, or permission issues

**Solution:**

```bash
# Check pod logs
kubectl logs ${POD_NAME} -n ${NAMESPACE}

# Check previous crash logs
kubectl logs ${POD_NAME} -n ${NAMESPACE} --previous

# Verify PVC is mounted correctly
kubectl describe pod ${POD_NAME} -n ${NAMESPACE} | grep -A 10 Volumes

# Check PVC permissions
kubectl exec -it ${POD_NAME} -n ${NAMESPACE} -- ls -la /data

# If permissions are wrong, fix them
kubectl exec -it ${POD_NAME} -n ${NAMESPACE} -- chown -R 1000:1000 /data

# For database applications, check database file integrity
kubectl exec -it ${POD_NAME} -n ${NAMESPACE} -- \
  sqlite3 /data/database.db "PRAGMA integrity_check;"
```

#### Issue 5: Kopia Repository Connection Fails

**Symptoms:**
```
Error: failed to connect to repository: repository not found
```

**Cause:** NFS mount incorrect, repository path wrong, or password mismatch

**Solution:**

```bash
# Verify NFS mount on Kopia pod
kubectl exec -n volsync-system deploy/kopia -- ls -la /repository
# Should show .kopia directory and data files

# Check Kopia repository configuration
kubectl exec -n volsync-system deploy/kopia -- cat /config/repository.config

# Verify Kopia password in secret
kubectl get secret kopia-secret -n volsync-system -o jsonpath='{.data.KOPIA_PASSWORD}' | base64 -d

# Test repository connectivity
kubectl exec -n volsync-system deploy/kopia -- \
  kopia repository status

# If repository is corrupted, run maintenance
kubectl exec -n volsync-system deploy/kopia -- \
  kopia repository repair --safety=full
```

#### Issue 6: External Secrets Operator Not Creating Secrets

**Symptoms:**
```
Error: secret "myapp-volsync-secret" not found
```

**Cause:** OnePassword connection failed or secret key not found

**Solution:**

```bash
# Check ExternalSecret status
kubectl get externalsecret ${APP}-volsync -n ${NAMESPACE} -o yaml | grep -A 10 status

# Check ClusterSecretStore status
kubectl get clustersecretstore onepassword -o json | jq .status

# Verify OnePassword connection
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets

# Check if secret exists in OnePassword
# Log into 1Password and verify "volsync-template" item exists

# Manually trigger ExternalSecret sync
kubectl annotate externalsecret ${APP}-volsync -n ${NAMESPACE} \
  force-sync=$(date +%s) --overwrite

# If still failing, check ESO webhook
kubectl get validatingwebhookconfiguration | grep external-secrets
```

#### Issue 7: Snapshot Creation Fails

**Symptoms:**
```
Error: failed to create snapshot: snapshot class not found
```

**Cause:** Snapshot class not available or snapshot controller not running

**Solution:**

```bash
# Check snapshot classes
kubectl get volumesnapshotclass

# Verify snapshot controller is running
kubectl get pods -n kube-system | grep snapshot-controller

# Check CSI driver supports snapshots
kubectl get csidriver

# If snapshot class is missing, create it
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-ceph-blockpool
driver: rook-ceph.rbd.csi.ceph.com
deletionPolicy: Delete
parameters:
  clusterID: rook-ceph
  csi.storage.k8s.io/snapshotter-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/snapshotter-secret-namespace: rook-ceph
EOF
```

#### Issue 8: Migration Takes Longer Than Expected

**Symptoms:**
- Restore job running for hours
- No progress visible

**Cause:** Large data volume, slow network, or Kopia deduplication overhead

**Solution:**

```bash
# Monitor Kopia restore progress (if available)
kubectl logs -n volsync-system -l job-name=volsync-dst-${APP}-* -f | grep -i progress

# Check network throughput to NAS
kubectl run -it --rm speedtest --image=networkstatic/iperf3 --restart=Never -- \
  iperf3 -c nas.g-eye.tech

# Check Kopia repository statistics
kubectl exec -n volsync-system deploy/kopia -- \
  kopia repository stats

# If stuck, check if Kopia is actually working
kubectl exec -n volsync-system deploy/kopia -- ps aux | grep kopia

# Consider splitting large volumes into smaller apps if possible
```

---

## Monitoring and Validation

### Pre-Migration Monitoring

**Checklist before starting migration:**

```bash
# 1. Verify backup jobs are healthy
kubectl get replicationsource -A -o custom-columns=\
NAME:.metadata.name,\
NAMESPACE:.metadata.namespace,\
LAST_SYNC:.status.lastSyncTime,\
DURATION:.status.lastSyncDuration

# 2. Check Prometheus alerts (if configured)
kubectl get prometheusrule -A | grep volsync

# 3. Verify Kopia repository size and health
kubectl exec -n volsync-system deploy/kopia -- kopia repository status
kubectl exec -n volsync-system deploy/kopia -- kopia snapshot list | wc -l
# Should show multiple snapshots per application

# 4. Check all PVCs are bound and healthy on source cluster
kubectl get pvc -A | grep -v Bound
# Expected: No output (all PVCs bound)

# 5. Document current cluster state
kubectl top nodes
kubectl top pods -A | sort -k3 -rn | head -20
kubectl get pods -A --no-headers | wc -l
# Record these baseline metrics
```

### During Migration Monitoring

**Destination Cluster:**

```bash
# 1. Watch restore jobs in real-time
watch "kubectl get replicationdestination -A | grep -v NAME"

# 2. Monitor PVC creation
watch "kubectl get pvc -A | grep -E 'Pending|Bound'"

# 3. Track pod startup
watch "kubectl get pods -A | grep -v Running | grep -v Completed"

# 4. Monitor cluster resource usage
watch "kubectl top nodes"

# 5. Watch for errors in Volsync logs
kubectl logs -n volsync-system -l app.kubernetes.io/name=volsync -f | grep -i error
```

**Source Cluster (if running):**

```bash
# Monitor traffic decline during hot migration
watch "kubectl top pods -A | grep -E '(nextcloud|plex|home-assistant)'"
```

### Post-Migration Validation

**Immediate Checks (First Hour):**

```bash
# 1. All pods running
kubectl get pods -A | grep -v Running | grep -v Completed
# Expected: Only system pods like jobs

# 2. All PVCs bound
kubectl get pvc -A | grep -v Bound
# Expected: No output

# 3. No CrashLoopBackOff
kubectl get pods -A | grep CrashLoopBackOff
# Expected: No output

# 4. Check logs for errors (critical apps)
for app in home-assistant nextcloud plex radarr sonarr; do
  echo "=== $app logs ==="
  kubectl logs -n default -l app.kubernetes.io/name=$app --tail=50 | grep -i error
done

# 5. Verify DNS resolution
for host in nextcloud.g-eye.io plex.g-eye.io home-assistant.g-eye.io; do
  echo "Testing $host..."
  curl -I https://$host
done

# 6. Check ingress/gateway status
kubectl get gateway -A
kubectl get httproute -A | grep -v Ready
# Expected: All routes ready
```

**24-Hour Monitoring:**

```bash
# 1. Verify backups running on new cluster
kubectl get rs -A -o custom-columns=\
NAME:.metadata.name,\
NAMESPACE:.metadata.namespace,\
LAST_SYNC:.status.lastSyncTime

# All should show timestamps within last hour

# 2. Check backup jobs completed successfully
kubectl get jobs -n volsync-system | grep volsync-src | grep -v Completed
# Expected: No output (all completed)

# 3. Verify new snapshots in Kopia repository
kubectl exec -n volsync-system deploy/kopia -- \
  kopia snapshot list --max-results 50
# Should show new snapshots with today's date

# 4. Monitor Prometheus alerts (if configured)
kubectl get prometheusalerts -A | grep -i volsync
# Expected: No firing alerts

# 5. Review application metrics
kubectl top pods -A | sort -k3 -rn | head -20
# Compare to baseline from source cluster

# 6. Check for OOM kills or restarts
kubectl get pods -A -o custom-columns=\
NAME:.metadata.name,\
NAMESPACE:.metadata.namespace,\
RESTARTS:.status.containerStatuses[0].restartCount | grep -v "0$"
# Investigate any non-zero restart counts
```

**7-Day Validation:**

```bash
# 1. Verify backup retention policy working
kubectl exec -n volsync-system deploy/kopia -- kopia snapshot list --all
# Should show:
# - 24 hourly snapshots for each app
# - 7 daily snapshots for each app

# 2. Test restore from backup (on test PVC)
kubectl patch rd test-restore -n default --type merge \
  -p '{"spec":{"trigger":{"manual":"validation-restore"}}}'
# Verify restore succeeds

# 3. Review cluster stability metrics
kubectl get nodes
kubectl describe nodes | grep -A 5 "Allocated resources"
# Ensure nodes are healthy and not overloaded

# 4. Application-specific validation
# For critical apps, perform detailed functional tests:
# - Home Assistant: Check automation triggers work
# - Nextcloud: Upload/download files, test sharing
# - Plex: Verify library scans, test transcoding
# - Radarr/Sonarr: Test search and download workflows

# 5. User acceptance testing
# Gather feedback from users on application functionality
# Document any issues or performance concerns

# 6. Performance comparison
# Compare response times, error rates, and resource usage
# to source cluster baseline

# 7. Disaster recovery drill
# Test restore procedure on a non-critical app
# Verify you can recover if disaster strikes
```

### Monitoring Dashboard (Optional)

If using Prometheus/Grafana, create a migration monitoring dashboard:

**Prometheus Queries:**

```promql
# Backup success rate
rate(volsync_replication_source_success_total[1h])

# Backup duration
volsync_replication_source_duration_seconds

# PVC usage
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100

# Pod restart count
kube_pod_container_status_restarts_total

# Application response time (example for HTTP apps)
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)
```

**Grafana Dashboard Panels:**

1. **Backup Status** - Show success/failure of recent backups
2. **PVC Usage** - Track storage consumption on destination cluster
3. **Pod Health** - Display running/crashed pod counts
4. **Application Response Times** - Monitor performance
5. **Network Throughput** - Track data transfer rates
6. **Resource Utilization** - CPU/memory usage trends

---

## Quick Reference

### Critical Commands

#### Backup Operations

```bash
# Trigger manual backup
kubectl patch rs ${APP} -n ${NAMESPACE} --type merge \
  -p '{"spec":{"trigger":{"manual":"backup-now"}}}'

# Check backup status
kubectl get rs ${APP} -n ${NAMESPACE} -o json | jq .status

# View backup logs
kubectl logs -n volsync-system -l job-name=volsync-src-${APP}-* -f

# List all backups
kubectl get replicationsource -A
```

#### Restore Operations

```bash
# Trigger restore
kubectl patch rd ${APP}-dst -n ${NAMESPACE} --type merge \
  -p '{"spec":{"trigger":{"manual":"restore-once"}}}'

# Check restore status
kubectl get rd ${APP}-dst -n ${NAMESPACE} -o json | jq .status

# View restore logs
kubectl logs -n volsync-system -l job-name=volsync-dst-${APP}-* -f

# Wait for restore to complete
kubectl wait --for=condition=LatestMoverStatus=Succeeded \
  rd/${APP}-dst -n ${NAMESPACE} --timeout=3600s
```

#### Kopia Operations

```bash
# Repository status
kubectl exec -n volsync-system deploy/kopia -- kopia repository status

# List snapshots
kubectl exec -n volsync-system deploy/kopia -- kopia snapshot list

# Show snapshot details
kubectl exec -n volsync-system deploy/kopia -- kopia snapshot show ${SNAPSHOT_ID}

# Repository statistics
kubectl exec -n volsync-system deploy/kopia -- kopia repository stats

# Web UI access
kubectl port-forward -n volsync-system svc/kopia 8080:80
# Navigate to http://localhost:8080
```

#### Application Management

```bash
# Scale application to 0 (stop)
kubectl scale deployment ${APP} -n ${NAMESPACE} --replicas=0

# Scale application back up (start)
kubectl scale deployment ${APP} -n ${NAMESPACE} --replicas=1

# Restart application
kubectl rollout restart deployment/${APP} -n ${NAMESPACE}

# Check application logs
kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=${APP} --tail=100 -f

# Exec into pod
kubectl exec -it -n ${NAMESPACE} $(kubectl get pod -n ${NAMESPACE} -l app.kubernetes.io/name=${APP} -o name) -- /bin/bash
```

### Migration Quick Commands

#### Pre-Migration

```bash
# Check all backups are recent (< 1 hour old)
kubectl get rs -A -o json | jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name): \(.status.lastSyncTime)"' | grep -v $(date -u -d '1 hour ago' +%Y-%m-%d)

# Verify Kopia repository accessible
kubectl exec -n volsync-system deploy/kopia -- ls -la /repository

# Check storage availability on destination cluster
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, allocatable: .status.allocatable.storage}'
```

#### During Migration

```bash
# Monitor all restores in progress
watch 'kubectl get rd -A -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,STATUS:.status.latestMoverStatus.phase'

# Check PVC creation progress
watch 'kubectl get pvc -A | grep -E "NAME|Pending|Bound"'

# Monitor pod startups
watch 'kubectl get pods -A | grep -v Running | grep -v Completed'
```

#### Post-Migration

```bash
# Quick health check
kubectl get pods -A | grep -v Running | grep -v Completed | wc -l
# Expected: 0

# Verify all PVCs bound
kubectl get pvc -A | grep -v Bound | wc -l
# Expected: 0

# Check for application errors
kubectl get events -A --field-selector type=Warning | grep -E "(OOM|Failed|Error)"

# Test application access
for app in nextcloud plex home-assistant; do
  curl -I https://${app}.g-eye.io 2>&1 | head -1
done
```

### Emergency Procedures

#### Rollback to Source Cluster

```bash
# 1. Immediately update DNS to source cluster
# (Use your DNS provider's emergency procedure)

# 2. Scale source cluster apps back up
kubectl scale deployment --all --replicas=1 -n default --context=source-cluster

# 3. Verify source cluster health
kubectl get pods -A --context=source-cluster

# 4. Monitor traffic return to source
kubectl top pods -A --context=source-cluster
```

#### Restore Single Application from Backup

```bash
# 1. Stop application
kubectl scale deployment ${APP} -n ${NAMESPACE} --replicas=0

# 2. Delete corrupted PVC
kubectl delete pvc ${APP} -n ${NAMESPACE}

# 3. Trigger restore
kubectl patch rd ${APP}-dst -n ${NAMESPACE} --type merge \
  -p '{"spec":{"trigger":{"manual":"emergency-restore"}}}'

# 4. Wait for restore
kubectl wait --for=condition=LatestMoverStatus=Succeeded \
  rd/${APP}-dst -n ${NAMESPACE} --timeout=3600s

# 5. Start application
kubectl scale deployment ${APP} -n ${NAMESPACE} --replicas=1

# 6. Verify functionality
kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=${APP} --tail=100 -f
```

### Useful One-Liners

```bash
# Count total PVC capacity in cluster
kubectl get pvc -A -o json | jq -r '.items[].spec.resources.requests.storage' | grep Gi | sed 's/Gi//' | awk '{s+=$1} END {print s " Gi"}'

# Find largest PVCs
kubectl get pvc -A -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,SIZE:.spec.resources.requests.storage | sort -k3 -rn | head -10

# Check which apps have recent backups
kubectl get rs -A -o json | jq -r '.items[] | select(.status.lastSyncTime > (now - 3600 | todate)) | "\(.metadata.namespace)/\(.metadata.name)"'

# List apps without backups
comm -23 <(kubectl get pvc -A --no-headers | awk '{print $1"/"$2}' | sort) <(kubectl get rs -A --no-headers | awk '{print $1"/"$2}' | sort)

# Monitor Kopia repository growth
watch 'kubectl exec -n volsync-system deploy/kopia -- kopia repository stats | grep "Total size"'

# Check NFS mount in Volsync jobs
kubectl get pods -n volsync-system -o json | jq -r '.items[] | select(.metadata.name | startswith("volsync")) | .spec.volumes[] | select(.nfs != null) | .nfs'
```

---

## Appendix

### File Structure Reference

```
/kubernetes/
├── apps/
│   ├── volsync-system/
│   │   ├── volsync/
│   │   │   ├── app/
│   │   │   │   ├── helmrelease.yaml           # Volsync installation
│   │   │   │   ├── mutatingadmissionpolicy.yaml # NFS injection + jitter
│   │   │   │   └── prometheusrule.yaml        # Monitoring alerts
│   │   │   └── ks.yaml
│   │   ├── kopia/
│   │   │   ├── app/
│   │   │   │   ├── helmrelease.yaml           # Kopia installation
│   │   │   │   ├── externalsecret.yaml        # Kopia credentials
│   │   │   │   └── resources/
│   │   │   │       └── repository.config      # Kopia config
│   │   │   └── ks.yaml
│   │   └── kustomization.yaml
│   └── default/                                # Application namespaces
│       ├── home-assistant/
│       │   └── ks.yaml                         # Includes volsync component
│       ├── nextcloud/
│       │   └── ks.yaml                         # Includes volsync component
│       └── ...
├── components/
│   └── volsync/
│       ├── replicationsource.yaml              # Backup template
│       ├── replicationdestination.yaml         # Restore template
│       ├── pvc.yaml                            # PVC template
│       ├── externalsecret.yaml                 # Secrets template
│       └── kustomization.yaml
└── ...
```

### Glossary

| Term | Definition |
|------|------------|
| **Volsync** | Kubernetes operator for asynchronous volume replication |
| **Kopia** | Content-addressable backup tool with deduplication and encryption |
| **ReplicationSource** | Volsync CRD that defines a backup source (PVC to back up) |
| **ReplicationDestination** | Volsync CRD that defines a restore target (where to restore PVC) |
| **Ceph RBD** | RADOS Block Device - block storage backend for Ceph |
| **CSI** | Container Storage Interface - Kubernetes storage plugin standard |
| **Snapshot** | Point-in-time copy of a volume (using CSI VolumeSnapshot) |
| **NFS** | Network File System - protocol for accessing remote filesystems |
| **OnePassword** | Password manager used for storing Kopia repository password |
| **External Secrets Operator** | Kubernetes operator for syncing secrets from external vaults |
| **MutatingAdmissionPolicy** | Kubernetes admission controller for modifying resources |
| **OpenEBS** | Container-attached storage for Kubernetes (used for cache) |
| **Flux** | GitOps toolkit for Kubernetes continuous delivery |
| **HelmRelease** | Flux CRD for managing Helm chart deployments |
| **Kustomization** | Flux CRD for managing Kustomize overlays |
| **PVC** | PersistentVolumeClaim - request for storage in Kubernetes |
| **PV** | PersistentVolume - actual storage backing a PVC |
| **StorageClass** | Kubernetes abstraction for storage provisioner configuration |
| **VolumeSnapshotClass** | Configuration for CSI volume snapshot provisioner |

### Retention Policy Details

**Hourly Snapshots:**
- Frequency: Every hour at top of hour (0 * * * *)
- Retention: 24 snapshots
- Coverage: Last 24 hours with hourly granularity
- Automatic deletion: Snapshots older than 24 hours (if not promoted to daily)

**Daily Snapshots:**
- Frequency: One per day (promoted from hourly)
- Retention: 7 snapshots
- Coverage: Last 7 days with daily granularity
- Automatic deletion: Snapshots older than 7 days

**Example Timeline:**

```
Current Time: 2025-11-03 14:00

Hourly Snapshots (24):
2025-11-03 14:00 ← Most recent
2025-11-03 13:00
2025-11-03 12:00
...
2025-11-02 15:00 ← 24 hours ago

Daily Snapshots (7):
2025-11-03 00:00 ← Most recent daily
2025-11-02 00:00
2025-11-01 00:00
2025-10-31 00:00
2025-10-30 00:00
2025-10-29 00:00
2025-10-28 00:00
2025-10-27 00:00 ← Will be deleted tonight
```

**Recovery Scenarios:**

| Time Since Change | Recovery Granularity | Snapshot Used |
|-------------------|---------------------|---------------|
| 1 hour ago | Hourly | Most recent hourly |
| 12 hours ago | Hourly | 12th hourly snapshot |
| 24 hours ago | Hourly or Daily | 24th hourly or 1st daily |
| 3 days ago | Daily | 3rd daily snapshot |
| 7 days ago | Daily | 7th daily snapshot |
| >7 days ago | **NOT RECOVERABLE** | N/A |

### Storage Requirements

**Source Cluster:**
- PVC storage: ~350Gi (application data)
- Snapshot storage: Minimal (Ceph CoW snapshots)
- Cache storage (OpenEBS): 5Gi per concurrent backup job

**Destination Cluster:**
- PVC storage: ~350Gi (restored application data)
- Cache storage (OpenEBS): 5Gi per concurrent restore job

**NAS Storage (Kopia Repository):**
- Initial full backup: ~350Gi
- With deduplication (estimated): ~200-250Gi
- With compression (zstd-fastest): ~140-200Gi
- Total with 7-day retention: ~150-250Gi (depends on change rate)

**Example Calculation:**

```
Application Data: 350Gi
Deduplication ratio: 1.5x (typical for mixed data)
Compression ratio: 1.4x (zstd-fastest)
Effective size: 350 / 1.5 / 1.4 ≈ 167Gi

Daily change rate: ~5% (17.5Gi/day)
7-day incremental: 7 * 17.5 = 122.5Gi

Total repository size: 167 + 122.5 = ~290Gi (with some overhead)
```

### Migration Checklist (Printable)

**Pre-Migration:**
- [ ] All ReplicationSources show recent sync (<1 hour)
- [ ] No backup jobs in Error or Failed state
- [ ] Kopia repository accessible and healthy
- [ ] OnePassword integration working
- [ ] NAS accessible from source cluster
- [ ] Destination cluster infrastructure ready
- [ ] Rook-Ceph deployed and healthy on destination
- [ ] Storage classes available on destination
- [ ] External Secrets Operator configured on destination
- [ ] Volsync and Kopia deployed on destination
- [ ] NAS accessible from destination cluster

**Migration:**
- [ ] Applications scaled down on source (Cold) or read-only (Hot)
- [ ] Final backups triggered and completed
- [ ] ReplicationDestination resources created on destination
- [ ] Restores triggered for all applications
- [ ] All restores completed successfully
- [ ] All PVCs bound on destination
- [ ] Applications started on destination
- [ ] No CrashLoopBackOff pods

**Post-Migration:**
- [ ] All pods Running on destination
- [ ] Application logs clean (no critical errors)
- [ ] Data integrity spot checks passed
- [ ] DNS/routing updated to destination cluster
- [ ] Applications accessible via production URLs
- [ ] User testing confirms functionality
- [ ] Backups running hourly on destination cluster
- [ ] New snapshots visible in Kopia repository
- [ ] Monitoring and alerts configured
- [ ] No critical alerts firing

**7-Day Validation:**
- [ ] Cluster stable for 7 days
- [ ] Backup retention policy working correctly
- [ ] Test restore successful from backup
- [ ] User acceptance testing complete
- [ ] Performance comparable to source cluster
- [ ] No data loss or corruption reports
- [ ] Ready to decommission source cluster

---

## Why Migrate to K0s?

K0s (https://k0sproject.io/) is an excellent Kubernetes distribution for home labs and production environments that offers several advantages:

### K0s Advantages

**Simplicity:**
- ✅ **Zero Dependencies**: Single binary, no external dependencies
- ✅ **Zero Friction**: Install with one command, no complex configuration
- ✅ **Zero Cost**: Open source, no licensing fees
- ✅ **Automated Setup**: `k0sctl` handles multi-node deployment
- ✅ **Batteries Included**: CoreDNS, metrics-server, kube-router built-in

**Operations:**
- ✅ **Self-Managed etcd**: No separate etcd cluster to maintain
- ✅ **Autopilot Support**: Automated cluster upgrades
- ✅ **Multiple Architectures**: x86, ARM, ARM64 support
- ✅ **Flexible Deployment**: Controller+Worker, single-node, or HA
- ✅ **Minimal Footprint**: ~150MB RAM for controller

**Compatibility:**
- ✅ **100% Upstream Kubernetes**: Certified Kubernetes conformant
- ✅ **Standard APIs**: Works with all standard Kubernetes tools
- ✅ **Flexible CNI**: Supports Cilium, Calico, or default kube-router
- ✅ **Extensions**: Helm, Kustomize, operators work as expected

**Perfect for Home Labs:**
- ✅ **Low Resource Usage**: Ideal for Raspberry Pi, NUCs, older hardware
- ✅ **Easy Upgrades**: In-place cluster upgrades with Autopilot
- ✅ **Production-Ready**: Used in production by many organizations
- ✅ **Active Community**: Regular releases and support

### When to Choose K0s

**Ideal Scenarios:**
- Migrating from heavier distributions (vanilla K8s, Rancher)
- Consolidating multiple small clusters
- Running on resource-constrained hardware
- Simplifying cluster operations and maintenance
- Learning Kubernetes without complexity overhead
- Building edge or IoT deployments

**This Repository's K0s Setup:**
- **Version**: K0s v1.29.1+k0s.0
- **CNI**: Cilium (replaces default kube-router)
- **Storage**: Rook-Ceph with RBD
- **GitOps**: Flux for declarative management
- **Monitoring**: Kube-Prometheus-Stack
- **Networking**: Gateway API with Cilium

---

## Additional Resources

### Documentation Links

- **K0s Official Docs:** https://docs.k0sproject.io/
- **K0s GitHub:** https://github.com/k0sproject/k0s
- **Volsync Official Docs:** https://volsync.readthedocs.io/
- **Kopia Documentation:** https://kopia.io/docs/
- **Rook-Ceph Docs:** https://rook.io/docs/rook/latest/
- **External Secrets Operator:** https://external-secrets.io/
- **Kubernetes CSI Snapshots:** https://kubernetes.io/docs/concepts/storage/volume-snapshots/

### Community Resources

- **Volsync GitHub:** https://github.com/backube/volsync
- **Kopia GitHub:** https://github.com/kopia/kopia
- **r/selfhosted:** https://reddit.com/r/selfhosted
- **Kubernetes Slack:** https://slack.k8s.io/

### Support

For issues specific to this repository's Volsync configuration:
1. Check the [troubleshooting section](#troubleshooting)
2. Review Volsync pod logs: `kubectl logs -n volsync-system -l app.kubernetes.io/name=volsync`
3. Check Kopia logs: `kubectl logs -n volsync-system deploy/kopia`
4. Open an issue in the repository with:
   - Kubernetes version and distribution
   - Volsync and Kopia versions
   - Relevant logs and error messages
   - Steps to reproduce

---

**Last Updated:** November 3, 2025
**Version:** 1.0
**Target Distribution:** K0s v1.29.1+k0s.0
**Volsync Version:** v0.16.13
**Kopia Version:** 0.21.1
