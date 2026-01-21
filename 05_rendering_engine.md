# Crime Committer VI — Rendering Engine

Purpose: single source for TUI rendering architecture. Defines the frame buffer structure and rendering abstraction. Pair with `02_ui_spec.md` for visual design and layout rules.

## 1. Philosophy

- **Renderer-agnostic design**: The game writes to an abstract frame buffer; renderers flush the buffer to DOM, canvas, or other targets.
- **Character-based**: Every position is a single character with foreground and background color.
- **Layered composition**: Draw structure first (borders, boxes), then overwrite with content; no need to calculate gaps or avoid corners.
- **Dirty tracking**: Only modified cells are marked for re-render; renderers decide how to optimize.
- **Double buffering**: Write to back buffer, swap on render to avoid tearing.
- **Fixed viewport**: No scrolling the terminal itself; individual panels may scroll content within their bounds.

## 2. Frame Buffer Structure

### Cell Definition

Each cell in the buffer represents a single character position:

```javascript
{
  char: ' ',           // Single character (string)
  fg: '#00ff00',       // Foreground color (hex string)
  bg: '#000000',       // Background color (hex string)
  dirty: true          // Render flag (boolean)
}
```

### Buffer Layout

The frame buffer is a 2D array indexed by `[y][x]` (row-major order):

```javascript
{
  width: 80,           // Terminal width in columns
  height: 24,          // Terminal height in rows
  cells: [],           // 2D array: cells[y][x]
  dirtyRegions: []     // Optional: track rectangular dirty regions
}
```

### Coordinate System

- Origin (0, 0) is top-left corner
- X increases rightward (columns)
- Y increases downward (rows)
- Valid ranges: `0 <= x < width`, `0 <= y < height`

## 3. Color Palette

### Standard Colors

Map common terminal colors to the retrofuturistic palette defined in `02_ui_spec.md`:

```javascript
const Palette = {
  // Backgrounds
  BLACK: '#000000',
  DARK_BLUE: '#0a1628',
  DARKER_BLUE: '#1a2332',

  // Primary UI
  TERMINAL_GREEN: '#00ff00',
  TERMINAL_GREEN_DIM: '#33ff33',
  NEON_CYAN: '#00ffff',
  NEON_TEAL: '#40e0d0',

  // Accents
  HOT_PINK: '#ff00ff',
  MAGENTA: '#ff1493',
  ELECTRIC_ORANGE: '#ff6600',
  BRIGHT_ORANGE: '#ff8c00',
  BRIGHT_YELLOW: '#ffff00',

  // Semantic
  HEAT_ORANGE: '#ff4500',
  HEAT_RED: '#ff0000',
  SUCCESS_GREEN: '#00ff00',

  // Text
  WHITE: '#ffffff',
  LIGHT_GRAY: '#cccccc',
  MID_GRAY: '#888888',
  DIM_GRAY: '#555555',
};
```

### Color References

Colors can be specified as:
- Direct hex strings: `'#00ff00'`
- Palette references: `Palette.TERMINAL_GREEN`

### Gradient System

Gradients enable smooth color transitions across text for enhanced visual appeal:

**Color Interpolation:**
```javascript
function lerpColor(color1, color2, t) {
  // Linear interpolation between two hex colors
  // t = 0.0 returns color1, t = 1.0 returns color2
  // Returns interpolated hex color string
}
```

**Gradient Definitions (gradients.js):**
```javascript
const GRADIENTS = {
  street: ['#00ff00', '#44ff22', '#66ff33', '#88ff44', '#aaff55', '#ccff88'],
  commerce: ['#00ffff', '#40e0d0', '#5ff5f5', '#80ffff'],
  cyber: ['#ff00ff', '#00ffff', '#ff00ff'],
  heat: ['#ff4500', '#ff6600', '#ff8800', '#ffaa00'],
  // ... more gradients
};
```

**Gradient Text Rendering:**
- `drawGradientText(x, y, text, gradientName, bgColor, alignment)` method in FrameBuffer
- Automatically interpolates colors across text length
- Supports 'left', 'center', and 'right' alignment
- Falls back to solid color if gradient name doesn't exist
- Each character receives its own interpolated color

**Implementation:**
```javascript
// Generate gradient colors for text length
const colors = getGradientColors(text, gradientName);

// Render each character with its color
for (let i = 0; i < text.length; i++) {
  buffer.setCell(x + i, y, text[i], colors[i], bgColor);
}
```

## 4. Frame Buffer API

### Core Operations

```javascript
class FrameBuffer {
  constructor(width, height) { }

  // Cell manipulation
  setCell(x, y, char, fg, bg)      // Write single cell
  getCell(x, y)                     // Read single cell
  clearCell(x, y)                   // Reset to default (space, default colors)

  // Bulk operations
  fill(char, fg, bg)                // Fill entire buffer
  fillRect(x, y, w, h, char, fg, bg) // Fill rectangular region
  clear()                           // Reset entire buffer to defaults

  // Text operations
  writeText(x, y, text, fg, bg)     // Write string starting at position
  writeTextCentered(y, text, fg, bg) // Write centered on row
  writeTextRight(x, y, text, fg, bg) // Write right-aligned from position

  // Box drawing
  drawBox(x, y, width, height, style, fg, bg)  // Draw box with border chars
  drawHLine(x, y, length, char, fg, bg)        // Horizontal line
  drawVLine(x, y, length, char, fg, bg)        // Vertical line

  // Gradient text rendering
  drawGradientText(x, y, text, gradientName, bg, alignment)  // Gradient text with color interpolation

  // Dirty tracking
  markDirty(x, y)                   // Mark cell as dirty
  markRectDirty(x, y, w, h)         // Mark region as dirty
  clearDirtyFlags()                 // Reset all dirty flags after render
  getDirtyCells()                   // Get list of dirty cells for rendering

  // Buffer management
  clone()                           // Deep copy of buffer
  swap(otherBuffer)                 // Swap with another buffer (double buffering)
}
```

### Box Drawing Styles

Standard box drawing character sets:

```javascript
const BoxStyles = {
  SINGLE: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    teeDown: '┬',
    teeUp: '┴',
    teeRight: '├',
    teeLeft: '┤',
    cross: '┼',
  },

  DOUBLE: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    teeDown: '╦',
    teeUp: '╩',
    teeRight: '╠',
    teeLeft: '╣',
    cross: '╬',
  },

  HEAVY: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    teeDown: '┳',
    teeUp: '┻',
    teeRight: '┣',
    teeLeft: '┫',
    cross: '╋',
  },
};
```

## 5. Renderer Interface

Renderers are responsible for flushing the frame buffer to an output target.

### Renderer Contract

```javascript
class Renderer {
  constructor(buffer, targetElement) {
    this.buffer = buffer;
    this.target = targetElement;
  }

  // Core rendering
  render()              // Full render of buffer to target
  renderDirty()         // Partial render (dirty cells only)

  // Lifecycle
  init()                // Setup renderer (create DOM/canvas structure)
  destroy()             // Cleanup resources
  resize(width, height) // Handle buffer size changes

  // Optional performance hints
  setFont(fontFamily, fontSize)
  setCellSize(width, height)
}
```

### Renderer Implementations

Multiple renderers can be implemented:

#### DOM Renderer (Phase 1)
- Single `<pre>` element
- Update `textContent` with entire buffer as string
- No color support initially
- Simple and fast for prototyping

#### DOM Span Renderer (Phase 2)
- Grid of `<span>` elements or row-based `<div>`s
- Each span styled with `color` and `background-color`
- Only update dirty cells/rows
- Better performance than full textContent replacement

#### Canvas Renderer (Phase 3)
- Single `<canvas>` element
- Use `fillText()` for characters
- Use `fillRect()` for backgrounds
- Only redraw dirty regions
- Optimal performance for large buffers

#### WebGL Renderer (Future/Optional)
- GPU-accelerated rendering
- Character atlas texture
- Instanced rendering
- Overkill for most cases but possible

## 6. Layout System

### Viewport Configuration

The game uses a fixed viewport resolution:

```javascript
const VIEWPORT = {
  width: 80,    // 80 columns (classic terminal width)
  height: 25    // 25 rows (classic terminal height)
};
```

This classic terminal resolution provides:
- Familiar terminal dimensions (VT100 standard)
- Compact, focused layout that fits anywhere
- Forces prioritization of important information
- Authentic terminal aesthetic
- Easy to make dynamic/resizable in future

### Panel System

The 80x25 viewport is divided into fixed panels as defined in `02_ui_spec.md`:

```javascript
const Layout = {
  statusRail: { x: 0, y: 0, width: 80, height: 2 },
  tabBar: { x: 0, y: 2, width: 80, height: 1 },
  mainPanel: { x: 0, y: 3, width: 80, height: 22 },
};
```

Note: The layout uses a single full-width main panel instead of split panels to maximize usable space at 80x25. The log has been removed as a separate panel - events are shown contextually within the main panel as needed.

Panels can write to their region without knowing absolute coordinates:

```javascript
class Panel {
  constructor(buffer, x, y, width, height) {
    this.buffer = buffer;
    this.bounds = { x, y, width, height };
  }

  // Write relative to panel origin
  write(localX, localY, text, fg, bg) {
    const globalX = this.bounds.x + localX;
    const globalY = this.bounds.y + localY;
    if (this.inBounds(localX, localY)) {
      this.buffer.writeText(globalX, globalY, text, fg, bg);
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.bounds.width &&
           y >= 0 && y < this.bounds.height;
  }

  clear() {
    this.buffer.fillRect(
      this.bounds.x,
      this.bounds.y,
      this.bounds.width,
      this.bounds.height,
      ' ',
      Palette.LIGHT_GRAY,
      Palette.BLACK
    );
  }
}
```

## 7. Rendering Order and Composition

### Layered Drawing Strategy

The frame buffer uses a **painter's algorithm**: draw background layers first, then overwrite with foreground content. This eliminates complex layout calculations.

**Standard render order:**

1. **Clear/Fill** - Reset buffer or fill with background
2. **Draw all borders and boxes** - Layout structure (panels, dividers, containers)
3. **Draw content** - Text, progress bars, data that overwrites borders where needed
4. **Draw overlays** - Fullscreen modals, tooltips, cursor/selection (if applicable)

**Example render sequence:**

```javascript
function renderFrame(buffer) {
  // Layer 0: Background
  buffer.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);

  // Layer 1: Structure (borders)
  buffer.drawBox(0, 0, 80, 25, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
  buffer.drawBox(0, 3, 80, 22, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);

  // Layer 2: Content (overwrites borders as needed)
  buffer.writeText(2, 1, 'CRIME COMMITTER VI', Palette.NEON_CYAN, Palette.BLACK);
  buffer.writeText(2, 2, 'JOBS', Palette.NEON_CYAN, Palette.BLACK); // Active tab
  buffer.writeText(10, 2, 'ACTIVE', Palette.DIM_GRAY, Palette.BLACK); // Inactive tab
  // ... more content

  // Layer 3: Overlays (fullscreen modals)
  if (ui.modal && ui.modal.active) {
    renderModal(buffer, ui.modal);
  }
}
```

**Benefits of layered composition:**

- **Simpler logic**: No need to calculate "draw from x to x-1 to avoid corner"
- **Flexible layout**: Content can naturally overflow or align with borders
- **Easy updates**: Redraw structure, then overwrite with new content
- **Visual consistency**: Borders define regions; content fills them naturally

### Render Loop

```javascript
class RenderEngine {
  constructor(buffer, renderer) {
    this.buffer = buffer;
    this.renderer = renderer;
    this.lastRenderTime = 0;
  }

  update() {
    // Game logic writes to buffer in layers
    UI.render(this.buffer);

    // Renderer flushes dirty cells
    this.renderer.renderDirty();

    // Clear dirty flags for next frame
    this.buffer.clearDirtyFlags();
  }
}
```

### Double Buffering (Optional)

For tear-free rendering:

```javascript
const frontBuffer = new FrameBuffer(80, 24);
const backBuffer = new FrameBuffer(80, 24);

function render() {
  // Write to back buffer
  UI.render(backBuffer);

  // Swap buffers
  [frontBuffer, backBuffer] = [backBuffer, frontBuffer];

  // Render front buffer
  renderer.render(frontBuffer);
}
```

## 8. Performance Considerations

### Dirty Tracking Strategies

#### Cell-level Tracking
- Mark individual cells dirty
- Optimal for sparse updates (timers, single values)
- Higher overhead for bulk changes

#### Region Tracking
- Track rectangular dirty regions
- Optimal for panel redraws
- Merge overlapping regions

#### Scan-line Tracking
- Track dirty rows only
- Middle ground between cell and full refresh
- Good for row-based layouts

### Optimization Guidelines

- Minimize writes to buffer; only update changed cells
- Batch writes when possible; mark dirty once after bulk operations
- Use region fills for large areas rather than cell-by-cell writes
- Clear dirty flags after render; don't accumulate
- Profile renderers; switch implementation if performance issues arise

## 9. Integration with UI Layer

The UI layer (`ui.js`) writes to the frame buffer using panel abstractions:

```javascript
class UI {
  constructor(buffer) {
    this.buffer = buffer;
    this.panels = {
      status: new Panel(buffer, 0, 0, 80, 1),
      tabs: new Panel(buffer, 0, 1, 80, 1),
      main: new Panel(buffer, 0, 2, 60, 20),
      log: new Panel(buffer, 60, 2, 20, 20),
    };
  }

  renderAll() {
    this.renderStatusRail();
    this.renderTabs();
    this.renderMainPanel();
    this.renderLogPanel();
  }

  renderStatusRail() {
    const p = this.panels.status;
    p.clear();
    p.write(0, 0, 'CRIME COMMITTER VI', Palette.NEON_CYAN, Palette.BLACK);
    p.write(25, 0, `CASH: $${Engine.state.resources.cash}`, Palette.SUCCESS_GREEN, Palette.BLACK);
    // ... etc
  }
}
```

## 10. Design Constraints

- The frame buffer is the single source of truth for what appears on screen
- Renderers never modify buffer content; they only read and display
- All UI code writes to the buffer; no direct DOM manipulation outside renderers
- Color values are always hex strings for consistency
- Characters are always single-character strings (no multi-char graphemes for now)
- Coordinate validation is the responsibility of the FrameBuffer API
- Out-of-bounds writes are silently ignored or clamped

## 11. Future Extensions

### Possible Enhancements (Not Immediate)

- **Data-driven layouts**: JSON-defined UI layouts with template variables (LayoutRenderer system for visual design tools)
- **Layering system**: Multiple buffers composited together (background, content, overlay)
- **Scrollback buffer**: Maintain history beyond visible viewport
- **Character attributes**: Bold, dim, underline, blink flags per cell
- **Extended characters**: Support for emoji or multi-cell wide characters
- **Effects**: Fade, pulse, typewriter reveals
- **Input handling**: Cursor positioning, selection regions
- **Accessibility**: Screen reader support via hidden DOM layer

### Explicit Non-Goals

- Full terminal emulation (ANSI escape sequences, etc.)
- Mouse input handling (use browser events on renderer layer)
- Copy/paste support (renderer responsibility)
- Variable-width fonts (monospace only)
- Anti-aliasing control (renderer/browser responsibility)

## 12. Modal Overlay Rendering

Fullscreen modals render as Layer 3 overlays that completely cover the 80×25 viewport with interactive content.

### Modal Rendering Architecture

Modals are rendered after all regular UI layers but before any cursor/input overlays:

```javascript
function render() {
  // Layer 0: Background
  buffer.clear();

  // Layer 1: Structure (borders, panels)
  renderStructure(buffer);

  // Layer 2: Content (text, data, active runs)
  renderContent(buffer);

  // Layer 3: Modal overlay (if active)
  if (ui.modal.active) {
    renderModal(buffer, ui.modal);
  }
}
```

### Modal Composition

Modal rendering follows the same layered approach within its 80×25 bounds:

1. **Fill background**: Solid BLACK background (no transparency)
2. **Draw border**: Double-line box (BoxStyles.DOUBLE) in NEON_CYAN
3. **Render title**: Centered text on row 1
4. **Draw separator**: Horizontal line on row 2
5. **Render content**: Scrollable text area (rows 3-24) with formatted segments
6. **Draw scrollbar**: Visual indicator when content exceeds visible area

### Content Formatting

Modal content uses `parseModalContent()` to convert markdown-like syntax into formatted segments:

```javascript
// Input: Raw content string with formatting
const content = `**Bold text** and {{neon_cyan}}colored text{{/}}`;

// Output: Array of line objects with segments
[
  {
    segments: [
      { text: 'Bold text', fg: Palette.WHITE, bg: Palette.BLACK },
      { text: ' and ', fg: Palette.LIGHT_GRAY, bg: Palette.BLACK },
      { text: 'colored text', fg: Palette.NEON_CYAN, bg: Palette.BLACK }
    ]
  }
]
```

Each segment is rendered character-by-character using `writeText()` to preserve color boundaries.

### Scrollable Content Area

Content area spans rows 3 through 24 (22 visible lines total):

- **Content width**: 76 characters (80 - 4 for borders and padding)
- **Visible height**: 21 lines (rows 3-23, row 24 reserved for border)
- **Scroll offset**: Tracked in `ui.modal.scroll`
- **Render window**: `parsedLines.slice(scrollOffset, scrollOffset + 21)`

### Scrollbar Rendering

When content exceeds 21 visible lines, a scrollbar appears on the right edge:

```javascript
// Scrollbar positioned at x=79 (rightmost column)
const scrollbarX = 79;
const scrollbarY = 3;  // Start at content area top
const scrollbarHeight = 21;  // Match content area height

// Track uses vertical line character
buffer.drawVLine(scrollbarX, scrollbarY, scrollbarHeight, '│', Palette.DIM_GRAY, Palette.BLACK);

// Thumb position calculated from scroll percentage
const scrollPct = scrollOffset / (totalLines - visibleLines);
const thumbY = scrollbarY + Math.floor(scrollPct * (scrollbarHeight - 1));

// Thumb uses solid block character
buffer.setCell(scrollbarX, thumbY, '█', Palette.NEON_CYAN, Palette.BLACK);
```

### Input Handling Integration

Modal rendering is tightly coupled with input handling:

- **Input priority**: Modals capture all keyboard input when active
- **Scroll controls**: Arrow keys modify `ui.modal.scroll` and trigger re-render
- **Dismiss actions**: SPACE/ENTER/ESC set `ui.modal.active = false`
- **Queue integration**: On dismiss, check `ModalQueue` for next modal

### Performance Characteristics

Modal rendering is intentionally simple and full-screen:

- **Full buffer overwrite**: Modals redraw all 2000 cells (80×25)
- **No dirty tracking**: Simplifies implementation since modals are transient
- **Minimal state**: Only scroll offset persists between render frames
- **Instant transitions**: No fade animations; modals appear/disappear immediately

### Implementation Files

Modal rendering spans three files with clear separation of concerns:

- **modal.js**: Content parsing (`parseModalContent`), queue management (`ModalQueue`)
- **ui.js**: Rendering logic (`renderModal` method in UI class)
- **main.js**: State management (ui.modal object), input handling, lifecycle functions

## 13. Implementation Checklist

Phase 1: Core Buffer
- [ ] Implement FrameBuffer class with cell storage
- [ ] Implement basic write operations (setCell, writeText)
- [ ] Implement dirty tracking (cell-level)
- [ ] Implement box drawing utilities
- [ ] Add bounds checking and validation

Phase 2: Renderer
- [ ] Implement simple DOM renderer (single `<pre>`)
- [ ] Implement DOM span renderer (color support)
- [ ] Add renderer swap capability
- [ ] Profile performance at target viewport size

Phase 3: Integration
- [ ] Create Panel abstraction class
- [ ] Define layout configuration for game UI
- [ ] Integrate with existing UI.js
- [ ] Wire up to Engine event system

Phase 4: Optimization
- [ ] Add region-based dirty tracking
- [ ] Implement canvas renderer
- [ ] Add double buffering support
- [ ] Profile and optimize hot paths
