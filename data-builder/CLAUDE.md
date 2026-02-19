# data-builder/ - Workbench (Content Editor Tool)

A separate web app for editing game data files. Runs as a local dev server (`node server.js`) and provides visual editors for all game content. Not part of the game itself.

## Running
```
cd data-builder
node server.js
```
Opens at `http://localhost:3000`. Reads/writes JSON files in `../data/`.

## Root Files

| File | Purpose |
|------|---------|
| `server.js` | Express server. Serves static files, provides REST API for reading/writing game data JSON files. |
| `workbench.html` | Main workbench UI - tabbed interface that loads all editors. |
| `js/builder.js` (~68KB) | Legacy monolithic builder with validation, export, and data transformation logic. |
| `js/hub-storage.js` | Shared localStorage utilities for the workbench. |

## Legacy Standalone Editors (pre-workbench)
| File | Purpose |
|------|---------|
| `index.html` | Original standalone scenario editor. |
| `scenarios-variants-builder.html` | Standalone variant/resolution editor. |
| `branches-designer.html` | Standalone branch editor. |
| `resources-designer.html` | Standalone resource editor. |
| `progression-designer.html` | Standalone progression/flow designer. |
| `modal-editor.html` | Standalone modal content editor. |
| `docs.html` | Schema documentation viewer. |

## css/ - Workbench Styles
| File | Purpose |
|------|---------|
| `tokens.css` | CSS custom properties (colors, spacing, typography). |
| `layout.css` | Page layout, sidebar, panels, grid. |
| `components.css` | Buttons, inputs, cards, tags, modals. |
| `workshop.css` | Workshop-specific editor styles. |

## js/ - Workbench JavaScript

All workbench JavaScript files have been refactored to use new terminology: `scenario/scenarios` (was `activity/activities`), `variant/variants` (was `option/options`). Legacy standalone HTML editors may still contain old terminology.

### Core
| File | Purpose |
|------|---------|
| `app.js` | App bootstrap, tab routing, global event handling. |
| `builder.js` (~68KB) | Legacy monolithic builder used by standalone editor pages. Refactored to use scenario/variant terminology. |
| `state.js` | Reactive store - loads all game data, provides `store` object, handles save/load via server API. Uses scenario/variant terminology. |
| `data-io.js` | Data import/export, file I/O helpers. Includes migration logic to convert old `options` to `variants` on load. |
| `hub-storage.js` | Shared localStorage utilities used by standalone pages and workbench. |
| `models.js` | Data model factories - `createScenario()`, `createVariant()`, `createResolution()`, etc. Default values for new entities. |
| `utils.js` | Shared utilities - DOM helpers, ID generation, formatting. |
| `modal-preview.js` | Live preview renderer for modal content (matches game's modal rendering). |

### js/components/ - Shared UI Components
| File | Purpose |
|------|---------|
| `sidebar.js` | Navigation sidebar - branch/scenario tree with drag-and-drop. |
| `mini-map.js` | Visual branch/scenario overview map. |
| `tab-bar.js` | Tab bar component for editor sections. |
| `resource-picker.js` | Dropdown for selecting resources (used in requirements/outputs). |
| `role-picker.js` | Dropdown for selecting crew roles. |

### js/tabs/ - Editor Tabs
| File | Purpose |
|------|---------|
| `workshop.js` (~89KB) | Main scenario/variant editor. The largest and most complex editor - handles scenarios, variants, resolutions, requirements, effects, outcomes. |
| `world.js` (~36KB) | World editor - branches, roles, perks. |
| `economy.js` (~13KB) | Economy editor - resources, balance tuning. |
| `map.js` (~11KB) | Visual progression map editor. |
| `modals.js` (~18KB) | Modal content editor with live preview. |
