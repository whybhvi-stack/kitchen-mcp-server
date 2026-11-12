import { getDb } from "./connection.js";

const normalizeName = (rawItem: string): string => rawItem.trim().toLowerCase();

export const SHOPPING_MAX_ITEMS = 500;

export type ShoppingStatus = "pending" | "bought";

export function getShoppingList(status: ShoppingStatus | "all" = "pending") {
  const db = getDb();
  const query = status === "all"
    ? "SELECT name, quantity, status FROM shopping_items ORDER BY name COLLATE NOCASE ASC"
    : "SELECT name, quantity, status FROM shopping_items WHERE status = ? ORDER BY name COLLATE NOCASE ASC";
  const params = status === "all" ? [] : [status];
  const rows = db.prepare(query).all(...params) as Array<{ name: string; quantity: string | null; status: ShoppingStatus }>;

  return {
    items: rows.map((row) => ({
      item: row.name,
      quantity: row.quantity ?? null,
      status: row.status,
    })),
  };
}

export function addToShoppingList(rawItem: string, quantity?: string): {
  item: string;
  quantity: string | null;
  already_on_list: boolean;
  status: ShoppingStatus;
} {
  const db = getDb();
  const item = normalizeName(rawItem);
  const trimmedQuantity = quantity?.trim() || undefined;

  if (!item) {
    throw new Error("item is required");
  }

  const existing = db.prepare("SELECT name, quantity, status FROM shopping_items WHERE name = ?").get(item) as
    | { name: string; quantity: string | null; status: ShoppingStatus }
    | undefined;

  if (existing) {
    if (existing.status === "pending") {
      return {
        item: existing.name,
        quantity: existing.quantity ?? trimmedQuantity ?? null,
        already_on_list: true,
        status: existing.status,
      };
    }

    const nextQuantity = trimmedQuantity ?? existing.quantity ?? null;
    db.prepare("UPDATE shopping_items SET quantity = ?, status = ?, updated_at = ? WHERE name = ?").run(
      nextQuantity,
      "pending",
      new Date().toISOString(),
      item,
    );

    return { item: existing.name, quantity: nextQuantity, already_on_list: false, status: "pending" };
  }

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM shopping_items").get() as { count: number } | undefined;
  const count = Number(countRow?.count ?? 0);
  if (count >= SHOPPING_MAX_ITEMS) {
    throw new Error(`Shopping list is full. Maximum of ${SHOPPING_MAX_ITEMS} items allowed.`);
  }

  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO shopping_items (name, quantity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(item, trimmedQuantity ?? null, "pending", now, now);

  return { item, quantity: trimmedQuantity ?? null, already_on_list: false, status: "pending" };
}

export function updateShoppingItem(
  rawItem: string,
  quantity?: string,
  status?: ShoppingStatus,
): { item: string; quantity: string | null; status: ShoppingStatus } {
  const db = getDb();
  const item = normalizeName(rawItem);

  if (!item) {
    throw new Error("item is required");
  }

  if (quantity === undefined && status === undefined) {
    throw new Error("quantity or status is required");
  }

  const existing = db.prepare("SELECT name, quantity, status FROM shopping_items WHERE name = ?").get(item) as
    | { name: string; quantity: string | null; status: ShoppingStatus }
    | undefined;

  if (!existing) {
    throw new Error(`Shopping item "${item}" was not found.`);
  }

  const nextQuantity = typeof quantity === "string" ? quantity.trim() || null : null;
  const nextStatus = status ?? null;
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE shopping_items SET quantity = COALESCE(?, quantity), status = COALESCE(?, status), updated_at = ? WHERE name = ?",
  ).run(nextQuantity, nextStatus, now, item);

  return {
    item: existing.name,
    quantity: nextQuantity ?? existing.quantity ?? null,
    status: nextStatus ?? existing.status,
  };
}

export function removeFromShoppingList(rawItem: string): { removed: string } {
  const db = getDb();
  const item = normalizeName(rawItem);

  if (!item) {
    throw new Error("item is required");
  }

  const result = db.prepare("DELETE FROM shopping_items WHERE name = ?").run(item);
  if (result.changes === 0) {
    throw new Error(`Shopping item "${item}" was not found.`);
  }

  return { removed: item };
}

export function countShoppingItems(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM shopping_items").get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}
