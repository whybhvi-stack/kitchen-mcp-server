import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeIngredient } from "../src/lib/ingredients.ts";

const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");

test("normalizeIngredient matches singular, plural and alternative names", () => {
  assert.equal(normalizeIngredient("Tomatoes"), "tomato");
  assert.equal(normalizeIngredient("tomato "), "tomato");
  assert.equal(normalizeIngredient("eggs"), "egg");
  assert.equal(normalizeIngredient("berries"), "berry");
  assert.equal(normalizeIngredient("potatoes"), "potato");
  assert.equal(normalizeIngredient("radishes"), "radish");
  assert.equal(normalizeIngredient("hummus"), "hummus");
  assert.equal(normalizeIngredient("asparagus"), "asparagus");
  assert.equal(normalizeIngredient("coriander"), "cilantro");
  assert.equal(normalizeIngredient("capsicum"), "bell pepper");
  assert.equal(normalizeIngredient("  Bell   Peppers "), "bell pepper");
  assert.equal(normalizeIngredient("green chillies"), "green chili");
  assert.equal(normalizeIngredient(""), "");
});

async function withClient(fn: (call: (name: string, args?: Record<string, unknown>) => Promise<{ isError: boolean; text: string }>) => Promise<void>) {
  const tempRoot = path.join(repoRoot, ".tmp-matching-errors");
  mkdirSync(tempRoot, { recursive: true });
  const dbDir = mkdtempSync(path.join(tempRoot, "tmp-"));
  const client = new Client({ name: "matching-errors-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/stdio.js"],
    cwd: repoRoot,
    env: { ...process.env, KITCHEN_DB_PATH: path.join(dbDir, "kitchen.db") },
    stderr: "ignore",
  });
  try {
    await client.connect(transport);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      const text = ((result.content ?? []) as Array<{ text?: string }>).map((c) => c.text ?? "").join("\n");
      return { isError: result.isError === true, text };
    };
    await fn(call);
  } finally {
    await client.close().catch(() => undefined);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("singular pantry names match plural recipe ingredients and expiring items rank first", async () => {
  await withClient(async (call) => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await call("add_pantry_item", { name: "Egg", quantity: "6" });
    await call("add_pantry_item", { name: "Onion", quantity: "2" });
    await call("add_pantry_item", { name: "Butter", quantity: "1" });
    await call("add_pantry_item", { name: "Tomato", quantity: "3", expiry: tomorrow });

    const { text } = await call("suggest_recipes");
    const payload = JSON.parse(text);
    const bhurji = payload.recipes.find((r: { id: string }) => r.id === "egg-bhurji");
    assert.ok(bhurji, "egg-bhurji should be suggested");
    assert.deepEqual(bhurji.missing, []);
    assert.equal(bhurji.match_percent, 100);
    assert.deepEqual(bhurji.uses_expiring, ["tomato"]);
    assert.equal(payload.recipes[0].id, "egg-bhurji", "the complete recipe using expiring food should come first");
    for (const recipe of payload.recipes) {
      assert.equal(typeof recipe.match_percent, "number");
      assert.ok(Array.isArray(recipe.uses_expiring));
    }
  });
});

test("an empty pantry still returns valid recipes and filters still work", async () => {
  await withClient(async (call) => {
    const all = JSON.parse((await call("suggest_recipes")).text);
    assert.ok(Array.isArray(all.recipes) && all.recipes.length > 0);
    const vegan = JSON.parse((await call("suggest_recipes", { diet: "vegan" })).text);
    assert.ok(vegan.recipes.every((r: { diet: string }) => r.diet === "vegan"));
    const quick = JSON.parse((await call("suggest_recipes", { max_time_minutes: 10 })).text);
    assert.ok(quick.recipes.every((r: { time_minutes: number }) => r.time_minutes <= 10));
  });
});

test("expected problems show a clear message, not the generic database message", async () => {
  await withClient(async (call) => {
    const missingPantry = await call("remove_pantry_item", { name: "unicorn meat" });
    assert.equal(missingPantry.isError, true);
    assert.match(missingPantry.text, /was not found/);

    const missingShopping = await call("remove_from_shopping_list", { item: "unicorn meat" });
    assert.equal(missingShopping.isError, true);
    assert.match(missingShopping.text, /was not found/);

    const noFields = await call("update_shopping_item", { item: "milk" });
    assert.equal(noFields.isError, true);

    const missingTimer = await call("cancel_timer", { id: "does-not-exist" });
    assert.equal(missingTimer.isError, true);
    assert.match(missingTimer.text, /was not found/);

    const started = JSON.parse((await call("start_timer", { label: "tea", minutes: 5 })).text);
    await call("cancel_timer", { id: started.id });
    const again = await call("cancel_timer", { id: started.id });
    assert.equal(again.isError, true);
    assert.match(again.text, /not running/);

    for (const result of [missingPantry, missingShopping, missingTimer, again]) {
      assert.doesNotMatch(result.text, /Could not save/);
      assert.doesNotMatch(result.text, /[A-Za-z]:\\|\/home\/|\.db/);
    }
  });
});
