# Talos and Kubernetes Minor Upgrade Runbook

## Trigger: supported minor versions are available

### Symptoms

- Live/Git versions are aligned but behind upstream; the 2026-09-25 baseline recorded Talos `1.13.9` and Kubernetes `1.36.5`, with `1.14.1` and `1.37.1` current.
- Renovate may open separate component PRs, while a `system-upgrade-controller` Plan can upgrade the full Kubernetes control plane.

### Confirm the Cause

1. Read upstream compatibility, release, and known-issue notes. Confirm a supported one-minor-at-a-time path and Talos/Kubernetes version-skew rules.
2. Compare desired and live versions:

   ```bash
   kubectl get nodes -o wide
   kubectl -n system-upgrade get plans,jobs -o wide
   talosctl version
   flux get all -A --status-selector ready=false
   ```

3. Inspect `kubernetes/apps/system-upgrade/system-upgrade-controller/plans/{talos,kubernetes}.yaml`, Talos machine configuration, Image Factory schematic, and the complete PR diff. A plan invoking `talosctl upgrade-k8s --to <version>` upgrades API server, controller-manager, scheduler, and kubelet, even if a PR title names one image.
4. Establish preflight gates: all nodes Ready, Ceph `HEALTH_OK` with OSDs up/in, Cilium/CoreDNS healthy, Flux fully reconciled to the exact Git SHA, backups current, no active incident, and a tested management path independent of workloads.
5. Record current versions/configuration and a rollback/recovery plan. Talos rollback constraints differ from ordinary application rollbacks.

### Safe Fix

- Do not start automatically. Obtain Mehdi's explicit approval for each Talos/control-plane rollout and maintenance window.
- Upgrade Talos before Kubernetes when the target Kubernetes version requires the newer Talos release.
- Preserve the Image Factory schematic and machine configuration. Roll one node at a time according to the approved Plan, maintaining control-plane quorum and Ceph availability.
- Wait for each Talos node to return Ready and for Ceph/Cilium/Flux to stabilize before advancing.
- Run the Kubernetes Plan separately. Do not merge sibling component-pin PRs merely because the live Plan already changed those images; reconcile Git deliberately under the normal PR policy.

### Verify Afterwards

- Each Plan is `Complete=True` at the approved target version.
- Every node is Ready and reports the target Talos/Kubernetes version.
- kube-apiserver, controller-manager, scheduler, and kubelet versions/images are consistent and healthy on every control-plane node.
- Ceph is `HEALTH_OK`; Cilium/CoreDNS, Flux Kustomizations/HelmReleases, certificates, backups, and representative applications are healthy.
- Observe the normal Flux webhook path and exact applied merge SHA before using a targeted reconcile.

### Escalate Instead

Stop and escalate for quorum risk, a NotReady node, Ceph degradation, Cilium/DNS failure, scheduler/API/etcd errors, an unsupported skew, a failed Plan, or any need to roll back machine configuration. Never advance to Kubernetes while Talos or storage is unstable. All Talos machine-config and control-plane changes require Mehdi.
