/**
 * OpenAPI YAML parser - converts raw spec to typed Endpoint structures
 */

import YAML from "yaml";
import { OpenAPISpecError } from "../errors/index.js";
import type { Endpoint, HttpMethod, Parameter, ParameterIn } from "../types.js";
import type { OpenAPISpec, Operation, ParameterObject, PathItem } from "./types.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

/**
 * Parse YAML string to OpenAPI spec object
 */
export function parseYaml(yamlContent: string): OpenAPISpec {
  try {
    const parsed = YAML.parse(yamlContent);
    if (!parsed || typeof parsed !== "object") {
      throw new OpenAPISpecError("invalid_yaml", "Parsed content is not an object");
    }
    if (!parsed.openapi || !parsed.paths) {
      throw new OpenAPISpecError(
        "invalid_schema",
        "Missing required fields: openapi, paths"
      );
    }
    return parsed as OpenAPISpec;
  } catch (error) {
    if (error instanceof OpenAPISpecError) {
      throw error;
    }
    throw new OpenAPISpecError(
      "parse_error",
      error instanceof Error ? error.message : "Unknown parse error"
    );
  }
}

/**
 * Convert OpenAPI spec to array of Endpoint objects
 */
export function parseEndpoints(spec: OpenAPISpec): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const pathParams = (pathItem as PathItem).parameters || [];

    for (const method of HTTP_METHODS) {
      const methodLower = method.toLowerCase() as keyof PathItem;
      const operation = (pathItem as PathItem)[methodLower] as Operation | undefined;

      if (!operation) continue;

      const endpoint = parseOperation(method, path, operation, pathParams);
      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Parse a single operation into an Endpoint
 */
function parseOperation(
  method: HttpMethod,
  path: string,
  operation: Operation,
  pathParams: ParameterObject[]
): Endpoint {
  const allParams = [...pathParams, ...(operation.parameters || [])];
  const parameters = allParams.map(parseParameter);

  // Check for SSE/streaming endpoints
  const isStreaming = detectStreaming(operation);

  // Parse request body
  let requestBody: Endpoint["requestBody"];
  if (operation.requestBody) {
    const contentTypes = Object.keys(operation.requestBody.content || {});
    const primaryContentType = contentTypes[0] || "application/json";
    const mediaType = operation.requestBody.content?.[primaryContentType];

    requestBody = {
      required: operation.requestBody.required ?? false,
      contentType: primaryContentType,
      schema: mediaType?.schema as Record<string, unknown> | undefined,
    };
  }

  // Parse responses
  const responses: Record<string, { description: string }> = {};
  for (const [code, response] of Object.entries(operation.responses || {})) {
    responses[code] = { description: response.description || "" };
  }

  return {
    method,
    path,
    operationId: operation.operationId,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags || ["default"],
    parameters,
    requestBody,
    responses,
    isStreaming,
  };
}

/**
 * Parse a parameter object
 */
function parseParameter(param: ParameterObject): Parameter {
  return {
    name: param.name,
    in: param.in as ParameterIn,
    required: param.required ?? param.in === "path",
    description: param.description,
    schema: param.schema
      ? {
          type: param.schema.type,
          format: param.schema.format,
          default: param.schema.default,
          enum: param.schema.enum,
        }
      : undefined,
  };
}

/**
 * Detect if an endpoint is a streaming/SSE endpoint
 */
function detectStreaming(operation: Operation): boolean {
  // Check response content types for SSE
  for (const response of Object.values(operation.responses || {})) {
    const contentTypes = Object.keys(response.content || {});
    if (contentTypes.some((ct) => ct.includes("event-stream") || ct.includes("ndjson"))) {
      return true;
    }
  }

  // Check description/summary for streaming hints
  const text = `${operation.summary || ""} ${operation.description || ""}`.toLowerCase();
  return text.includes("stream") || text.includes("sse") || text.includes("server-sent");
}
