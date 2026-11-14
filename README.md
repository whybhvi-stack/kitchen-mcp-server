# Kitchen MCP Server

A small MCP server for pantry tracking, recipe suggestions, shopping lists, and timers.
It runs in either Streamable HTTP mode or stdio mode, so it can work with local MCP clients or a simple HTTP client.

## Tools

| Tool | Purpose |
|---|---|
| `get_pantry` | List pantry items with quantities and expiry information |
| `add_pantry_item` | Add or update a pantry item |
| `remove_pantry_item` | Remove a pantry item by name |
| `get_expiring_items` | Show items expiring within a given number of days |
| `suggest_recipes` | Rank recipes by what the user already has |
| `get_recipe_steps` | Get ingredients and steps for a recipe |
| `add_to_shopping_list` | Add one item to the shopping list |
| `get_shopping_list` | Read the shopping list, optionally filtered by status |
| `update_shopping_item` | Update quantity or status for a shopping item |
| `remove_from_shopping_list` | Remove a shopping item by name |
| `start_timer` | Start a labelled kitchen timer and store it in SQLite |
| `list_timers` | List timers, including remaining time; the server cannot ring or notify |
| `cancel_timer` | Cancel a running timer by id |

## Requirements

Requires Node.js 24.15+.

## Database settings

The server stores SQLite data in a file named `kitchen.db` under a `.kitchen-mcp-server` folder in the user's home directory by default.

- Unix-like systems: `~/.kitchen-mcp-server/kitchen.db`
- Windows: `%USERPROFILE%\.kitchen-mcp-server\kitchen.db`

You can override this with `KITCHEN_DB_PATH`.

```bash
KITCHEN_DB_PATH=/path/to/my-kitchen.db npm start
```

You can also turn on a one-time demo pantry seed for a new empty database:

```bash
KITCHEN_SEED_DEMO=true npm start
```

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

Pantry and shopping list data are persisted between restarts in SQLite. Timers are also saved between restarts, but the server cannot ring or notify the user; the agent should call `list_timers` and tell the user to also use a phone alarm.

### Stdio mode

```bash
npm run start:stdio
```

This mode is meant for MCP clients that launch the server over standard input and output.

## Back up your data

Stop the server cleanly, then copy `kitchen.db` together with any `kitchen.db-wal` and `kitchen.db-shm` files that exist next to it. When you want to restore it, point `KITCHEN_DB_PATH` at the saved file.

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

It connects, lists the 13 tools, and calls several of them.

You can also use the MCP Inspector with the Streamable HTTP transport at `http://127.0.0.1:3000/mcp`.

## How it works

- Built with the official TypeScript SDK, `@modelcontextprotocol/sdk` version `1.32.1`.
- HTTP mode uses Express and a stateless Streamable HTTP transport.
- Stdio mode uses `StdioServerTransport` for local MCP clients.
- Tool inputs are validated with zod and errors are returned as MCP error results.
- Pantry and shopping data are stored in SQLite and persist across restarts.
- Timer state is stored in SQLite and persists across restarts, but the server cannot ring or notify the user.

## Limitations

- Timers are saved in SQLite and persist across restarts, but the server cannot ring or notify the user; use a phone alarm as well.
- There is no authentication and it is intended for local use.
- The server binds to `127.0.0.1` by default in HTTP mode.

## Project structure

```text
src/
  server.ts        Express app for Streamable HTTP mode
  stdio.ts         Stdio transport entry point
  tools.ts         MCP tool registrations and zod validation
  kitchen.ts       Recipe lookup (pantry, shopping list and timers live in src/db)
  smoke-test.ts    Local smoke test client
  data/            Seed pantry and recipe data
```

## License

MIT, see [LICENSE](LICENSE).