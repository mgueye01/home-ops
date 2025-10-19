TWENTY MCP SERVER CONNECTION FIX - AGENT INSTRUCTIONS

PROBLEM:
The Twenty CRM MCP server is accepting SSE (Server-Sent Events) connections but immediately closing them without completing the MCP protocol handshake. This causes n8n workflows to timeout after 60 seconds with error code -32001.

EVIDENCE FROM LOGS:
- n8n error: "McpClientTool: Failed to connect to MCP Server" with timeout error code -32001 after 60 seconds
- Twenty MCP server logs show: "[SSE] New connection from: node" immediately followed by "[SSE] Connection closed"
- This pattern repeats - connections open and immediately close

ROOT CAUSE:
The SSE endpoint is closing the HTTP response stream prematurely instead of keeping it open for bidirectional communication. An SSE connection MUST remain open for the entire session.

CURRENT DEPLOYMENT:
- Image: ghcr.io/mgueye01/twenty-crm-mcp-server:66edce6ceec9b2e046f4260fd363c24447def717
- Kubernetes namespace: dev
- Service: twenty-mcp.dev.svc.cluster.local
- SSE Endpoint: http://twenty-mcp.dev.svc.cluster.local/sse
- Twenty API: https://lelabo-crm.g-eye.io

THE FIX:
Find the SSE endpoint handler (likely in the /sse route) and fix the connection lifecycle:

WRONG CODE (current):
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  // ... some logic ...
  res.end(); // ❌ This closes the connection immediately
});

CORRECT CODE (needed):
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Store connection
  const clientId = generateUniqueId();
  activeConnections.set(clientId, res);

  // Send MCP initialization message immediately
  sendMcpInitialization(res);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Handle disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    activeConnections.delete(clientId);
    console.log('[SSE] Connection closed');
  });

  // CRITICAL: DO NOT call res.end() - keep connection open!
});

KEY REQUIREMENTS:
1. NEVER call res.end() on the SSE endpoint
2. Keep the response stream open indefinitely
3. Send MCP initialization message immediately on connect
4. Implement heartbeat (every 30 seconds) to prevent timeout
5. Handle client disconnect events properly
6. Store active connections in a Map/object for later use

MCP INITIALIZATION MESSAGE:
The server must send this immediately after connection:
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
    "serverInfo": { "name": "twenty-crm-mcp-server", "version": "1.0.0" },
    "tools": [list of Twenty CRM tools]
  }
}

Format: Send as SSE message using: res.write(`data: ${JSON.stringify(message)}\n\n`)

TWENTY CRM TOOLS TO EXPOSE:
- create_person, get_person, update_person, list_people, delete_person
- create_company, get_company, update_company, list_companies, delete_company
- create_note, get_note, update_note, list_notes, delete_note
- create_task, get_task, update_task, list_tasks, delete_task

TESTING INSTRUCTIONS:
1. After fixing, build and deploy new image
2. Test SSE connection stays open:
   kubectl exec -n default deployment/n8n -- curl -N http://twenty-mcp.dev.svc.cluster.local/sse
   Expected: Connection stays open, receives messages
3. Test in n8n workflow VW3XopDpR7mIFWI2 (CRM Agent)
   Expected: No timeout, successful MCP connection

SUCCESS CRITERIA:
✓ SSE connections remain open (no immediate "Connection closed" in logs)
✓ n8n connects without 60-second timeout
✓ MCP initialization message is sent
✓ Twenty CRM operations work through n8n workflow

ADDITIONAL NOTES:
- The Twenty CRM API integration is working fine (server connects successfully)
- The issue is ONLY in the SSE connection lifecycle management
- Server starts successfully and is reachable
- Focus on the /sse endpoint handler code
