import { randomUUID } from "node:crypto";
import { seedPantry } from "./data/pantry.js";
import { recipes } from "./data/recipes.js";
import { daysUntil } from "./lib/dates.js";
import type { PantryItem, ShoppingItem, Timer } from "./types.js";

// In-memory kitchen state, shared by every request (resets when the server restarts).
const pantry: PantryItem[] = seedPantry();
const shopping: ShoppingItem[] = [];
const timers: Timer[] = [];

const normalizeName = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} must not be empty`);
  if (trimmed.length > 100) throw new Error(`${field} must be 100 characters or fewer`);
  return trimmed.toLowerCase();
};

const validateExpiry = (value?: string) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error("expiry must be in YYYY-MM-DD format");
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new Error("expiry must be a real calendar date");
  }
  return trimmed;
};

const validateQuantity = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("quantity must not be empty");
  if (trimmed.length > 50) throw new Error("quantity must be 50 characters or fewer");
  return trimmed;
};

const validateDays = (days: number | undefined) => {
  const value = days ?? 3;
  if (!Number.isInteger(value) || value < 0 || value > 365) {
    throw new Error("days must be an integer from 0 to 365");
  }
  return value;
};

const validateRecipeId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("recipe_id must not be empty");
  if (trimmed.length > 100) throw new Error("recipe_id must be 100 characters or fewer");
  return trimmed;
};

const validatedLabel = (value: string) => normalizeName(value, "label");

const withDays = (i: PantryItem) => ({
  ...i,
  expiresInDays: i.expiry ? daysUntil(i.expiry) : null,
});

export const getPantry = () => ({ items: pantry.map(withDays) });

export function addPantryItem(rawName: string, quantity: string, expiry?: string) {
  const name = normalizeName(rawName, "name");
  const nextQuantity = validateQuantity(quantity);
  const verifiedExpiry = validateExpiry(expiry);
  const existing = pantry.find((p) => p.name === name);
  if (existing) {
    existing.quantity = nextQuantity;
    if (verifiedExpiry) existing.expiry = verifiedExpiry;
  } else {
    pantry.push({ name, quantity: nextQuantity, expiry: verifiedExpiry });
  }
  return { added: name, quantity: nextQuantity, expiry: verifiedExpiry ?? null };
}

export function getExpiringItems(days = 3) {
  const safeDays = validateDays(days);
  const items = pantry
    .filter((p) => p.expiry && daysUntil(p.expiry) <= safeDays)
    .map(withDays)
    .sort((a, b) => (a.expiresInDays ?? 0) - (b.expiresInDays ?? 0));
  return { within_days: safeDays, items };
}

export function suggestRecipes(
  maxTimeMinutes?: number,
  diet: "any" | "vegetarian" | "vegan" = "any",
) {
  if (maxTimeMinutes !== undefined && (!Number.isInteger(maxTimeMinutes) || maxTimeMinutes < 1 || maxTimeMinutes > 1440)) {
    throw new Error("max_time_minutes must be an integer from 1 to 1440");
  }
  const have = new Set(pantry.map((p) => p.name));
  const results = recipes
    .filter((r) => maxTimeMinutes === undefined || r.timeMinutes <= maxTimeMinutes)
    .filter((r) => diet === "any" || (diet === "vegan" ? r.diet === "vegan" : r.diet !== "any"))
    .map((r) => ({
      id: r.id,
      title: r.title,
      time_minutes: r.timeMinutes,
      diet: r.diet,
      missing: r.ingredients.filter((i) => !have.has(i)),
    }))
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 5);
  return { recipes: results };
}

export function getRecipeSteps(recipeId: string) {
  const key = validateRecipeId(recipeId).toLowerCase();
  const r = recipes.find((x) => x.id === key || x.title.toLowerCase() === key);
  if (!r) throw new Error(`No recipe found for "${key}"`);
  return { title: r.title, time_minutes: r.timeMinutes, ingredients: r.ingredients, steps: r.steps };
}

export function addToShoppingList(rawItem: string, quantity?: string) {
  const item = normalizeName(rawItem, "item");
  const nextQuantity = quantity === undefined ? undefined : validateQuantity(quantity);
  const exists = shopping.some((i) => i.item === item);
  if (!exists) shopping.push({ item, quantity: nextQuantity });
  return { item, quantity: nextQuantity ?? null, already_on_list: exists };
}

export const getShoppingList = () => ({ items: shopping });

export function startTimer(label: string, minutes: number) {
  const timerLabel = validatedLabel(label);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
    throw new Error("minutes must be a positive number with a maximum of 1440");
  }
  const timer: Timer = { id: randomUUID(), label: timerLabel, endsAt: Date.now() + minutes * 60_000 };
  timers.push(timer);
  return { id: timer.id, label: timerLabel, minutes, ends_at: new Date(timer.endsAt).toISOString() };
}