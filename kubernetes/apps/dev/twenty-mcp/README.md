# Twenty CRM MCP Server Deployment

## Overview

This deployment provides a Model Context Protocol (MCP) server that connects to Twenty CRM at `https://lelabo-crm.g-eye.io` and exposes an SSE endpoint for n8n AI Agent integration.

## Architecture

```
┌────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│   n8n          │◄────────┤ Twenty MCP      │◄────────┤ Twenty CRM       │
│  AI Agent      │  SSE    │ Server          │  GraphQL│ (lelabo-crm)     │
│                │         │                 │         │                  │
└────────────────┘         └─────────────────┘         └──────────────────┘
  n8n.g-eye.io           twenty-mcp.g-eye.io        lelabo-crm.g-eye.io
```

## Components

### MCP Server Application

**Location**: `/mcp-server/` (repository root)

**Files**:
- `package.json` - Node.js dependencies
- `server.js` - MCP server implementation with Twenty CRM integration
- `Dockerfile` - Multi-stage container build
- `.dockerignore` - Build exclusions

**Container Image**: `ghcr.io/mgueye01/twenty-crm-mcp-server:latest`

### Kubernetes Deployment

**Namespace**: `dev`

**Files**:
- `ks.yaml` - FluxCD Kustomization
- `app/helmrelease.yaml` - HelmRelease using app-template
- `app/secret.sops.yaml` - SOPS-encrypted Twenty CRM API key
- `app/kustomization.yaml` - Resource list

**Endpoints**:
- **SSE**: `https://twenty-mcp.g-eye.io/sse` - MCP protocol endpoint
- **Health**: `https://twenty-mcp.g-eye.io/health` - Health check
- **Ready**: `https://twenty-mcp.g-eye.io/ready` - Readiness check

## Available MCP Tools

The server exposes 5 tools for interacting with Twenty CRM:

1. **list_contacts** - List contacts from CRM
   - Parameters: `limit` (number), `search` (string)

2. **create_contact** - Create a new contact
   - Parameters: `firstName`, `lastName`, `email`, `phone`

3. **get_contact** - Get a specific contact by ID
   - Parameters: `id` (string)

4. **list_companies** - List companies from CRM
   - Parameters: `limit` (number)

5. **create_company** - Create a new company
   - Parameters: `name`, `domainName`, `address`

## Deployment Steps

### 1. Get Twenty CRM API Key

```bash
# Visit Twenty CRM Settings
open https://lelabo-crm.g-eye.io/settings/developers

# Create new API key with name: "mcp-server-n8n"
# Copy the generated key
```

### 2. Encrypt Secret with SOPS

```bash
# Edit the secret file
vim kubernetes/apps/dev/twenty-mcp/app/secret.sops.yaml

# Replace REPLACE_WITH_YOUR_TWENTY_CRM_API_KEY with your actual key

# Encrypt with SOPS
sops --encrypt --in-place kubernetes/apps/dev/twenty-mcp/app/secret.sops.yaml
```

### 3. Build and Push Container Image

The GitHub Actions workflow at `.github/workflows/build-mcp-server.yaml` automatically builds and pushes the container image when changes are pushed to `mcp-server/` directory.

**Manual build**:
```bash
cd mcp-server
docker build -t ghcr.io/mgueye01/twenty-crm-mcp-server:latest .
docker push ghcr.io/mgueye01/twenty-crm-mcp-server:latest
```

### 4. Deploy to Kubernetes

The deployment is managed by FluxCD. Once the files are committed to Git, FluxCD will automatically:

1. Reconcile the `twenty-mcp` Kustomization
2. Create the secret in the `dev` namespace
3. Deploy the HelmRelease
4. Create the HTTPRoute for external access

**Manual reconciliation**:
```bash
# Trigger FluxCD reconciliation
flux reconcile kustomization twenty-mcp -n flux-system

# Watch deployment
kubectl -n dev get pods -l app.kubernetes.io/name=twenty-mcp -w

# Check logs
kubectl -n dev logs -f deployment/twenty-mcp
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl -n dev get pods -l app.kubernetes.io/name=twenty-mcp

# Test health endpoint
curl https://twenty-mcp.g-eye.io/health

# Test readiness (verifies Twenty CRM connectivity)
curl https://twenty-mcp.g-eye.io/ready

# Test SSE endpoint (should return event stream)
curl https://twenty-mcp.g-eye.io/sse
```

## n8n Integration

### Configure MCP Client Tool in n8n

1. Access n8n: `https://n8n.g-eye.io`

2. Create new workflow

3. Add **AI Agent** node

4. Add **MCP Client Tool** node with configuration:
   ```json
   {
     "sseEndpoint": "https://twenty-mcp.g-eye.io/sse",
     "authentication": "none",
     "include": "all"
   }
   ```

5. Add **OpenAI** or **Anthropic** LLM node

6. Connect nodes: `Webhook → AI Agent ← (MCP Client Tool + LLM)`

### Example Workflow JSON

```json
{
  "name": "Twenty CRM AI Assistant",
  "nodes": [
    {
      "parameters": {
        "path": "twenty-crm-chat",
        "httpMethod": "POST",
        "responseMode": "lastNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [250, 300]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.chatInput }}",
        "options": {
          "systemMessage": "You are a helpful AI assistant with access to Twenty CRM. Help users manage their contacts, companies, and deals."
        }
      },
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.7,
      "position": [450, 300]
    },
    {
      "parameters": {
        "sseEndpoint": "https://twenty-mcp.g-eye.io/sse",
        "authentication": "none",
        "include": "all"
      },
      "name": "Twenty CRM MCP",
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "typeVersion": 1,
      "position": [650, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "AI Agent", "type": "main", "index": 0}]]
    },
    "Twenty CRM MCP": {
      "ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]
    }
  }
}
```

### Test End-to-End

```bash
# Send test request to n8n webhook
curl -X POST https://n8n.g-eye.io/webhook/twenty-crm-chat \
  -H "Content-Type: application/json" \
  -d '{"chatInput": "List all contacts from Twenty CRM"}'
```

## Monitoring

### Health Checks

**Gatus** (configured via HTTPRoute annotation):
- Endpoint: `https://twenty-mcp.g-eye.io/health`
- Conditions: `[STATUS] == 200`, `[BODY].status == healthy`

**Kubernetes Probes**:
- **Liveness**: `/health` every 10s
- **Readiness**: `/ready` every 5s (validates Twenty CRM connectivity)

### Logs

```bash
# View logs
kubectl -n dev logs -f deployment/twenty-mcp

# Filter for errors
kubectl -n dev logs deployment/twenty-mcp | grep ERROR

# View logs in Loki (if configured)
# Query: {app="twenty-mcp", namespace="dev"}
```

## Troubleshooting

### Pod CrashLoopBackOff

```bash
# Check logs
kubectl -n dev logs deployment/twenty-mcp

# Common causes:
# - Missing or invalid TWENTY_API_KEY
# - Twenty CRM API unreachable
# - Network connectivity issues
```

### n8n Cannot Connect to SSE Endpoint

```bash
# Check HTTPRoute
kubectl -n dev get httproute twenty-mcp

# Check service
kubectl -n dev get svc twenty-mcp

# Test internal connectivity
kubectl -n dev run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://twenty-mcp.dev.svc.cluster.local/health

# Check Gateway
kubectl -n kube-system get gateway internal
```

### Twenty CRM Authentication Failed

```bash
# Verify API key in secret
kubectl -n dev get secret twenty-mcp-secret -o jsonpath='{.data.TWENTY_API_KEY}' | base64 -d

# Test API key manually
curl -X POST https://lelabo-crm.g-eye.io/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

### Tools Not Appearing in n8n

```bash
# Port-forward to test SSE endpoint directly
kubectl -n dev port-forward svc/twenty-mcp 3000:80

# Test tools list endpoint
curl http://localhost:3000/sse

# Check MCP server logs for connection attempts
kubectl -n dev logs -f deployment/twenty-mcp | grep SSE
```

## Security Considerations

**Pod Security**:
- Non-root user (UID 1001)
- Read-only root filesystem
- All capabilities dropped
- No privilege escalation

**Network Security**:
- Internal Gateway (192.168.10.50) for cluster-only access
- HTTPS enforced via Gateway API
- CORS restricted to n8n.g-eye.io

**Secret Management**:
- API key stored in SOPS-encrypted Secret
- Secret rotated via FluxCD
- Reloader automatically restarts pod on secret changes

## Resource Requirements

**CPU**:
- Request: 50m
- Limit: None (burstable)

**Memory**:
- Request: 128Mi
- Limit: 256Mi

**Storage**:
- None (stateless application)
- /tmp mounted as emptyDir

## Dependencies

- **FluxCD**: GitOps orchestration
- **External Secrets Operator**: Secret management (dependency declared but not used - using SOPS instead)
- **Cilium Gateway API**: Ingress routing
- **Gatus**: Health monitoring
- **Reloader**: Automatic pod restarts on secret changes

## Maintenance

### Update Container Image

**Automatic (Recommended)**:
- Push changes to `mcp-server/` directory
- GitHub Actions builds and pushes new image
- Update `tag` in `helmrelease.yaml` to trigger rollout

**Manual**:
```bash
# Edit helmrelease.yaml
vim kubernetes/apps/dev/twenty-mcp/app/helmrelease.yaml

# Change tag to new version or SHA
# Commit and push - FluxCD will reconcile
```

### Update Secret

```bash
# Edit and re-encrypt
sops kubernetes/apps/dev/twenty-mcp/app/secret.sops.yaml

# Commit and push
# Reloader will automatically restart the pod
```

## References

- **MCP Specification**: https://modelcontextprotocol.io/
- **Twenty CRM**: https://twenty.com/
- **n8n MCP Integration**: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.mcpclienttool/
- **App Template**: https://github.com/bjw-s-labs/helm-charts/tree/main/charts/app-template
- **FluxCD**: https://fluxcd.io/
