// Modal Preview Renderer
// Uses the game's rendering stack to preview modal layout and style settings.

import { FrameBuffer } from '/engine/js/framebuffer.js';
import { DOMRenderer } from '/engine/js/dom_renderer.js';
import { Palette, BoxStyles } from '/engine/js/palette.js';
import { parseModalContent } from '/engine/js/modal.js';

const PREVIEW_WIDTH = 80;
const PREVIEW_HEIGHT = 25;

let previewBuffer = null;
let previewRenderer = null;

// Type-based styling defaults (must match modal.js getModal()).
const typeStyles = {
  story: { borderStyle: 'DOUBLE', borderColor: 'NEON_CYAN', backgroundColor: 'BLACK', titleColor: 'NEON_CYAN', bodyColor: 'LIGHT_GRAY' },
  lesson: { borderStyle: 'SINGLE', borderColor: 'GOLD', backgroundColor: 'BLACK', titleColor: 'GOLD', bodyColor: 'LIGHT_GRAY' },
  lore: { borderStyle: 'SINGLE', borderColor: 'PURPLE', backgroundColor: 'BLACK', titleColor: 'PURPLE', bodyColor: 'LIGHT_GRAY' },
  default: { borderStyle: 'DOUBLE', borderColor: 'NEON_CYAN', backgroundColor: 'BLACK', titleColor: 'NEON_CYAN', bodyColor: 'LIGHT_GRAY' },
};

export function initPreview(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  previewBuffer = new FrameBuffer(PREVIEW_WIDTH, PREVIEW_HEIGHT);
  previewRenderer = new DOMRenderer(previewBuffer, containerId);
}

export function renderPreview(modal) {
  if (!previewBuffer || !previewRenderer) return;
  if (!modal) {
    previewBuffer.clear();
    previewRenderer.render();
    return;
  }

  const style = typeStyles[modal.type] || typeStyles.default;
  const borderStyleKey = modal.borderStyle || style.borderStyle;
  const borderColorKey = modal.borderColor || style.borderColor;
  const bgColorKey = modal.backgroundColor || style.backgroundColor;
  const titleColorKey = modal.titleColor || style.titleColor;
  const bodyColorKey = modal.bodyColor || style.bodyColor;

  const borderStyle = BoxStyles[borderStyleKey] || BoxStyles.DOUBLE;
  const borderColor = Palette[borderColorKey] || Palette.NEON_CYAN;
  const bgColor = Palette[bgColorKey] || Palette.BLACK;
  const titleColor = Palette[titleColorKey] || Palette.NEON_CYAN;
  const bodyColor = Palette[bodyColorKey] || Palette.LIGHT_GRAY;

  const defaultLayout = modal.id === 'intro' ? 'fullscreen' : 'centered';
  const defaultOverlay = modal.id === 'intro' ? 'blackout' : 'dim50';
  const layout = modal.layout === 'fullscreen' ? 'fullscreen' : (modal.layout === 'centered' ? 'centered' : defaultLayout);
  const overlay = modal.overlay === 'blackout' ? 'blackout' : (modal.overlay === 'dim50' ? 'dim50' : defaultOverlay);

  const parsedWidth = Number.parseInt(modal.contentWidth, 10);
  const rawWidth = Number.isFinite(parsedWidth) ? parsedWidth : 76;
  const textWidth = Math.max(24, Math.min(rawWidth, PREVIEW_WIDTH - 4));
  const textX = Math.floor((PREVIEW_WIDTH - textWidth) / 2);
  const title = (modal.title || '').trim();
  const hasTitle = !!title;
  const parsedLines = parseModalContent(modal.body || '', textWidth, bgColor, bodyColor);

  const boxW = layout === 'fullscreen' ? PREVIEW_WIDTH : Math.min(PREVIEW_WIDTH - 4, textWidth + 4);
  let boxH = PREVIEW_HEIGHT;
  if (layout === 'centered') {
    const chromeRows = hasTitle ? 4 : 2;
    const minCenteredBoxH = hasTitle ? 10 : 8;
    const maxCenteredBoxH = Math.max(minCenteredBoxH, PREVIEW_HEIGHT - 4);
    const maxBodyRows = Math.max(3, maxCenteredBoxH - chromeRows);
    const desiredBodyRows = Math.max(3, Math.min(parsedLines.length || 1, maxBodyRows));
    boxH = Math.max(minCenteredBoxH, desiredBodyRows + chromeRows);
  }
  const boxX = layout === 'fullscreen' ? 0 : Math.floor((PREVIEW_WIDTH - boxW) / 2);
  const boxY = layout === 'fullscreen' ? 0 : Math.floor((PREVIEW_HEIGHT - boxH) / 2);

  if (layout === 'fullscreen' || overlay === 'blackout') {
    previewBuffer.fill(' ', bodyColor, Palette.BLACK);
  } else {
    drawBackdropScene();
    applyDimOverlay(0.5);
  }

  previewBuffer.fillRect(
    boxX + 1,
    boxY + 1,
    Math.max(0, boxW - 2),
    Math.max(0, boxH - 2),
    ' ',
    bodyColor,
    bgColor
  );
  previewBuffer.drawBox(boxX, boxY, boxW, boxH, borderStyle, borderColor, bgColor);

  let contentStartY = boxY + 1;

  if (hasTitle) {
    const centeredTitleX = textX + Math.floor((textWidth - title.length) / 2);
    const minTitleX = boxX + 2;
    const maxTitleX = boxX + boxW - title.length - 2;
    const titleX = Math.max(minTitleX, Math.min(maxTitleX, centeredTitleX));
    previewBuffer.writeText(titleX, contentStartY, title, titleColor, bgColor);
    contentStartY += 2;
  }

  const contentBottomY = boxY + boxH - 2;
  const contentHeight = Math.max(1, contentBottomY - contentStartY + 1);
  const visibleLines = parsedLines.slice(0, contentHeight);

  visibleLines.forEach((line, idx) => {
    const y = contentStartY + idx;
    let x = textX;
    line.segments.forEach((segment) => {
      previewBuffer.writeText(x, y, segment.text, segment.fg, segment.bg);
      x += segment.text.length;
    });
  });

  if (modal.countdown) {
    const countdownText = 'CAN CLOSE IN 3s';
    const countdownX = Math.max(boxX + 2, boxX + boxW - countdownText.length - 2);
    previewBuffer.writeText(countdownX, contentBottomY, countdownText, Palette.BRIGHT_YELLOW, bgColor);
  }

  if (parsedLines.length > contentHeight) {
    const scrollbarX = boxX + boxW - 2;
    const thumbSize = Math.max(1, Math.floor((contentHeight * contentHeight) / parsedLines.length));
    for (let i = 0; i < contentHeight; i++) {
      const isThumb = i < thumbSize;
      const char = isThumb ? '#' : '|';
      const color = isThumb ? borderColor : Palette.DIM_GRAY;
      previewBuffer.setCell(scrollbarX, contentStartY + i, char, color, bgColor);
    }
  }

  previewRenderer.render();
}

function drawBackdropScene() {
  previewBuffer.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);
  previewBuffer.writeText(1, 0, 'CRIME COMMITTER VI - PREVIEW', Palette.NEON_CYAN, Palette.BLACK);
  previewBuffer.writeText(PREVIEW_WIDTH - 10, 0, '12:34:56', Palette.MID_GRAY, Palette.BLACK);
  previewBuffer.drawBox(0, 2, PREVIEW_WIDTH, PREVIEW_HEIGHT - 2, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
  previewBuffer.writeText(2, 4, '[1] QUICK GRAB', Palette.LIGHT_GRAY, Palette.BLACK);
  previewBuffer.writeText(2, 6, '[2] HOTWIRE SEDAN', Palette.LIGHT_GRAY, Palette.BLACK);
  previewBuffer.writeText(2, 8, '[3] DOCKSIDE LIFT', Palette.LIGHT_GRAY, Palette.BLACK);
  previewBuffer.writeText(PREVIEW_WIDTH - 14, 4, 'HEAT 26', Palette.HEAT_ORANGE, Palette.BLACK);
}

function applyDimOverlay(factor = 0.5) {
  const clamped = Math.max(0, Math.min(1, factor));
  for (let y = 0; y < PREVIEW_HEIGHT; y++) {
    for (let x = 0; x < PREVIEW_WIDTH; x++) {
      const cell = previewBuffer.cells[y][x];
      if (!cell) continue;
      cell.fg = dimHexColor(cell.fg, clamped);
      cell.bg = dimHexColor(cell.bg, clamped);
      cell.dirty = true;
    }
  }
}

function dimHexColor(color, factor) {
  if (typeof color !== 'string') return color;
  const match = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!match) return color;

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const scale = 1 - factor;

  const nr = Math.max(0, Math.min(255, Math.round(r * scale)));
  const ng = Math.max(0, Math.min(255, Math.round(g * scale)));
  const nb = Math.max(0, Math.min(255, Math.round(b * scale)));
  const toHex = (n) => n.toString(16).padStart(2, '0');

  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function destroyPreview() {
  if (previewRenderer) {
    previewRenderer.destroy();
    previewRenderer = null;
  }
  previewBuffer = null;
}
