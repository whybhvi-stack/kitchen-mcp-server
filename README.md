# Kitchen MCP Server

A small MCP server for pantry tracking, recipe suggestions, shopping lists, and timers.
It runs in either Streamable HTTP mode or stdio mode, so it can work with local MCP clients or a simple HTTP client.

## Tools

| Tool | Purpose |
|---|---|
| `get_pantry` | List pantry items with quantities and expiry information |
| `add_pantry_item` | Add or update a pantry item |
| `get_expiring_items` | Show items expiring within a given number of days |
| `suggest_recipes` | Rank recipes by what the user already has |
| `get_recipe_steps` | Get ingredients and steps for a recipe |
| `add_to_shopping_list` | Add one item to the shopping list |
| `get_shopping_list` | Read the shopping list |
| `start_timer` | Start a labelled kitchen timer |

## Requirements

Requires Node.js 20.19 or newer.

## Build

```bash
npm install
npm run build
```

## Run modes

### HTTP mode

```bash
npm start
```

The server listens on `http://127.0.0.1:3000/mcp` by default. You can override it with `PORT` and `HOST` environment variables.

### Stdio mode

```bash
npm run start:stdio
```

This mode is meant for MCP clients that launch the server over standard input and output.

## Example stdio MCP client config

```json
{
  "mcpServers": {
    "kitchen": {
      "command": "node",
      "args": ["dist/stdio.js"]
    }
  }
}
```

## Try it

In one terminal:

```bash
npm start
```

In another terminal:

```bash
npm run test:smoke
```

It connects, lists the 8 tools, and calls several of them.

You can also use the MCP Inspector with the Streamable HTTP transport at `http://127.0.0.1:3000/mcp`.

## How it works

- Built with the official TypeScript SDK, `@modelcontextprotocol/sdk` version `1.32.1`.
- HTTP mode uses Express and a stateless Streamable HTTP transport.
- Stdio mode uses `StdioServerTransport` for local MCP clients.
- Tool inputs are validated with zod and errors are returned as MCP error results.
- Kitchen state is held in memory in `src/kitchen.ts` and resets when the server restarts.

## Limitations

- Data is kept in memory only and resets when the process restarts.
- There is no authentication and it is intended for local use.
- The server binds to `127.0.0.1` by default in HTTP mode.

## Project structure

```text
src/
  server.ts        Express app for Streamable HTTP mode
  stdio.ts         Stdio transport entry point
  tools.ts         MCP tool registrations and zod validation
  kitchen.ts       Kitchen logic and in-memory state
  smoke-test.ts    Local smoke test client
  data/            Seed pantry and recipe data
```

## License

MIT, see [LICENSE](LICENSE).