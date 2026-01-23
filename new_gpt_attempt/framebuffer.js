import { Gradients, lerpColor, Palette } from "./palette.js";

export const BoxStyles = {
  SINGLE: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
  },
};

export class FrameBuffer {
  constructor(width, height, defaultFg = Palette.LIGHT_GRAY, defaultBg = Palette.BLACK) {
    this.width = width;
    this.height = height;
    this.defaultFg = defaultFg;
    this.defaultBg = defaultBg;
    this.cells = [];
    this._init();
  }

  _init() {
    for (let y = 0; y < this.height; y += 1) {
      const row = [];
      for (let x = 0; x < this.width; x += 1) {
        row.push(this._makeCell(" ", this.defaultFg, this.defaultBg, true));
      }
      this.cells.push(row);
    }
  }

  _makeCell(char, fg, bg, dirty) {
    return { char, fg, bg, dirty };
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  setCell(x, y, char, fg = this.defaultFg, bg = this.defaultBg) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[y][x];
    if (cell.char === char && cell.fg === fg && cell.bg === bg) return;
    cell.char = char;
    cell.fg = fg;
    cell.bg = bg;
    cell.dirty = true;
  }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y][x];
  }

  clearCell(x, y) {
    this.setCell(x, y, " ", this.defaultFg, this.defaultBg);
  }

  fill(char = " ", fg = this.defaultFg, bg = this.defaultBg) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.setCell(x, y, char, fg, bg);
      }
    }
  }

  fillRect(x, y, w, h, char = " ", fg = this.defaultFg, bg = this.defaultBg) {
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        this.setCell(x + col, y + row, char, fg, bg);
      }
    }
  }

  clear() {
    this.fill(" ", this.defaultFg, this.defaultBg);
  }

  writeText(x, y, text, fg = this.defaultFg, bg = this.defaultBg) {
    if (!text) return;
    for (let i = 0; i < text.length; i += 1) {
      this.setCell(x + i, y, text[i], fg, bg);
    }
  }

  writeTextCentered(y, text, fg = this.defaultFg, bg = this.defaultBg) {
    const x = Math.max(0, Math.floor((this.width - text.length) / 2));
    this.writeText(x, y, text, fg, bg);
  }

  writeTextRight(x, y, text, fg = this.defaultFg, bg = this.defaultBg) {
    const startX = x - text.length + 1;
    this.writeText(startX, y, text, fg, bg);
  }

  drawHLine(x, y, length, char = "-", fg = this.defaultFg, bg = this.defaultBg) {
    for (let i = 0; i < length; i += 1) {
      this.setCell(x + i, y, char, fg, bg);
    }
  }

  drawVLine(x, y, length, char = "|", fg = this.defaultFg, bg = this.defaultBg) {
    for (let i = 0; i < length; i += 1) {
      this.setCell(x, y + i, char, fg, bg);
    }
  }

  drawBox(x, y, width, height, style = BoxStyles.SINGLE, fg = this.defaultFg, bg = this.defaultBg) {
    if (width < 2 || height < 2) return;
    const right = x + width - 1;
    const bottom = y + height - 1;
    this.setCell(x, y, style.topLeft, fg, bg);
    this.setCell(right, y, style.topRight, fg, bg);
    this.setCell(x, bottom, style.bottomLeft, fg, bg);
    this.setCell(right, bottom, style.bottomRight, fg, bg);
    this.drawHLine(x + 1, y, width - 2, style.horizontal, fg, bg);
    this.drawHLine(x + 1, bottom, width - 2, style.horizontal, fg, bg);
    this.drawVLine(x, y + 1, height - 2, style.vertical, fg, bg);
    this.drawVLine(right, y + 1, height - 2, style.vertical, fg, bg);
  }

  drawGradientText(x, y, text, gradientName, bg = this.defaultBg, alignment = "left") {
    if (!text) return;
    const gradient = Gradients[gradientName];
    if (!gradient) {
      this.writeText(x, y, text, this.defaultFg, bg);
      return;
    }
    let startX = x;
    if (alignment === "center") {
      startX = x - Math.floor(text.length / 2);
    } else if (alignment === "right") {
      startX = x - text.length + 1;
    }
    const colors = this._getGradientColors(text.length, gradient);
    for (let i = 0; i < text.length; i += 1) {
      this.setCell(startX + i, y, text[i], colors[i], bg);
    }
  }

  _getGradientColors(length, gradient) {
    if (length <= 1) return [gradient[0]];
    const result = [];
    const segments = gradient.length - 1;
    for (let i = 0; i < length; i += 1) {
      const t = i / (length - 1);
      const seg = Math.min(segments - 1, Math.floor(t * segments));
      const localT = (t * segments) - seg;
      const color = lerpColor(gradient[seg], gradient[seg + 1], localT);
      result.push(color);
    }
    return result;
  }

  markDirty(x, y) {
    const cell = this.getCell(x, y);
    if (cell) cell.dirty = true;
  }

  clearDirtyFlags() {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.cells[y][x].dirty = false;
      }
    }
  }

  getDirtyCells() {
    const dirty = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const cell = this.cells[y][x];
        if (cell.dirty) dirty.push({ x, y, cell });
      }
    }
    return dirty;
  }
}

export class Panel {
  constructor(buffer, x, y, width, height) {
    this.buffer = buffer;
    this.bounds = { x, y, width, height };
  }

  inBounds(x, y) {
    return x >= 0 && x < this.bounds.width && y >= 0 && y < this.bounds.height;
  }

  write(x, y, text, fg, bg) {
    if (!this.inBounds(x, y)) return;
    this.buffer.writeText(this.bounds.x + x, this.bounds.y + y, text, fg, bg);
  }

  setCell(x, y, char, fg, bg) {
    if (!this.inBounds(x, y)) return;
    this.buffer.setCell(this.bounds.x + x, this.bounds.y + y, char, fg, bg);
  }

  clear(char = " ", fg = Palette.LIGHT_GRAY, bg = Palette.BLACK) {
    this.buffer.fillRect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height, char, fg, bg);
  }
}
