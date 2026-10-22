# Kitchen MCP Server

An open-source **MCP (Model Context Protocol) server** that exposes kitchen tools
(pantry, recipes, shopping list, timers) over **Streamable HTTP**.

It is the companion to [Kitchen Copilot](https://github.com/whybhvi-stack/kitchen-copilot),
a simulated Alexa+ cooking assistant built for the Amazon Developer Hackathon.
Kitchen Copilot's in-browser tool layer mirrors these tools; this repo packages them
as a real, standalone MCP server that any MCP client can call.

## Tools

| Tool | Purpose |
|---|---|
| `get_pantry` | List pantry items with days until expiry |
| `add_pantry_item` | Add or update a pantry item |
| `get_expiring_items` | Items expiring within N days |
| `suggest_recipes` | Recipes ranked by what you already have, with missing ingredients |
| `get_recipe_steps` | Ingredients and steps for a recipe |
| `add_to_shopping_list` | Add one item to the list |
| `get_shopping_list` | Read the list |
| `start_timer` | Start a labelled timer |

## Run it

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm start
```

The server listens on `http://127.0.0.1:3000/mcp` (override with `PORT` and `HOST`).
It binds to localhost by default.

## Try it

In a second terminal, run the included client:

```bash
npm run test:smoke
```

It connects, lists the 8 tools, and calls several of them.

You can also connect any MCP client that supports Streamable HTTP, for example the
MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Choose the Streamable HTTP transport and enter `http://127.0.0.1:3000/mcp`.

## How it works

- Built with the official TypeScript SDK, `@modelcontextprotocol/sdk` **v1.32.1**
  (protocol version 2025-11-25).
- Stateless Streamable HTTP: each POST to `/mcp` gets a fresh MCP server and transport.
- Tool inputs are validated with zod. Errors come back as MCP error results.
- Kitchen data is held in memory in `kitchen.ts`, shared across requests.

```
MCP client ──POST /mcp──► Express ──► StreamableHTTPServerTransport
                                          │
                                          ▼
                                   McpServer (tools.ts)
                                          │
                                          ▼
                                 kitchen.ts (shared state)
```

## Limitations

- Data is in memory and resets when the server restarts.
- No authentication: it is meant for local use and binds to `127.0.0.1` by default.
- Stateless mode only: there are no sessions and no server-to-client streaming.

## Project structure

```
src/
  server.ts       Express app and Streamable HTTP transport
  tools.ts        MCP tool registrations (zod schemas)
  kitchen.ts      domain logic and in-memory state
  smoke-test.ts   MCP client that exercises the server
  data/           seed pantry and recipes
```

## License

MIT, see [LICENSE](LICENSE).