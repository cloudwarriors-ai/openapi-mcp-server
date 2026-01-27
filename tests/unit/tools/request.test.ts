/**
 * Tests for request tool logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiResponse } from "../../../src/types.js";
import type { OpenAPIService } from "../../../src/openapi/service.js";
import type { ApiHttpClient } from "../../../src/http/api-client.js";
import { AuthenticationError } from "../../../src/errors/index.js";

// Mock the server module
vi.mock("../../../src/server.js", () => ({
  server: {
    registerTool: vi.fn(),
  },
}));

import { server } from "../../../src/server.js";
import { registerRequestTool } from "../../../src/tools/request.js";

function createMockDeps() {
  return {
    openapi: {
      getEndpoints: vi.fn(),
      getEndpointsByTag: vi.fn(),
      getEndpointByPath: vi.fn().mockResolvedValue(null),
      refresh: vi.fn(),
      getSpec: vi.fn(),
    } as unknown as OpenAPIService,
    http: {
      request: vi.fn().mockResolvedValue({
        status: 200,
        data: { success: true },
        headers: {},
      } as ApiResponse),
    } as unknown as ApiHttpClient,
  };
}

describe("registerRequestTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register tool with correct name", () => {
    const deps = createMockDeps();
    registerRequestTool({ deps });

    expect(server.registerTool).toHaveBeenCalledWith(
      "api_request",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should make GET request successfully", async () => {
    const deps = createMockDeps();
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ method: "GET", path: "/api/auth/status" });

    expect(result.content[0].text).toContain("200");
    expect(result.content[0].text).toContain("success");
    expect(deps.http.request).toHaveBeenCalledWith("GET", "/api/auth/status", {
      body: undefined,
      query: undefined,
      pathParams: undefined,
    });
  });

  it("should make POST request with body", async () => {
    const deps = createMockDeps();
    const body = { username: "test", password: "secret" };
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    await handler({ method: "POST", path: "/api/auth/login", body });

    expect(deps.http.request).toHaveBeenCalledWith("POST", "/api/auth/login", {
      body,
      query: undefined,
      pathParams: undefined,
    });
  });

  it("should pass path parameters", async () => {
    const deps = createMockDeps();
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    await handler({
      method: "GET",
      path: "/api/servers/{id}",
      pathParams: { id: "123" },
    });

    expect(deps.http.request).toHaveBeenCalledWith("GET", "/api/servers/{id}", {
      body: undefined,
      query: undefined,
      pathParams: { id: "123" },
    });
  });

  it("should include query parameters", async () => {
    const deps = createMockDeps();
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    await handler({
      method: "GET",
      path: "/api/servers",
      query: { status: "running", limit: "10" },
    });

    expect(deps.http.request).toHaveBeenCalledWith("GET", "/api/servers", {
      body: undefined,
      query: { status: "running", limit: "10" },
      pathParams: undefined,
    });
  });

  it("should validate missing path parameters", async () => {
    const deps = createMockDeps();
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ method: "GET", path: "/api/servers/{id}" });

    expect(result.content[0].text).toContain("Missing required path parameters");
    expect(result.content[0].text).toContain("id");
  });

  it("should handle authentication errors", async () => {
    const deps = createMockDeps();
    (deps.http.request as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AuthenticationError("/api/servers", 401)
    );
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ method: "GET", path: "/api/servers" });

    expect(result.content[0].text).toContain("AuthenticationError");
    expect(result.content[0].text).toContain("Guidance");
  });

  it("should warn about streaming endpoints", async () => {
    const deps = createMockDeps();
    (deps.openapi.getEndpointByPath as ReturnType<typeof vi.fn>).mockResolvedValue({
      method: "GET",
      path: "/api/events/stream",
      summary: "Event stream",
      isStreaming: true,
      tags: ["events"],
      parameters: [],
      responses: {},
    });
    registerRequestTool({ deps });

    const [, , handler] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await handler({ method: "GET", path: "/api/events/stream" });

    expect(result.content[0].text).toContain("streaming endpoint");
  });
});
