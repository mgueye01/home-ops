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
