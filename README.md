# docshark

A TMCP (lightweight MCP) server built with:

- **Schema Adapter**: @tmcp/adapter-valibot
- **Transports**: @tmcp/transport-stdio, @tmcp/transport-http, @tmcp/transport-sse
- **Example**: Included at `src/index.js`

## Development

```bash
# Install dependencies
pnpm install

# Start the server
pnpm run start

# Start with file watching
pnpm run dev
```

## Usage

This server provides the following capabilities:

### Tools

- `hello` - A simple greeting tool

### Example Server

Run the example server:

```bash
node src/index.js
```

The example demonstrates:
- Schema validation with @tmcp/adapter-valibot
- STDIO transport for MCP communication



## Architecture

This server uses the TMCP (lightweight MCP) architecture:

- **McpServer**: Core server implementation
- **Schema Adapter**: Validates input using @tmcp/adapter-valibot
- **Transports**: Communication layers (@tmcp/transport-stdio, @tmcp/transport-http, @tmcp/transport-sse)

## Learn More

- [TMCP Documentation](https://github.com/paoloricciuti/tmcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)