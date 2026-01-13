# Claude Experiment TUI

A keyboard-navigable TUI implementation of Crime Committer VI, based on the root version with full keyboard controls.

## Features

- **Full Keyboard Navigation**: Navigate the entire game without touching the mouse
- **Same Engine as Root**: Uses the exact same engine.js, main.js, and core UI logic as the root version
- **Font Switching**: Toggle between VGA fonts and Source Code Pro (same as root version)
- **Complete Game Mechanics**: All features from the root version including:
  - Activity/Option/Run structure
  - Staff management with XP and stars
  - Heat and Cred systems
  - Weighted outcomes and modifiers
  - Repeat queues (RUN ONCE, RUN X, RUN ∞)
  - Resource management
  - Event logging
  - Auto-save to localStorage

## Design Philosophy

This implementation is built directly on the root version's codebase. The only difference is added keyboard navigation controls for a true TUI experience.

Follows all founding documents:
- [01_design_philosophy.md](../01_design_philosophy.md) - Core mechanics and philosophy
- [02_ui_spec.md](../02_ui_spec.md) - Visual language and interaction patterns
- [03_schema_engine.md](../03_schema_engine.md) - Data-driven game engine
- [04_lexicon.md](../04_lexicon.md) - Terminology system

## How to Run

Because this game uses `fetch` to load JSON data from the `../data/` directory, it **cannot** be run by simply opening `index.html` in a browser (due to CORS restrictions).

You must serve the project root via a local web server.

### Using Python (simplest)
1. Open a terminal in the **root** of the repo (`.../ccvibes/ccvibes/`)
2. Run: `python -m http.server`
3. Go to: `http://localhost:8000/claude_experiment_tui/`

### Using Node/VS Code
- Use the "Live Server" extension in VS Code
- Or run `npx http-server` in the root

## Keyboard Controls

### Global Navigation
- **TAB** / **SHIFT+TAB**: Cycle through tabs (Activities, Crew, Resources, Settings, Log)
- **ESC**: Go back (when in activity detail view)

### Activities Tab
- **LEFT** / **RIGHT ARROW**: Navigate between branch tabs (ALL, STREET, COMMERCE, etc.)
- **UP** / **DOWN ARROW**: Navigate activity items in list view
- **ENTER**: Select/activate focused item or button
  - In list view: Opens selected activity's detail view
  - In detail view: Clicks the focused button (RUN ONCE, RUN X, RUN ∞)

### Tips
- Arrow keys automatically scroll focused elements into view
- All buttons remain clickable with mouse if preferred
- Keyboard controls do not interfere with input fields (repeat count inputs)

## UI Structure

```
┌─ STATUS HEADER ──────────────────────────────────────────┐
│ ● CRIME COMMITTER VI [TUI BUILD]    CASH | HEAT | CREW  │
└───────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════

[ ACTIVITIES ]  [ CREW ]  [ RESOURCES ]  [ SETTINGS ]  [ LOG ]

┌─ OPERATIONS ──────────────────────────────────────────────┐
│ ALL │ STREET │ COMMERCE                                   │
│                                                            │
│ [Activity cards arranged in grid...]                      │
│                                                            │
└────────────────────────────────────────────────────────────┘

KEYBOARD: TAB/ARROWS=Navigate ENTER=Select ESC=Back  UPTIME: 00:12:34
```

## Architecture

### Files
- **index.html**: Main structure (identical to root with keyboard hint in footer)
- **style.css**: Complete styling from root version
- **engine.js**: Game engine - **exact copy from root**
- **ui.js**: UI rendering - **root version + keyboard navigation**
- **main.js**: Initialization - **exact copy from root**

### Keyboard Navigation Added

The only modification to the root version is the addition of keyboard navigation in [ui.js](ui.js):

- `setupKeyboardNavigation()`: Main keyboard event handler
- `handleArrowNavigation()`: Arrow key navigation logic
- `handleEnterKey()`: Enter key activation logic

These functions are added to the UI object and called during initialization. They work alongside the existing click handlers without interfering with normal operation.

### Data Flow
1. Engine loads JSON data from `../data/` folder (same as root)
2. Engine maintains game state following schema from founding documents
3. UI renders styled interface using DOM elements
4. User input handled by keyboard navigation OR mouse clicks
5. Engine processes actions and updates state
6. Loop continues with auto-save every 10 seconds

## Differences from Root Version

The ONLY differences:
1. **Keyboard navigation added** - Tab switching, arrow navigation, Enter to select
2. **Footer updated** - Shows keyboard hint instead of just "OPERATIONAL"
3. **Title updated** - "[TUI BUILD]" indicator in header
4. **Focus styles added** - Visual feedback for keyboard navigation
5. **Activity items focusable** - `tabIndex = 0` added to activity cards

Everything else is identical:
- Same engine logic
- Same UI rendering
- Same data structures
- Same visual design
- Same font options
- Same repeat queue system
- Same crew management
- Same auto-save

## Implementation Notes

### Keyboard Navigation Design

The keyboard navigation is designed to feel natural and intuitive:

- **TAB** follows web convention for major navigation
- **Arrow keys** follow TUI/terminal conventions for list navigation
- **ENTER** activates the focused element
- **ESC** goes back, following modal dialog conventions

### Focus Management

Activity items are given `tabIndex = 0` to make them focusable. CSS `:focus` styles provide visual feedback. The navigation code tracks focus state and scrolls elements into view automatically.

### Non-Invasive Implementation

The keyboard navigation is added as an extension to the existing codebase:
- Does not modify existing click handlers
- Does not change data structures
- Does not alter game logic
- Can be used alongside mouse input

This means the game works perfectly with:
- Keyboard only
- Mouse only
- Keyboard + mouse hybrid

## Future Enhancements

Potential additions while maintaining compatibility with root:
- Keyboard shortcuts for common actions (R for repeat, S for settings, etc.)
- Visual indicator showing currently focused element
- Vim-style hjkl navigation option
- Customizable keyboard bindings in settings

## Credits

Built by Claude (Anthropic) as a keyboard-navigable variant of the Crime Committer VI root implementation.

Uses the same game engine, data structures, and visual design as the root version.

Font: IBM VGA fonts from fonts folder + Source Code Pro from Google Fonts
