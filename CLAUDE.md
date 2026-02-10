# Crime Committer VI - Project Guide

## Maintenance Rule
**When adding, removing, or significantly changing any file, update the CLAUDE.md in that file's folder.** Keep descriptions short and accurate. This saves future sessions from re-exploring the codebase.

## Hosting
Deployed via **Vercel**, connected to the GitHub repo. Vercel auto-deploys from the latest push. Custom domain: `crimecommitter.com` (managed in Vercel dashboard).

## Architecture
TUI game rendered at 20fps in an 80x25 character grid. The pipeline is:
`Engine (game logic)` -> `FrameBuffer (cell grid)` -> `DOMRenderer (HTML spans)` -> `#game div`

Settings persisted to localStorage as `ccv_tui_settings`, game state as `ccv_game_state`.

## Core Game Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point. Loads fonts, CSS, and `main.js` as ES module. Default font class is `font-ibm-bios` (for boot screen). |
| `main.js` (~1300 lines) | Controller. Init sequence, input dispatch (`handleInput` -> per-tab handlers), game loop (adaptive: 20fps active / 4fps idle / 1fps hidden), modal/crime-detail orchestration. |
| `engine.js` (~1000 lines) | Game logic. State management, data loading (7 JSON files), tick loop (run processing, heat decay, staff recovery, stats), resolution system (deterministic/ranged/weighted outcomes), condition evaluation. Exports `Engine` class + `sortRunsActiveFirst` helper. |
| `ui.js` (~2200 lines) | All rendering. `UI` class writes to FrameBuffer. Status rail, tab bar, 7 tab renderers (jobs/active/crew/resources/stats/log/options), crime detail overlay, modal overlay, branch selection bar, scroll bars. |
| `framebuffer.js` (~295 lines) | Renderer-agnostic 80x25 cell grid. Each cell has char/fg/bg/dirty/progressBar. Text, box-drawing, gradient progress bars, dirty tracking. |
| `dom_renderer.js` (~115 lines) | Converts FrameBuffer to HTML. Each char wrapped in `<span class="c">` with `display:inline-block;width:1ch` for fixed-width alignment. |
| `modal.js` (~425 lines) | Modal system. `ModalQueue` class (seen tracking, showOnce), `loadModalData()` fetches modals.json, `getModal()` resolves type-based styling, `parseModalContent()` for rich text rendering. |
| `boot.js` (~285 lines) | Boot screen + DOS prompt. `BootScreen` class renders 286-style POST with optional slow boot (RAM counting, delays). `DosPrompt` class provides interactive DOS CLI (`C:\CCVI>`) for authentic boot mode. |
| `settings.js` (~135 lines) | Font/zoom/bloom settings. `FONTS` array, `FONT_CATEGORIES` (modern/retro), load/save to localStorage, `applyFont()`, `cycleFontSetting()`, `switchFontCategory()`. |
| `crew.js` (~165 lines) | Crew name generation. Loads `data/names.json`, generates random names with titles/initials/middle names, uniqueness checking. |
| `palette.js` (~140 lines) | Color constants (`Palette`) and box-drawing character sets (`BoxStyles`: SINGLE, DOUBLE, HEAVY, ASCII). |
| `gradients.js` (~100 lines) | `interpolateColor()` for hex color blending, named gradient definitions (`GRADIENTS` object), `getGradientColors()` for multi-stop interpolation. Includes `blackbody` gradient used by the heat bar. |
| `style.css` | Font-face declarations, `.font-*` classes, `.game-layer` sizing, bloom overlay, progress bar letter-spacing. |

## Utility / Experimental Files
| File | Purpose |
|------|---------|
| `layout_renderer.js` | Converts JSON layouts to FrameBuffer ops (bridges TUI Designer output). |
| `tui_renderer.js` | Standalone TUI renderer class (used by data-builder workbench, not the game). |
| `ascii-to-json.html` | Tool to convert ASCII art to JSON layout format. |

## Design Docs (numbered `0x_*.md`)
| File | Purpose |
|------|---------|
| `00_agent_readme.md` | Instructions for AI agents working on this project. |
| `01_design_philosophy.md` | Game design vision, tone, progression philosophy. |
| `02_ui_spec.md` | UI specification - layouts, colors, interaction patterns. |
| `03_schema_engine.md` | Data schema reference - entity definitions, state shape, resolution types. |
| `04_lexicon.md` | In-game terminology definitions. |
| `05_rendering_engine.md` | Rendering pipeline spec - FrameBuffer, DOMRenderer, layers. |
| `06_workbench.md` | Data-builder workbench design doc. |

## Other Root Files
| File | Purpose |
|------|---------|
| `todo.md` | Project task tracking. |
| `perk-ideas.md` | Brainstorming doc for the perk system. |
| `clear_save.txt` | Console snippet to clear localStorage save data. |
| `robots.txt` | Search engine crawl rules. Blocks `/data-builder/`. |

## Key Patterns
- **Font system**: Config in 3 places: `settings.js` (FONTS array, FONT_CATEGORIES), `style.css` (@font-face + .font-* classes), `ui.js` (fontNames display map ~line 1760, isRetro array ~line 1770). All three must stay in sync.
- **Resources**: Cash and heat shown in status rail. Heat uses a 20-char blackbody gradient bar. Cred exists in engine but is not displayed in status rail.
- **Items**: Fully merged into resources. All `items` code paths removed.
- **Modals**: Loaded once by `modal.js` (not engine). Engine triggers modals via `showModal` effect type -> `modalQueue`.
- **Run sorting**: Use `sortRunsActiveFirst` from engine.js (shared comparator, 6 call sites).
- **Boot system**: Three tiers: (1) first load = slow boot + straight to game, (2) normal = fast boot, (3) `authenticBoot` setting ON = slow boot + DOS CLI prompt. First-boot flag is `ccv_has_booted` in localStorage, cleared by `resetProgress()`. Options tab has 9 items (indices 0-8).
