#!/usr/bin/env node
/**
 * OpenAPI MCP Server
 *
 * A generic MCP server that exposes any OpenAPI-documented REST API to LLMs.
 * Auto-discovers endpoints from the OpenAPI specification.
 *
 * Environment variables:
 * - API_BASE_URL: Base URL for the API (required)
 * - API_OPENAPI_PATH: Path to OpenAPI spec (default: /openapi.yaml)
 * - API_AUTH_TYPE: 'none', 'apiKey', or 'bearer' (default: none)
 * - API_KEY: API key (when auth type is apiKey)
 * - API_KEY_HEADER: Header name for API key (default: X-API-Key)
 * - API_BEARER_TOKEN: Bearer token (when auth type is bearer)
 * - API_TIMEOUT_MS: Request timeout in milliseconds (default: 30000)
 * - API_CACHE_TTL_MS: OpenAPI spec cache TTL (default: 3600000)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { loadConfigFromEnv } from "./config.js";
import { OpenAPIService } from "./openapi/service.js";
import { ApiHttpClient } from "./http/api-client.js";
import { registerAllTools } from "./tools/factory.js";

/**
 * Main entry point
 */
async function main() {
  console.error("[openapi-mcp] Starting...");

  // Load configuration
  let config;
  try {
    config = loadConfigFromEnv();
    console.error(`[openapi-mcp] API URL: ${config.baseUrl}`);
    console.error(`[openapi-mcp] OpenAPI spec: ${config.openapiSpecPath}`);
    console.error(`[openapi-mcp] Auth type: ${config.auth.type}`);
  } catch (error) {
    console.error("[openapi-mcp] Configuration error:", error);
    process.exit(1);
  }

  // Create services
  const openapi = new OpenAPIService(config);
  const http = new ApiHttpClient(config);

  // Register all tools with dependencies
  registerAllTools({ openapi, http });
  console.error("[openapi-mcp] Registered 2 tools: api_discover, api_request");

  // Pre-fetch OpenAPI spec (non-blocking, will use cache/retry on demand)
  openapi.getEndpoints().then(
    (endpoints) => {
      console.error(`[openapi-mcp] Loaded ${endpoints.length} endpoints from OpenAPI spec`);
    },
    (error) => {
      console.error(
        "[openapi-mcp] Warning: Could not pre-fetch OpenAPI spec:",
        error instanceof Error ? error.message : error
      );
    }
  );

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[openapi-mcp] MCP server running via stdio");

  // Graceful shutdown
  const cleanup = () => {
    console.error("[openapi-mcp] Shutting down...");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  console.error("[openapi-mcp] Fatal error:", error);
  process.exit(1);
});
