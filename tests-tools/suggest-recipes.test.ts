import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");

test("suggest_recipes returns real recipe data through the stdio MCP server", async () => {
  const tempRoot = path.join(repoRoot, ".tmp-suggest-recipes");
  mkdirSync(tempRoot, { recursive: true });
  const dbDir = mkdtempSync(path.join(tempRoot, "tmp-"));
  const dbFile = path.join(dbDir, "kitchen.db");

  const client = new Client({ name: "suggest-recipes-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/stdio.js"],
    cwd: repoRoot,
    env: { ...process.env, KITCHEN_DB_PATH: dbFile },
    stderr: "ignore",
  });

  try {
    await client.connect(transport);

    for (const item of [
      { name: "eggs", quantity: "1", expiry: "2030-01-01" },
      { name: "spinach", quantity: "1", expiry: "2030-01-01" },
      { name: "onions", quantity: "1", expiry: "2030-01-01" },
      { name: "tomatoes", quantity: "1", expiry: "2030-01-01" },
      { name: "butter", quantity: "1", expiry: "2030-01-01" },
    ]) {
      await client.callTool({
        name: "add_pantry_item",
        arguments: { name: item.name, quantity: item.quantity, expiry: item.expiry },
      });
    }

    const recipesResult = await client.callTool({ name: "suggest_recipes", arguments: {} });
    const recipesText = (recipesResult.content ?? []).map((item) => item.text ?? "").join("\n");
    const recipesPayload = JSON.parse(recipesText);

    assert.ok(Array.isArray(recipesPayload.recipes) && recipesPayload.recipes.length > 0, "suggest_recipes should return recipes");
    for (const recipe of recipesPayload.recipes) {
      assert.equal(typeof recipe.id, "string");
      assert.equal(typeof recipe.title, "string");
      assert.equal(typeof recipe.time_minutes, "number");
      assert.equal(typeof recipe.diet, "string");
      assert.ok(Array.isArray(recipe.missing));
    }

    const veganResult = await client.callTool({ name: "suggest_recipes", arguments: { diet: "vegan" } });
    const veganPayload = JSON.parse((veganResult.content ?? []).map((item) => item.text ?? "").join("\n"));
    assert.ok(veganPayload && Array.isArray(veganPayload.recipes));

    const quickResult = await client.callTool({ name: "suggest_recipes", arguments: { max_time_minutes: 10 } });
    const quickPayload = JSON.parse((quickResult.content ?? []).map((item) => item.text ?? "").join("\n"));
    assert.ok(quickPayload && Array.isArray(quickPayload.recipes));
  } finally {
    await client.close();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
