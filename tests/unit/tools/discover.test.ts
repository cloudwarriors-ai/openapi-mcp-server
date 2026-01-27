/**
 * Tests for discover tool logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Endpoint } from "../../../src/types.js";
import type { OpenAPIService } from "../../../src/openapi/service.js";
import type { ApiHttpClient } from "../../../src/http/api-client.js";

// Mock the server module
vi.mock("../../../src/server.js", () => ({
  server: {
    registerTool: vi.fn(),
  },
}));

import { server } from "../../../src/server.js";
import { registerDiscoverTool } from "../../../src/tools/discover.js";

function createMockEndpoints(): Endpoint[] {
  return [
    {
      method: "GET",
      path: "/api/auth/status",
      summary: "Get authentication status",
      tags: ["auth"],
      parameters: [],
      responses: { "200": { description: "OK" } },
    },
    {
      method: "POST",
      path: "/api/auth/login",
      summary: "Login with credentials",
      tags: ["auth"],
      parameters: [],
      requestBody: {
        required: true,
        contentType: "application/json",
      },
      responses: { "200": { description: "OK" } },
    },
    {
      method: "GET",
      path: "/api/servers",
      summary: "List all servers",
      tags: ["servers"],
      parameters: [
        { name: "status", in: "query", required: false, description: "Filter by status" },
      ],
      responses: { "200": { description: "OK" } },
    },
    {
      method: "GET",
      path: "/api/events/stream",
      summary: "Subscribe to events (SSE)",
      tags: ["events"],
      parameters: [],
      responses: { "200": { description: "OK" } },
      isStreaming: true,
    },
  ];
}

function createMockDeps(endpoints: Endpoint[]) {
  const grouped: Record<string, Endpoint[]> = {};
  for (const e of endpoints) {
    for (const tag of e.tags) {
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push(e);
    }
  }

  return {
    openapi: {
      getEndpoints: vi.fn().mockResolvedValue(endpoints),
      getEndpointsByTag: vi.fn().mockResolvedValue(grouped),
      getEndpointByPath: vi.fn(),
      refresh: vi.fn(),
      getSpec: vi.fn(),
    } as unknown as OpenAPIService,
    http: {} as ApiHttpClient,
  };
}

describe("registerDiscoverTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register tool with correct name", () => {
    const deps = createMockDeps(createMockEndpoints());
    registerDiscoverTool({ deps });

    expect(server.registerTool).toHaveBeenCalledWith(
      "api_discover",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should list all endpoints grouped by domain", async () => {
    const endpoints = createMockEndpoints();
    const deps = createMockDeps(endpoints);
    registerDiscoverTool({ deps });

    // Get the handler that was registered
    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];

    const result = await handler({});

    expect(result.content[0].text).toContain("auth");
    expect(result.content[0].text).toContain("servers");
    expect(result.content[0].text).toContain("events");
    expect(result.content[0].text).toContain("GET /api/auth/status");
  });

  it("should filter by domain when specified", async () => {
    const endpoints = createMockEndpoints();
    const deps = createMockDeps(endpoints);
    registerDiscoverTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ domain: "auth" });

    expect(result.content[0].text).toContain("auth");
    expect(result.content[0].text).not.toContain("## servers");
    expect(result.content[0].text).not.toContain("## events");
  });

  it("should include parameters when requested", async () => {
    const endpoints = createMockEndpoints();
    const deps = createMockDeps(endpoints);
    registerDiscoverTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ includeParameters: true });

    expect(result.content[0].text).toContain("Parameters:");
    expect(result.content[0].text).toContain("status");
  });

  it("should mark streaming endpoints", async () => {
    const endpoints = createMockEndpoints();
    const deps = createMockDeps(endpoints);
    registerDiscoverTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({});

    expect(result.content[0].text).toContain("[STREAMING]");
  });

  it("should handle empty results gracefully", async () => {
    const deps = createMockDeps([]);
    registerDiscoverTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({});

    expect(result.content[0].text).toContain("No endpoints found");
  });

  it("should handle errors gracefully", async () => {
    const deps = createMockDeps([]);
    (deps.openapi.getEndpointsByTag as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );
    registerDiscoverTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({});

    expect(result.content[0].text).toContain("Failed to discover endpoints");
  });
});
