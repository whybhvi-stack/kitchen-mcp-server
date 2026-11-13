import { recipes } from "./data/recipes.js";

const validateRecipeId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("recipe_id must not be empty");
  if (trimmed.length > 100) throw new Error("recipe_id must be 100 characters or fewer");
  return trimmed;
};

export function getRecipeSteps(recipeId: string) {
  const key = validateRecipeId(recipeId).toLowerCase();
  const r = recipes.find((x) => x.id === key || x.title.toLowerCase() === key);
  if (!r) throw new Error(`No recipe found for "${key}"`);
  return { title: r.title, time_minutes: r.timeMinutes, ingredients: r.ingredients, steps: r.steps };
}