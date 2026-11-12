import type { DatabaseSync } from "node:sqlite";
import { seedPantry } from "../data/pantry.js";
import { DatabaseError } from "./errors.js";
import { getDb } from "./connection.js";
import { runMigrations } from "./migrations.js";

export function seedDemoPantry(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM pantry_items").get() as { count: number } | undefined;
  const count = Number(row?.count ?? 0);

  if (count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO pantry_items (name, quantity, expiry, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const item of seedPantry()) {
    insert.run(item.name, item.quantity, item.expiry ?? null, now, now);
  }
}

export function initDatabase(): void {
  try {
    const db = getDb();
    runMigrations(db);

    if (process.env.KITCHEN_SEED_DEMO === "true") {
      seedDemoPantry(db);
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Could not initialize the SQLite database: ${message}`);
  }
}
