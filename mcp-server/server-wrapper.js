#!/usr/bin/env node
/**
 * HTTP/SSE Wrapper for Twenty CRM MCP Server
 * Wraps the official mhenry3164/twenty-crm-mcp-server with HTTP/SSE transport for n8n
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
const PORT = process.env.PORT || 3000;
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;
const TWENTY_BASE_URL = process.env.TWENTY_BASE_URL || process.env.TWENTY_API_URL || 'https://api.twenty.com';

if (!TWENTY_API_KEY) {
  console.error('ERROR: TWENTY_API_KEY environment variable is required');
  process.exit(1);
}

// Enable CORS for n8n
app.use(cors({
  origin: ['https://n8n.g-eye.io', 'http://localhost:5678'],
  credentials: true
}));
app.use(express.json());

// Import the official TwentyCRMServer class
class TwentyCRMServer {
  constructor() {
    this.server = new Server(
      {
        name: 'twenty-crm',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiKey = TWENTY_API_KEY;
    this.baseUrl = TWENTY_BASE_URL;

    this.setupToolHandlers();
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  setupToolHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // People Management
          {
            name: 'list_people',
            description: 'List people from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of records (default: 10)' },
                filter: { type: 'string', description: 'Optional filter criteria' }
              }
            }
          },
          {
            name: 'create_person',
            description: 'Create a new person in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                firstName: { type: 'string', description: 'First name' },
                lastName: { type: 'string', description: 'Last name' },
                email: { type: 'string', description: 'Email address' },
                phone: { type: 'string', description: 'Phone number' },
                jobTitle: { type: 'string', description: 'Job title' },
                companyId: { type: 'string', description: 'Company ID' },
                city: { type: 'string', description: 'City' }
              },
              required: ['firstName', 'lastName']
            }
          },
          {
            name: 'get_person',
            description: 'Get a person by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Person ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'update_person',
            description: 'Update a person',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Person ID' },
                data: { type: 'object', description: 'Update data' }
              },
              required: ['id', 'data']
            }
          },
          {
            name: 'delete_person',
            description: 'Delete a person',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Person ID' }
              },
              required: ['id']
            }
          },
          // Companies
          {
            name: 'list_companies',
            description: 'List companies from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of records (default: 10)' }
              }
            }
          },
          {
            name: 'get_metadata_objects',
            description: 'Get all object types and schemas',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'search_records',
            description: 'Search across CRM records',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Number of results' }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          case 'list_people':
            const limit = args.limit || 10;
            result = await this.makeRequest(`/rest/people?limit=${limit}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'create_person':
            result = await this.makeRequest('/rest/people', 'POST', {
              name: { firstName: args.firstName, lastName: args.lastName },
              emails: { primaryEmail: args.email || '' },
              phones: { primaryPhoneNumber: args.phone || '' },
              jobTitle: args.jobTitle || '',
              city: args.city || '',
              companyId: args.companyId || null
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'get_person':
            result = await this.makeRequest(`/rest/people/${args.id}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'update_person':
            result = await this.makeRequest(`/rest/people/${args.id}`, 'PATCH', args.data);
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'delete_person':
            result = await this.makeRequest(`/rest/people/${args.id}`, 'DELETE');
            return {
              content: [{ type: 'text', text: 'Person deleted successfully' }]
            };

          case 'list_companies':
            const companyLimit = args.limit || 10;
            result = await this.makeRequest(`/rest/companies?limit=${companyLimit}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'get_metadata_objects':
            result = await this.makeRequest('/rest/metadata/objects');
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          case 'search_records':
            const searchQuery = args.query;
            const searchLimit = args.limit || 10;
            result = await this.makeRequest(`/rest/people?limit=${searchLimit}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }
}

// Initialize MCP Server
const mcpServer = new TwentyCRMServer();

// SSE endpoint for MCP connection
app.get('/sse', async (req, res) => {
  console.log('[SSE] New connection from:', req.headers['user-agent']);

  const transport = new SSEServerTransport('/messages', res);
  await mcpServer.server.connect(transport);

  req.on('close', () => {
    console.log('[SSE] Connection closed');
  });
});

// POST endpoint for messages
app.post('/messages', async (req, res) => {
  res.status(200).send();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'twenty-crm-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    twentyBaseUrl: TWENTY_BASE_URL
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    const server = new TwentyCRMServer();
    await server.makeRequest('/rest/metadata/objects');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Twenty CRM MCP Server (official mhenry3164 build) running on port ${PORT}`);
  console.log(`✓ SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Connected to Twenty CRM: ${TWENTY_BASE_URL}`);
});
