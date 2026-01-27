/**
 * Tests for OpenAPI parser
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml, parseEndpoints } from "../../../src/openapi/parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../fixtures");

describe("parseYaml", () => {
  it("should parse valid OpenAPI YAML", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("Hermes API (Test Fixture)");
    expect(spec.paths).toBeDefined();
  });

  it("should throw on invalid YAML", () => {
    expect(() => parseYaml("not: valid: yaml: ::")).toThrow();
  });

  it("should throw on missing required fields", () => {
    expect(() => parseYaml('title: "Missing openapi and paths"')).toThrow(
      /Missing required fields/
    );
  });
});

describe("parseEndpoints", () => {
  it("should parse all endpoints from spec", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    // Should have 8 endpoints based on fixture
    expect(endpoints.length).toBe(8);
  });

  it("should correctly parse GET endpoint", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    const authStatus = endpoints.find(
      (e) => e.path === "/api/auth/status" && e.method === "GET"
    );
    expect(authStatus).toBeDefined();
    expect(authStatus?.summary).toBe("Get authentication status");
    expect(authStatus?.tags).toContain("auth");
  });

  it("should correctly parse POST endpoint with request body", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    const login = endpoints.find(
      (e) => e.path === "/api/auth/login" && e.method === "POST"
    );
    expect(login).toBeDefined();
    expect(login?.requestBody).toBeDefined();
    expect(login?.requestBody?.required).toBe(true);
    expect(login?.requestBody?.contentType).toBe("application/json");
  });

  it("should correctly parse path parameters", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    const getServer = endpoints.find(
      (e) => e.path === "/api/servers/{id}" && e.method === "GET"
    );
    expect(getServer).toBeDefined();
    expect(getServer?.parameters).toHaveLength(1);
    expect(getServer?.parameters[0].name).toBe("id");
    expect(getServer?.parameters[0].in).toBe("path");
    expect(getServer?.parameters[0].required).toBe(true);
  });

  it("should correctly parse query parameters", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    const listServers = endpoints.find(
      (e) => e.path === "/api/servers" && e.method === "GET"
    );
    expect(listServers).toBeDefined();
    expect(listServers?.parameters).toHaveLength(2);

    const statusParam = listServers?.parameters.find((p) => p.name === "status");
    expect(statusParam?.in).toBe("query");
    expect(statusParam?.schema?.enum).toContain("running");
  });

  it("should detect streaming endpoints", () => {
    const yaml = readFileSync(join(fixturesDir, "openapi-sample.yaml"), "utf-8");
    const spec = parseYaml(yaml);
    const endpoints = parseEndpoints(spec);

    const eventStream = endpoints.find((e) => e.path === "/api/events/stream");
    expect(eventStream).toBeDefined();
    expect(eventStream?.isStreaming).toBe(true);
  });
});
