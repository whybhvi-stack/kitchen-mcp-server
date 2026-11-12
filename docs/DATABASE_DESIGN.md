# Database design for the Kitchen MCP server

This project is moving from in-memory arrays to a small SQLite database stored on disk. The database keeps the pantry, shopping list, and timers persistent between restarts while leaving the tool interface unchanged for now.

## Why SQLite

The project uses the built-in `node:sqlite` module from Node.js. That gives us a real SQLite database without adding a native dependency or a separate package install step. It is a good fit for a local machine tool that is meant to stay lightweight and easy to run.

Important requirement: `node:sqlite` exists since Node 22.5, and this project requires Node 24.15+ because that is the LTS line where the module is a release candidate.

## Database file location

The database file is chosen from the environment variable `KITCHEN_DB_PATH`.

- If `KITCHEN_DB_PATH` is set, that exact path is used.
- If `KITCHEN_DB_PATH` is not set, the app uses a file named `kitchen.db` inside a folder named `.kitchen-mcp-server` under the user's home directory.
- The app creates that folder if it is missing.
- The default is never inside the project folder.

Example default location:

- Linux/macOS: `~/.kitchen-mcp-server/kitchen.db`
- Windows: `C:\Users\<you>\.kitchen-mcp-server\kitchen.db`

The server resolves the path with `os.homedir()` and creates the directory before opening the database.

## Tables

The first migration creates the following tables and indexes:

### `schema_migrations`

```sql
schema_migrations(
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)
```

Tracks which migration versions have already been applied.

### `pantry_items`

```sql
pantry_items(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  quantity TEXT NOT NULL,
  expiry TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

This looks up pantry names without caring about case. Dates are stored as ISO 8601 text.

### `shopping_items`

```sql
shopping_items(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  quantity TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','bought')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

A shopping item can be pending or bought.

### `timers`

```sql
timers(
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','cancelled')),
  created_at TEXT NOT NULL
)
```

Times are stored as epoch milliseconds for the timer expiry value.

### Indexes

```sql
CREATE INDEX idx_pantry_items_expiry ON pantry_items(expiry);
CREATE INDEX idx_shopping_items_status ON shopping_items(status);
CREATE INDEX idx_timers_status_ends_at ON timers(status, ends_at);
```

## Migration approach

The database uses a simple versioned migration table:

1. The app checks for the `schema_migrations` table.
2. It reads the highest applied version.
3. It applies all pending migrations in order inside a transaction.
4. Each successful migration records its version and timestamp in `schema_migrations`.
5. If the app sees a migration version newer than the code knows about, it stops with a clear error instead of guessing.
6. Running migrations again is safe; already-applied versions are skipped.

This keeps the schema stable while allowing future changes.

## Recipes

Recipes stay as the built-in seed data in `src/data/recipes.ts` for now. A recipes table is not added in this phase; that comes later after the database foundation is stable.

## Demo data policy

The server does not insert the sample pantry data automatically for a brand-new user. The app checks `KITCHEN_SEED_DEMO`.

- `KITCHEN_SEED_DEMO=true` means: if `pantry_items` is empty, insert the demo pantry.
- Otherwise: leave a new database empty.

This avoids surprising a real user with demo stock on first startup.

## Backup and recovery

Backups are straightforward:

- Stop the server cleanly.
- Copy the `.db` file to a safe location.
- If WAL is active, also copy any `kitchen.db-wal` and `kitchen.db-shm` files that exist next to the database.
- Restore it later by pointing `KITCHEN_DB_PATH` at the backup file.

The database runs in WAL mode (`journal_mode = WAL`), so SQLite may create `kitchen.db-wal` and `kitchen.db-shm` files next to the main database file while the server is running. A safe backup means stopping the server and copying the `.db` file together with any matching `-wal` and `-shm` files that exist.

## Summary

The design keeps the implementation simple and safe:

- Node's built-in SQLite support
- a single database file in the user's home directory by default
- explicit migrations with rollback safety
- no changes to the MCP tool names or tool behavior yet
- a clear path for future persistent storage without changing the public API

Phase 3 and 4 done: pantry and shopping list data now persist in SQLite, while timers remain in memory for now.
