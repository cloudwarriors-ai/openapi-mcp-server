/**
 * Shared TypeScript interfaces for the OpenAPI MCP Server
 */

import type { OpenAPIService } from "./openapi/service.js";
import type { ApiHttpClient } from "./http/api-client.js";

/**
 * HTTP methods supported
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * Parameter location in the request
 */
export type ParameterIn = "path" | "query" | "header" | "body";

/**
 * API endpoint parameter definition
 */
export interface Parameter {
  name: string;
  in: ParameterIn;
  required: boolean;
  description?: string;
  schema?: {
    type?: string;
    format?: string;
    default?: unknown;
    enum?: string[];
  };
}

/**
 * API endpoint definition parsed from OpenAPI spec
 */
export interface Endpoint {
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: {
    required: boolean;
    contentType: string;
    schema?: Record<string, unknown>;
  };
  responses: Record<string, { description: string }>;
  isStreaming?: boolean;
}

/**
 * Dependencies injected into tool handlers
 */
export interface ToolDependencies {
  openapi: OpenAPIService;
  http: ApiHttpClient;
}

/**
 * HTTP response from API
 */
export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Request options for HTTP client
 */
export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string>;
  pathParams?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
}
