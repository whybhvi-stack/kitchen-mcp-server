import { randomUUID } from "node:crypto";
import { getDb } from "./connection.js";
import { UserError } from "./errors.js";

const normalizeLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new UserError("label must not be empty");
  }
  if (trimmed.length > 100) {
    throw new UserError("label must be 100 characters or fewer");
  }
  return trimmed;
};

const ensureValidMinutes = (minutes: number): void => {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
    throw new UserError("minutes must be a positive number with a maximum of 1440");
  }
};

function listRunningCount(db = getDb()): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM timers WHERE status = 'running'").get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

export function startTimer(label: string, minutes: number): { id: string; label: string; status: "running"; minutes: number; ends_at: string } {
  const db = getDb();
  const normalizedLabel = normalizeLabel(label);
  ensureValidMinutes(minutes);

  if (listRunningCount(db) >= 50) {
    throw new UserError("Maximum of 50 running timers allowed.");
  }

  const id = randomUUID();
  const now = Date.now();
  const endsAt = now + minutes * 60_000;
  const createdAt = new Date(now).toISOString();

  db.prepare("INSERT INTO timers (id, label, ends_at, status, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    normalizedLabel,
    endsAt,
    "running",
    createdAt,
  );

  return {
    id,
    label: normalizedLabel,
    status: "running",
    minutes,
    ends_at: new Date(endsAt).toISOString(),
  };
}

export function listTimers(statusFilter: "running" | "done" | "cancelled" | "all" = "running"): { timers: Array<{ id: string; label: string; status: "running" | "done" | "cancelled"; ends_at: string; remaining_seconds: number }> } {
  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE timers SET status = 'done' WHERE status = 'running' AND ends_at <= ?").run(now);

  const query =
    statusFilter === "all"
      ? "SELECT id, label, status, ends_at FROM timers ORDER BY ends_at ASC, created_at ASC"
      : "SELECT id, label, status, ends_at FROM timers WHERE status = ? ORDER BY ends_at ASC, created_at ASC";

  const rows = (statusFilter === "all"
    ? db.prepare(query).all()
    : db.prepare(query).all(statusFilter)) as Array<{ id: string; label: string; status: "running" | "done" | "cancelled"; ends_at: number }>;

  return {
    timers: rows.map((row) => ({
      id: row.id,
      label: row.label,
      status: row.status,
      ends_at: new Date(row.ends_at).toISOString(),
      remaining_seconds: row.status === "running" ? Math.max(0, Math.ceil((row.ends_at - now) / 1000)) : 0,
    })),
  };
}

export function cancelTimer(id: string): { id: string; label: string; status: "cancelled" } {
  const db = getDb();
  const trimmedId = id.trim();

  if (!trimmedId) {
    throw new UserError("id must not be empty");
  }

  const row = db.prepare("SELECT id, label, status FROM timers WHERE id = ?").get(trimmedId) as
    | { id: string; label: string; status: "running" | "done" | "cancelled" }
    | undefined;

  if (!row) {
    throw new UserError(`Timer "${trimmedId}" was not found.`);
  }

  if (row.status !== "running") {
    throw new UserError(`Timer "${trimmedId}" is not running.`);
  }

  const result = db.prepare("UPDATE timers SET status = 'cancelled' WHERE id = ? AND status = 'running'").run(trimmedId);
  if (result.changes === 0) {
    throw new UserError(`Timer "${trimmedId}" is not running.`);
  }

  return { id: row.id, label: row.label, status: "cancelled" };
}
