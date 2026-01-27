/**
 * OpenAPI-specific type definitions
 */

/**
 * Raw OpenAPI specification structure (subset we care about)
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

/**
 * Path item containing operations by method
 */
export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  parameters?: ParameterObject[];
}

/**
 * Operation (endpoint) definition
 */
export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBody;
  responses: Record<string, ResponseObject>;
  deprecated?: boolean;
}

/**
 * Parameter definition
 */
export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

/**
 * Request body definition
 */
export interface RequestBody {
  required?: boolean;
  description?: string;
  content: Record<string, MediaType>;
}

/**
 * Media type definition
 */
export interface MediaType {
  schema?: SchemaObject;
}

/**
 * Response object
 */
export interface ResponseObject {
  description: string;
  content?: Record<string, MediaType>;
}

/**
 * Schema object (simplified)
 */
export interface SchemaObject {
  type?: string;
  format?: string;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  $ref?: string;
}

/**
 * Cached specification metadata
 */
export interface CachedSpec {
  spec: OpenAPISpec;
  fetchedAt: number;
  expiresAt: number;
}
