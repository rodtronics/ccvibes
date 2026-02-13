// Layout Renderer - Converts JSON layouts to FrameBuffer operations
// This bridges the TUI Designer output with your game's rendering system

import { Palette } from './palette.js';

export const LayoutColors = {
    dim: Palette.DIM_GRAY,
    white: Palette.WHITE,
    gray: Palette.MID_GRAY,
    cyan: Palette.NEON_CYAN,
    pink: Palette.HOT_PINK,
    magenta: Palette.HOT_PINK,
    green: Palette.SUCCESS_GREEN,
    red: Palette.HEAT_RED,
    gold: Palette.BRIGHT_YELLOW,
    teal: Palette.TERMINAL_GREEN,
    blue: Palette.NEON_CYAN,
    amber: Palette.BRIGHT_YELLOW,
    brown: Palette.MID_GRAY,
    purple: Palette.HOT_PINK,
    orange: Palette.HEAT_RED,
    yellow: Palette.BRIGHT_YELLOW
};

export const LayoutGradients = {
    'cool': [Palette.NEON_CYAN, Palette.TERMINAL_GREEN, Palette.SUCCESS_GREEN],
    'warm': [Palette.HOT_PINK, Palette.HEAT_RED, Palette.BRIGHT_YELLOW],
    'heat': [Palette.HEAT_RED, Palette.BRIGHT_YELLOW, Palette.SUCCESS_GREEN],
    'cyber': [Palette.HOT_PINK, Palette.NEON_CYAN, Palette.TERMINAL_GREEN],
    // Add more as needed
};

export class LayoutRenderer {
    constructor(framebuffer) {
        this.buffer = framebuffer;
    }

    /**
     * Render a layout JSON to the framebuffer
     * @param {Object} layout - Layout definition from TUI designer
     * @param {number} offsetX - X offset for positioning
     * @param {number} offsetY - Y offset for positioning
     */
    render(layout, offsetX = 0, offsetY = 0) {
        if (!layout || !layout.lines) {
            console.warn('Invalid layout:', layout);
            return;
        }

        layout.lines.forEach((line, index) => {
            const y = (line.y !== undefined ? line.y : index) + offsetY;

            if (line.type === 'border') {
                this.renderBorder(line, y, offsetX);
            }
            else if (line.type === 'text') {
                this.renderText(line, y, offsetX);
            }
            else if (line.type === 'bar') {
                this.renderBar(line, y, offsetX);
            }
            else if (line.type === 'tabs') {
                this.renderTabs(line, y, offsetX);
            }
        });
    }

    renderBorder(line, y, offsetX) {
        const char = line.char || '─';
        const color = LayoutColors[line.color] || Palette.DIM_GRAY;

        const width = line.width || this.buffer.width;
        for (let x = 0; x < width; x++) {
            this.buffer.writeChar(x + offsetX, y, char, color, Palette.BLACK);
        }
    }

    renderText(line, y, offsetX) {
        let x = (line.x || 0) + offsetX;

        line.segments.forEach(seg => {
            const color = LayoutColors[seg.color] || Palette.WHITE;

            // For now, ignore gradients (they need special handling)
            // Just use the color or a default
            for (let i = 0; i < seg.text.length; i++) {
                this.buffer.writeChar(x + i, y, seg.text[i], color, Palette.BLACK);
            }
            x += seg.text.length;
        });
    }

    renderBar(line, y, offsetX) {
        const x = (line.x || 0) + offsetX;
        const width = line.width || 20;
        const fill = line.fill || 0.5;
        const filledCount = Math.floor(width * fill);

        const fullChar = line.fullChar || '#';
        const emptyChar = line.emptyChar || '-';

        for (let i = 0; i < width; i++) {
            const char = i < filledCount ? fullChar : emptyChar;
            const color = i < filledCount ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;
            this.buffer.writeChar(x + i, y, char, color, Palette.BLACK);
        }
    }

    renderTabs(line, y, offsetX) {
        let x = (line.x || 0) + offsetX;
        const separator = line.separator || '  ';

        line.items.forEach((item, idx) => {
            const color = LayoutColors[item.color] || Palette.MID_GRAY;

            for (let i = 0; i < item.text.length; i++) {
                this.buffer.writeChar(x + i, y, item.text[i], color, Palette.BLACK);
            }
            x += item.text.length;

            if (idx < line.items.length - 1) {
                for (let i = 0; i < separator.length; i++) {
                    this.buffer.writeChar(x + i, y, separator[i], Palette.DIM_GRAY, Palette.BLACK);
                }
                x += separator.length;
            }
        });
    }
}
