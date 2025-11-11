# Storage Full Runbook

## Alert: PersistentVolumeCriticallyFull / KubePersistentVolumeFillingUp

### Symptoms
- PersistentVolume usage above threshold (80%, 95%, or predicted to fill within 4 days)
- Applications may fail to write data
- Pods may enter CrashLoopBackOff

### Investigation

1. **Identify the volume:**
   ```bash
   kubectl get pvc -A | grep <pvc-name>
   ```

2. **Check current usage:**
   ```bash
   kubectl exec -n <namespace> <pod-name> -- df -h /path/to/mount
   ```

3. **Check Grafana for trends:**
   - Dashboard: https://grafana.g-eye.io/d/kubernetes-volumes
   - Look for usage patterns (sudden spike vs gradual growth)

4. **Check application logs:**
   ```bash
   kubectl logs -n <namespace> <pod-name> | grep -i "space\|full\|error"
   ```

### Resolution Options

#### Option 1: Expand PVC (Recommended for permanent fix)

1. Find the PVC configuration:
   ```bash
   find kubernetes/apps -name "*.yaml" -exec grep -l "VOLSYNC_CAPACITY\|storage:" {} \;
   ```

2. Increase size (VolSync-managed volumes):
   ```yaml
   # In the app's ks.yaml:
   postBuild:
     substitute:
       VOLSYNC_CAPACITY: 200Gi  # Increase from current value
   ```

   Or direct PVC:
   ```yaml
   spec:
     resources:
       requests:
         storage: 200Gi  # Increase from current value
   ```

3. Commit and push:
   ```bash
   git add <file>
   git commit -m "fix: expand <app> volume to <size>"
   git push
   ```

4. Wait for Flux reconciliation (1-5 minutes)

5. Verify expansion:
   ```bash
   kubectl get pvc -n <namespace> <pvc-name> -w
   kubectl exec -n <namespace> <pod-name> -- df -h /path/to/mount
   ```

#### Option 2: Clean Up Data (Temporary relief)

1. Identify what's using space:
   ```bash
   kubectl exec -n <namespace> <pod-name> -- du -sh /* | sort -h
   ```

2. Clean up based on application type:
   - **Databases**: Delete old backups, run VACUUM, archive old data
   - **Logs**: Truncate or rotate logs
   - **Media**: Remove unused files
   - **Caches**: Clear application caches

3. Example cleanup commands:
   ```bash
   # ClickHouse (like rybbit)
   kubectl exec -n default rybbit-clickhouse-xyz -- clickhouse-client --query "OPTIMIZE TABLE tablename FINAL"

   # PostgreSQL
   kubectl exec -n <ns> postgres-xyz -- psql -U user -d db -c "VACUUM FULL"
   ```

#### Option 3: Enable Compression (Application-specific)

Check if application supports compression:
- ClickHouse: Enable codec in table definitions
- PostgreSQL: Enable `pg_compression`
- File storage: Enable filesystem-level compression

### Prevention

1. **Monitor trends in Grafana**
2. **Set appropriate initial sizes** (overestimate growth)
3. **Implement data retention policies**
4. **Enable compression where possible**
5. **Test alerts** after any volume changes

### Related Incidents

- 2025-11-11: Rybbit ClickHouse filled 20GB, expanded to 200GB
  - Commit: `0af1d334` (volume expansion)
  - Duration of impact: 10 days (2025-11-01 to 2025-11-11)
  - Root cause: No alerting, metrics not collected
  - Resolution: Volume expanded from 20Gi to 200Gi, monitoring added via PrometheusRule and ServiceMonitor
