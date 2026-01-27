/**
 * OpenAPI Service - facade coordinating loader, parser, and cache
 */

import type { Endpoint, HttpMethod } from "../types.js";
import type { Config } from "../config.js";
import type { OpenAPISpec } from "./types.js";
import type { SpecLoader } from "./loader.js";
import type { SpecCache } from "./cache.js";
import { HttpSpecLoader } from "./loader.js";
import { FileSpecCache } from "./cache.js";
import { parseYaml, parseEndpoints } from "./parser.js";
import { OpenAPISpecError } from "../errors/index.js";

/**
 * Service for managing OpenAPI specification lifecycle
 */
export class OpenAPIService {
  private readonly loader: SpecLoader;
  private readonly cache: SpecCache;
  private readonly config: Config;
  private endpoints: Endpoint[] | null = null;
  private spec: OpenAPISpec | null = null;

  constructor(config: Config, loader?: SpecLoader, cache?: SpecCache) {
    this.config = config;
    this.loader = loader || new HttpSpecLoader(config);
    this.cache = cache || new FileSpecCache(config.cacheDir);
  }

  /**
   * Get all endpoints, fetching/caching spec as needed
   */
  async getEndpoints(): Promise<Endpoint[]> {
    if (this.endpoints) {
      return this.endpoints;
    }

    // Try cache first
    const cached = await this.cache.get();
    if (cached) {
      this.spec = cached.spec;
      this.endpoints = parseEndpoints(cached.spec);
      return this.endpoints;
    }

    // Fetch fresh spec
    await this.refresh();
    return this.endpoints!;
  }

  /**
   * Get a specific endpoint by method and path
   */
  async getEndpointByPath(method: HttpMethod, path: string): Promise<Endpoint | null> {
    const endpoints = await this.getEndpoints();

    // Exact match first
    let endpoint = endpoints.find(
      (e) => e.method === method && e.path === path
    );
    if (endpoint) return endpoint;

    // Try matching with path parameters (e.g., /api/users/{id} matches /api/users/123)
    endpoint = endpoints.find((e) => {
      if (e.method !== method) return false;
      return this.pathMatches(e.path, path);
    });

    return endpoint || null;
  }

  /**
   * Get endpoints grouped by tag/domain
   */
  async getEndpointsByTag(): Promise<Record<string, Endpoint[]>> {
    const endpoints = await this.getEndpoints();
    const grouped: Record<string, Endpoint[]> = {};

    for (const endpoint of endpoints) {
      for (const tag of endpoint.tags) {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(endpoint);
      }
    }

    return grouped;
  }

  /**
   * Force refresh of the OpenAPI spec
   */
  async refresh(): Promise<void> {
    let yamlContent: string;

    try {
      yamlContent = await this.loader.fetch();
    } catch (error) {
      // Try to use stale cache as fallback
      const staleCache = await this.cache.get();
      if (staleCache) {
        console.error(
          "[openapi-mcp] Failed to fetch spec, using stale cache:",
          error instanceof Error ? error.message : error
        );
        this.spec = staleCache.spec;
        this.endpoints = parseEndpoints(staleCache.spec);
        return;
      }
      throw error;
    }

    this.spec = parseYaml(yamlContent);
    this.endpoints = parseEndpoints(this.spec);

    // Cache the fresh spec
    await this.cache.set(this.spec, this.config.cacheTtlMs);
  }

  /**
   * Get the raw OpenAPI spec
   */
  async getSpec(): Promise<OpenAPISpec> {
    if (!this.spec) {
      await this.getEndpoints();
    }
    if (!this.spec) {
      throw new OpenAPISpecError("fetch_failed", "No spec available");
    }
    return this.spec;
  }

  /**
   * Check if a concrete path matches a templated path
   */
  private pathMatches(templatePath: string, concretePath: string): boolean {
    const templateParts = templatePath.split("/");
    const concreteParts = concretePath.split("/");

    if (templateParts.length !== concreteParts.length) {
      return false;
    }

    return templateParts.every((part, i) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        // Path parameter - matches anything
        return true;
      }
      return part === concreteParts[i];
    });
  }
}
