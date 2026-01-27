/**
 * Tool-related types for OpenAPI MCP Server
 */

import type { ToolDependencies } from "../types.js";

/**
 * Tool result returned to the LLM
 */
export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Tool registration context
 */
export interface ToolContext {
  deps: ToolDependencies;
}
