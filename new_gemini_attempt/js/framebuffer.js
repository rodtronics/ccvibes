import { Palette, BoxStyles } from './constants.js';

export class FrameBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cells = [];
        this.initCells();
    }

    initCells() {
        for (let y = 0; y < this.height; y++) {
            this.cells[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.cells[y][x] = {
                    char: ' ',
                    fg: Palette.LIGHT_GRAY,
                    bg: Palette.BLACK,
                    dirty: true
                };
            }
        }
    }

    setCell(x, y, char, fg, bg) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        
        const cell = this.cells[y][x];
        if (cell.char !== char || cell.fg !== fg || cell.bg !== bg) {
            cell.char = char;
            cell.fg = fg;
            cell.bg = bg;
            cell.dirty = true;
        }
    }

    fill(char, fg, bg) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.setCell(x, y, char, fg, bg);
            }
        }
    }

    fillRect(x, y, w, h, char, fg, bg) {
        for (let iy = y; iy < y + h; iy++) {
            for (let ix = x; ix < x + w; ix++) {
                this.setCell(ix, iy, char, fg, bg);
            }
        }
    }

    writeText(x, y, text, fg, bg) {
        for (let i = 0; i < text.length; i++) {
            this.setCell(x + i, y, text[i], fg, bg);
        }
    }

    writeTextCentered(y, text, fg, bg) {
        const x = Math.floor((this.width - text.length) / 2);
        this.writeText(x, y, text, fg, bg);
    }
    
    writeTextRight(x, y, text, fg, bg) {
        const startX = x - text.length + 1;
        this.writeText(startX, y, text, fg, bg);
    }

    drawBox(x, y, width, height, style, fg, bg) {
        // Corners
        this.setCell(x, y, style.topLeft, fg, bg);
        this.setCell(x + width - 1, y, style.topRight, fg, bg);
        this.setCell(x, y + height - 1, style.bottomLeft, fg, bg);
        this.setCell(x + width - 1, y + height - 1, style.bottomRight, fg, bg);

        // Edges
        for (let i = 1; i < width - 1; i++) {
            this.setCell(x + i, y, style.horizontal, fg, bg);
            this.setCell(x + i, y + height - 1, style.horizontal, fg, bg);
        }
        for (let i = 1; i < height - 1; i++) {
            this.setCell(x, y + i, style.vertical, fg, bg);
            this.setCell(x + width - 1, y + i, style.vertical, fg, bg);
        }
    }
    
    drawHLine(x, y, length, char, fg, bg) {
        for(let i=0; i<length; i++) {
            this.setCell(x + i, y, char, fg, bg);
        }
    }
    
    drawVLine(x, y, length, char, fg, bg) {
        for(let i=0; i<length; i++) {
            this.setCell(x, y + i, char, fg, bg);
        }
    }

    clearDirtyFlags() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.cells[y][x].dirty = false;
            }
        }
    }
}
