/**
 * api_request tool - generic HTTP client for any API endpoint
 */

import { z } from "zod";
import { server } from "../server.js";
import type { ToolContext } from "./types.js";
import type { HttpMethod } from "../types.js";
import { ValidationError } from "../errors/index.js";

/**
 * Input schema for request tool
 */
const requestInputSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .describe("HTTP method for the request"),
  path: z
    .string()
    .min(1)
    .describe("API path (e.g., '/api/auth/status' or '/api/servers/{id}')"),
  body: z
    .unknown()
    .optional()
    .describe("Request body for POST/PUT/PATCH requests (will be JSON-encoded)"),
  query: z
    .record(z.string())
    .optional()
    .describe("Query parameters as key-value pairs"),
  pathParams: z
    .record(z.string())
    .optional()
    .describe("Path parameters to substitute (e.g., { 'id': '123' } for /api/servers/{id})"),
}).strict();

/**
 * Validate path parameters against the endpoint definition
 */
function validatePathParams(
  path: string,
  pathParams: Record<string, string> | undefined
): void {
  // Find all {param} in the path
  const paramPattern = /\{([^}]+)\}/g;
  const requiredParams: string[] = [];
  let match;

  while ((match = paramPattern.exec(path)) !== null) {
    requiredParams.push(match[1]);
  }

  if (requiredParams.length === 0) {
    return; // No path params needed
  }

  if (!pathParams) {
    throw new ValidationError(
      "pathParams",
      `Missing required path parameters: ${requiredParams.join(", ")}`
    );
  }

  const missing = requiredParams.filter((p) => !(p in pathParams));
  if (missing.length > 0) {
    throw new ValidationError(
      "pathParams",
      `Missing required path parameters: ${missing.join(", ")}`
    );
  }
}

/**
 * Format the response for the LLM
 */
function formatResponse(
  status: number,
  data: unknown,
  endpoint?: { summary?: string; isStreaming?: boolean }
): string {
  const lines: string[] = [];

  // Status line
  const statusText = status >= 200 && status < 300 ? "Success" : "Error";
  lines.push(`## Response: ${status} ${statusText}`);

  // Endpoint info if available
  if (endpoint?.summary) {
    lines.push(`Endpoint: ${endpoint.summary}`);
  }

  // Streaming warning
  if (endpoint?.isStreaming) {
    lines.push(
      "\n⚠️ This is a streaming endpoint. The response shown is initial data only. " +
        "Real-time updates are not supported via this tool."
    );
  }

  // Response data
  lines.push("\n### Data\n```json");
  lines.push(JSON.stringify(data, null, 2));
  lines.push("```");

  return lines.join("\n");
}

/**
 * Format error for the LLM
 */
function formatError(error: Error): string {
  const lines: string[] = [];
  lines.push(`## Error: ${error.name}`);
  lines.push(`\n${error.message}`);

  // Add guidance for known error types
  if ("userGuidance" in error && typeof error.userGuidance === "string") {
    lines.push(`\n**Guidance:** ${error.userGuidance}`);
  }

  if ("statusCode" in error) {
    lines.push(`\n**Status Code:** ${error.statusCode}`);
  }

  return lines.join("\n");
}

/**
 * Register the request tool
 */
export function registerRequestTool(ctx: ToolContext) {
  server.registerTool(
    "api_request",
    {
      title: "API Request",
      description:
        "Make an HTTP request to any API endpoint. " +
        "Use api_discover first to see available endpoints and their parameters. " +
        "Supports path parameter substitution (e.g., '/api/servers/{id}' with pathParams: { 'id': '123' }).",
      inputSchema: requestInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        // Validate path parameters
        validatePathParams(params.path, params.pathParams);

        // Look up endpoint for metadata
        const endpoint = await ctx.deps.openapi.getEndpointByPath(
          params.method as HttpMethod,
          params.path
        );

        // Warn if endpoint not found in spec (might still work)
        if (!endpoint) {
          console.error(
            `[openapi-mcp] Warning: Endpoint ${params.method} ${params.path} not found in OpenAPI spec`
          );
        }

        // Make the request
        const response = await ctx.deps.http.request(params.method as HttpMethod, params.path, {
          body: params.body,
          query: params.query,
          pathParams: params.pathParams,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: formatResponse(response.status, response.data, endpoint || undefined),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError(error instanceof Error ? error : new Error(String(error))),
            },
          ],
        };
      }
    }
  );
}
