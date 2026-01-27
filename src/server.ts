/**
 * MCP Server module
 * Creates the server instance
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Create MCP server
export const server = new McpServer({
  name: "openapi-mcp-server",
  version: "1.0.0",
});
