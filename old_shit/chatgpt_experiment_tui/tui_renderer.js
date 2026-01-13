export class TuiRenderer {
  constructor(containerId, width = 110, height = 38) {
    this.container = document.getElementById(containerId);
    this.width = width;
    this.height = height;
    this.buffer = [];
    this.fgBuffer = [];
    this.bgBuffer = [];
    this.clear();
  }

  clear(fillChar = " ") {
    this.buffer = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => fillChar)
    );
    this.fgBuffer = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => null)
    );
    this.bgBuffer = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => null)
    );
  }

  set(x, y, char, fg = null, bg = null) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.buffer[y][x] = char;
    this.fgBuffer[y][x] = fg;
    this.bgBuffer[y][x] = bg;
  }

  write(x, y, text, fg = null, bg = null) {
    if (y < 0 || y >= this.height) return;
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx < 0 || cx >= this.width) continue;
      this.buffer[y][cx] = text[i];
      this.fgBuffer[y][cx] = fg;
      this.bgBuffer[y][cx] = bg;
    }
  }

  drawBox(x, y, w, h, title = "", style = "thin", color = null, bg = null) {
    const palettes = {
      thin: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" },
      heavy: { tl: "+", tr: "+", bl: "+", br: "+", h: "=", v: "|" }
    };
    const chars = palettes[style] || palettes.thin;

    // Corners
    this.set(x, y, chars.tl, color, bg);
    this.set(x + w - 1, y, chars.tr, color, bg);
    this.set(x, y + h - 1, chars.bl, color, bg);
    this.set(x + w - 1, y + h - 1, chars.br, color, bg);

    // Horizontal edges
    for (let i = 1; i < w - 1; i++) {
      this.set(x + i, y, chars.h, color, bg);
      this.set(x + i, y + h - 1, chars.h, color, bg);
    }

    // Vertical edges
    for (let j = 1; j < h - 1; j++) {
      this.set(x, y + j, chars.v, color, bg);
      this.set(x + w - 1, y + j, chars.v, color, bg);
    }

    if (title) {
      const safeTitle = ` ${title} `;
      this.write(x + 2, y, safeTitle.slice(0, Math.max(0, w - 4)), color, bg);
    }
  }

  drawDivider(x, y, length, label = "", color = "#444", bg = null) {
    const text = label ? `-- ${label} ` : "";
    this.write(x, y, text, color, bg);
    const remaining = Math.max(0, length - text.length);
    this.write(x + text.length, y, "-".repeat(remaining), color, bg);
  }

  drawProgress(x, y, width, pct, color = "#0f0", bg = null) {
    const clamped = Math.max(0, Math.min(1, pct));
    const inner = Math.max(0, width - 2);
    const filled = Math.round(inner * clamped);
    const bar =
      "[" + "#".repeat(filled).padEnd(inner, ".") + "] " + String(Math.floor(clamped * 100)).padStart(3, " ") + "%";
    this.write(x, y, bar.slice(0, width), color, bg);
  }

  render() {
    if (!this.container) return;
    let html = "";

    for (let y = 0; y < this.height; y++) {
      let row = "";
      let currentFg = null;
      let currentBg = null;
      let spanOpen = false;

      for (let x = 0; x < this.width; x++) {
        const ch = this.buffer[y][x];
        const fg = this.fgBuffer[y][x];
        const bg = this.bgBuffer[y][x];

        if (fg !== currentFg || bg !== currentBg) {
          if (spanOpen) {
            row += "</span>";
            spanOpen = false;
          }
          if (fg || bg) {
            let style = "";
            if (fg) style += `color:${fg};`;
            if (bg) style += `background-color:${bg};`;
            row += `<span style="${style}">`;
            spanOpen = true;
          }
          currentFg = fg;
          currentBg = bg;
        }

        row += this.escape(ch);
      }

      if (spanOpen) row += "</span>";
      if (y < this.height - 1) row += "\n";
      html += row;
    }

    this.container.innerHTML = html;
  }

  escape(ch) {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    if (ch === "'") return "&#39;";
    return ch;
  }
}
