/**
 * Tool registration - registers all tools with the MCP server
 */

import type { ToolDependencies } from "../types.js";
import type { ToolContext } from "./types.js";
import { registerDiscoverTool } from "./discover.js";
import { registerRequestTool } from "./request.js";

/**
 * Register all API tools with the MCP server
 */
export function registerAllTools(deps: ToolDependencies): void {
  const ctx: ToolContext = { deps };

  registerDiscoverTool(ctx);
  registerRequestTool(ctx);
}
