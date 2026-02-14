# Complete Deployment Prompt for Twenty CRM MCP Server on Kubernetes

## 📋 Overview
Deploy a Node.js MCP (Model Context Protocol) server to your Kubernetes cluster that:
- Connects to your Twenty CRM instance at `https://lelabo-crm.g-eye.io/`
- Exposes an SSE endpoint for n8n at `https://n8n.g-eye.io/` to consume
- Follows your existing cluster patterns (FluxCD, Gateway API, Helm)
- Runs in the `dev` namespace alongside your other development tools

---

## 🎯 Deployment Goals

**Step 1: Create MCP Server Application**
- Node.js application with SSE transport
- Twenty CRM GraphQL API integration
- Tools for: contacts, companies, deals, tasks
- Health check endpoint

**Step 2: Package as Container**
- Dockerfile with multi-stage build
- Minimal production image
- Proper security practices

**Step 3: Deploy to Kubernetes**
- Deployment manifest following your cluster patterns
- Service for internal communication
- HTTPRoute for external access (if needed)
- Secrets for Twenty CRM API credentials

**Step 4: Configure n8n Integration**
- MCP Client Tool configuration
- Connection to the MCP server SSE endpoint
- AI Agent workflow setup

---

## 📁 File Structure

```
kubernetes/apps/dev/twenty-crm-mcp/
├── app/
│   ├── helmrelease.yaml          # FluxCD HelmRelease
│   ├── secret.sops.yaml          # Encrypted secrets (Twenty API key)
│   └── kustomization.yaml
├── ks.yaml                        # Kustomization resource
└── namespace.yaml                 # Namespace (if needed)

mcp-server/                        # MCP Server application code
├── package.json
├── server.js
├── Dockerfile
├── .dockerignore
└── README.md
```

---

## 🔧 Part 1: MCP Server Application

### `mcp-server/package.json`
```json
{
  "name": "twenty-crm-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "description": "MCP Server for Twenty CRM with SSE transport",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.19.2",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### `mcp-server/server.js`
```javascript
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://lelabo-crm.g-eye.io/graphql';
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

if (!TWENTY_API_KEY) {
  console.error('ERROR: TWENTY_API_KEY environment variable is required');
  process.exit(1);
}

// Enable CORS for n8n access
app.use(cors({
  origin: ['https://n8n.g-eye.io', 'http://localhost:5678'],
  credentials: true
}));
app.use(express.json());

// Initialize MCP Server
const mcpServer = new Server({
  name: 'twenty-crm-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define Twenty CRM Tools
mcpServer.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'list_contacts',
        description: 'List contacts from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of contacts (default: 10)', default: 10 },
            search: { type: 'string', description: 'Search by name or email' }
          }
        }
      },
      {
        name: 'create_contact',
        description: 'Create a new contact in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            firstName: { type: 'string', description: 'First name' },
            lastName: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' }
          },
          required: ['firstName', 'lastName']
        }
      },
      {
        name: 'get_contact',
        description: 'Get a specific contact by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Contact ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'list_companies',
        description: 'List companies from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of companies (default: 10)', default: 10 }
          }
        }
      },
      {
        name: 'create_company',
        description: 'Create a new company in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Company name' },
            domainName: { type: 'string', description: 'Company domain' },
            address: { type: 'string', description: 'Company address' }
          },
          required: ['name']
        }
      }
    ]
  };
});

// Handle tool calls
mcpServer.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'list_contacts':
        result = await fetchTwentyCRM(`
          query {
            people(first: ${args.limit || 10}) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  email
                  phone
                  createdAt
                }
              }
            }
          }
        `);
        break;

      case 'create_contact':
        result = await fetchTwentyCRM(`
          mutation {
            createPerson(data: {
              firstName: "${args.firstName}"
              lastName: "${args.lastName}"
              ${args.email ? `email: "${args.email}"` : ''}
              ${args.phone ? `phone: "${args.phone}"` : ''}
            }) {
              id
              firstName
              lastName
              email
              phone
            }
          }
        `);
        break;

      case 'get_contact':
        result = await fetchTwentyCRM(`
          query {
            person(id: "${args.id}") {
              id
              firstName
              lastName
              email
              phone
              createdAt
              company {
                id
                name
              }
            }
          }
        `);
        break;

      case 'list_companies':
        result = await fetchTwentyCRM(`
          query {
            companies(first: ${args.limit || 10}) {
              edges {
                node {
                  id
                  name
                  domainName
                  employees
                  createdAt
                }
              }
            }
          }
        `);
        break;

      case 'create_company':
        result = await fetchTwentyCRM(`
          mutation {
            createCompany(data: {
              name: "${args.name}"
              ${args.domainName ? `domainName: "${args.domainName}"` : ''}
              ${args.address ? `address: "${args.address}"` : ''}
            }) {
              id
              name
              domainName
            }
          }
        `);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Fetch data from Twenty CRM GraphQL API
async function fetchTwentyCRM(query) {
  const response = await fetch(TWENTY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TWENTY_API_KEY}`
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`Twenty CRM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data.data;
}

// SSE endpoint for MCP connection
app.get('/sse', async (req, res) => {
  console.log('[SSE] New connection from:', req.headers['user-agent']);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);

  req.on('close', () => {
    console.log('[SSE] Connection closed');
    transport.close();
  });
});

// POST endpoint for messages
app.post('/messages', async (req, res) => {
  res.status(200).send();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'twenty-crm-mcp-server',
    timestamp: new Date().toISOString(),
    twentyCrmUrl: TWENTY_API_URL
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    // Test connection to Twenty CRM
    await fetchTwentyCRM('query { __typename }');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Twenty CRM MCP Server running on port ${PORT}`);
  console.log(`✓ SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Connected to Twenty CRM: ${TWENTY_API_URL}`);
});
```

### `mcp-server/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
```

### `mcp-server/.dockerignore`
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.dockerignore
Dockerfile
```

---

## 🚀 Part 2: Kubernetes Deployment

### Option A: Using Deployment + Service + HTTPRoute (Recommended)

#### `kubernetes/apps/dev/twenty-crm-mcp/app/deployment.yaml`
```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: twenty-crm-mcp
  namespace: dev
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twenty-crm-mcp
  namespace: dev
  labels:
    app.kubernetes.io/name: twenty-crm-mcp
    app.kubernetes.io/instance: twenty-crm-mcp
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: twenty-crm-mcp
      app.kubernetes.io/instance: twenty-crm-mcp
  template:
    metadata:
      labels:
        app.kubernetes.io/name: twenty-crm-mcp
        app.kubernetes.io/instance: twenty-crm-mcp
      annotations:
        reloader.stakater.com/auto: "true"
    spec:
      serviceAccountName: twenty-crm-mcp
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: mcp-server
        image: ghcr.io/mgueye01/twenty-crm-mcp-server:latest  # Change to your registry
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        env:
        - name: PORT
          value: "3000"
        - name: TWENTY_API_URL
          value: "https://lelabo-crm.g-eye.io/graphql"
        - name: TWENTY_API_KEY
          valueFrom:
            secretKeyRef:
              name: twenty-crm-mcp-secret
              key: api-key
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: twenty-crm-mcp
  namespace: dev
  labels:
    app.kubernetes.io/name: twenty-crm-mcp
    app.kubernetes.io/instance: twenty-crm-mcp
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app.kubernetes.io/name: twenty-crm-mcp
    app.kubernetes.io/instance: twenty-crm-mcp
```

#### `kubernetes/apps/dev/twenty-crm-mcp/app/httproute.yaml`
```yaml
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: twenty-crm-mcp
  namespace: dev
  labels:
    app.kubernetes.io/name: twenty-crm-mcp
    app.kubernetes.io/instance: twenty-crm-mcp
  annotations:
    gatus.home-operations.com/enabled: "true"
    gatus.home-operations.com/endpoint: |-
      conditions: ["[STATUS] == 200", "[BODY].status == healthy"]
      url: https://twenty-mcp.g-eye.io/health
spec:
  hostnames:
  - twenty-mcp.g-eye.io
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: internal
    namespace: kube-system
    sectionName: https
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: twenty-crm-mcp
      port: 80
      weight: 1
```

#### `kubernetes/apps/dev/twenty-crm-mcp/app/secret.sops.yaml`
```yaml
# This should be encrypted with SOPS
---
apiVersion: v1
kind: Secret
metadata:
  name: twenty-crm-mcp-secret
  namespace: dev
type: Opaque
stringData:
  api-key: "YOUR_TWENTY_CRM_API_KEY_HERE"  # Get from Twenty CRM Settings > Developers > API Keys
```

#### `kubernetes/apps/dev/twenty-crm-mcp/app/kustomization.yaml`
```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: dev
resources:
  - ./deployment.yaml
  - ./httproute.yaml
  - ./secret.sops.yaml
```

#### `kubernetes/apps/dev/twenty-crm-mcp/ks.yaml`
```yaml
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: twenty-crm-mcp
  namespace: flux-system
spec:
  targetNamespace: dev
  commonMetadata:
    labels:
      app.kubernetes.io/name: twenty-crm-mcp
  path: ./kubernetes/apps/dev/twenty-crm-mcp/app
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  wait: false
  interval: 30m
  retryInterval: 1m
  timeout: 5m
```

---

### Option B: Using HelmRelease (Following your cluster pattern)

#### `kubernetes/apps/dev/twenty-crm-mcp/app/helmrelease.yaml`
```yaml
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: twenty-crm-mcp
  namespace: dev
spec:
  interval: 30m
  chart:
    spec:
      chart: app-template
      version: 4.3.0
      sourceRef:
        kind: HelmRepository
        name: bjw-s
        namespace: flux-system
  install:
    remediation:
      retries: 3
  upgrade:
    cleanupOnFail: true
    remediation:
      retries: 3
      strategy: rollback
  values:
    controllers:
      twenty-crm-mcp:
        annotations:
          reloader.stakater.com/auto: "true"

        containers:
          app:
            image:
              repository: ghcr.io/mgueye01/twenty-crm-mcp-server
              tag: latest
              pullPolicy: Always

            env:
              PORT: "3000"
              TWENTY_API_URL: "https://lelabo-crm.g-eye.io/graphql"
              NODE_ENV: "production"

            envFrom:
            - secretRef:
                name: twenty-crm-mcp-secret

            probes:
              liveness:
                enabled: true
                custom: true
                spec:
                  httpGet:
                    path: /health
                    port: 3000
                  initialDelaySeconds: 10
                  periodSeconds: 10
              readiness:
                enabled: true
                custom: true
                spec:
                  httpGet:
                    path: /ready
                    port: 3000
                  initialDelaySeconds: 5
                  periodSeconds: 5

            resources:
              requests:
                cpu: 50m
                memory: 128Mi
              limits:
                cpu: 200m
                memory: 256Mi

            securityContext:
              allowPrivilegeEscalation: false
              capabilities:
                drop:
                - ALL
              readOnlyRootFilesystem: true

    service:
      app:
        controller: twenty-crm-mcp
        ports:
          http:
            port: 80
            targetPort: 3000

    route:
      app:
        enabled: true
        parentRefs:
        - group: gateway.networking.k8s.io
          kind: Gateway
          name: internal
          namespace: kube-system
          sectionName: https
        hostnames:
        - twenty-mcp.g-eye.io
        rules:
        - matches:
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: twenty-crm-mcp
            port: 80

    persistence:
      tmp:
        enabled: true
        type: emptyDir
        globalMounts:
        - path: /tmp
```

---

## 🔐 Part 3: Secrets Management

### Get Twenty CRM API Key
```bash
# 1. Access Twenty CRM
open https://lelabo-crm.g-eye.io/

# 2. Navigate to: Settings → Developers → API Keys
# 3. Create new API key with name: "n8n-mcp-server"
# 4. Copy the generated key
```

### Create and Encrypt Secret with SOPS
```bash
# Create secret file
cat <<EOF > kubernetes/apps/dev/twenty-crm-mcp/app/secret.sops.yaml
apiVersion: v1
kind: Secret
metadata:
  name: twenty-crm-mcp-secret
  namespace: dev
type: Opaque
stringData:
  api-key: "paste_your_api_key_here"
  TWENTY_API_KEY: "paste_your_api_key_here"
EOF

# Encrypt with SOPS (if you use it)
sops --encrypt --in-place kubernetes/apps/dev/twenty-crm-mcp/app/secret.sops.yaml
```

---

## 🔨 Part 4: Build and Push Container Image

### Using GitHub Actions (in your home-ops repo)
```yaml
# .github/workflows/build-mcp-server.yaml
name: Build Twenty CRM MCP Server

on:
  push:
    branches:
      - main
    paths:
      - 'mcp-server/**'
      - '.github/workflows/build-mcp-server.yaml'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./mcp-server
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/twenty-crm-mcp-server:latest
            ghcr.io/${{ github.repository_owner }}/twenty-crm-mcp-server:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Or Manual Build
```bash
# Build locally
cd mcp-server
docker build -t ghcr.io/mgueye01/twenty-crm-mcp-server:latest .

# Push to registry
docker push ghcr.io/mgueye01/twenty-crm-mcp-server:latest
```

---

## ⚙️ Part 5: n8n Configuration

### n8n Workflow Configuration

**1. Create Workflow in n8n (`https://n8n.g-eye.io/`)**

**2. Add Nodes:**
- Webhook or Manual Trigger
- AI Agent (OpenAI, Anthropic, etc.)
- MCP Client Tool

**3. Configure MCP Client Tool:**
```json
{
  "sseEndpoint": "https://twenty-mcp.g-eye.io/sse",
  "authentication": "none",
  "include": "all"
}
```

**Alternative: Internal Service Connection (No HTTPRoute needed)**
```json
{
  "sseEndpoint": "http://twenty-crm-mcp.dev.svc.cluster.local/sse",
  "authentication": "none",
  "include": "all"
}
```

**4. Complete Workflow JSON:**
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
          "systemMessage": "You are a helpful AI assistant with access to Twenty CRM. Help users manage their contacts, companies, and deals. When asked about CRM data, use the available tools to fetch or update information."
        }
      },
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.7,
      "position": [450, 300]
    },
    {
      "parameters": {
        "model": "gpt-4o",
        "options": {}
      },
      "name": "OpenAI",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1,
      "position": [450, 450]
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
    "OpenAI": {
      "ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]
    },
    "Twenty CRM MCP": {
      "ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]
    }
  }
}
```

---

## 🚀 Part 6: Deployment Steps

### Step 1: Prepare Repository
```bash
# In your home-ops repository
git checkout -b feature/twenty-crm-mcp

# Create directory structure
mkdir -p kubernetes/apps/dev/twenty-crm-mcp/app
mkdir -p mcp-server

# Copy all files to respective locations
```

### Step 2: Get Twenty CRM API Key
```bash
# 1. Visit https://lelabo-crm.g-eye.io/settings/developers
# 2. Create new API key
# 3. Save it securely
```

### Step 3: Create and Encrypt Secret
```bash
# Create secret
kubectl create secret generic twenty-crm-mcp-secret \
  --from-literal=api-key='YOUR_API_KEY' \
  --namespace=dev \
  --dry-run=client -o yaml > kubernetes/apps/dev/twenty-crm-mcp/app/secret.yaml

# Encrypt with SOPS (if using)
sops --encrypt --in-place kubernetes/apps/dev/twenty-crm-mcp/app/secret.yaml
```

### Step 4: Build Container Image
```bash
# Option A: Push to trigger GitHub Actions
git add .
git commit -m "Add Twenty CRM MCP server"
git push origin feature/twenty-crm-mcp

# Option B: Build locally
cd mcp-server
docker build -t ghcr.io/mgueye01/twenty-crm-mcp-server:latest .
docker push ghcr.io/mgueye01/twenty-crm-mcp-server:latest
```

### Step 5: Deploy to Cluster
```bash
# Apply Kustomization
kubectl apply -f kubernetes/apps/dev/twenty-crm-mcp/ks.yaml

# Wait for reconciliation
kubectl -n dev get pods -w

# Check logs
kubectl -n dev logs -f deployment/twenty-crm-mcp
```

### Step 6: Verify Deployment
```bash
# Check pod status
kubectl -n dev get pods -l app.kubernetes.io/name=twenty-crm-mcp

# Check health
kubectl -n dev port-forward svc/twenty-crm-mcp 3000:80
curl http://localhost:3000/health

# Test SSE endpoint
curl http://localhost:3000/sse
```

### Step 7: Configure n8n
```bash
# 1. Access n8n: https://n8n.g-eye.io/
# 2. Create new workflow
# 3. Add MCP Client Tool node
# 4. Configure SSE endpoint: https://twenty-mcp.g-eye.io/sse
# 5. Test connection
```

### Step 8: Test End-to-End
```bash
# Send test request to webhook
curl -X POST https://n8n.g-eye.io/webhook/twenty-crm-chat \
  -H "Content-Type: application/json" \
  -d '{"chatInput": "List all contacts from Twenty CRM"}'
```

---

## 🔍 Part 7: Troubleshooting

### Check Pod Status
```bash
kubectl -n dev get pods -l app.kubernetes.io/name=twenty-crm-mcp
kubectl -n dev describe pod <pod-name>
kubectl -n dev logs -f deployment/twenty-crm-mcp
```

### Test Twenty CRM Connection
```bash
# Port forward
kubectl -n dev port-forward svc/twenty-crm-mcp 3000:80

# Test health
curl http://localhost:3000/health

# Test readiness
curl http://localhost:3000/ready

# Test SSE endpoint
curl http://localhost:3000/sse
```

### Check FluxCD Reconciliation
```bash
kubectl -n flux-system get kustomizations
kubectl -n flux-system describe kustomization twenty-crm-mcp
kubectl -n flux-system logs deployment/kustomize-controller -f
```

### Common Issues

**1. Pod CrashLoopBackOff**
```bash
# Check logs
kubectl -n dev logs deployment/twenty-crm-mcp

# Likely causes:
# - Missing TWENTY_API_KEY
# - Invalid Twenty CRM URL
# - Network connectivity issues
```

**2. n8n Cannot Connect**
```bash
# Check if HTTPRoute is configured
kubectl -n dev get httproute twenty-crm-mcp

# Check Gateway
kubectl -n kube-system get gateway internal

# Test internal service
kubectl -n dev run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://twenty-crm-mcp.dev.svc.cluster.local/health
```

**3. Twenty CRM API Authentication Failed**
```bash
# Verify API key
kubectl -n dev get secret twenty-crm-mcp-secret -o jsonpath='{.data.api-key}' | base64 -d

# Test manually
curl -X POST https://lelabo-crm.g-eye.io/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

---

## 📊 Part 8: Monitoring

### Add ServiceMonitor (Optional)
```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: twenty-crm-mcp
  namespace: dev
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: twenty-crm-mcp
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Useful Metrics to Monitor
- HTTP request rate and latency
- SSE connection count
- Twenty CRM API response times
- Error rates

---

## ✅ Success Criteria

- [ ] MCP server pod is running and healthy
- [ ] Health endpoint returns 200 OK
- [ ] Ready endpoint successfully connects to Twenty CRM
- [ ] SSE endpoint accepts connections
- [ ] HTTPRoute (if used) resolves correctly
- [ ] n8n MCP Client Tool connects successfully
- [ ] AI Agent can list contacts from Twenty CRM
- [ ] AI Agent can create new contacts in Twenty CRM

---

## 📝 Next Steps

1. **Add More Tools**: Extend with tasks, notes, opportunities
2. **Add Authentication**: Secure SSE endpoint if exposing externally
3. **Add Monitoring**: Prometheus metrics and Grafana dashboards
4. **Add Rate Limiting**: Protect against abuse
5. **Add Caching**: Improve performance for frequent queries
6. **CI/CD Pipeline**: Automate builds and deployments
7. **Documentation**: Add API documentation and usage examples

---

This complete prompt provides everything needed to deploy the Twenty CRM MCP server to your Kubernetes cluster following your existing patterns. Review it and let me know when you're ready to implement!
