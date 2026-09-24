# Gateway, DNS, and Cilium Outage Triage Runbook

## Alerts: broad endpoint, DNS, Gateway, or network failure fan-out

### Symptoms

- Many unrelated applications fail together, often across `kube-system` and `network`.
- Internal names fail, HTTPRoutes are not accepted/resolved, Envoy has no healthy backend, or Cloudflare Tunnel is disconnected.
- Public HTTPS calls intermittently fail on IPv6 literals although this cluster is intentionally IPv4-only.

### Confirm the Cause

1. Establish blast radius and the first failing layer:

   ```bash
   kubectl -n kube-system get pods -l k8s-app=cilium -o wide
   kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
   kubectl -n network get pods,helmreleases
   kubectl get gateways,httproutes -A
   flux get all -A --status-selector ready=false
   ```

2. Test, from a disposable diagnostic pod, Kubernetes Service resolution, one external A record, one external AAAA query, ClusterIP reachability, and an affected HTTP backend. Do not change CoreDNS or Cilium merely because one application times out.
3. Inspect Gateway status conditions:

   ```bash
   kubectl get gateway -A -o wide
   kubectl get httproute -A \
     -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name,ACCEPTED:.status.parents[*].conditions[?(@.type=="Accepted")].status,RESOLVED:.status.parents[*].conditions[?(@.type=="ResolvedRefs")].status'
   ```

4. Inspect Envoy Gateway/listener/backend and Cloudflare Tunnel logs, then CoreDNS and Cilium logs. Confirm whether the failure is DNS, route programming, endpoint health, policy, tunnel, or an application backend.
5. For `dial tcp [IPv6]:... network is unreachable`, prove all three before blaming DNS: Cilium has IPv6 disabled, pods have no usable IPv6 default route, and CoreDNS returns public AAAA answers. Correlate current Alertmanager, Flux logs, Alertmanager receiver logs, and VictoriaLogs history because Prometheus may not retain log-derived alerts.
6. Compare live state with Git for `kube-system/cilium`, `kube-system/coredns`, `network/envoy-gateway`, `network/cloudflare-dns`, `network/unifi-dns`, and `network/cloudflare-tunnel`.

### Safe Fix

- Restart only one demonstrably stuck pod when its controller has healthy replacement capacity and the desired configuration is correct.
- Reconcile one drifted Kustomization/HelmRelease after proving the dependency is healthy.
- If a transient upstream or control-plane interruption recovered, allow normal controller retry and verify a quiet period.
- Draft systemic DNS/Gateway/Cilium fixes in a focused GitOps PR with rollback, but do not deploy them without approval.

### Verify Afterwards

- CoreDNS and Cilium replicas are Ready; Cilium endpoints/policies are healthy.
- Internal service DNS and external A lookups work. On the IPv4-only design, external AAAA behavior matches the approved CoreDNS policy and does not produce `SERVFAIL`.
- Gateways are `Programmed=True`; affected HTTPRoutes are accepted and references resolved; Envoy backends are healthy.
- Cloudflare Tunnel and DNS controllers are healthy; internal and external synthetic checks pass.
- Flux and External Secrets recover and VictoriaLogs shows no new cross-workload network error during a meaningful quiet period.

### Escalate Instead

Any Cilium, CoreDNS, Gateway, Cloudflare, UniFi DNS, routing, firewall, or network-policy change requires Mehdi. Escalate immediately for cluster-wide DNS loss, API connectivity loss, an unavailable public entry point, or a change that could lock operators out. Do not enable dual stack or broadly suppress DNS records as an incident-time experiment.
