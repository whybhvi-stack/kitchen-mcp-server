import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "./errors.js";

let db: DatabaseSync | null = null;
let currentPath = "";

export function resolveDatabasePath(rawPath = process.env.KITCHEN_DB_PATH): string {
  const value = rawPath?.trim();

  if (!value) {
    const defaultDir = path.join(os.homedir(), ".kitchen-mcp-server");
    const defaultFile = path.join(defaultDir, "kitchen.db");

    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Could not create the SQLite folder for the database: ${defaultDir}. ${message}`, defaultFile);
    }

    return defaultFile;
  }

  if (value === ":memory:") {
    return value;
  }

  const resolved = path.resolve(value);

  if (resolved !== ":memory:") {
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Could not create the SQLite folder for the database: ${path.dirname(resolved)}. ${message}`, resolved);
    }
  }

  return resolved;
}

export function getDb(databasePath = resolveDatabasePath()): DatabaseSync {
  if (db && currentPath === databasePath) {
    return db;
  }

  if (db) {
    db.close();
    db = null;
    currentPath = "";
  }

  try {
    db = new DatabaseSync(databasePath);
    currentPath = databasePath;
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Could not open SQLite database at ${databasePath}: ${message}`, databasePath);
  }

  return db;
}

export function closeDb(): void {
  if (!db) {
    return;
  }

  db.close();
  db = null;
  currentPath = "";
}
