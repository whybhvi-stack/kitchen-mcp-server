# Changelog

## 1.1.0

- Timers are now saved in the database and survive restarts. New tools: `list_timers` and `cancel_timer`. The server still cannot ring or notify; the agent should call `list_timers` and the user should also use a phone alarm.
- Smarter recipe matching: singular and plural names now match (tomato and tomatoes), plus a few common alternative names (coriander and cilantro, capsicum and bell pepper).
- Recipes that use food expiring within 3 days are suggested first. `suggest_recipes` now also returns `match_percent` and `uses_expiring` for each recipe.
- Clear error messages: "not found", "list is full" and similar problems now say what is wrong. Only real database failures show the generic "Could not save" message.
- Now 13 tools.

## 1.0.0

- Pantry and shopping list are saved in a local SQLite database and survive restarts.
- 11 tools, in stdio mode and HTTP mode.
- Input checks on names, dates and quantities.
