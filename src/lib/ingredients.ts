// Makes ingredient names comparable: "Tomatoes", "tomato " and "TOMATO" all become "tomato".
// This is only used for matching. Names stored in the database and shown to the user are not changed.

const PLURAL_EXCEPTIONS: Record<string, string> = {
  chillies: "chilli",
};

const SYNONYMS: Record<string, string> = {
  coriander: "cilantro",
  chilli: "chili",
  capsicum: "bell pepper",
  aubergine: "eggplant",
  curd: "yogurt",
  scallion: "spring onion",
};

function singularize(word: string): string {
  if (word.length <= 3) return word;
  const exception = PLURAL_EXCEPTIONS[word];
  if (exception) return exception;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(ches|shes|xes|sses|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("ss") || word.endsWith("us") || word.endsWith("is")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function normalizeIngredient(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words
    .map((word) => SYNONYMS[word] ?? word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
