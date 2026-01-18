# Gradient System Integration Plan

## Current State
- The [data-builder/tui-designer-v2.html](data-builder/tui-designer-v2.html) has a full gradient implementation
- Branches now support `ui.color` and `ui.gradient` fields in JSON
- Main tabs are hardcoded with colors

## Gradient System from TUI Designer

The designer includes:

### Color Interpolation
```javascript
function interpolateColor(color1, color2, t) {
  // Smoothly blends between two hex colors
  // t = 0.0 to 1.0 (0 = color1, 1 = color2)
}
```

### Named Gradients
```javascript
const GRADIENTS = {
  'cool': ['#00ffff', '#33ddbb', '#7bff9f'],
  'warm': ['#ff00ff', '#dd33aa', '#bb6688'],
  'heat': ['#ff4d4d', '#ff8844', '#ffcc55'],
  'cyber': ['#9966ff', '#6688ff', '#42c7b8'],
  'ocean': ['#0066cc', '#0099dd', '#00cccc', '#00ffcc'],
  // ... many more
}
```

### Gradient Text Rendering
```javascript
drawGradientText(x, y, text, gradientName, align = 'left') {
  const gradient = GRADIENTS[gradientName];
  const step = (gradient.length - 1) / (text.length - 1);

  for (let i = 0; i < text.length; i++) {
    const colorIndex = Math.floor(i * step);
    const nextIndex = Math.min(colorIndex + 1, gradient.length - 1);
    const t = (i * step) - colorIndex;
    const color = interpolateColor(gradient[colorIndex], gradient[nextIndex], t);
    // Draw character with interpolated color
  }
}
```

## Integration Difficulty: **Moderate** (2-3 hours)

### What Needs to be Done:

1. **Add Gradient Support to FrameBuffer** ✓ Easy
   - Add gradient definitions to `palette.js`
   - Add `drawGradientText()` method to FrameBuffer
   - Add color interpolation helper

2. **Update DOMRenderer** ✓ Easy
   - Already supports per-character colors via spans
   - No changes needed

3. **Update UI Rendering** ✓ Easy
   - Modify `renderTab()` to support gradients
   - Check if `ui.gradient` is set, use it instead of solid color
   - Fallback to `ui.color` if no gradient

4. **Schema Updates** ✓ Already done
   - `branches.json` now has `ui.color` and `ui.gradient`
   - Can add same pattern to activities, options, etc.

### Example Usage After Integration:

```json
// branches.json
{
  "id": "cybercrime",
  "name": "cybercrime",
  "hotkey": "y",
  "ui": {
    "gradient": "cyber",  // Use gradient instead of solid color
    "color": null
  }
}
```

```javascript
// In renderTab()
if (b.ui?.gradient) {
  this.buffer.drawGradientText(x, y, b.name.toUpperCase(), b.ui.gradient);
} else {
  const color = b.ui?.color ? Palette[b.ui.color] : Palette.TERMINAL_GREEN;
  this.buffer.writeText(x, y, b.name.toUpperCase(), color);
}
```

## Recommended Gradient Names for Game

Based on the designer's gradients, here are good matches for the game theme:

- **`cyber`** - Purple to teal, very cyberpunk
- **`cool`** - Cyan to green, clean tech feel
- **`warm`** - Magenta to red, aggressive/dangerous
- **`heat`** - Red to yellow, heat/danger indicator
- **`neon`** - Hot pink to orange, classic neon signs
- **`toxic`** - Green to yellow, illegal/hazardous activities
- **`blackbody`** - Dark red through orange to yellow, heat radiation

## Implementation Steps

1. Copy gradient definitions from TUI designer to new `gradients.js`
2. Add `interpolateColor()` helper to `gradients.js`
3. Import gradients in `framebuffer.js`
4. Add `drawGradientText()` method to FrameBuffer class
5. Update `renderTab()` to check for gradient first, then color
6. Test with a gradient on one branch
7. Document gradient names in schema comments

## Files to Modify

- `gradients.js` (new) - Gradient definitions and helpers
- `framebuffer.js` - Add drawGradientText method
- `ui.js` - Update renderTab to support gradients
- `palette.js` - Import gradients or merge them
- `data/branches.json` - Example gradient usage in comments

## Performance Considerations

- Color interpolation is cheap (just RGB math)
- Each character gets its own span anyway (already doing this)
- No performance impact since we're not adding more DOM elements
- Could cache interpolated colors if needed, but unlikely necessary

## Future Enhancement: Animated Gradients

Once static gradients work, could add:
- Shifting gradients (colors rotate over time)
- Pulsing (fade in/out effect)
- Would require storing animation state and updating on tick
- Low priority, static gradients are good enough for MVP
