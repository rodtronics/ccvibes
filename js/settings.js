// Crime Committer VI - Settings Management
// Handles font settings, zoom, bloom effects, and localStorage persistence

const BLOOM_OVERLAY_ID = 'bloom-overlay';

// Settings constants
export const FONTS = ['fira', 'vga-9x8', 'vga-8x16', 'jetbrains-mono', 'ibm-bios', 'commodore-64', 'scp', 'courier-prime', 'vt323', 'share-tech-mono', 'nova-mono', 'doto', 'workbench'];
const FONT_CLASSES = [...FONTS];
export const FONT_CATEGORIES = {
  modern: ['fira', 'jetbrains-mono', 'scp'],
  retro: ['vga-9x8', 'vga-8x16', 'ibm-bios', 'commodore-64'],
  other: ['courier-prime', 'vt323', 'share-tech-mono', 'nova-mono', 'doto', 'workbench']
};

export const MIN_ZOOM = 100; // %
export const MAX_ZOOM = 300; // %
export const ZOOM_STEP = 50; // %

export const GRID_HEIGHTS = [43, 55];
export const FPS_OPTIONS = [1, 2, 5, 10, 20, 30, 60, 120, 240];
export const FPS_TO_MS = {
  1: 1000,
  2: 500,
  5: 200,
  10: 100,
  20: 50,
  30: 33,
  60: 16,
  120: 8,
  240: 4
};

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function getFontCategory(fontId) {
  if (FONT_CATEGORIES.modern.includes(fontId)) return 'modern';
  if (FONT_CATEGORIES.other.includes(fontId)) return 'other';
  return 'retro';
}

// Load settings from localStorage with defaults
export function loadSettings() {
  const defaults = {
    font: 'fira',
    gradients: false,    // Always off (removed from options)
    hotkeyGlow: false,   // Always off (removed from options)
    bloom: false,
    funnyNames: false,
    allCaps: true,       // Always on (removed from options)
    zoom: 150, // Font size zoom percentage (100, 150, 200, 250, etc.)
    showIntro: true,     // Show intro modal on launch
    skipTutorials: false, // Skip tutorial and story modals
    authenticBoot: false, // Slow boot with DOS CLI prompt every time
    fps: 60, // Active frame rate (20/30/60/120/240)
    gridHeight: 43, // Vertical resolution (43 or 55 rows)
  };

  try {
    const raw = localStorage.getItem('ccv_tui_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old font settings
      if (parsed.font === 'vga') parsed.font = 'vga-9x8';
      if (parsed.fontScale && !parsed.zoom) parsed.zoom = Math.round(parsed.fontScale * 100);
      if (parsed.zoom && parsed.zoom < MIN_ZOOM) parsed.zoom = MIN_ZOOM;

      // Validate FPS
      if (parsed.fps && !FPS_OPTIONS.includes(parsed.fps)) {
        parsed.fps = 60; // Default to 60 if invalid
      }

      // Validate gridHeight (coerce string→number, clamp to allowed values)
      const gh = parseInt(parsed.gridHeight, 10);
      if (!GRID_HEIGHTS.includes(gh)) {
        parsed.gridHeight = 43;
      } else {
        parsed.gridHeight = gh;
      }

      // Merge with defaults to ensure new settings exist
      const loaded = { ...defaults, ...parsed };
      console.log('Settings loaded:', loaded);
      return loaded;
    }
  } catch (err) {
    console.warn('Settings load failed', err);
  }
  console.log('Using default settings:', defaults);
  return defaults;
}

// Save settings to localStorage
export function saveSettings(settings) {
  try {
    localStorage.setItem('ccv_tui_settings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
  } catch (err) {
    console.warn('Settings save failed', err);
  }
}

// Apply font and zoom settings to DOM
export function applyFont(settings) {
  const container = document.getElementById('game');
  if (!container) return;
  const overlay = document.getElementById(BLOOM_OVERLAY_ID);
  const targets = overlay ? [container, overlay] : [container];

  // Remove all font classes
  const nextFont = FONTS.includes(settings.font) ? settings.font : 'fira';
  settings.font = nextFont;

  // Scale the font size via CSS
  const zoom = clamp(settings.zoom || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  settings.zoom = zoom;
  targets.forEach((target) => {
    FONT_CLASSES.forEach(font => target.classList.remove(`font-${font}`));
    target.classList.add(`font-${nextFont}`);
    target.style.fontSize = `${zoom}%`;
  });

  // Bloom-style overlay (separate element)
  applyBloom(settings);
}

// Cycle font within current category
export function cycleFontSetting(settings, direction = 1) {
  const currentFont = settings.font;
  const category = getFontCategory(currentFont);
  const fonts = FONT_CATEGORIES[category];

  const currentIndex = fonts.indexOf(currentFont);
  // Calculate next index with wrap-around
  let nextIndex = (currentIndex + direction) % fonts.length;
  if (nextIndex < 0) nextIndex = fonts.length - 1;

  settings.font = fonts[nextIndex];
  console.log(`Font cycled to: ${settings.font} (Category: ${category})`);
  applyFont(settings);
  saveSettings(settings);
}

// Switch between modern and retro font categories
export function switchFontCategory(settings) {
  const currentFont = settings.font;
  const currentCategory = getFontCategory(currentFont);
  const categories = ['modern', 'retro', 'other'];
  const currentIndex = categories.indexOf(currentCategory);
  const nextIndex = (currentIndex + 1) % categories.length;
  const nextCategory = categories[nextIndex];

  // Pick the first font of the new category
  settings.font = FONT_CATEGORIES[nextCategory][0];
  console.log(`Font category switched to: ${nextCategory}, Font: ${settings.font}`);
  applyFont(settings);
  saveSettings(settings);
}

// Apply or remove bloom effect
export function applyBloom(settings) {
  const overlay = document.getElementById(BLOOM_OVERLAY_ID);
  if (!overlay) return;
  overlay.style.display = settings.bloom ? 'block' : 'none';
}

// Cycle FPS setting (clamped, no wrap-around)
export function cycleFpsSetting(settings, direction = 1) {
  const currentIndex = FPS_OPTIONS.indexOf(settings.fps);
  const nextIndex = currentIndex + direction;

  // Clamp to valid range (no wrap-around)
  if (nextIndex < 0 || nextIndex >= FPS_OPTIONS.length) {
    return; // Already at the end, do nothing
  }

  settings.fps = FPS_OPTIONS[nextIndex];
  console.log(`FPS changed to: ${settings.fps}`);
  saveSettings(settings);
}
