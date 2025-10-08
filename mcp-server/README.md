# Twenty CRM MCP Server

A Model Context Protocol (MCP) server that integrates with Twenty CRM, providing SSE-based access to CRM data for AI agents and automation tools like n8n.

## Overview

This MCP server exposes Twenty CRM functionality through a standardized protocol, enabling AI agents to:
- List and search contacts
- Create new contacts
- Get contact details
- List companies
- Create new companies

## Features

- **SSE Transport**: Server-Sent Events for real-time communication
- **GraphQL Integration**: Native integration with Twenty CRM's GraphQL API
- **Health Checks**: Built-in health and readiness endpoints
- **Security**: Non-root user, read-only filesystem, minimal attack surface
- **Production Ready**: Multi-stage Docker build, proper error handling

## Prerequisites

- Node.js >= 20.0.0
- Twenty CRM instance with API access
- Twenty CRM API key

## Installation

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export TWENTY_API_KEY="your-api-key-here"
export TWENTY_API_URL="https://lelabo-crm.g-eye.io/graphql"

# Start server
npm start

# Or use watch mode for development
npm run dev
```

### Docker

```bash
# Build image
docker build -t twenty-crm-mcp-server:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e TWENTY_API_KEY="your-api-key-here" \
  -e TWENTY_API_URL="https://lelabo-crm.g-eye.io/graphql" \
  twenty-crm-mcp-server:latest
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `TWENTY_API_URL` | No | `https://lelabo-crm.g-eye.io/graphql` | Twenty CRM GraphQL endpoint |
| `TWENTY_API_KEY` | Yes | - | Twenty CRM API key |
| `NODE_ENV` | No | - | Node environment (production/development) |

### Getting a Twenty CRM API Key

1. Access your Twenty CRM instance
2. Navigate to: Settings → Developers → API Keys
3. Click "Create API Key"
4. Give it a name (e.g., "MCP Server")
5. Copy the generated key

## API Endpoints

### SSE Endpoint
- **URL**: `GET /sse`
- **Description**: Server-Sent Events endpoint for MCP protocol communication
- **Usage**: Connect your MCP client to this endpoint

### Messages Endpoint
- **URL**: `POST /messages`
- **Description**: Receives messages from MCP clients
- **Content-Type**: `application/json`

### Health Check
- **URL**: `GET /health`
- **Description**: Basic health check endpoint
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "twenty-crm-mcp-server",
    "timestamp": "2025-10-08T12:00:00.000Z",
    "twentyCrmUrl": "https://lelabo-crm.g-eye.io/graphql"
  }
  ```

### Readiness Check
- **URL**: `GET /ready`
- **Description**: Checks if server can connect to Twenty CRM
- **Response**:
  ```json
  {
    "status": "ready"
  }
  ```

## Available Tools

### list_contacts
List contacts from Twenty CRM.

**Parameters:**
- `limit` (number, optional): Number of contacts to return (default: 10)
- `search` (string, optional): Search by name or email

**Example:**
```json
{
  "name": "list_contacts",
  "arguments": {
    "limit": 20
  }
}
```

### create_contact
Create a new contact in Twenty CRM.

**Parameters:**
- `firstName` (string, required): First name
- `lastName` (string, required): Last name
- `email` (string, optional): Email address
- `phone` (string, optional): Phone number

**Example:**
```json
{
  "name": "create_contact",
  "arguments": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890"
  }
}
```

### get_contact
Get a specific contact by ID.

**Parameters:**
- `id` (string, required): Contact ID

**Example:**
```json
{
  "name": "get_contact",
  "arguments": {
    "id": "contact-id-here"
  }
}
```

### list_companies
List companies from Twenty CRM.

**Parameters:**
- `limit` (number, optional): Number of companies to return (default: 10)

**Example:**
```json
{
  "name": "list_companies",
  "arguments": {
    "limit": 15
  }
}
```

### create_company
Create a new company in Twenty CRM.

**Parameters:**
- `name` (string, required): Company name
- `domainName` (string, optional): Company domain
- `address` (string, optional): Company address

**Example:**
```json
{
  "name": "create_company",
  "arguments": {
    "name": "Acme Corp",
    "domainName": "acme.com",
    "address": "123 Main St"
  }
}
```

## Integration with n8n

### MCP Client Tool Configuration

1. In your n8n workflow, add an "MCP Client Tool" node
2. Configure the SSE endpoint:
   - **SSE Endpoint**: `https://twenty-mcp.g-eye.io/sse` (external)
   - **SSE Endpoint**: `http://twenty-crm-mcp.dev.svc.cluster.local/sse` (internal)
3. Set authentication to "none"
4. Include "all" tools

### Example Workflow

```json
{
  "name": "Twenty CRM AI Assistant",
  "nodes": [
    {
      "parameters": {
        "sseEndpoint": "https://twenty-mcp.g-eye.io/sse",
        "authentication": "none",
        "include": "all"
      },
      "name": "Twenty CRM MCP",
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool"
    }
  ]
}
```

## Kubernetes Deployment

See the main deployment documentation in `kubernetes/apps/dev/twenty-crm-mcp/` for:
- Helm chart deployment
- Secret management with SOPS
- Gateway API HTTPRoute configuration
- Service mesh integration

## Security Considerations

- **Non-root User**: Runs as user ID 1001
- **Read-only Filesystem**: Application runs with read-only root filesystem
- **Minimal Image**: Uses Alpine Linux base image
- **No Privilege Escalation**: Security context prevents privilege escalation
- **CORS**: Configured to only allow specific origins
- **API Key**: Securely stored in Kubernetes secrets

## Troubleshooting

### Server won't start

Check that `TWENTY_API_KEY` is set:
```bash
echo $TWENTY_API_KEY
```

### Connection to Twenty CRM fails

Test the API key manually:
```bash
curl -X POST https://lelabo-crm.g-eye.io/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

### SSE connection drops

Check logs for errors:
```bash
# Docker
docker logs <container-id>

# Kubernetes
kubectl -n dev logs -f deployment/twenty-crm-mcp
```

### n8n cannot connect

1. Verify the service is accessible:
   ```bash
   curl https://twenty-mcp.g-eye.io/health
   ```

2. Check CORS configuration in `server.js`

3. Verify HTTPRoute is configured correctly

## Development

### Adding New Tools

1. Add tool definition in `tools/list` handler
2. Implement tool logic in `tools/call` handler
3. Add corresponding GraphQL query/mutation
4. Update documentation

### Testing

```bash
# Health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# SSE connection test
curl -N http://localhost:3000/sse
```

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   n8n AI    │ ◄─SSE─► │  MCP Server      │ ◄─HTTP─►│ Twenty CRM  │
│   Agent     │         │  (Express + SDK) │         │  GraphQL    │
└─────────────┘         └──────────────────┘         └─────────────┘
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `express`: Web framework
- `cors`: CORS middleware

## License

See main repository license.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs
3. Verify Twenty CRM API access
4. Check network connectivity

## Version History

- **1.0.0**: Initial release
  - SSE transport
  - Basic CRM operations (contacts, companies)
  - Health and readiness checks
  - Production-ready Docker image
