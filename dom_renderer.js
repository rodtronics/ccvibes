// Crime Committer VI - DOM Renderer
// Renders FrameBuffer to DOM using colored spans
// Read-only consumer of the frame buffer

export class DOMRenderer {
  constructor(buffer, containerId) {
    this.buffer = buffer;
    this.container = document.getElementById(containerId);
    this.cellEls = [];
    this.prevChar = [];
    this.prevFg = [];
    this.prevBg = [];
    this.prevPb = [];

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

    this.buildGrid();
  }

  buildGrid() {
    const width = this.buffer.width;
    const height = this.buffer.height;
    const fragment = document.createDocumentFragment();

    this.container.innerHTML = '';

    this.cellEls = new Array(width * height);
    this.prevChar = new Array(width * height);
    this.prevFg = new Array(width * height);
    this.prevBg = new Array(width * height);
    this.prevPb = new Array(width * height);

    let idx = 0;
    for (let y = 0; y < height; y++) {
      const rowEl = document.createElement('div');
      for (let x = 0; x < width; x++) {
        const cellEl = document.createElement('span');
        cellEl.className = 'c';
        cellEl.textContent = ' ';
        rowEl.appendChild(cellEl);

        this.cellEls[idx] = cellEl;
        this.prevChar[idx] = null;
        this.prevFg[idx] = null;
        this.prevBg[idx] = null;
        this.prevPb[idx] = null;
        idx++;
      }
      fragment.appendChild(rowEl);
    }

    this.container.appendChild(fragment);
  }

  render() {
    const width = this.buffer.width;
    const height = this.buffer.height;
    const cellEls = this.cellEls;
    const prevChar = this.prevChar;
    const prevFg = this.prevFg;
    const prevBg = this.prevBg;
    const prevPb = this.prevPb;

    let idx = 0;
    for (let y = 0; y < height; y++) {
      const row = this.buffer.cells[y];
      for (let x = 0; x < width; x++) {
        const cell = row[x];
        const char = cell.char || ' ';
        const fg = cell.fg || '';
        const bg = cell.bg || '';
        const pb = !!cell.progressBar;

        const el = cellEls[idx];

        if (prevChar[idx] !== char) {
          el.textContent = char;
          prevChar[idx] = char;
        }
        if (prevFg[idx] !== fg) {
          el.style.color = fg;
          prevFg[idx] = fg;
        }
        if (prevBg[idx] !== bg) {
          el.style.backgroundColor = bg;
          prevBg[idx] = bg;
        }
        if (prevPb[idx] !== pb) {
          el.className = pb ? 'c pb' : 'c';
          prevPb[idx] = pb;
        }

        idx++;
      }
    }

    this.buffer.clearDirtyFlags();
  }

  renderDirty() {
    this.render();
  }

  resize(width, height) {
    const nextWidth = width ?? this.buffer.width;
    const nextHeight = height ?? this.buffer.height;
    const expectedCells = nextWidth * nextHeight;

    if (this.cellEls.length !== expectedCells) {
      this.buildGrid();
      return;
    }

    if (nextWidth !== this.buffer.width || nextHeight !== this.buffer.height) {
      // Buffer dimensions changed but cells weren't rebuilt (or caller passed a mismatch).
      // Assume the buffer owner will update `buffer.cells` before the next render.
      this.buildGrid();
    }
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.cellEls = [];
    this.prevChar = [];
    this.prevFg = [];
    this.prevBg = [];
    this.prevPb = [];
  }
}
