import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { initDatabase } from "./db/index.js";
import * as pantryRepo from "./db/pantryRepo.js";
import * as shoppingRepo from "./db/shoppingRepo.js";
import * as kitchen from "./kitchen.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const trimmedName = (field: string, max = 100) =>
  z.string().trim().min(1, `${field} must not be empty`).max(max, `${field} must be ${max} characters or fewer`);

const trimmedRecipeId = () => trimmedName("recipe_id", 100);
const quantitySchema = z.string().trim().min(1, "quantity must not be empty").max(50, "quantity must be 50 characters or fewer");
const expirySchema = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "expiry must be in YYYY-MM-DD format",
  })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, {
    message: "expiry must be a real calendar date",
  });

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

// Runs a tool and turns any thrown error into a proper MCP error result.
function safe(fn: () => unknown): ToolResult {
  try {
    return ok(fn());
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
    };
  }
}

function safeDb(fn: () => unknown): ToolResult {
  try {
    initDatabase();
    const value = fn();
    if (value instanceof Promise) {
      throw new Error("Database function returned a Promise instead of a value.");
    }
    return ok(value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    return {
      isError: true,
      content: [{ type: "text", text: "Could not save to the kitchen database. Try again." }],
    };
  }
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "kitchen-mcp-server", version: "1.0.0" });

  server.registerTool(
    "get_pantry",
    { title: "Get pantry", description: "List everything in the pantry with quantities and days until expiry." },
    async () => safeDb(() => pantryRepo.getPantry()),
  );

  server.registerTool(
    "add_pantry_item",
    {
      title: "Add pantry item",
      description: "Add an item to the pantry, or update its quantity if it already exists.",
      inputSchema: {
        name: trimmedName("name").describe("Item name, e.g. 'eggs'"),
        quantity: quantitySchema.describe("Quantity with unit, e.g. '12' or '1 kg'"),
        expiry: expirySchema.optional().describe("Optional expiry date as YYYY-MM-DD"),
      },
    },
    async ({ name, quantity, expiry }) => safeDb(() => pantryRepo.addPantryItem(name, quantity, expiry)),
  );

  server.registerTool(
    "remove_pantry_item",
    {
      title: "Remove pantry item",
      description: "Remove a pantry item by name. Returns an error if the item is not present.",
      inputSchema: { name: trimmedName("name").describe("Pantry item name to remove") },
    },
    async ({ name }) => safeDb(() => pantryRepo.removePantryItem(name)),
  );

  server.registerTool(
    "get_expiring_items",
    {
      title: "Get expiring items",
      description: "List pantry items that expire within the given number of days, soonest first.",
      inputSchema: { days: z.number().int().min(0).max(365).optional().describe("Look-ahead window in days (default 3)") },
    },
    async ({ days }) => safeDb(() => pantryRepo.getExpiringItems(days)),
  );

  server.registerTool(
    "suggest_recipes",
    {
      title: "Suggest recipes",
      description: "Suggest recipes ranked by how many ingredients the user already has, listing what is missing.",
      inputSchema: {
        max_time_minutes: z.number().int().min(1).max(1440).optional().describe("Maximum total cooking time in minutes"),
        diet: z.enum(["any", "vegetarian", "vegan"]).optional().describe("Dietary filter"),
      },
    },
    async ({ max_time_minutes, diet }) => safeDb(() => pantryRepo.suggestRecipes(max_time_minutes, diet)),
  );

  server.registerTool(
    "get_recipe_steps",
    {
      title: "Get recipe steps",
      description: "Get the ingredients and step-by-step instructions for a recipe, by id or title.",
      inputSchema: { recipe_id: trimmedRecipeId().describe("Recipe id or title") },
    },
    async ({ recipe_id }) => safe(() => kitchen.getRecipeSteps(recipe_id)),
  );

  server.registerTool(
    "add_to_shopping_list",
    {
      title: "Add to shopping list",
      description: "Add one item to the shopping list. If the item was bought earlier, it is reactivated and no duplicate rows are created.",
      inputSchema: {
        item: trimmedName("item").describe("Item name, e.g. 'parmesan'"),
        quantity: z.string().trim().max(50).optional().describe("Optional quantity"),
      },
    },
    async ({ item, quantity }) => safeDb(() => shoppingRepo.addToShoppingList(item, quantity)),
  );

  server.registerTool(
    "get_shopping_list",
    {
      title: "Get shopping list",
      description: "Return the shopping list filtered by status. Default is pending.",
      inputSchema: {
        status: z.enum(["pending", "bought", "all"]).optional().describe("Filter by status; default pending"),
      },
    },
    async ({ status }) => safeDb(() => shoppingRepo.getShoppingList(status ?? "pending")),
  );

  server.registerTool(
    "update_shopping_item",
    {
      title: "Update shopping item",
      description: "Update the quantity or status of an existing shopping item.",
      inputSchema: {
        item: trimmedName("item").describe("Shopping item name to update"),
        quantity: z.string().trim().max(50).optional().describe("New quantity for the item"),
        status: z.enum(["pending", "bought"]).optional().describe("New status for the item"),
      },
    },
    async ({ item, quantity, status }) => safeDb(() => shoppingRepo.updateShoppingItem(item, quantity, status)),
  );

  server.registerTool(
    "remove_from_shopping_list",
    {
      title: "Remove from shopping list",
      description: "Remove a shopping list item by name. Returns an error if the item is not present.",
      inputSchema: { item: trimmedName("item").describe("Shopping item name to remove") },
    },
    async ({ item }) => safeDb(() => shoppingRepo.removeFromShoppingList(item)),
  );

  server.registerTool(
    "start_timer",
    {
      title: "Start timer",
      description: "Start a kitchen timer with a label and a duration in minutes.",
      inputSchema: {
        label: trimmedName("label").describe("What the timer is for, e.g. 'pasta'"),
        minutes: z.number().positive().max(1440).describe("Duration in minutes"),
      },
    },
    async ({ label, minutes }) => safe(() => kitchen.startTimer(label, minutes)),
  );

  return server;
}