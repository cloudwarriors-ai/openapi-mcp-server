/**
 * Zod-validated configuration for the OpenAPI MCP Server
 */

import { z } from "zod";

/**
 * Authentication configuration
 */
const authSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("apiKey"),
    key: z.string().min(1, "API key cannot be empty"),
    header: z.string().default("X-API-Key"),
  }),
  z.object({
    type: z.literal("bearer"),
    token: z.string().min(1, "Bearer token cannot be empty"),
  }),
]);

/**
 * Full configuration schema
 */
export const configSchema = z.object({
  baseUrl: z
    .string()
    .url("Invalid API base URL"),
  openapiSpecPath: z.string().default("/openapi.yaml"),
  auth: authSchema.default({ type: "none" }),
  timeoutMs: z.number().int().positive().default(30000),
  cacheTtlMs: z.number().int().positive().default(3600000), // 1 hour
  cacheDir: z.string().optional(),
  retryOn429: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(5).default(3),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Config {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "API_BASE_URL environment variable is required.\n" +
      "Example: API_BASE_URL=https://api.example.com"
    );
  }

  const authType = process.env.API_AUTH_TYPE || "none";

  let auth: z.infer<typeof authSchema>;
  switch (authType) {
    case "apiKey":
      auth = {
        type: "apiKey",
        key: process.env.API_KEY || "",
        header: process.env.API_KEY_HEADER || "X-API-Key",
      };
      break;
    case "bearer":
      auth = {
        type: "bearer",
        token: process.env.API_BEARER_TOKEN || "",
      };
      break;
    default:
      auth = { type: "none" };
  }

  return configSchema.parse({
    baseUrl,
    openapiSpecPath: process.env.API_OPENAPI_PATH || "/openapi.yaml",
    auth,
    timeoutMs: process.env.API_TIMEOUT_MS
      ? parseInt(process.env.API_TIMEOUT_MS, 10)
      : undefined,
    cacheTtlMs: process.env.API_CACHE_TTL_MS
      ? parseInt(process.env.API_CACHE_TTL_MS, 10)
      : undefined,
    cacheDir: process.env.API_CACHE_DIR,
    retryOn429: process.env.API_RETRY_ON_429 !== "false",
    maxRetries: process.env.API_MAX_RETRIES
      ? parseInt(process.env.API_MAX_RETRIES, 10)
      : undefined,
  });
}
