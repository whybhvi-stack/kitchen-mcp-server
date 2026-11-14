import { getDb } from "./connection.js";
import { recipes } from "../data/recipes.js";
import { daysUntil } from "../lib/dates.js";
import { normalizeIngredient } from "../lib/ingredients.js";
import { UserError } from "./errors.js";

const normalizeName = (rawName: string): string => rawName.trim().toLowerCase();

export const PANTRY_MAX_ITEMS = 1000;

export function getPantry(): { items: Array<{ name: string; quantity: string; expiry?: string | null; expiresInDays: number | null }> } {
  const db = getDb();
  const rows = db
    .prepare("SELECT name, quantity, expiry FROM pantry_items ORDER BY name COLLATE NOCASE ASC")
    .all() as Array<{ name: string; quantity: string; expiry: string | null }>;

  return {
    items: rows.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      expiry: row.expiry ?? null,
      expiresInDays: row.expiry ? daysUntil(row.expiry) : null,
    })),
  };
}

export function addPantryItem(rawName: string, quantity: string, expiry?: string): { added: string; quantity: string; expiry: string | null } {
  const db = getDb();
  const name = normalizeName(rawName);
  const trimmedQuantity = quantity.trim();
  const trimmedExpiry = expiry?.trim() || undefined;

  if (!name) {
    throw new UserError("name is required");
  }

  if (!trimmedQuantity) {
    throw new UserError("quantity must not be empty");
  }

  const existing = db.prepare("SELECT name, quantity, expiry FROM pantry_items WHERE name = ?").get(name) as
    | { name: string; quantity: string; expiry: string | null }
    | undefined;

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM pantry_items").get() as { count: number } | undefined;
  const count = Number(countRow?.count ?? 0);

  if (!existing && count >= PANTRY_MAX_ITEMS) {
    throw new UserError(`Pantry is full. Maximum of ${PANTRY_MAX_ITEMS} items allowed.`);
  }

  const now = new Date().toISOString();

  if (existing) {
    const nextExpiry = trimmedExpiry ? trimmedExpiry : existing.expiry ?? null;
    db.prepare(
      "UPDATE pantry_items SET quantity = ?, expiry = ?, updated_at = ? WHERE name = ?",
    ).run(trimmedQuantity, nextExpiry, now, name);

    return { added: name, quantity: trimmedQuantity, expiry: nextExpiry };
  }

  db.prepare(
    "INSERT INTO pantry_items (name, quantity, expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(name, trimmedQuantity, trimmedExpiry ?? null, now, now);

  return { added: name, quantity: trimmedQuantity, expiry: trimmedExpiry ?? null };
}

export function getExpiringItems(days = 3): { within_days: number; items: Array<{ name: string; quantity: string; expiry: string | null; expiresInDays: number | null }> } {
  const db = getDb();
  const rows = db
    .prepare("SELECT name, quantity, expiry FROM pantry_items WHERE expiry IS NOT NULL ORDER BY expiry ASC")
    .all() as Array<{ name: string; quantity: string; expiry: string | null }>;

  const items = rows
    .map((row) => ({
      name: row.name,
      quantity: row.quantity,
      expiry: row.expiry ?? null,
      expiresInDays: row.expiry ? daysUntil(row.expiry) : null,
    }))
    .filter((item) => item.expiresInDays !== null && item.expiresInDays <= days)
    .sort((a, b) => (a.expiresInDays ?? 0) - (b.expiresInDays ?? 0));

  return { within_days: days, items };
}

export function suggestRecipes(maxTimeMinutes?: number, diet: "any" | "vegetarian" | "vegan" = "any") {
  const db = getDb();
  const pantryRows = db.prepare("SELECT name, expiry FROM pantry_items").all() as Array<{ name: string; expiry: string | null }>;
  const have = new Map<string, { name: string; expiringSoon: boolean }>();
  for (const row of pantryRows) {
    const days = row.expiry ? daysUntil(row.expiry) : null;
    have.set(normalizeIngredient(row.name), {
      name: row.name,
      expiringSoon: days !== null && days >= 0 && days <= 3,
    });
  }

  const results = recipes
    .filter((recipe) => maxTimeMinutes === undefined || recipe.timeMinutes <= maxTimeMinutes)
    .filter((recipe) => diet === "any" || (diet === "vegan" ? recipe.diet === "vegan" : recipe.diet !== "any"))
    .map((recipe) => {
      const missing: string[] = [];
      const usesExpiring: string[] = [];
      for (const ingredient of recipe.ingredients) {
        const match = have.get(normalizeIngredient(ingredient));
        if (!match) {
          missing.push(ingredient);
        } else if (match.expiringSoon) {
          usesExpiring.push(match.name);
        }
      }
      const total = recipe.ingredients.length;
      return {
        id: recipe.id,
        title: recipe.title,
        time_minutes: recipe.timeMinutes,
        diet: recipe.diet,
        missing,
        uses_expiring: usesExpiring,
        match_percent: total === 0 ? 100 : Math.round(((total - missing.length) / total) * 100),
      };
    })
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        b.uses_expiring.length - a.uses_expiring.length ||
        a.time_minutes - b.time_minutes,
    )
    .slice(0, 5);

  return { recipes: results };
}

export function removePantryItem(rawName: string): { removed: string } {
  const db = getDb();
  const name = normalizeName(rawName);

  if (!name) {
    throw new UserError("name is required");
  }

  const result = db.prepare("DELETE FROM pantry_items WHERE name = ?").run(name);
  if (result.changes === 0) {
    throw new UserError(`Pantry item "${name}" was not found.`);
  }

  return { removed: name };
}

export function countPantryItems(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM pantry_items").get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}
