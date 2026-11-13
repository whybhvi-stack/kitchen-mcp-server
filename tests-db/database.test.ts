import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { closeDb, getDb } from "../src/db/connection.ts";
import { runMigrations, MIGRATIONS } from "../src/db/migrations.ts";

function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

test("migrations run once and are repeatable", () => {
  const db = createMemoryDb();

  runMigrations(db);
  runMigrations(db);

  const count = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
  assert.equal(count.count, 1);
  closeDb();
});

test("all tables exist", () => {
  const db = createMemoryDb();
  runMigrations(db);

  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];

  assert.deepEqual(
    rows.map((row) => row.name).sort(),
    ["pantry_items", "schema_migrations", "shopping_items", "timers"].sort(),
  );
  closeDb();
});

test("unique pantry names are case-insensitive", () => {
  const db = createMemoryDb();
  runMigrations(db);

  db.exec(
    "INSERT INTO pantry_items (name, quantity, expiry, created_at, updated_at) VALUES ('eggs', '6', '2027-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
  );

  assert.throws(() => {
    db.exec(
      "INSERT INTO pantry_items (name, quantity, expiry, created_at, updated_at) VALUES ('Eggs', '12', '2027-01-02', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    );
  }, /UNIQUE constraint failed|constraint failed/i);
  closeDb();
});

test("invalid shopping status is rejected by the CHECK rule", () => {
  const db = createMemoryDb();
  runMigrations(db);

  assert.throws(() => {
    db.exec(
      "INSERT INTO shopping_items (name, quantity, status, created_at, updated_at) VALUES ('milk', '1 litre', 'archived', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    );
  }, /CHECK|constraint/i);
  closeDb();
});

test("failed migration rolls back", () => {
  const db = createMemoryDb();

  assert.throws(() => {
    runMigrations(db, [
      {
        version: 1,
        name: "broken-migration",
        up: (database) => {
          database.exec("CREATE TABLE broken_table (id INTEGER PRIMARY KEY);");
          throw new Error("boom");
        },
      },
    ]);
  }, /Migration broken-migration failed/i);

  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE name = 'broken_table'").get();
  assert.equal(tableCheck, undefined);
  const schemaRow = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
  assert.equal(schemaRow.count, 0);
  closeDb();
});

test("file database keeps its data after close and reopen", () => {
  const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");
  const tempRoot = path.join(repoRoot, ".tmp-db-tests");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "kitchen-db-"));
  const filePath = path.join(tempDir, "kitchen.db");

  const firstDb = getDb(filePath);
  runMigrations(firstDb);
  firstDb.exec(
    "INSERT INTO pantry_items (name, quantity, expiry, created_at, updated_at) VALUES ('milk', '1 litre', '2027-01-10', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
  );
  closeDb();

  const reopenedDb = getDb(filePath);
  const row = reopenedDb
    .prepare("SELECT COUNT(*) AS count FROM pantry_items WHERE name = 'milk'")
    .get() as { count: number };

  assert.equal(row.count, 1);
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

process.on("exit", () => {
  closeDb();
});
