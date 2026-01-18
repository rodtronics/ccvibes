# Gradient System & Hotkey Glow Implementation Summary

## Features Implemented

### 1. Gradient System
- **New file**: [gradients.js](gradients.js)
  - Color interpolation function for smooth transitions between colors
  - Named gradient definitions (cyber, cool, warm, heat, neon, toxic, street, commerce, etc.)
  - Helper function to generate gradient colors for any text length

- **FrameBuffer enhancement**: [framebuffer.js](framebuffer.js)
  - Added `drawGradientText()` method for rendering text with gradient colors
  - Supports left, center, and right alignment
  - Graceful fallback to solid color if gradient doesn't exist

- **Data schema support**: [data/branches.json](data/branches.json)
  - Branches now have `ui.gradient` field
  - STREET branch uses "street" gradient (green tones)
  - COMMERCE branch uses "commerce" gradient (cyan tones)

### 2. Hotkey Glow Effect
- **Enhanced renderTab()**: [ui.js](ui.js)
  - Characters adjacent to the hotkey letter now show a "glow" effect
  - Uses color interpolation at 67% between highlight cyan and grey
  - Only visible on inactive tabs (when the tab is not selected)
  - Works alongside the existing hotkey highlighting

### 3. Settings Panel
- **New toggles in Settings tab**:
  1. Font (existing, now numbered)
  2. Gradients - Toggle gradient rendering on/off
  3. Hotkey Glow - Toggle the adjacent character glow effect on/off

- **Keyboard controls**:
  - Number keys (1-3) to jump to setting
  - Arrow keys (Up/Down) to navigate
  - Enter/Space to toggle or cycle setting
  - All settings auto-save to localStorage

- **Default settings**: [main.js](main.js)
  - Gradients: ON by default
  - Hotkey Glow: ON by default
  - Settings persist across page reloads

## How It Works

### Gradient Rendering
When gradients are enabled and a UI element has a gradient specified:
1. The gradient name (e.g., "street") is looked up in GRADIENTS
2. Colors are interpolated across the text length
3. Each character gets its own color from the gradient
4. The result is a smooth color transition across the text

Example:
```
STREET → S(#00ff00) T(#44ff22) R(#66ff33) E(#88ff44) E(#aaff55) T(#ccff88)
```

### Hotkey Glow
When hotkey glow is enabled on inactive tabs:
1. Find the hotkey letter position in the label
2. Highlight the hotkey letter in bright cyan
3. Color adjacent characters (±1 position) at 67% interpolation between cyan and grey
4. Creates a subtle "glow" effect around the hotkey

Example with hotkey 'T' in "STREET":
```
S(dim) T(glow) R(CYAN) E(glow) E(dim) T(dim)
```

### Settings Toggle Flow
1. User presses S to open Settings tab
2. Use arrows or numbers to select setting
3. Press Enter to toggle/cycle
4. Change is immediately applied and saved
5. UI re-renders with new setting active

## Files Modified

- ✨ NEW: [gradients.js](gradients.js) - Gradient system
- 📝 MODIFIED: [framebuffer.js](framebuffer.js) - Added gradient rendering
- 📝 MODIFIED: [ui.js](ui.js) - Enhanced tab rendering, settings UI
- 📝 MODIFIED: [main.js](main.js) - Settings handling and persistence
- 📝 MODIFIED: [data/branches.json](data/branches.json) - Added gradient references

## Testing

To test the features:
1. Load the game - you should see gradients on branch tabs (STREET and COMMERCE)
2. Press S to open Settings
3. Try toggling Gradients (option 2) - branch tabs should switch between gradient and solid color
4. Try toggling Hotkey Glow (option 3) - adjacent characters to hotkeys should gain/lose glow
5. Switch between tabs to see the glow effect on inactive tabs

## Future Enhancements

- Apply gradients to other UI elements (activity names, status text, etc.)
- Add more gradient presets for different game branches
- Animated gradients (colors shift over time)
- Custom gradient builder in settings
