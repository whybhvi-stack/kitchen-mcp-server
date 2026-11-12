import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { closeDb } from "../src/db/connection.ts";
import { initDatabase } from "../src/db/index.ts";
import * as pantryRepo from "../src/db/pantryRepo.ts";
import * as shoppingRepo from "../src/db/shoppingRepo.ts";
import { daysFromNow } from "../src/lib/dates.ts";

const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitchen-tools-"));
  const file = path.join(dir, "kitchen.db");
  return { dir, file };
}

function setupDb(file: string) {
  process.env.KITCHEN_DB_PATH = file;
  delete process.env.KITCHEN_SEED_DEMO;
  closeDb();
  initDatabase();
}

function cleanup(dir: string) {
  closeDb();
  delete process.env.KITCHEN_DB_PATH;
  delete process.env.KITCHEN_SEED_DEMO;
  fs.rmSync(dir, { recursive: true, force: true });
}

test("pantry add, get, update, and delete work", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    const created = pantryRepo.addPantryItem("milk", "2 litres", "2030-01-15");
    assert.equal(created.added, "milk");

    const list = pantryRepo.getPantry();
    assert.ok(list.items.some((item) => item.name === "milk" && item.quantity === "2 litres" && item.expiry === "2030-01-15"));

    const updated = pantryRepo.addPantryItem("MILK", "3 litres", "2030-01-20");
    assert.equal(updated.quantity, "3 litres");
    assert.equal(updated.expiry, "2030-01-20");

    const afterUpdate = pantryRepo.getPantry();
    assert.equal(afterUpdate.items.filter((item) => item.name === "milk").length, 1);

    const removed = pantryRepo.removePantryItem("milk");
    assert.equal(removed.removed, "milk");
    assert.deepEqual(pantryRepo.getPantry().items.filter((item) => item.name === "milk"), []);
  } finally {
    cleanup(dir);
  }
});

test("pantry names are case-insensitive and duplicate rows are not created", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    pantryRepo.addPantryItem("Eggs", "6", "2030-02-01");
    pantryRepo.addPantryItem("eggs", "12", "2030-02-15");

    const list = pantryRepo.getPantry();
    assert.equal(list.items.filter((item) => item.name === "eggs").length, 1);
    assert.equal(list.items.find((item) => item.name === "eggs")?.quantity, "12");
  } finally {
    cleanup(dir);
  }
});

test("expiry filtering and database-backed recipe suggestions use database items", async () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    pantryRepo.addPantryItem("eggs", "6", daysFromNow(1));
    pantryRepo.addPantryItem("spinach", "1 bag", daysFromNow(2));
    pantryRepo.addPantryItem("onions", "3", daysFromNow(10));
    pantryRepo.addPantryItem("tomatoes", "5", daysFromNow(10));
    pantryRepo.addPantryItem("butter", "200 g", daysFromNow(10));

    const expiring = pantryRepo.getExpiringItems(30);
    assert.ok(expiring.items.some((item) => item.name === "eggs"));

    const suggestion = await pantryRepo.suggestRecipes(15, "vegetarian");
    const eggBhurji = suggestion.recipes.find((item) => item.id === "egg-bhurji");
    assert.ok(eggBhurji);
    assert.deepEqual(eggBhurji.missing, []);
  } finally {
    cleanup(dir);
  }
});

test("pantry limit is enforced at 1000 items", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    for (let index = 0; index < 1000; index += 1) {
      pantryRepo.addPantryItem(`item-${index}`, `${index + 1}`);
    }

    assert.throws(() => {
      pantryRepo.addPantryItem("item-1000", "1000");
    }, /Pantry is full/);
  } finally {
    cleanup(dir);
  }
});

test("shopping list duplicates are prevented and a bought item can be reactivated", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    const first = shoppingRepo.addToShoppingList("parmesan", "1 block");
    const second = shoppingRepo.addToShoppingList("parmesan", "2 blocks");
    assert.equal(first.already_on_list, false);
    assert.equal(second.already_on_list, true);
    assert.equal(shoppingRepo.getShoppingList("pending").items.length, 1);

    shoppingRepo.updateShoppingItem("parmesan", undefined, "bought");
    const reactivated = shoppingRepo.addToShoppingList("parmesan", "3 blocks");
    assert.equal(reactivated.status, "pending");
    assert.equal(reactivated.already_on_list, false);
    assert.equal(shoppingRepo.getShoppingList("pending").items[0]?.item, "parmesan");
  } finally {
    cleanup(dir);
  }
});

test("shopping item updates and invalid updates fail cleanly", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    shoppingRepo.addToShoppingList("milk", "1 litre");
    const updated = shoppingRepo.updateShoppingItem("milk", "2 litres", "bought");
    assert.equal(updated.status, "bought");
    assert.equal(updated.quantity, "2 litres");

    assert.throws(() => {
      shoppingRepo.updateShoppingItem("missing", "1");
    }, /was not found/);

    assert.throws(() => {
      shoppingRepo.updateShoppingItem("milk");
    }, /quantity or status is required/);
  } finally {
    cleanup(dir);
  }
});

test("shopping remove on a missing item returns an error", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);
    assert.throws(() => {
      shoppingRepo.removeFromShoppingList("missing-item");
    }, /was not found/);
  } finally {
    cleanup(dir);
  }
});

test("shopping limit is enforced at 500 items", () => {
  const { dir, file } = makeTempDb();

  try {
    setupDb(file);

    for (let index = 0; index < 500; index += 1) {
      shoppingRepo.addToShoppingList(`shop-${index}`);
    }

    assert.throws(() => {
      shoppingRepo.addToShoppingList("shop-500");
    }, /Shopping list is full/);
  } finally {
    cleanup(dir);
  }
});

test("empty new database has no demo items", () => {
  const { dir, file } = makeTempDb();

  try {
    process.env.KITCHEN_DB_PATH = file;
    closeDb();
    initDatabase();

    assert.deepEqual(pantryRepo.getPantry().items, []);
  } finally {
    cleanup(dir);
  }
});

test("restart test keeps pantry and shopping list data across a stdio process restart", async () => {
  const { dir, file } = makeTempDb();

  try {
    const first = new Client({ name: "persist-1", version: "1.0.0" });
    const transportOne = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/stdio.js"],
      cwd: repoRoot,
      env: { ...process.env, KITCHEN_DB_PATH: file },
    });

    await first.connect(transportOne);
    await first.callTool({
      name: "add_pantry_item",
      arguments: { name: "restart pantry", quantity: "1 jar", expiry: "2030-05-01" },
    });
    await first.callTool({
      name: "add_to_shopping_list",
      arguments: { item: "restart shopping", quantity: "1 box" },
    });
    await first.close();

    const second = new Client({ name: "persist-2", version: "1.0.0" });
    const transportTwo = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/stdio.js"],
      cwd: repoRoot,
      env: { ...process.env, KITCHEN_DB_PATH: file },
    });

    await second.connect(transportTwo);
    const pantry = await second.callTool({ name: "get_pantry", arguments: {} });
    const shopping = await second.callTool({ name: "get_shopping_list", arguments: { status: "pending" } });
    const pantryText = JSON.parse((pantry.content ?? []).map((item) => item.text ?? "").join("\n"));
    const shoppingText = JSON.parse((shopping.content ?? []).map((item) => item.text ?? "").join("\n"));

    assert.ok(pantryText.items.some((item: { name: string }) => item.name === "restart pantry"));
    assert.ok(shoppingText.items.some((item: { item: string }) => item.item === "restart shopping"));

    await second.close();
  } finally {
    cleanup(dir);
  }
});
