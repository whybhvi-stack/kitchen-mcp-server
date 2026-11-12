import type { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "./errors.js";

type Migration = {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "create-initial-schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pantry_items (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          quantity TEXT NOT NULL,
          expiry TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shopping_items (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          quantity TEXT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'bought')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS timers (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          ends_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'cancelled')),
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry ON pantry_items(expiry);
        CREATE INDEX IF NOT EXISTS idx_shopping_items_status ON shopping_items(status);
        CREATE INDEX IF NOT EXISTS idx_timers_status_ends_at ON timers(status, ends_at);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync, migrationDefinitions: Migration[] = MIGRATIONS): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const latestKnownVersion = migrationDefinitions.at(-1)?.version ?? 0;
  const currentVersionRow = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number } | undefined;
  const currentVersion = Number(currentVersionRow?.version ?? 0);

  if (currentVersion > latestKnownVersion) {
    throw new DatabaseError(
      `Database migration version ${currentVersion} is newer than the code knows. This app supports up to ${latestKnownVersion}.`,
    );
  }

  for (const migration of migrationDefinitions) {
    const alreadyApplied = db
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1")
      .get(migration.version);

    if (alreadyApplied) {
      continue;
    }

    db.exec("BEGIN IMMEDIATE;");

    try {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, new Date().toISOString());
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Migration ${migration.name} failed: ${message}`);
    }
  }
}
