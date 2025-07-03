# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a GitOps-based homelab infrastructure repository that manages a complete Kubernetes cluster using Talos Linux as the base OS. The setup includes a comprehensive stack of applications ranging from media services to development tools, all managed through Flux CD.

## Key Technologies

- **Kubernetes**: Container orchestration with Cilium CNI
- **Talos Linux**: Immutable OS for Kubernetes nodes
- **Flux CD**: GitOps continuous deployment
- **SOPS + Age**: Encrypted secrets management
- **Taskfile**: Task automation and scripts
- **Renovate**: Automated dependency updates

## Common Commands

### Task Management
```bash
# List all available tasks
task --list

# Bootstrap entire cluster (requires ROOK_DISK variable)
task bootstrap:default ROOK_DISK=Micron_7450_MTFDKBA800TFS

# Generate kubeconfig for cluster
task talos:kubeconfig

# Apply Talos config to specific node
task talos:apply-node IP=192.168.1.10

# Upgrade Talos on specific node
task talos:upgrade-node IP=192.168.1.10

# Upgrade Kubernetes across cluster
task talos:upgrade-k8s
```

### Kubernetes Operations
```bash
# Mount PVC to temporary container for debugging
task kubernetes:browse-pvc NS=default CLAIM=pvc-name

# Open shell to specific node
task kubernetes:node-shell NODE=node-name

# Sync all ExternalSecrets
task kubernetes:sync-secrets

# Check reachability of all HTTPRoutes
task kubernetes:check-httproutes

# Clean up failed/pending/succeeded pods
task kubernetes:cleanse-pods

# Upgrade Actions Runner Controller
task kubernetes:upgrade-arc
```

### VolSync Operations
```bash
# Suspend/resume VolSync
task volsync:state-suspend
task volsync:state-resume

# Snapshot an application
task volsync:snapshot NS=namespace APP=app-name

# Restore application from backup
task volsync:restore NS=namespace APP=app-name PREVIOUS=backup-timestamp

# Unlock restic repositories
task volsync:unlock
```

### Workstation Setup
```bash
# Install Homebrew tools
task workstation:brew

# Install kubectl krew plugins
task workstation:krew
```

### Testing and Validation
```bash
# Run pre-commit hooks
pre-commit run --all-files

# Test Flux configurations locally
flux-local test --path kubernetes/flux/cluster

# Validate Kubernetes schemas
kubectl --dry-run=client apply -f kubernetes/
```

## Architecture Overview

### Directory Structure
- `/kubernetes/` - Main Kubernetes manifests organized by namespace
  - `/apps/` - Application deployments across different namespaces
  - `/flux/` - Flux CD cluster configuration
  - `/components/` - Reusable Kubernetes components
- `/talos/` - Talos Linux configuration templates
- `/scripts/` - Bootstrap and maintenance scripts
- `/.taskfiles/` - Modular task definitions
- `/.github/` - GitHub Actions workflows

### Key Configuration Files
- `.sops.yaml` - SOPS configuration for encrypted secrets
- `Taskfile.yaml` - Main task runner configuration
- `.pre-commit-config.yaml` - Pre-commit hooks for code quality
- `.renovaterc.json5` - Renovate configuration for dependency updates
- `.minijinja.toml` - Jinja2 template configuration

### Secret Management
- All secrets are encrypted with SOPS using age encryption
- Age key is stored in `age.key` file
- Secret files follow `*.sops.yaml` naming convention
- External Secrets Operator manages secret injection into cluster

### GitOps Workflow
1. Changes are made to configuration files
2. Pre-commit hooks validate changes
3. Flux CD automatically applies changes to cluster
4. Renovate creates PRs for dependency updates
5. GitHub Actions validate configurations

### Application Categories
- **Media Services**: Plex, Sonarr, Radarr, Jellyseerr, Tautulli
- **Development**: Gitea, Harbor, Backstage, Actions Runner Controller
- **Home Automation**: Home Assistant, Mosquitto MQTT
- **Monitoring**: Grafana, Prometheus, Loki, Gatus
- **Storage**: Rook Ceph, PostgreSQL, Redis
- **Networking**: Authelia, Cloudflare, Cert-Manager

## Development Workflow

### Making Changes
1. Create feature branch from `main`
2. Make configuration changes
3. Run pre-commit hooks: `pre-commit run --all-files`
4. Test with flux-local if modifying Flux configs
5. Commit changes and push
6. Create PR for review

### Secrets Management
- Use SOPS to encrypt sensitive data: `sops -e -i file.sops.yaml`
- Never commit unencrypted secrets
- Use External Secrets Operator for secret injection

### Testing
- Pre-commit hooks run automatically on commit
- GitHub Actions validate schemas and run flux-local tests
- Use `task kubernetes:check-httproutes` to verify service reachability

### Environment Variables
- `KUBECONFIG`: Path to kubeconfig file
- `TALOSCONFIG`: Path to Talos configuration
- `SOPS_AGE_KEY_FILE`: Path to age encryption key
- `ROOK_DISK`: Disk model for Rook Ceph storage

## Troubleshooting

### Common Issues
- **Flux not syncing**: Check `flux get all` and `flux logs`
- **Secrets not available**: Verify External Secrets Operator status
- **Pod scheduling issues**: Check node resources and taints
- **Storage issues**: Verify Rook Ceph cluster health

### Debugging Commands
```bash
# Check Flux status
flux get all

# View pod logs
kubectl logs -n namespace pod-name

# Check External Secrets
kubectl get externalsecrets --all-namespaces

# Monitor Talos system
talosctl -n node-ip logs

# Check Rook Ceph status
kubectl -n rook-ceph get cephcluster
```

## Security Considerations

- All secrets are encrypted with SOPS
- Pre-commit hooks prevent committing unencrypted secrets
- Network policies restrict pod communication
- Authelia provides authentication for external services
- Regular security updates via Renovate
