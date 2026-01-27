# OpenAPI MCP Server

A generic [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes any OpenAPI-documented REST API to LLMs like Claude.

## Features

- **Auto-discovers endpoints** from any OpenAPI 3.x specification (YAML or JSON)
- **Two simple tools**: `api_discover` and `api_request`
- **Flexible authentication**: None, API Key, or Bearer token
- **Caching**: Caches OpenAPI spec locally with configurable TTL
- **Retry logic**: Automatic retry on rate limits (429) with exponential backoff

## Installation

```bash
npm install @cloudwarriors/openapi-mcp
```

Or run directly with npx:

```bash
npx @cloudwarriors/openapi-mcp
```

## Configuration

The server is configured via environment variables:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `API_BASE_URL` | Base URL of the API | `https://api.example.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `API_OPENAPI_PATH` | Path to OpenAPI spec | `/openapi.yaml` |
| `API_AUTH_TYPE` | Authentication type: `none`, `apiKey`, `bearer` | `none` |
| `API_KEY` | API key (when `API_AUTH_TYPE=apiKey`) | - |
| `API_KEY_HEADER` | Header name for API key | `X-API-Key` |
| `API_BEARER_TOKEN` | Bearer token (when `API_AUTH_TYPE=bearer`) | - |
| `API_TIMEOUT_MS` | Request timeout in milliseconds | `30000` |
| `API_CACHE_TTL_MS` | OpenAPI spec cache TTL | `3600000` (1 hour) |

## Usage with Claude Code

Add to your `.mcp.json` or Claude Code settings:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["@cloudwarriors/openapi-mcp"],
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_OPENAPI_PATH": "/docs/openapi.yaml"
      }
    }
  }
}
```

### Example: Connecting to Hermes

```json
{
  "mcpServers": {
    "hermes": {
      "command": "npx",
      "args": ["@cloudwarriors/openapi-mcp"],
      "env": {
        "API_BASE_URL": "http://localhost:3345",
        "API_OPENAPI_PATH": "/api/docs/openapi.yaml"
      }
    }
  }
}
```

### Example: Connecting to a Protected API

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["@cloudwarriors/openapi-mcp"],
      "env": {
        "API_BASE_URL": "https://api.mycompany.com",
        "API_OPENAPI_PATH": "/openapi.json",
        "API_AUTH_TYPE": "bearer",
        "API_BEARER_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Tools

### `api_discover`

Lists all available API endpoints grouped by domain/tag.

**Parameters:**
- `domain` (optional): Filter endpoints by domain/tag
- `includeParameters` (optional): Include parameter details (default: false)

**Example:**
```json
{ "domain": "users", "includeParameters": true }
```

### `api_request`

Makes an HTTP request to any API endpoint.

**Parameters:**
- `method` (required): HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)
- `path` (required): API path (e.g., `/api/users/{id}`)
- `body` (optional): Request body for POST/PUT/PATCH
- `query` (optional): Query parameters as key-value pairs
- `pathParams` (optional): Path parameter substitutions

**Example:**
```json
{
  "method": "GET",
  "path": "/api/users/{id}",
  "pathParams": { "id": "123" }
}
```

## Finding Your API's OpenAPI Spec

Common locations for OpenAPI specifications:

- `/openapi.yaml` or `/openapi.json`
- `/api/docs/openapi.yaml`
- `/swagger.json`
- `/v1/openapi.json`
- `/api-docs`

Check your API's documentation or try accessing these paths directly.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (watch)
npm run dev
```

## License

MIT

## Author

CloudWarriors
