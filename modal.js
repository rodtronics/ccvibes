// Crime Committer VI - Modal System
// Fullscreen info modals for intro, tutorials, story reveals, and unlock notifications

import { Palette, BoxStyles } from './palette.js';

// Modal data - loaded from JSON
let MODAL_DATA = null;

/**
 * Parse modal content with markdown-like formatting
 * Supports:
 * - **text** → Bold/bright (WHITE)
 * - ~~text~~ → Dim (DIM_GRAY)
 * - {{color}}text{{/}} → Colored text (any Palette color name, spans multiple lines)
 * - {{bg:color}}text{{/}} → Background color
 * - Blank lines → Line breaks
 * - Auto-wrapping to specified width
 *
 * @param {string} content - Raw content string
 * @param {number} width - Width to wrap text to
 * @returns {Array} Array of line objects: { segments: [{text, fg, bg}] }
 */
export function parseModalContent(content, width = 76) {
  // First, process multi-line color tags by joining lines until tags are closed
  const processedContent = processMultilineColorTags(content);

  const lines = [];
  const rawLines = processedContent.split('\n');

  for (const rawLine of rawLines) {
    // Empty lines become blank lines
    if (rawLine.trim() === '') {
      lines.push({ segments: [{ text: '', fg: Palette.LIGHT_GRAY, bg: Palette.BLACK }] });
      continue;
    }

    // Parse line into segments with formatting
    const segments = parseLineSegments(rawLine);

    // Wrap segments to width
    const wrappedLines = wrapSegments(segments, width);
    lines.push(...wrappedLines);
  }

  return lines;
}

/**
 * Process multi-line color tags by joining lines within tags
 * Converts: {{color}}\ntext\n{{/}} → {{color}}text{{/}}
 */
function processMultilineColorTags(content) {
  let result = '';
  let inTag = false;
  let tagOpen = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    // Check for opening tag
    if (!inTag && content.substr(i, 2) === '{{' && content.substr(i, 5) !== '{{/}}') {
      inTag = true;
      tagOpen = '{{';
      result += char;
    }
    // Check for closing tag
    else if (inTag && content.substr(i, 5) === '{{/}}') {
      inTag = false;
      result += content.substr(i, 5);
      i += 4; // Skip the rest of {{/}}
    }
    // Replace newlines inside tags with spaces
    else if (inTag && char === '\n') {
      result += ' ';
    }
    else {
      result += char;
    }
  }

  return result;
}

/**
 * Parse a single line into formatted segments
 */
function parseLineSegments(line) {
  const segments = [];
  let currentPos = 0;
  let currentFg = Palette.LIGHT_GRAY;
  let currentBg = Palette.BLACK;

  while (currentPos < line.length) {
    // Check for **bold**
    if (line.substr(currentPos, 2) === '**') {
      const endPos = line.indexOf('**', currentPos + 2);
      if (endPos !== -1) {
        const text = line.substring(currentPos + 2, endPos);
        segments.push({ text, fg: Palette.WHITE, bg: currentBg });
        currentPos = endPos + 2;
        continue;
      }
    }

    // Check for ~~dim~~
    if (line.substr(currentPos, 2) === '~~') {
      const endPos = line.indexOf('~~', currentPos + 2);
      if (endPos !== -1) {
        const text = line.substring(currentPos + 2, endPos);
        segments.push({ text, fg: Palette.DIM_GRAY, bg: currentBg });
        currentPos = endPos + 2;
        continue;
      }
    }

    // Check for {{color}} or {{bg:color}}
    if (line.substr(currentPos, 2) === '{{') {
      const endTagPos = line.indexOf('}}', currentPos + 2);
      if (endTagPos !== -1) {
        const tag = line.substring(currentPos + 2, endTagPos);
        const contentEndPos = line.indexOf('{{/}}', endTagPos + 2);

        if (contentEndPos !== -1) {
          const text = line.substring(endTagPos + 2, contentEndPos);

          // Check if it's a background color tag
          if (tag.startsWith('bg:')) {
            const colorName = tag.substring(3).toUpperCase();
            const bgColor = Palette[colorName] || currentBg;
            segments.push({ text, fg: currentFg, bg: bgColor });
          } else {
            // Foreground color
            const colorName = tag.toUpperCase();
            const fgColor = Palette[colorName] || currentFg;
            segments.push({ text, fg: fgColor, bg: currentBg });
          }

          currentPos = contentEndPos + 5; // Skip {{/}}
          continue;
        }
      }
    }

    // Regular character
    const nextSpecial = findNextSpecial(line, currentPos);
    const text = line.substring(currentPos, nextSpecial);
    if (text) {
      segments.push({ text, fg: currentFg, bg: currentBg });
    }
    currentPos = nextSpecial;
  }

  return segments;
}

/**
 * Find the next special formatting character
 */
function findNextSpecial(line, start) {
  const specials = ['**', '~~', '{{'];
  let nearest = line.length;

  for (const special of specials) {
    const pos = line.indexOf(special, start);
    if (pos !== -1 && pos < nearest) {
      nearest = pos;
    }
  }

  return nearest;
}

/**
 * Wrap segments to specified width, breaking on word boundaries
 * Preserves multiple spaces for ASCII art alignment
 */
function wrapSegments(segments, width) {
  const lines = [];
  let currentLine = [];
  let currentLength = 0;

  for (const segment of segments) {
    // Split preserving multiple spaces by using regex
    const parts = segment.text.split(/( +)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue; // Skip empty strings from split

      const isSpace = /^ +$/.test(part);
      const partLen = part.length;

      if (isSpace) {
        // Handle spaces: add them if they fit, otherwise wrap
        if (currentLength + partLen > width && currentLine.length > 0) {
          lines.push({ segments: currentLine });
          currentLine = [];
          currentLength = 0;
        }
        currentLine.push({ text: part, fg: segment.fg, bg: segment.bg });
        currentLength += partLen;
      } else {
        // Handle words: check if they fit
        if (currentLength + partLen > width && currentLine.length > 0) {
          lines.push({ segments: currentLine });
          currentLine = [];
          currentLength = 0;
        }
        currentLine.push({ text: part, fg: segment.fg, bg: segment.bg });
        currentLength += partLen;
      }
    }
  }

  // Add remaining line
  if (currentLine.length > 0) {
    lines.push({ segments: currentLine });
  } else if (lines.length === 0) {
    // Ensure at least one line
    lines.push({ segments: [{ text: '', fg: Palette.LIGHT_GRAY, bg: Palette.BLACK }] });
  }

  return lines;
}

/**
 * Load modal data from JSON
 */
export async function loadModalData() {
  try {
    const response = await fetch('data/modals.json');
    MODAL_DATA = await response.json();
    return MODAL_DATA;
  } catch (error) {
    console.error('Failed to load modal data:', error);
    return null;
  }
}

/**
 * Get a modal by ID
 */
export function getModal(modalId) {
  if (!MODAL_DATA) {
    console.warn('Modal data not loaded');
    return null;
  }

  const modal = MODAL_DATA.modals[modalId];
  if (!modal) {
    console.warn(`Modal not found: ${modalId}`);
    return null;
  }

  // Get the type configuration
  const type = MODAL_DATA.types[modal.type] || MODAL_DATA.types.default;

  return {
    id: modalId,
    content: modal.content,
    showOnce: modal.showOnce !== false, // Default to true
    borderStyle: BoxStyles[type.borderStyle] || BoxStyles.DOUBLE,
    borderColor: Palette[type.borderColor] || Palette.NEON_CYAN,
    backgroundColor: Palette[type.backgroundColor] || Palette.BLACK,
  };
}

/**
 * Queue for managing multiple modal displays
 */
export class ModalQueue {
  constructor() {
    this.queue = [];
    this.seenModals = this.loadSeenModals();
  }

  /**
   * Load list of modals that have been shown once
   */
  loadSeenModals() {
    try {
      const raw = localStorage.getItem('ccv_seen_modals');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save list of seen modals
   */
  saveSeenModals() {
    try {
      localStorage.setItem('ccv_seen_modals', JSON.stringify(this.seenModals));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Mark a modal as seen
   */
  markSeen(modalId) {
    if (!this.seenModals.includes(modalId)) {
      this.seenModals.push(modalId);
      this.saveSeenModals();
    }
  }

  /**
   * Check if a modal has been seen
   */
  hasSeen(modalId) {
    return this.seenModals.includes(modalId);
  }

  /**
   * Add a modal to the queue
   */
  enqueue(modalId, force = false) {
    const modal = getModal(modalId);
    if (!modal) return;

    // Check if should show based on showOnce setting
    if (modal.showOnce && this.hasSeen(modalId) && !force) {
      return;
    }

    // Don't add duplicates
    if (!this.queue.includes(modalId)) {
      this.queue.push(modalId);
    }
  }

  /**
   * Get next modal in queue
   */
  dequeue() {
    return this.queue.shift();
  }

  /**
   * Check if queue has modals
   */
  hasNext() {
    return this.queue.length > 0;
  }

  /**
   * Clear all queued modals
   */
  clear() {
    this.queue = [];
  }
}
