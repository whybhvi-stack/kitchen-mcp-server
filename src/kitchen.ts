import { randomUUID } from "node:crypto";
import { seedPantry } from "./data/pantry";
import { recipes } from "./data/recipes";
import { daysUntil } from "./lib/dates";
import type { PantryItem, ShoppingItem, Timer } from "./types";

// In-memory kitchen state, shared by every request (resets when the server restarts).
const pantry: PantryItem[] = seedPantry();
const shopping: ShoppingItem[] = [];
const timers: Timer[] = [];

const withDays = (i: PantryItem) => ({
  ...i,
  expiresInDays: i.expiry ? daysUntil(i.expiry) : null,
});

export const getPantry = () => ({ items: pantry.map(withDays) });

export function addPantryItem(rawName: string, quantity: string, expiry?: string) {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error("name is required");
  const existing = pantry.find((p) => p.name === name);
  if (existing) {
    existing.quantity = quantity;
    if (expiry) existing.expiry = expiry;
  } else {
    pantry.push({ name, quantity, expiry });
  }
  return { added: name, quantity, expiry: expiry ?? null };
}

export function getExpiringItems(days = 3) {
  const items = pantry
    .filter((p) => p.expiry && daysUntil(p.expiry) <= days)
    .map(withDays)
    .sort((a, b) => (a.expiresInDays ?? 0) - (b.expiresInDays ?? 0));
  return { within_days: days, items };
}

export function suggestRecipes(
  maxTimeMinutes?: number,
  diet: "any" | "vegetarian" | "vegan" = "any",
) {
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
  const key = recipeId.trim().toLowerCase();
  const r = recipes.find((x) => x.id === key || x.title.toLowerCase() === key);
  if (!r) throw new Error(`No recipe found for "${key}"`);
  return { title: r.title, time_minutes: r.timeMinutes, ingredients: r.ingredients, steps: r.steps };
}

export function addToShoppingList(rawItem: string, quantity?: string) {
  const item = rawItem.trim().toLowerCase();
  if (!item) throw new Error("item is required");
  const exists = shopping.some((i) => i.item === item);
  if (!exists) shopping.push({ item, quantity });
  return { item, quantity: quantity ?? null, already_on_list: exists };
}

export const getShoppingList = () => ({ items: shopping });

export function startTimer(label: string, minutes: number) {
  if (!(minutes > 0)) throw new Error("minutes must be greater than 0");
  const timer: Timer = { id: randomUUID(), label, endsAt: Date.now() + minutes * 60_000 };
  timers.push(timer);
  return { id: timer.id, label, minutes, ends_at: new Date(timer.endsAt).toISOString() };
}