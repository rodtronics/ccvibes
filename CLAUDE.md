# Crime Committer VI - Project Guide

This game is a work in progress, and there is not need at this stage to spend time or effort or space with backwards compatibility. we have tight constraints on code size so anything that is related to backwards compatibility is unecessary and even detrimental.

## Maintenance Rule

**When adding, removing, or significantly changing any file, update the CLAUDE.md in that file's folder.** Keep descriptions short and accurate. This saves future sessions from re-exploring the codebase.

## Hosting

Deployed via **Vercel**, connected to the GitHub repo. Vercel auto-deploys from the latest push. Custom domain: `crimecommitter.com` (managed in Vercel dashboard).

## Architecture

TUI game rendered in a 132-column character grid (43 or 55 rows, configurable via `gridHeight` setting). The pipeline is:
`Engine (game logic)` -> `FrameBuffer (cell grid)` -> `DOMRenderer (HTML spans)` -> `#game div`

Settings persisted to localStorage as `ccv_tui_settings`, game state as `ccv_game_state`.

## Core Game Files (in `js/`)

All JavaScript source files live in the `js/` folder. Entry point is `index.html` which loads `js/main.js`.

| File                              | Purpose                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                      | Entry point. Loads fonts, CSS, and `js/main.js` as ES module. Default font class is `font-ibm-bios` (for boot screen).                                                                                                                                                                    |
| `js/main.js` (~1300 lines)        | Controller. Init sequence, input dispatch (`handleInput` -> per-tab handlers), game loop (adaptive: 20fps active / 4fps idle / 1fps hidden), modal/scenario-detail orchestration.                                                                                                         |
| `js/engine.js` (~1000 lines)      | Game logic. State management, data loading (7 JSON files), tick loop (run processing, heat decay, staff recovery, stats), resolution system (deterministic/ranged/weighted outcomes), condition evaluation. Exports `Engine` class + `sortRunsActiveFirst` helper.                        |
| `js/ui.js` (~2200 lines)          | All rendering. `UI` class writes to FrameBuffer. Status rail, tab bar, 7 tab renderers (jobs/active/crew/resources/stats/log/options), crime detail overlay, modal overlay, branch selection bar, scroll bars.                                                                            |
| `js/framebuffer.js` (~295 lines)  | Renderer-agnostic 80x25 cell grid. Each cell has char/fg/bg/dirty/progressBar. Text, box-drawing, gradient progress bars, dirty tracking.                                                                                                                                                 |
| `js/dom_renderer.js` (~115 lines) | Converts FrameBuffer to HTML. Each char wrapped in `<span class="c">` with `display:inline-block;width:1ch` for fixed-width alignment.                                                                                                                                                    |
| `js/modal.js` (~425 lines)        | Modal system. `ModalQueue` class (seen tracking, showOnce), `loadModalData()` fetches modals.json, `getModal()` resolves type-based styling, `parseModalContent()` for rich text rendering.                                                                                               |
| `js/boot.js` (~285 lines)         | Boot screen + DOS prompt + BIOS setup. `BootScreen` class renders 286-style POST with optional slow boot (RAM counting, delays). `DosPrompt` class provides interactive DOS CLI (`C:\CCVI>`) for authentic boot mode. `BiosSetup` class provides a traditional blue BIOS settings screen. |
| `js/settings.js` (~135 lines)     | Font/zoom/bloom settings. `FONTS` array, `FONT_CATEGORIES` (modern/retro), load/save to localStorage, `applyFont()`, `cycleFontSetting()`, `switchFontCategory()`.                                                                                                                        |
| `js/crew.js` (~165 lines)         | Crew name generation. Loads `data/names.json`, generates random names with titles/initials/middle names, uniqueness checking.                                                                                                                                                             |
| `js/palette.js` (~140 lines)      | Color constants (`Palette`) and box-drawing character sets (`BoxStyles`: SINGLE, DOUBLE, HEAVY, ASCII).                                                                                                                                                                                   |
| `js/gradients.js` (~100 lines)    | `interpolateColor()` for hex color blending, named gradient definitions (`GRADIENTS` object), `getGradientColors()` for multi-stop interpolation. Includes `blackbody` gradient used by the heat bar.                                                                                     |
| `js/save_slots.js`                | Save slot management. Slot IDs, normalization, file names, raw state access.                                                                                                                                                                                                              |
| `style.css`                       | Font-face declarations, `.font-*` classes, `.game-layer` sizing, bloom overlay, progress bar letter-spacing.                                                                                                                                                                              |

## Utility / Experimental Files (in `js/`)

| File                    | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `js/layout_renderer.js` | Converts JSON layouts to FrameBuffer ops (bridges TUI Designer output).       |
| `js/tui_renderer.js`    | Standalone TUI renderer class (used by data-builder workbench, not the game). |
| `ascii-to-json.html`    | Tool to convert ASCII art to JSON layout format.                              |

## Design Docs (numbered `0x_*.md`)

| File                      | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `00_agent_readme.md`      | Instructions for AI agents working on this project.                        |
| `01_design_philosophy.md` | Game design vision, tone, progression philosophy.                          |
| `02_ui_spec.md`           | UI specification - layouts, colors, interaction patterns.                  |
| `03_schema_engine.md`     | Data schema reference - entity definitions, state shape, resolution types. |
| `04_lexicon.md`           | In-game terminology definitions.                                           |
| `05_rendering_engine.md`  | Rendering pipeline spec - FrameBuffer, DOMRenderer, layers.                |
| `06_workbench.md`         | Data-builder workbench design doc.                                         |

## Other Root Files

| File             | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `todo.md`        | Project task tracking.                              |
| `perk-ideas.md`  | Brainstorming doc for the perk system.              |
| `clear_save.txt` | Console snippet to clear localStorage save data.    |
| `robots.txt`     | Search engine crawl rules. Blocks `/data-builder/`. |

## Key Patterns

- **Font system**: Config in 3 places: `js/settings.js` (FONTS array, FONT_CATEGORIES), `style.css` (@font-face + .font-\* classes), `js/ui.js` (fontNames display map ~line 1760, isRetro array ~line 1770). All three must stay in sync.
- **Resources**: Cash and heat shown in status rail. Heat uses a 20-char blackbody gradient bar. Cred exists in engine but is not displayed in status rail.
- **Items**: Fully merged into resources. All `items` code paths removed.
- **Modals**: Loaded once by `js/modal.js` (not engine). Engine triggers modals via `showModal` effect type -> `modalQueue`.
- **Run sorting**: Use `sortRunsActiveFirst` from `js/engine.js` (shared comparator, 6 call sites).
- **Grid resolution**: 132 columns × configurable height (43 or 55 rows). `gridHeight` setting in `ccv_tui_settings`. `Layout.HEIGHT` in `js/ui.js` reads from settings at module load time. `boot.js` derives `MAX_Y` from `Layout.HEIGHT`. Changing height triggers `location.reload()`. Options > Font > Screen Height to toggle.
- **Boot system**: Three tiers: (1) first load = slow boot + straight to game, (2) normal = fast boot, (3) `authenticBoot` setting ON = slow boot + DOS CLI prompt. First-boot flag is `ccv_has_booted` in localStorage, cleared by `resetProgress()`. Options tab has 10 items (indices 0-9). Hidden BIOS setup screen accessible by pressing DEL during boot (via SHUTDOWN command or authenticBoot mode).
