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