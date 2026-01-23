export class DOMGridRenderer {
  constructor(buffer, targetElement) {
    this.buffer = buffer;
    this.target = targetElement;
    this.cells = [];
    this.init();
  }

  init() {
    this.target.innerHTML = "";
    this.cells = [];
    const frag = document.createDocumentFragment();
    for (let y = 0; y < this.buffer.height; y += 1) {
      for (let x = 0; x < this.buffer.width; x += 1) {
        const span = document.createElement("span");
        span.className = "cell";
        span.textContent = " ";
        frag.appendChild(span);
        if (!this.cells[y]) this.cells[y] = [];
        this.cells[y][x] = span;
      }
    }
    this.target.appendChild(frag);
  }

  render() {
    const dirty = [];
    for (let y = 0; y < this.buffer.height; y += 1) {
      for (let x = 0; x < this.buffer.width; x += 1) {
        dirty.push({ x, y, cell: this.buffer.getCell(x, y) });
      }
    }
    this._renderCells(dirty);
  }

  renderDirty() {
    const dirty = this.buffer.getDirtyCells();
    this._renderCells(dirty);
  }

  _renderCells(cells) {
    for (const entry of cells) {
      const { x, y, cell } = entry;
      if (!cell) continue;
      const span = this.cells[y][x];
      span.textContent = cell.char;
      span.style.color = cell.fg;
      span.style.backgroundColor = cell.bg;
    }
  }
}
