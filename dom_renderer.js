// Crime Committer VI - DOM Renderer
// Renders FrameBuffer to DOM using colored spans
// Read-only consumer of the frame buffer

export class DOMRenderer {
  constructor(buffer, containerId) {
    this.buffer = buffer;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`Container element #${containerId} not found`);
    }

    this.init();
  }

  init() {
    // Clear container and set up structure
    this.container.innerHTML = '';
    // Font family is controlled by CSS classes (font-vga-9x8, font-vga-8x16, font-jetbrains-mono, etc.)
    // Let CSS control line-height so fonts can set their own vertical metrics
    this.container.style.whiteSpace = 'pre';
    this.container.style.overflow = 'hidden';
    this.container.style.backgroundColor = '#000000';
  }

  render() {
    // Full render: regenerate entire DOM from buffer
    let html = '';

    for (let y = 0; y < this.buffer.height; y++) {
      let row = '';
      let currentFg = null;
      let currentBg = null;
      let spanOpen = false;

      for (let x = 0; x < this.buffer.width; x++) {
        const cell = this.buffer.cells[y][x];
        const char = cell.char || ' ';
        const fg = cell.fg;
        const bg = cell.bg;

        // Check if we need to open/close/change span
        if (fg !== currentFg || bg !== currentBg) {
          // Close previous span if open
          if (spanOpen) {
            row += '</span>';
            spanOpen = false;
          }

          // Open new span with current colors
          if (fg || bg) {
            let style = '';
            if (fg) style += `color:${fg};`;
            if (bg) style += `background-color:${bg};`;
            row += `<span style="${style}">`;
            spanOpen = true;
          }

          currentFg = fg;
          currentBg = bg;
        }

        // Add the character in a fixed-width cell (ensures consistent spacing across all fonts)
        if (cell.progressBar) {
          row += `<span class="c pb">${this.escapeHtml(char)}</span>`;
        } else {
          row += `<span class="c">${this.escapeHtml(char)}</span>`;
        }
      }

      // Close any open span at end of row
      if (spanOpen) {
        row += '</span>';
      }

      html += row;
      if (y < this.buffer.height - 1) {
        html += '\n';
      }
    }

    this.container.innerHTML = html;
    this.buffer.clearDirtyFlags();
  }

  renderDirty() {
    // For initial implementation, just do full render
    // TODO: Optimize with dirty tracking in future
    this.render();
  }

  escapeHtml(char) {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  }

  resize(width, height) {
    // If buffer is resized externally, we don't need to do anything
    // The buffer will handle its own resize, we just render it
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
