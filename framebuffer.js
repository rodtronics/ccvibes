// Crime Committer VI - Frame Buffer
// Renderer-agnostic character buffer with unified cell structure
// Based on 05_rendering_engine.md

import { Palette, BoxStyles } from './palette.js';
import { getGradientColors, interpolateColor } from './gradients.js';

export class FrameBuffer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = this.createCellArray();
    this.forceUppercase = false;
  }

  createCellArray() {
    const cells = [];
    for (let y = 0; y < this.height; y++) {
      cells[y] = [];
      for (let x = 0; x < this.width; x++) {
        cells[y][x] = {
          char: ' ',
          fg: Palette.LIGHT_GRAY,
          bg: Palette.BLACK,
          dirty: true,
        };
      }
    }
    return cells;
  }

  // Core cell operations
  setCell(x, y, char, fg, bg) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[y][x];
    cell.char = char || ' ';
    cell.fg = fg || Palette.LIGHT_GRAY;
    cell.bg = bg || Palette.BLACK;
    cell.dirty = true;
  }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return null;
    return { ...this.cells[y][x] };
  }

  clearCell(x, y) {
    this.setCell(x, y, ' ', Palette.LIGHT_GRAY, Palette.BLACK);
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // Bulk operations
  fill(char, fg, bg) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.setCell(x, y, char, fg, bg);
      }
    }
  }

  fillRect(x, y, w, h, char, fg, bg) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setCell(x + dx, y + dy, char, fg, bg);
      }
    }
  }

  clear() {
    this.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);
  }

  // Text operations
  normalizeText(text) {
    if (!this.forceUppercase) return text;
    return text.replace(/[a-z]/g, (char) => char.toUpperCase());
  }

  writeText(x, y, text, fg, bg) {
    if (!text) return;
    const str = this.normalizeText(String(text));
    for (let i = 0; i < str.length; i++) {
      this.setCell(x + i, y, str[i], fg, bg);
    }
  }

  writeTextCentered(y, text, fg, bg) {
    if (!text) return;
    const str = this.normalizeText(String(text));
    const x = Math.floor((this.width - str.length) / 2);
    this.writeText(x, y, str, fg, bg);
  }

  writeTextRight(x, y, text, fg, bg) {
    if (!text) return;
    const str = this.normalizeText(String(text));
    const startX = x - str.length + 1;
    this.writeText(startX, y, str, fg, bg);
  }

  // Gradient text operations
  drawGradientText(x, y, text, gradientName, bg, align = 'left') {
    if (!text) return;
    const str = this.normalizeText(String(text));

    // Get interpolated colors for each character
    const colors = getGradientColors(gradientName, str.length);
    if (colors.length === 0) {
      // Fallback to regular text if gradient doesn't exist
      this.writeText(x, y, str, Palette.LIGHT_GRAY, bg);
      return;
    }

    // Calculate starting position based on alignment
    let startX = x;
    if (align === 'center') {
      startX = Math.floor((this.width - str.length) / 2);
    } else if (align === 'right') {
      startX = x - str.length + 1;
    }

    // Draw each character with its interpolated color
    for (let i = 0; i < str.length; i++) {
      this.setCell(startX + i, y, str[i], colors[i], bg);
    }

    return str.length;
  }

  // Box drawing
  drawBox(x, y, width, height, style, fg, bg) {
    if (width < 2 || height < 2) return;

    const chars = style || BoxStyles.SINGLE;

    // Corners
    this.setCell(x, y, chars.topLeft, fg, bg);
    this.setCell(x + width - 1, y, chars.topRight, fg, bg);
    this.setCell(x, y + height - 1, chars.bottomLeft, fg, bg);
    this.setCell(x + width - 1, y + height - 1, chars.bottomRight, fg, bg);

    // Horizontal edges
    for (let i = 1; i < width - 1; i++) {
      this.setCell(x + i, y, chars.horizontal, fg, bg);
      this.setCell(x + i, y + height - 1, chars.horizontal, fg, bg);
    }

    // Vertical edges
    for (let j = 1; j < height - 1; j++) {
      this.setCell(x, y + j, chars.vertical, fg, bg);
      this.setCell(x + width - 1, y + j, chars.vertical, fg, bg);
    }
  }

  drawHLine(x, y, length, char, fg, bg) {
    const lineChar = char || '─';
    for (let i = 0; i < length; i++) {
      this.setCell(x + i, y, lineChar, fg, bg);
    }
  }

  drawVLine(x, y, length, char, fg, bg) {
    const lineChar = char || '│';
    for (let i = 0; i < length; i++) {
      this.setCell(x, y + i, lineChar, fg, bg);
    }
  }

  // Progress bar drawing
  drawProgressBar(x, y, width, percent, fg, bg) {
    if (width < 2) return;

    const clampedPercent = Math.max(0, Math.min(1, percent));
    const innerWidth = width - 2; // Account for [ and ]
    const filledWidth = Math.floor(innerWidth * clampedPercent);

    // Draw brackets
    this.setCell(x, y, '[', fg, bg);
    this.setCell(x + width - 1, y, ']', fg, bg);

    // Draw filled portion
    for (let i = 0; i < filledWidth; i++) {
      this.setCell(x + 1 + i, y, '#', fg, bg);
    }

    // Draw empty portion
    for (let i = filledWidth; i < innerWidth; i++) {
      this.setCell(x + 1 + i, y, '-', fg, bg);
    }
  }

  // Smooth gradient progress bar with sub-character interpolation
  // - The leading character interpolates from emptyColor to its target gradient color
  // - Filled portion has a gradient across it (startColor -> endColor)
  // - Uses solid blocks (█) for a clean look
  drawSmoothProgressBar(x, y, width, percent, startColor, endColor, emptyColor, bg) {
    if (width < 1) return;

    const clampedPercent = Math.max(0, Math.min(1, percent));

    // Calculate how many characters are filled (including partial)
    const filledChars = clampedPercent * width;  // e.g., 3.7 for 37% of 10-char bar
    const fullChars = Math.floor(filledChars);   // 3 fully filled
    const partialPct = filledChars - fullChars;  // 0.7 = 70% through char #4

    for (let i = 0; i < width; i++) {
      // Calculate what color this position should be in the gradient
      const gradientPct = width > 1 ? i / (width - 1) : 0;
      const targetColor = interpolateColor(startColor, endColor, gradientPct);

      if (i < fullChars) {
        // Fully filled - use gradient color at this position
        this.setCell(x + i, y, '█', targetColor, bg);
      } else if (i === fullChars && partialPct > 0) {
        // Partial fill - interpolate between empty and target gradient color
        const color = interpolateColor(emptyColor, targetColor, partialPct);
        this.setCell(x + i, y, '█', color, bg);
      } else {
        // Empty
        this.setCell(x + i, y, '█', emptyColor, bg);
      }
    }
  }

  // Dirty tracking
  markDirty(x, y) {
    if (!this.inBounds(x, y)) return;
    this.cells[y][x].dirty = true;
  }

  markRectDirty(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.markDirty(x + dx, y + dy);
      }
    }
  }

  clearDirtyFlags() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x].dirty = false;
      }
    }
  }

  getDirtyCells() {
    const dirtyCells = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].dirty) {
          dirtyCells.push({ x, y, cell: this.cells[y][x] });
        }
      }
    }
    return dirtyCells;
  }

  // Buffer management
  clone() {
    const cloned = new FrameBuffer(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        cloned.cells[y][x] = { ...this.cells[y][x] };
      }
    }
    return cloned;
  }

  swap(otherBuffer) {
    if (otherBuffer.width !== this.width || otherBuffer.height !== this.height) {
      throw new Error('Cannot swap buffers of different sizes');
    }
    const temp = this.cells;
    this.cells = otherBuffer.cells;
    otherBuffer.cells = temp;
  }
}
