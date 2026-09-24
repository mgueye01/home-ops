# Certificate Renewal Failure Runbook

## Alert: CertManagerCertExpirySoon

### Symptoms

- A cert-manager `Certificate` is near expiry, `Ready=False`, or has not renewed inside its normal renewal window.
- A `CertificateRequest`, `Order`, or `Challenge` is Pending or Failed.
- An external endpoint may still serve an old certificate even though cert-manager shows the source certificate as renewed.

### Confirm the Cause

1. Identify the certificate and compare `notAfter`, `renewalTime`, and conditions:

   ```bash
   kubectl get certificates -A
   kubectl -n <namespace> describe certificate <name>
   kubectl -n <namespace> get certificaterequests,orders,challenges
   ```

2. Confirm the production issuer and controller are healthy:

   ```bash
   kubectl get clusterissuer letsencrypt-production
   kubectl describe clusterissuer letsencrypt-production
   kubectl -n cert-manager get pods
   kubectl -n cert-manager logs deploy/cert-manager --since=1h
   ```

3. Inspect the relevant request, order, challenge, events, and DNS response. Do not print token or TLS private-key Secret values.

4. Compare the certificate stored in the source TLS Secret with the certificate served externally:

   ```bash
   kubectl -n <namespace> get secret <tls-secret> -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -subject -issuer -dates -serial
   openssl s_client -connect <hostname>:443 -servername <hostname> </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -serial
   ```

If the source Secret is current but the endpoint serves an old certificate, inspect the Gateway/Ingress Secret import path. An ExternalSecret using `refreshPolicy: CreatedOnce` can leave a copied TLS Secret stale.

### Safe Fix

- For a transient ACME or DNS-provider error, allow cert-manager's normal retry and watch the request progress.
- Restart only a clearly stuck cert-manager pod when the deployment has healthy replicas and no configuration change is required.
- Reconcile the cert-manager Kustomization when Git is known-good and live state drifted.
- Make durable issuer, DNS solver, ExternalSecret refresh-policy, Gateway, or Ingress changes through a narrow reviewed GitOps PR. Keep all tokens and private keys in 1Password/External Secrets.

### Verify Afterwards

```bash
kubectl -n <namespace> get certificate <name>
kubectl -n <namespace> get certificaterequests,orders,challenges
kubectl get clusterissuer letsencrypt-production
```

Confirm `Ready=True`, `notAfter` and `renewalTime` advanced, temporary ACME resources completed, the source and imported TLS Secrets carry the same current certificate, and the external endpoint serves that certificate with a valid chain.

### Escalate Instead

Ask before changing DNS, Cloudflare credentials, Gateway/Ingress configuration, ExternalSecret behavior, or forcing broad certificate reissuance. Escalate immediately when a public certificate is expired, multiple certificates cannot renew, the issuer account or DNS solver is invalid, a private key may be exposed, or the renewed Secret is not reaching a critical external endpoint. Never expose Secret data in comments or logs.
