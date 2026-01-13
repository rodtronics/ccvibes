/**
 * TuiRenderer - A lightweight ASCII rendering engine.
 * Manages a character buffer to draw boxes, text, and UI elements.
 */
export class TuiRenderer {
  constructor(containerId, width = 100, height = 30) {
    this.container = document.getElementById(containerId);
    this.width = width;
    this.height = height;
    this.buffer = [];
    this.fgBuffer = []; // Foreground colors
    this.bgBuffer = []; // Background colors
    this.clear();
  }

  /**
   * Resets the buffer to empty spaces and default colors.
   */
  clear() {
    this.buffer = Array(this.height)
      .fill()
      .map(() => Array(this.width).fill(" "));
    this.fgBuffer = Array(this.height)
      .fill()
      .map(() => Array(this.width).fill(null)); // null = default color
    this.bgBuffer = Array(this.height)
      .fill()
      .map(() => Array(this.width).fill(null)); // null = default transparent/black
  }

  /**
   * Draws a box with borders and an optional title.
   * styles: 'normal', 'double', 'bold'
   */
  drawBox(x, y, w, h, title = null, style = "normal", color = null) {
    const chars =
      {
        normal: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
        double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
        bold: { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃" },
      }[style] || chars.normal;

    // Draw Corners
    this.set(x, y, chars.tl, color);
    this.set(x + w - 1, y, chars.tr, color);
    this.set(x, y + h - 1, chars.bl, color);
    this.set(x + w - 1, y + h - 1, chars.br, color);

    // Draw Borders
    for (let i = 1; i < w - 1; i++) {
      this.set(x + i, y, chars.h, color);
      this.set(x + i, y + h - 1, chars.h, color);
    }
    for (let j = 1; j < h - 1; j++) {
      this.set(x, y + j, chars.v, color);
      this.set(x + w - 1, y + j, chars.v, color);
    }

    // Draw Title
    if (title) {
      this.write(x + 2, y, ` ${title} `, color);
    }
  }

  /**
   * Writes a string to the buffer at specific coordinates.
   */
  write(x, y, text, fg = null, bg = null) {
    if (y < 0 || y >= this.height) return;
    for (let i = 0; i < text.length; i++) {
      if (x + i >= 0 && x + i < this.width) {
        this.buffer[y][x + i] = text[i];
        if (fg !== undefined) this.fgBuffer[y][x + i] = fg;
        if (bg !== undefined) this.bgBuffer[y][x + i] = bg;
      }
    }
  }

  /**
   * Sets a single character in the buffer.
   */
  set(x, y, char, fg = null, bg = null) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = char;
      if (fg !== undefined) this.fgBuffer[y][x] = fg;
      if (bg !== undefined) this.bgBuffer[y][x] = bg;
    }
  }

  /**
   * Sets the style of a cell without changing the character.
   */
  setStyle(x, y, fg, bg) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (fg !== undefined) this.fgBuffer[y][x] = fg;
      if (bg !== undefined) this.bgBuffer[y][x] = bg;
    }
  }

  /**
   * Flushes the buffer to the DOM container using HTML spans for color.
   */
  render() {
    if (!this.container) return;
    
    let html = "";
    
    for (let y = 0; y < this.height; y++) {
      let currentRow = "";
      let currentFg = null;
      let currentBg = null;
      let spanOpen = false;

      for (let x = 0; x < this.width; x++) {
        const char = this.buffer[y][x];
        const fg = this.fgBuffer[y][x];
        const bg = this.bgBuffer[y][x];

        // If style changes, close previous span and open new one
        if (fg !== currentFg || bg !== currentBg) {
          if (spanOpen) {
            currentRow += "</span>";
            spanOpen = false;
          }

          if (fg || bg) {
            let styleStr = "";
            if (fg) styleStr += `color:${fg};`;
            if (bg) styleStr += `background-color:${bg};`;
            currentRow += `<span style="${styleStr}">`;
            spanOpen = true;
          }
          
          currentFg = fg;
          currentBg = bg;
        }

        // Escape HTML special chars
        if (char === "&") currentRow += "&amp;";
        else if (char === "<") currentRow += "&lt;";
        else if (char === ">") currentRow += "&gt;";
        else if (char === '"') currentRow += "&quot;";
        else if (char === "'") currentRow += "&#039;";
        else currentRow += char;
      }

      if (spanOpen) {
        currentRow += "</span>";
      }
      
      html += currentRow + "\n";
    }

    this.container.innerHTML = html;
  }
}
