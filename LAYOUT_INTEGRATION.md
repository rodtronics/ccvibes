# TUI Layout System Integration Guide

## Overview

The TUI Designer creates JSON layout definitions that can be rendered by your game. This guide explains how to integrate designer-created layouts into the game code.

## Architecture

```
TUI Designer (data-builder/tui-designer-v2.html)
    ↓ Creates
Layout JSON Files (layouts/*.json)
    ↓ Loaded by
LayoutRenderer (layout_renderer.js)
    ↓ Writes to
FrameBuffer (framebuffer.js)
    ↓ Rendered by
DOMRenderer (dom_renderer.js)
```

## Integration Strategy: Incremental Adoption

### Phase 1: Keep existing hardcoded UI (NOW)
- Continue using `ui.js` with manual rendering
- Add `LayoutRenderer` as optional rendering path
- Create layout JSONs for reference/experimentation
- **No breaking changes**

### Phase 2: Hybrid approach (LATER)
- Use layouts for static elements (status rail, tab bar)
- Keep dynamic content hardcoded (activity lists, runs)
- Template system for variable substitution
- **Gradual migration**

### Phase 3: Fully data-driven (FUTURE)
- All UI defined by layouts
- Game code only provides data
- Complete separation of presentation and logic
- **Maximum flexibility**

## Current Recommendation: Phase 1

**Don't block game development on UI architecture.** Your current system works. Add layout support incrementally:

1. Keep `ui.js` as-is
2. Add `LayoutRenderer` to your imports (optional use)
3. Create layouts in designer for visual reference
4. Migrate one component at a time when you're ready

## Template Variable System

Layouts can include template variables for dynamic content:

```json
{
  "type": "text",
  "segments": [
    { "text": "CASH: ${{cash}}", "color": "green" },
    { "text": " HEAT {{heat}}%", "color": "red" }
  ]
}
```

At render time, replace variables:

```javascript
function renderWithData(layout, data) {
    const rendered = JSON.parse(JSON.stringify(layout)); // deep clone

    // Replace {{variable}} in all text segments
    function substitute(obj) {
        if (typeof obj === 'string') {
            return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return data[key] ?? match;
            });
        }
        if (Array.isArray(obj)) return obj.map(substitute);
        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (let key in obj) {
                result[key] = substitute(obj[key]);
            }
            return result;
        }
        return obj;
    }

    return substitute(rendered);
}

// Usage
const statusLayout = await fetch('layouts/status-rail.json').then(r => r.json());
const withData = renderWithData(statusLayout, {
    cash: engine.state.resources.cash,
    heat: Math.floor(engine.state.resources.heat),
    heatPercent: Math.floor(engine.state.resources.heat / 100 * 100),
    runCount: engine.state.runs.length
});
layoutRenderer.render(withData, 0, 0);
```

## What Needs Editing in Main Game Code?

### Option A: Keep everything as-is (Recommended for now)
- **No changes required**
- Use designer for visual prototyping only
- Manually port layouts to `ui.js` when happy with design

### Option B: Add layout loading (When ready)
1. Import `LayoutRenderer`:
   ```javascript
   import { LayoutRenderer } from './layout_renderer.js';
   ```

2. Load layout JSON files:
   ```javascript
   const layouts = {
       statusRail: await fetch('layouts/status-rail.json').then(r => r.json()),
       tabBar: await fetch('layouts/tab-bar.json').then(r => r.json()),
   };
   ```

3. Use in render methods:
   ```javascript
   renderStatusRail() {
       const data = {
           cash: this.fmtNum(this.engine.state.resources.cash),
           heat: Math.floor(this.engine.state.resources.heat),
           // ... etc
       };
       const layout = renderWithData(layouts.statusRail, data);
       const renderer = new LayoutRenderer(this.buffer);
       renderer.render(layout, 0, 0);
   }
   ```

## Layout File Organization

Suggested structure:
```
layouts/
  ├── status-rail.json      # Top status bar
  ├── tab-bar.json          # Navigation tabs
  ├── activities-3col.json  # Activities view structure
  ├── active-run.json       # Single run display block
  ├── log-entry.json        # Log entry format
  └── modal-crew.json       # Crew selection modal
```

## Breaking Down UI into Layouts

Based on `02_ui_spec.md`, these are the components you could create layouts for:

### Static Layouts (Easy wins)
- ✅ Status Rail (line 1-2)
- ✅ Tab Bar (line 3-4)
- ✅ Footer/Help line (line 59-60)
- ✅ Box borders (3-column structure)

### Semi-Dynamic Layouts (Template variables)
- ✅ Active run 4-line block
- ✅ Progress bars
- ⚠️ Meters (HEAT bar with dynamic fill)

### Dynamic Content (Keep hardcoded for now)
- ❌ Activity lists (dynamic length, scrolling)
- ❌ Log entries (dynamic content)
- ❌ Crew selection (complex interaction)

## When to Use Layouts vs Hardcoding

**Use layouts for:**
- Fixed structure (borders, headers, footers)
- Repeating patterns (run display blocks)
- Visual tweaking (colors, spacing, styles)
- A/B testing different designs

**Keep hardcoded for:**
- Lists with unknown length
- Content that scrolls
- Complex interaction states
- Performance-critical rendering

## Color Mapping

The designer uses named colors. Map them to your Palette:

```javascript
// layout_renderer.js
export const LayoutColors = {
    dim: Palette.DIM_GRAY,
    white: Palette.WHITE,
    gray: Palette.MID_GRAY,
    cyan: Palette.NEON_CYAN,
    green: Palette.SUCCESS_GREEN,
    red: Palette.HEAT_RED,
    // ... etc
};
```

## Next Steps

1. ✅ Use the designer to explore visual ideas
2. ✅ Create layout JSONs for reference
3. ⏳ Finish implementing game mechanics with current hardcoded UI
4. ⏳ When stable, start migrating static elements to layouts
5. ⏳ Add template system for dynamic values
6. ⏳ Gradually expand layout usage

## Summary

**You don't need to change anything right now.** The designer is a visual tool that helps you design and prototype layouts. When you're ready to migrate from hardcoded rendering to data-driven layouts, the integration path is clear and incremental.

Focus on making the game fun first. The UI architecture can evolve as you discover what actually needs to be configurable.
