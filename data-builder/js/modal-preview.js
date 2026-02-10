// Modal Preview Renderer
// Uses the game's actual rendering pipeline (FrameBuffer + DOMRenderer + parseModalContent)
// to show a pixel-perfect preview of how a modal will look in-game.

import { FrameBuffer } from '/engine/framebuffer.js';
import { DOMRenderer } from '/engine/dom_renderer.js';
import { Palette, BoxStyles } from '/engine/palette.js';
import { parseModalContent } from '/engine/modal.js';

const PREVIEW_WIDTH = 80;
const PREVIEW_HEIGHT = 25;

let previewBuffer = null;
let previewRenderer = null;

// Type-based styling defaults (must match modal.js getModal())
const typeStyles = {
  story:   { borderStyle: 'DOUBLE', borderColor: 'NEON_CYAN', backgroundColor: 'BLACK', titleColor: 'NEON_CYAN', bodyColor: 'LIGHT_GRAY' },
  lesson:  { borderStyle: 'SINGLE', borderColor: 'GOLD',     backgroundColor: 'BLACK', titleColor: 'GOLD',     bodyColor: 'LIGHT_GRAY' },
  lore:    { borderStyle: 'SINGLE', borderColor: 'PURPLE',   backgroundColor: 'BLACK', titleColor: 'PURPLE',   bodyColor: 'LIGHT_GRAY' },
  default: { borderStyle: 'DOUBLE', borderColor: 'NEON_CYAN', backgroundColor: 'BLACK', titleColor: 'NEON_CYAN', bodyColor: 'LIGHT_GRAY' },
};

/**
 * Initialize the preview renderer, attaching to a container element.
 * Call this once after the preview container div exists in the DOM.
 */
export function initPreview(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  previewBuffer = new FrameBuffer(PREVIEW_WIDTH, PREVIEW_HEIGHT);
  previewRenderer = new DOMRenderer(previewBuffer, containerId);
}

/**
 * Render a modal preview into the buffer.
 * @param {object} modal - The modal data object from the store (with id, title, body, type, borderStyle, borderColor, etc.)
 */
export function renderPreview(modal) {
  if (!previewBuffer || !previewRenderer) return;
  if (!modal) {
    previewBuffer.clear();
    previewRenderer.render();
    return;
  }

  // Resolve styles (same logic as modal.js getModal)
  const style = typeStyles[modal.type] || typeStyles.default;
  const borderStyleKey = modal.borderStyle || style.borderStyle;
  const borderColorKey = modal.borderColor || style.borderColor;
  const bgColorKey     = modal.backgroundColor || style.backgroundColor;
  const titleColorKey  = modal.titleColor || style.titleColor;
  const bodyColorKey   = modal.bodyColor || style.bodyColor;

  const borderStyle = BoxStyles[borderStyleKey] || BoxStyles.DOUBLE;
  const borderColor = Palette[borderColorKey] || Palette.NEON_CYAN;
  const bgColor     = Palette[bgColorKey] || Palette.BLACK;
  const titleColor  = Palette[titleColorKey] || Palette.NEON_CYAN;
  const bodyColor   = Palette[bodyColorKey] || Palette.LIGHT_GRAY;

  // Fill background
  previewBuffer.fill(' ', bodyColor, bgColor);

  // Draw border
  previewBuffer.drawBox(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT, borderStyle, borderColor, bgColor);

  let contentStartY = 1;

  // Title
  const title = (modal.title || '').trim();
  if (title) {
    const titleX = Math.floor((PREVIEW_WIDTH - title.length) / 2);
    previewBuffer.writeText(titleX, contentStartY, title, titleColor, bgColor);
    contentStartY += 2;
  }

  // Parse body content
  const contentWidth = PREVIEW_WIDTH - 4;
  const parsedLines = parseModalContent(modal.body || '', contentWidth, bgColor, bodyColor);

  // Draw content
  const contentHeight = PREVIEW_HEIGHT - contentStartY - 1;
  const visibleLines = parsedLines.slice(0, contentHeight);

  visibleLines.forEach((line, idx) => {
    const y = contentStartY + idx;
    let x = 2;
    line.segments.forEach(segment => {
      previewBuffer.writeText(x, y, segment.text, segment.fg, segment.bg);
      x += segment.text.length;
    });
  });

  if (modal.countdown) {
    const countdownText = 'AUTO-CLOSE IN 3s';
    const countdownX = Math.max(2, PREVIEW_WIDTH - countdownText.length - 2);
    previewBuffer.writeText(countdownX, PREVIEW_HEIGHT - 2, countdownText, Palette.BRIGHT_YELLOW, bgColor);
  }

  // Scrollbar indicator if content overflows
  if (parsedLines.length > contentHeight) {
    const scrollbarX = PREVIEW_WIDTH - 2;
    const ratio = contentHeight / parsedLines.length;
    const thumbSize = Math.max(1, Math.floor(contentHeight * ratio));
    for (let i = 0; i < contentHeight; i++) {
      const char = i < thumbSize ? '█' : '░';
      const color = i < thumbSize ? borderColor : Palette.DIM_GRAY;
      previewBuffer.setCell(scrollbarX, contentStartY + i, char, color, bgColor);
    }
  }

  previewRenderer.render();
}

/**
 * Destroy the preview renderer (cleanup).
 */
export function destroyPreview() {
  if (previewRenderer) {
    previewRenderer.destroy();
    previewRenderer = null;
  }
  previewBuffer = null;
}
