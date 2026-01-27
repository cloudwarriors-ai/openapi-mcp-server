/**
 * Typed error classes for the OpenAPI MCP Server
 */

/**
 * Base error for all API errors
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly endpoint: string;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    statusCode: number,
    endpoint: string,
    responseBody?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      endpoint: this.endpoint,
    };
  }
}

/**
 * Authentication errors (401, 403)
 */
export class AuthenticationError extends ApiError {
  constructor(endpoint: string, statusCode: 401 | 403, details?: string) {
    const message =
      statusCode === 401
        ? `Unauthorized access to ${endpoint}`
        : `Forbidden access to ${endpoint}`;
    super(details || message, statusCode, endpoint);
    this.name = "AuthenticationError";
  }

  get userGuidance(): string {
    return this.statusCode === 401
      ? "Authentication required. Set API_KEY or API_BEARER_TOKEN environment variable."
      : "You do not have permission to access this resource. Check your API key permissions.";
  }
}

/**
 * Rate limiting errors (429)
 */
export class RateLimitError extends ApiError {
  public readonly retryAfterSeconds?: number;

  constructor(endpoint: string, retryAfter?: number) {
    const message = retryAfter
      ? `Rate limited on ${endpoint}. Retry after ${retryAfter} seconds.`
      : `Rate limited on ${endpoint}.`;
    super(message, 429, endpoint);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfter;
  }
}

/**
 * Validation errors for request parameters
 */
export class ValidationError extends Error {
  public readonly field: string;
  public readonly details: string;

  constructor(field: string, details: string) {
    super(`Validation error on '${field}': ${details}`);
    this.name = "ValidationError";
    this.field = field;
    this.details = details;
  }
}

/**
 * OpenAPI specification errors
 */
export type OpenAPISpecErrorReason =
  | "fetch_failed"
  | "invalid_yaml"
  | "invalid_schema"
  | "parse_error";

export class OpenAPISpecError extends Error {
  public readonly reason: OpenAPISpecErrorReason;
  public readonly details?: string;

  constructor(reason: OpenAPISpecErrorReason, details?: string) {
    const messages: Record<OpenAPISpecErrorReason, string> = {
      fetch_failed: "Failed to fetch OpenAPI specification",
      invalid_yaml: "OpenAPI specification is not valid YAML",
      invalid_schema: "OpenAPI specification schema is invalid",
      parse_error: "Failed to parse OpenAPI specification",
    };
    super(details ? `${messages[reason]}: ${details}` : messages[reason]);
    this.name = "OpenAPISpecError";
    this.reason = reason;
    this.details = details;
  }
}

/**
 * Network/timeout errors
 */
export class NetworkError extends Error {
  public readonly endpoint: string;
  public readonly cause?: Error;

  constructor(endpoint: string, message: string, cause?: Error) {
    super(message);
    this.name = "NetworkError";
    this.endpoint = endpoint;
    this.cause = cause;
  }
}
