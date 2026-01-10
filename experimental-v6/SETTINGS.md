# Settings System

The experimental build now includes a comprehensive settings panel accessible via the **SETTINGS** tab.

## Features

### Font Selection

Choose from **6 font options**:

1. **Default Mono** - IBM Plex Mono, JetBrains Mono, Cascadia Mono fallbacks
2. **IBM VGA 8x14** - Classic VGA bitmap font (8×14 pixels)
3. **IBM VGA 8x16** - Standard VGA font (8×16 pixels)
4. **IBM VGA 9x14** - Wide VGA font (9×14 pixels)
5. **IBM VGA 9x16** - Wide standard VGA (9×16 pixels)
6. **IBM VGA 9x8** - Compact VGA font (9×8 pixels)

Each font option shows:
- Font name
- Live preview in that font
- `[ACTIVE]` indicator for current selection

**Changes apply immediately** when you click a font option.

### Glow Effects Toggle

Control the neon aesthetic with a visual toggle switch:

- **ON (default)**: Full cyberpunk glow effects
  - Neon text-shadow on titles and active elements
  - Box-shadow glows on borders and progress bars
  - Pulsing animation on status indicators

- **OFF**: Clean, flat appearance
  - No text-shadow
  - No box-shadow
  - No animations
  - Same layout and colors, just without the glow

Perfect for:
- Reducing visual noise
- Lower-spec systems
- Personal preference
- Screenshots/recordings

## Implementation

### Storage

Settings are persisted to localStorage as `ccvi_settings`:

```javascript
{
  "fontId": "vga_8x16",
  "glowEnabled": false
}
```

Settings persist across sessions and page reloads.

### Font Loading

VGA fonts are loaded via `@font-face` declarations in `style.css`:

```css
@font-face {
  font-family: "AcPlus_IBM_VGA_8x16";
  src: url("../fonts/AcPlus_IBM_VGA_8x16.ttf");
}
```

Fonts are loaded from the `../fonts/` directory relative to the experimental build.

### Glow Toggle

When glow is disabled, the `no-glow` class is added to `<body>`:

```css
body.no-glow .system-title,
body.no-glow .nav-tab.active,
body.no-glow .progress-fill {
  text-shadow: none !important;
  box-shadow: none !important;
  animation: none !important;
}
```

This removes all glow effects while preserving colors and layout.

## UI Components

### Font Options

- Clickable rows with hover state
- Active option highlighted with cyan border
- Each row shows live preview in that font
- Status indicator on right side

### Toggle Switch

- Interactive switch component
- Slider moves left (OFF) or right (ON)
- Active state shows cyan glow on slider
- Entire row is clickable

## Technical Details

### Files Modified

- **index.html** - Added Settings tab and panel
- **style.css** - Added font faces, settings styles, no-glow class
- **ui.js** - Added settings management, rendering, event handlers

### Methods Added

```javascript
UI.loadSettings()      // Load from localStorage
UI.saveSettings()      // Save to localStorage
UI.applySettings()     // Apply current settings to DOM
UI.setFont(fontId)     // Change font
UI.toggleGlow()        // Toggle glow effects
UI.renderSettings()    // Render settings panel
```

### Data Structure

```javascript
UI.settings = {
  fontId: 'default',     // Selected font ID
  glowEnabled: true      // Glow effects enabled
}

UI.fontOptions = [
  {
    id: 'default',
    label: 'Default Mono',
    fontFamily: '"IBM Plex Mono", ...'
  },
  // ... more fonts
]
```

## User Experience

- Settings apply **instantly** (no save button needed)
- Settings **persist** across page reloads
- Font previews show **actual font** before selection
- Toggle switch provides **visual feedback**
- Works seamlessly with existing UI

---

**Note**: Settings are client-side only. They do not affect game state or save data.
