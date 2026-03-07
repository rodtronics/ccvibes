// Crime Committer VI - Frame Buffer
// Renderer-agnostic character buffer with unified cell structure
// Based on 05_rendering_engine.md

import { Palette, BoxStyles } from './palette.js';

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
          progressBar: false,  // Flag for CSS targeting of progress bar chars
        };
      }
    }
    return cells;
  }

  // Core cell operations
  setCell(x, y, char, fg, bg) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[y][x];
    const nextChar = char || ' ';
    const nextFg = fg || Palette.LIGHT_GRAY;
    const nextBg = bg || Palette.BLACK;

    if (cell.char === nextChar && cell.fg === nextFg && cell.bg === nextBg && cell.progressBar === false) {
      return;
    }

    cell.char = nextChar;
    cell.fg = nextFg;
    cell.bg = nextBg;
    cell.progressBar = false;
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

  writeTextRight(x, y, text, fg, bg) {
    if (!text) return;
    const str = this.normalizeText(String(text));
    const startX = x - str.length + 1;
    this.writeText(startX, y, str, fg, bg);
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
    if (y < 0 || y >= this.height || length <= 0) return;
    const lineChar = char || '─';
    const startX = Math.max(0, x);
    const endX = Math.min(this.width, x + length);
    for (let i = startX; i < endX; i++) {
      this.setCell(i, y, lineChar, fg, bg);
    }
  }

  drawVLine(x, y, length, char, fg, bg) {
    if (x < 0 || x >= this.width || length <= 0) return;
    const lineChar = char || '│';
    const startY = Math.max(0, y);
    const endY = Math.min(this.height, y + length);
    for (let i = startY; i < endY; i++) {
      this.setCell(x, i, lineChar, fg, bg);
    }
  }

  // Background-color progress bar with inline text
  // Filled portion uses fillBg as background; empty portion uses emptyBg.
  // text is written on top (fg = textColor) left-padded by 1 char, truncated to width.
  drawTextBar(x, y, width, percent, text, textColor, fillBg, emptyBg) {
    if (width < 1) return;

    const clampedPercent = Math.max(0, Math.min(1, percent));
    const filledWidth = Math.round(clampedPercent * width);
    const str = String(text || '').substring(0, width);

    for (let i = 0; i < width; i++) {
      const bg = i < filledWidth ? fillBg : emptyBg;
      const ch = i < str.length ? str[i] : ' ';
      this.setCell(x + i, y, ch, textColor, bg);
    }
  }

  // Dirty tracking
  clearDirtyFlags() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x].dirty = false;
      }
    }
  }

}
