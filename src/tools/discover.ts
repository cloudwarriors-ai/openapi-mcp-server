/**
 * api_discover tool - lists all available API endpoints
 */

import { z } from "zod";
import { server } from "../server.js";
import type { ToolContext } from "./types.js";
import type { Endpoint } from "../types.js";

/**
 * Input schema for discover tool
 */
const discoverInputSchema = z.object({
  domain: z
    .string()
    .optional()
    .describe("Filter endpoints by domain/tag (e.g., 'auth', 'servers', 'workflows')"),
  includeParameters: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include parameter details for each endpoint"),
}).strict();

/**
 * Format an endpoint for display
 */
function formatEndpoint(endpoint: Endpoint, includeParams: boolean): string {
  const lines: string[] = [];

  // Method and path
  const streamingNote = endpoint.isStreaming ? " [STREAMING]" : "";
  lines.push(`${endpoint.method} ${endpoint.path}${streamingNote}`);

  // Summary
  if (endpoint.summary) {
    lines.push(`  ${endpoint.summary}`);
  }

  // Parameters
  if (includeParams && endpoint.parameters.length > 0) {
    lines.push("  Parameters:");
    for (const param of endpoint.parameters) {
      const required = param.required ? " (required)" : "";
      const type = param.schema?.type ? `: ${param.schema.type}` : "";
      lines.push(`    - ${param.name}${type}${required}`);
      if (param.description) {
        lines.push(`      ${param.description}`);
      }
    }
  }

  // Request body
  if (includeParams && endpoint.requestBody) {
    const required = endpoint.requestBody.required ? " (required)" : "";
    lines.push(`  Request Body${required}: ${endpoint.requestBody.contentType}`);
  }

  return lines.join("\n");
}

/**
 * Register the discover tool
 */
export function registerDiscoverTool(ctx: ToolContext) {
  server.registerTool(
    "api_discover",
    {
      title: "Discover API Endpoints",
      description:
        "List all available API endpoints grouped by domain. " +
        "Call this first to understand what APIs are available before making requests. " +
        "Returns method, path, description, and optionally parameters for each endpoint.",
      inputSchema: discoverInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const groupedEndpoints = await ctx.deps.openapi.getEndpointsByTag();

        // Filter by domain if specified
        let domains = Object.keys(groupedEndpoints).sort();
        if (params.domain) {
          const searchDomain = params.domain.toLowerCase();
          domains = domains.filter((d) => d.toLowerCase().includes(searchDomain));
        }

        if (domains.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: params.domain
                  ? `No endpoints found for domain "${params.domain}". Available domains: ${Object.keys(groupedEndpoints).join(", ")}`
                  : "No endpoints found in the API specification.",
              },
            ],
          };
        }

        // Build output
        const sections: string[] = [];
        let totalEndpoints = 0;

        for (const domain of domains) {
          const endpoints = groupedEndpoints[domain];
          totalEndpoints += endpoints.length;

          sections.push(`\n## ${domain} (${endpoints.length} endpoints)\n`);

          for (const endpoint of endpoints) {
            sections.push(formatEndpoint(endpoint, params.includeParameters ?? false));
            sections.push(""); // Blank line between endpoints
          }
        }

        const header = `# API Endpoints\nTotal: ${totalEndpoints} endpoints across ${domains.length} domains\n`;
        const footer =
          "\n---\nUse api_request to call any endpoint. Example:\n" +
          '  { "method": "GET", "path": "/api/status" }';

        return {
          content: [
            {
              type: "text" as const,
              text: header + sections.join("\n") + footer,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to discover endpoints: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
