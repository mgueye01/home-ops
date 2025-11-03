# Home-Ops Documentation

This directory contains comprehensive documentation for managing and operating this Kubernetes home lab infrastructure.

## Available Documentation

### [Volsync Migration Guide](./volsync-migration-guide.md)

**Complete guide for migrating to K0s from any Kubernetes distribution without data loss**

This guide provides detailed instructions for using Volsync and Kopia to migrate your entire Kubernetes cluster TO K0s from any other distribution (e.g., K3s, vanilla K8s, etc.) with zero data loss.

**Key Topics Covered:**

- ✅ **Architecture Overview** - How Volsync and Kopia work together
- ✅ **Prerequisites** - What you need before starting
- ✅ **Migration Strategies** - Cold, Hot (Blue-Green), and Gradual migration approaches
- ✅ **Step-by-Step Procedures** - Detailed commands for each migration strategy
- ✅ **Application-Specific Considerations** - Special handling for Nextcloud, Plex, databases, etc.
- ✅ **Troubleshooting** - Solutions to common issues
- ✅ **Monitoring and Validation** - How to verify successful migration
- ✅ **Quick Reference** - Essential commands and checklists

**Quick Stats:**
- 23 applications backed up
- 350+ Gi of data protected
- Hourly backups with 7-day retention
- Recovery Time Objective: Minutes to hours
- Recovery Point Objective: 1 hour

**When to Use This Guide:**
- Migrating TO K0s from K3s, vanilla Kubernetes, or any other distribution
- Consolidating to K0s for simplified Kubernetes operations
- Disaster recovery planning
- Testing K0s environment with production data
- Creating development/staging K0s clusters from production backups
- Implementing backup and restore procedures for K0s

**Documentation Length:** 2,150+ lines of comprehensive guidance

---

## Documentation Index

### Backup and Disaster Recovery
- [Volsync Migration Guide](./volsync-migration-guide.md) - Complete cluster migration procedures

### Coming Soon
- Storage Configuration Guide
- Network and Ingress Configuration
- Monitoring and Observability Setup
- Security Best Practices
- Application Deployment Patterns

---

## Quick Links

### External Resources
- [Volsync Official Documentation](https://volsync.readthedocs.io/)
- [Kopia Documentation](https://kopia.io/docs/)
- [Rook-Ceph Documentation](https://rook.io/docs/rook/latest/)
- [Flux Documentation](https://fluxcd.io/docs/)

### Repository Structure
- `/kubernetes/apps/` - Application manifests
- `/kubernetes/components/` - Reusable Kustomize components (including Volsync templates)
- `/kubernetes/apps/volsync-system/` - Volsync and Kopia installation

---

## Contributing to Documentation

When adding new documentation:

1. **Use clear, descriptive titles**
2. **Include a table of contents** for documents >500 lines
3. **Provide practical examples** with actual commands
4. **Include troubleshooting sections** for common issues
5. **Add quick reference sections** with one-liners and checklists
6. **Update this README** to link to new documentation

### Documentation Format

- Use Markdown (.md) format
- Include code blocks with language syntax highlighting
- Use tables for structured data
- Add diagrams using ASCII art or links to images
- Keep line length reasonable (~120 chars max)

---

## Getting Help

If you find issues with the documentation:

1. Check the troubleshooting sections first
2. Review application logs: `kubectl logs -n <namespace> -l app.kubernetes.io/name=<app>`
3. Check Flux reconciliation: `flux get all -A`
4. Open an issue in the repository

---

**Last Updated:** November 3, 2025
