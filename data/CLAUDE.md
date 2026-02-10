# data/ - Game Data Files

All game content is defined as JSON and loaded by `engine.js` at startup (except `modals.json` which is loaded by `modal.js`, and `names.json` which is loaded by `crew.js`).

## Files

| File | Loaded By | Purpose |
|------|-----------|---------|
| `activities.json` | engine | Activities (jobs/crimes) with options, resolutions, requirements, effects. Core gameplay content. |
| `branches.json` | engine | Branch definitions (job categories like "Primordial"). Each has id, name, order, UI color. |
| `resources.json` | engine | Resource definitions (cash, heat, cred, intel, etc). Each has id, name, description, category, visibility flags. |
| `roles.json` | engine | Crew role definitions (player, etc). Each has id, name, description, base stats. |
| `modals.json` | modal.js | Modal dialog content (intro, tutorials, lore reveals). Each has id, type, title, pages, styling. |
| `names.json` | crew.js | Name generation pools: titles, firstNames, lastNames, funnyTitles, funnyFirstNames, funnyLastNames. ~22KB, largest data file. |
| `lexicon.json` | engine | In-game terminology definitions. Maps term IDs to display text. |
| `tech.json` | engine | Tech tree definitions (placeholder, currently ~empty). |
| `perks.json` | engine | Perk definitions (placeholder, currently ~empty). |

## Deprecated
| File | Notes |
|------|-------|
| `items.json.deprecated` | Items system merged into resources. Kept as reference only. |

## Schema Reference
See `03_schema_engine.md` in root for full entity schemas and field definitions.
