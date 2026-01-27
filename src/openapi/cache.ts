/**
 * OpenAPI specification cache - file-based caching with TTL
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import type { OpenAPISpec, CachedSpec } from "./types.js";

/**
 * Cache interface (allows alternative implementations)
 */
export interface SpecCache {
  get(): Promise<CachedSpec | null>;
  set(spec: OpenAPISpec, ttlMs: number): Promise<void>;
  clear(): Promise<void>;
}

/**
 * File-based cache implementation
 */
export class FileSpecCache implements SpecCache {
  private readonly cachePath: string;

  constructor(cacheDir?: string) {
    const dir = cacheDir || join(tmpdir(), "hermes-api-mcp");
    this.cachePath = join(dir, "openapi-cache.json");
  }

  async get(): Promise<CachedSpec | null> {
    try {
      const content = await readFile(this.cachePath, "utf-8");
      const cached = JSON.parse(content) as CachedSpec;

      // Validate structure
      if (!cached.spec || !cached.fetchedAt || !cached.expiresAt) {
        return null;
      }

      // Check expiry
      if (Date.now() > cached.expiresAt) {
        return null;
      }

      return cached;
    } catch {
      // File doesn't exist or is invalid
      return null;
    }
  }

  async set(spec: OpenAPISpec, ttlMs: number): Promise<void> {
    const cached: CachedSpec = {
      spec,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    try {
      await mkdir(dirname(this.cachePath), { recursive: true });
      await writeFile(this.cachePath, JSON.stringify(cached, null, 2), "utf-8");
    } catch (error) {
      // Cache write failures are non-fatal
      console.error(
        "[hermes-api-mcp] Failed to write cache:",
        error instanceof Error ? error.message : error
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(this.cachePath);
    } catch {
      // File might not exist
    }
  }
}

/**
 * In-memory cache for testing
 */
export class MemorySpecCache implements SpecCache {
  private cached: CachedSpec | null = null;

  async get(): Promise<CachedSpec | null> {
    if (!this.cached) return null;
    if (Date.now() > this.cached.expiresAt) {
      this.cached = null;
      return null;
    }
    return this.cached;
  }

  async set(spec: OpenAPISpec, ttlMs: number): Promise<void> {
    this.cached = {
      spec,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
  }

  async clear(): Promise<void> {
    this.cached = null;
  }
}
