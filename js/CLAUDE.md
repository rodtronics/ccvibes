# js/ - Game Source Code

All JavaScript ES modules for the game live here. Entry point: `main.js` (loaded by `../index.html`).

## Files

| File | Purpose |
|------|---------|
| `main.js` | Controller. Init, input dispatch, game loop, modal orchestration. |
| `engine.js` | Game logic. State, data loading, tick loop, resolution system. |
| `ui.js` | All rendering. Status rail, tabs, overlays, scroll bars. |
| `framebuffer.js` | 80x25 cell grid with dirty tracking. |
| `dom_renderer.js` | Converts FrameBuffer to HTML spans. |
| `modal.js` | Modal system. Queue, seen tracking, rich text parsing. |
| `boot.js` | Boot screen, DOS prompt, BIOS setup screen. |
| `settings.js` | Font/zoom/bloom/FPS settings. Load/save to localStorage. |
| `crew.js` | Crew name generation from `../data/names.json`. |
| `palette.js` | Color constants and box-drawing character sets. |
| `gradients.js` | Color interpolation and named gradient definitions. |
| `save_slots.js` | Save slot management (IDs, normalization, file names). |
| `layout_renderer.js` | JSON layout to FrameBuffer converter (utility). |
| `tui_renderer.js` | Standalone TUI renderer (used by data-builder, not game). |

## Notes
- All inter-file imports use relative `./` paths (files are siblings).
- Data file fetches use `../data/` since data lives one level up.
