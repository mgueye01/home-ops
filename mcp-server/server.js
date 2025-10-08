import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://api.twenty.com';
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
  version: '2.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Helper function to make API requests to Twenty CRM
async function makeRequest(endpoint, method = 'GET', data = null) {
  const url = `${TWENTY_API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${TWENTY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
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

// Define all Twenty CRM Tools (23 tools total)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ===== PEOPLE MANAGEMENT (5 tools) =====
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
            companyId: { type: 'string', description: 'Company ID to associate with' },
            linkedinUrl: { type: 'string', description: 'LinkedIn profile URL' },
            city: { type: 'string', description: 'City' },
            avatarUrl: { type: 'string', description: 'Avatar image URL' }
          },
          required: ['firstName', 'lastName']
        }
      },
      {
        name: 'get_person',
        description: 'Get details of a specific person by ID',
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
        description: 'Update an existing person\'s information',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Person ID' },
            firstName: { type: 'string', description: 'First name' },
            lastName: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            jobTitle: { type: 'string', description: 'Job title' },
            companyId: { type: 'string', description: 'Company ID' },
            linkedinUrl: { type: 'string', description: 'LinkedIn profile URL' },
            city: { type: 'string', description: 'City' }
          },
          required: ['id']
        }
      },
      {
        name: 'list_people',
        description: 'List people with optional filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of results to return (default: 20)' },
            offset: { type: 'number', description: 'Number of results to skip (default: 0)' },
            search: { type: 'string', description: 'Search term for name or email' },
            companyId: { type: 'string', description: 'Filter by company ID' }
          }
        }
      },
      {
        name: 'delete_person',
        description: 'Delete a person from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Person ID to delete' }
          },
          required: ['id']
        }
      },

      // ===== COMPANY MANAGEMENT (5 tools) =====
      {
        name: 'create_company',
        description: 'Create a new company in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Company name' },
            domainName: { type: 'string', description: 'Company domain' },
            address: { type: 'string', description: 'Company address' },
            employees: { type: 'number', description: 'Number of employees' },
            linkedinUrl: { type: 'string', description: 'LinkedIn company URL' },
            xUrl: { type: 'string', description: 'X (Twitter) URL' },
            annualRecurringRevenue: { type: 'number', description: 'Annual recurring revenue' },
            idealCustomerProfile: { type: 'boolean', description: 'Is this an ideal customer profile' }
          },
          required: ['name']
        }
      },
      {
        name: 'get_company',
        description: 'Get details of a specific company by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Company ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'update_company',
        description: 'Update an existing company\'s information',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Company ID' },
            name: { type: 'string', description: 'Company name' },
            domainName: { type: 'string', description: 'Company domain' },
            address: { type: 'string', description: 'Company address' },
            employees: { type: 'number', description: 'Number of employees' },
            linkedinUrl: { type: 'string', description: 'LinkedIn company URL' },
            annualRecurringRevenue: { type: 'number', description: 'Annual recurring revenue' }
          },
          required: ['id']
        }
      },
      {
        name: 'list_companies',
        description: 'List companies with optional filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of results to return (default: 20)' },
            offset: { type: 'number', description: 'Number of results to skip (default: 0)' },
            search: { type: 'string', description: 'Search term for company name' }
          }
        }
      },
      {
        name: 'delete_company',
        description: 'Delete a company from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Company ID to delete' }
          },
          required: ['id']
        }
      },

      // ===== TASK MANAGEMENT (5 tools) =====
      {
        name: 'create_task',
        description: 'Create a new task in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            body: { type: 'string', description: 'Task description' },
            dueAt: { type: 'string', description: 'Due date (ISO 8601 format)' },
            status: { type: 'string', description: 'Task status (TODO, IN_PROGRESS, DONE)' },
            assigneeId: { type: 'string', description: 'Person ID to assign task to' }
          },
          required: ['title']
        }
      },
      {
        name: 'get_task',
        description: 'Get details of a specific task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task ID' },
            title: { type: 'string', description: 'Task title' },
            body: { type: 'string', description: 'Task description' },
            dueAt: { type: 'string', description: 'Due date (ISO 8601 format)' },
            status: { type: 'string', description: 'Task status (TODO, IN_PROGRESS, DONE)' },
            assigneeId: { type: 'string', description: 'Person ID to assign task to' }
          },
          required: ['id']
        }
      },
      {
        name: 'list_tasks',
        description: 'List tasks with optional filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of results to return (default: 20)' },
            offset: { type: 'number', description: 'Number of results to skip (default: 0)' },
            status: { type: 'string', description: 'Filter by status (TODO, IN_PROGRESS, DONE)' },
            assigneeId: { type: 'string', description: 'Filter by assignee ID' }
          }
        }
      },
      {
        name: 'delete_task',
        description: 'Delete a task from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task ID to delete' }
          },
          required: ['id']
        }
      },

      // ===== NOTE MANAGEMENT (5 tools) =====
      {
        name: 'create_note',
        description: 'Create a new note in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Note title' },
            body: { type: 'string', description: 'Note content' },
            position: { type: 'number', description: 'Position for ordering' }
          },
          required: ['title', 'body']
        }
      },
      {
        name: 'get_note',
        description: 'Get details of a specific note by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Note ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'update_note',
        description: 'Update an existing note',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Note ID' },
            title: { type: 'string', description: 'Note title' },
            body: { type: 'string', description: 'Note content' },
            position: { type: 'number', description: 'Position for ordering' }
          },
          required: ['id']
        }
      },
      {
        name: 'list_notes',
        description: 'List notes with optional filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of results to return (default: 20)' },
            offset: { type: 'number', description: 'Number of results to skip (default: 0)' },
            search: { type: 'string', description: 'Search term for note title or content' }
          }
        }
      },
      {
        name: 'delete_note',
        description: 'Delete a note from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Note ID to delete' }
          },
          required: ['id']
        }
      },

      // ===== METADATA & SEARCH (3 tools) =====
      {
        name: 'get_metadata_objects',
        description: 'Get all object types and their schemas from Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_object_metadata',
        description: 'Get metadata for a specific object type',
        inputSchema: {
          type: 'object',
          properties: {
            objectName: { type: 'string', description: 'Object name (e.g., person, company, task, note)' }
          },
          required: ['objectName']
        }
      },
      {
        name: 'search_records',
        description: 'Search across multiple object types in Twenty CRM',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            objectTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Object types to search (person, company, task, note)'
            },
            limit: { type: 'number', description: 'Maximum number of results (default: 20)' }
          },
          required: ['query']
        }
      }
    ]
  };
});

// Handle tool calls - this is where we'll implement the actual API calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // ===== PEOPLE OPERATIONS =====
      case 'create_person':
        result = await makeRequest('/rest/people', 'POST', args);
        break;

      case 'get_person':
        result = await makeRequest(`/rest/people/${args.id}`, 'GET');
        break;

      case 'update_person':
        const { id: personId, ...personData } = args;
        result = await makeRequest(`/rest/people/${personId}`, 'PATCH', personData);
        break;

      case 'list_people':
        const personParams = new URLSearchParams();
        if (args.limit) personParams.append('limit', args.limit);
        if (args.offset) personParams.append('offset', args.offset);
        if (args.search) personParams.append('search', args.search);
        if (args.companyId) personParams.append('companyId', args.companyId);
        result = await makeRequest(`/rest/people?${personParams}`, 'GET');
        break;

      case 'delete_person':
        result = await makeRequest(`/rest/people/${args.id}`, 'DELETE');
        break;

      // ===== COMPANY OPERATIONS =====
      case 'create_company':
        result = await makeRequest('/rest/companies', 'POST', args);
        break;

      case 'get_company':
        result = await makeRequest(`/rest/companies/${args.id}`, 'GET');
        break;

      case 'update_company':
        const { id: companyId, ...companyData } = args;
        result = await makeRequest(`/rest/companies/${companyId}`, 'PATCH', companyData);
        break;

      case 'list_companies':
        const companyParams = new URLSearchParams();
        if (args.limit) companyParams.append('limit', args.limit);
        if (args.offset) companyParams.append('offset', args.offset);
        if (args.search) companyParams.append('search', args.search);
        result = await makeRequest(`/rest/companies?${companyParams}`, 'GET');
        break;

      case 'delete_company':
        result = await makeRequest(`/rest/companies/${args.id}`, 'DELETE');
        break;

      // ===== TASK OPERATIONS =====
      case 'create_task':
        result = await makeRequest('/rest/tasks', 'POST', args);
        break;

      case 'get_task':
        result = await makeRequest(`/rest/tasks/${args.id}`, 'GET');
        break;

      case 'update_task':
        const { id: taskId, ...taskData } = args;
        result = await makeRequest(`/rest/tasks/${taskId}`, 'PATCH', taskData);
        break;

      case 'list_tasks':
        const taskParams = new URLSearchParams();
        if (args.limit) taskParams.append('limit', args.limit);
        if (args.offset) taskParams.append('offset', args.offset);
        if (args.status) taskParams.append('status', args.status);
        if (args.assigneeId) taskParams.append('assigneeId', args.assigneeId);
        result = await makeRequest(`/rest/tasks?${taskParams}`, 'GET');
        break;

      case 'delete_task':
        result = await makeRequest(`/rest/tasks/${args.id}`, 'DELETE');
        break;

      // ===== NOTE OPERATIONS =====
      case 'create_note':
        result = await makeRequest('/rest/notes', 'POST', args);
        break;

      case 'get_note':
        result = await makeRequest(`/rest/notes/${args.id}`, 'GET');
        break;

      case 'update_note':
        const { id: noteId, ...noteData } = args;
        result = await makeRequest(`/rest/notes/${noteId}`, 'PATCH', noteData);
        break;

      case 'list_notes':
        const noteParams = new URLSearchParams();
        if (args.limit) noteParams.append('limit', args.limit);
        if (args.offset) noteParams.append('offset', args.offset);
        if (args.search) noteParams.append('search', args.search);
        result = await makeRequest(`/rest/notes?${noteParams}`, 'GET');
        break;

      case 'delete_note':
        result = await makeRequest(`/rest/notes/${args.id}`, 'DELETE');
        break;

      // ===== METADATA & SEARCH =====
      case 'get_metadata_objects':
        result = await makeRequest('/rest/metadata/objects', 'GET');
        break;

      case 'get_object_metadata':
        result = await makeRequest(`/rest/metadata/objects/${args.objectName}`, 'GET');
        break;

      case 'search_records':
        const searchParams = new URLSearchParams();
        searchParams.append('q', args.query);
        if (args.limit) searchParams.append('limit', args.limit);
        if (args.objectTypes) searchParams.append('objectTypes', args.objectTypes.join(','));
        result = await makeRequest(`/rest/search?${searchParams}`, 'GET');
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

// SSE endpoint for MCP connection
app.get('/sse', async (req, res) => {
  console.log('[SSE] New connection from:', req.headers['user-agent']);

  // Set headers before SSEServerTransport takes over
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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
    version: '2.0.0',
    tools: 23,
    timestamp: new Date().toISOString(),
    twentyCrmUrl: TWENTY_API_URL
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    // Test connection to Twenty CRM
    await makeRequest('/rest/metadata/objects', 'GET');
    res.status(200).json({ status: 'ready', tools: 23 });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Twenty CRM MCP Server v2.0 running on port ${PORT}`);
  console.log(`✓ SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Connected to Twenty CRM: ${TWENTY_API_URL}`);
  console.log(`✓ Tools available: 23 (People, Companies, Tasks, Notes, Metadata, Search)`);
});
