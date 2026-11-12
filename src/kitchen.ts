import { randomUUID } from "node:crypto";
import { recipes } from "./data/recipes.js";
import type { Timer } from "./types.js";

const timers: Timer[] = [];

const normalizeName = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} must not be empty`);
  if (trimmed.length > 100) throw new Error(`${field} must be 100 characters or fewer`);
  return trimmed.toLowerCase();
};

const validateRecipeId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("recipe_id must not be empty");
  if (trimmed.length > 100) throw new Error("recipe_id must be 100 characters or fewer");
  return trimmed;
};

const validatedLabel = (value: string) => normalizeName(value, "label");

export function getRecipeSteps(recipeId: string) {
  const key = validateRecipeId(recipeId).toLowerCase();
  const r = recipes.find((x) => x.id === key || x.title.toLowerCase() === key);
  if (!r) throw new Error(`No recipe found for "${key}"`);
  return { title: r.title, time_minutes: r.timeMinutes, ingredients: r.ingredients, steps: r.steps };
}

export function startTimer(label: string, minutes: number) {
  const timerLabel = validatedLabel(label);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
    throw new Error("minutes must be a positive number with a maximum of 1440");
  }
  const timer: Timer = { id: randomUUID(), label: timerLabel, endsAt: Date.now() + minutes * 60_000 };
  timers.push(timer);
  return { id: timer.id, label: timerLabel, minutes, ends_at: new Date(timer.endsAt).toISOString() };
}