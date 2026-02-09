// Crime Committer VI - Boot Screen
// 286-style POST screen shown during loading

import { Palette } from './palette.js';

const HEADER_COLOR = Palette.NEON_CYAN;
const LABEL_COLOR = Palette.LIGHT_GRAY;
const VALUE_COLOR = Palette.WHITE;
const OK_COLOR = Palette.TERMINAL_GREEN;
const DOT_COLOR = Palette.DIM_GRAY;
const DOT_COLUMN = 38; // Column where dots end and "OK" begins

export class BootScreen {
  constructor(buffer) {
    this.buffer = buffer;
    this.currentLine = 0;
  }

  drawHeader() {
    const b = this.buffer;
    b.clear();

    // BIOS banner
    b.writeText(1, 0, 'CCVI BIOS v6.0', HEADER_COLOR);

    // Hardware info
    b.writeText(1, 2, 'Main Processor', LABEL_COLOR);
    b.writeText(16, 2, ': MOS 6502 @ 1MHz', VALUE_COLOR);

    b.writeText(1, 3, 'Video', LABEL_COLOR);
    b.writeText(16, 3, ': TUI 80x25 Color', VALUE_COLOR);

    b.writeText(1, 4, 'Memory', LABEL_COLOR);
    b.writeText(16, 4, ': 640K', VALUE_COLOR);
    b.writeText(23, 4, 'OK', OK_COLOR);

    // Loading section header
    b.writeText(1, 6, 'Loading system files...', LABEL_COLOR);

    this.currentLine = 8;
  }

  addProgress(label) {
    const b = this.buffer;
    const y = this.currentLine;
    const x = 3;

    // Write label
    b.writeText(x, y, label, LABEL_COLOR);

    // Fill dots from end of label to DOT_COLUMN
    const dotsStart = x + label.length + 1;
    for (let i = dotsStart; i < DOT_COLUMN; i++) {
      b.writeText(i, y, '.', DOT_COLOR);
    }

    // Write OK
    b.writeText(DOT_COLUMN + 1, y, 'OK', OK_COLOR);

    this.currentLine++;
  }

  drawComplete() {
    const b = this.buffer;
    b.writeText(1, this.currentLine + 1, 'All systems nominal.', OK_COLOR);
  }
}
