// Crime Committer VI - Color Palette
// Single source of truth for all colors used in the game
// Based on 02_ui_spec.md color palette section
//
// Derivation policy:
//   Base/anchor colours are hardcoded. Variant colours (selected states,
//   dim versions, etc.) are computed via filmicAdjust() from gradients.js
//   wherever possible, so the relationship is explicit rather than two
//   independent magic numbers. The filmic curve desaturates toward white
//   on brightening and toward black on darkening, matching how film handles
//   exposure rather than naive channel clamping.

import { filmicBrighten } from './gradients.js';

// ── Run bar base colours (anchors — do not derive these) ──────────────────────
const _RUN_FILL  = '#7a5200'; // active run bar, filled portion
const _RUN_DONE  = '#005500'; // completed run bar, filled portion
const _RUN_EMPTY = '#111111'; // any run bar, unfilled portion

// Stops to brighten when a row is selected. Single constant so all three
// selected variants are produced by the same operation.
const SEL_STOPS = 1.3;

export const Palette = {
  // ── Primary reference palette (0002.png) ──────────────────────────────────
  // Standard 5-stop spectrum: red → orange → yellow → green → blue
  // These are artistic anchors — derive UI colours from these where possible.
  P_RED:    '#cc2200',
  P_ORANGE: '#e86000',
  P_YELLOW: '#f0c000',
  P_GREEN:  '#22aa30',
  P_BLUE:   '#3388d8',

  // ── Secondary reference palette (0001.png) ────────────────────────────────
  // Warm sunset 5-stop: purple → hot-pink → salmon → orange → yellow
  S_PURPLE: '#9030b0',
  S_PINK:   '#e030a0',
  S_SALMON: '#ea6570',
  S_ORANGE: '#ec8030',
  S_YELLOW: '#f5d020',

  // ── Run card bar colours ──────────────────────────────────────────────────
  // Base values above; selected variants derived via filmicBrighten.
  RUN_FILL:      _RUN_FILL,
  RUN_FILL_SEL:  filmicBrighten(_RUN_FILL,  SEL_STOPS),
  RUN_DONE:      _RUN_DONE,
  RUN_DONE_SEL:  filmicBrighten(_RUN_DONE,  SEL_STOPS),
  RUN_EMPTY:     _RUN_EMPTY,
  RUN_EMPTY_SEL: filmicBrighten(_RUN_EMPTY, SEL_STOPS * 1.5), // near-black needs more stops to shift visibly
  TEXT_SUBDUE:   '#dddddd', // one step below WHITE; hand-tuned

  // ── Intro / branding ──────────────────────────────────────────────────────
  INTRO_A: '#fdd475',
  INTRO_B: '#ff5e9f',
  LOGO:    '#ff89a5',
  TITLE:   '#ff89a5',

  // ── Background colours ────────────────────────────────────────────────────
  BLACK:       '#000000',
  DARK_BLUE:   '#0a1628',
  DARKER_BLUE: '#1a2332',
  VGA_BLUE:    '#0000aa',
  VGA_BLUE_DARK: '#00007a',

  // ── Primary UI colours ────────────────────────────────────────────────────
  // Note: *_DIM variants below are hand-tuned predecessors of the filmic
  // system. Future: replace with filmicDarken(base, N) once the visual
  // design is locked.
  TERMINAL_GREEN:       '#00ff00',
  TERMINAL_GREEN_DIM:   '#33ff33',   // lighter/secondary; → filmicBrighten(TERMINAL_GREEN, 0.5)?
  TERMINAL_GREEN_DIMMER:'#1a7a1a',   // dark version; → filmicDarken(TERMINAL_GREEN, 2.5)?
  NEON_CYAN:     '#00ffff',
  NEON_CYAN_DIM: '#006666',          // → filmicDarken(NEON_CYAN, 2.5)?
  NEON_TEAL:     '#40e0d0',
  NEON_TEAL_DIM: '#1a5a52',          // → filmicDarken(NEON_TEAL, 2.5)?

  // ── Accent colours ────────────────────────────────────────────────────────
  HOT_PINK:            '#ff00ff',
  HOT_PINK_DIM:        '#660066',    // → filmicDarken(HOT_PINK, 2)?
  MAGENTA:             '#ff1493',
  ELECTRIC_ORANGE:     '#ff6600',
  ELECTRIC_ORANGE_DIM: '#663300',    // → filmicDarken(ELECTRIC_ORANGE, 2)?
  BRIGHT_ORANGE:       '#ff8c00',
  BRIGHT_YELLOW:       '#ffff00',

  // ── Semantic colours ──────────────────────────────────────────────────────
  HEAT_ORANGE:    '#ff4500',
  HEAT_RED:       '#ff0000',
  EXECUTABLE:     '#ff5858',
  ACTIVE_SLOT:    '#87ff87',
  PANEL_SELECTED: '#40e0d0',
  ACTIVE_BORDER:  '#00ffff',
  SUCCESS_GREEN:  '#00ff00',

  // ── BIOS colours ──────────────────────────────────────────────────────────
  BIOS_BG:        '#000080',
  BIOS_HIGHLIGHT: '#00ffff',

  // ── Branch UI colours ─────────────────────────────────────────────────────
  LAVA_RED:   '#ff3300',
  ELECTRIC_BLUE: '#0066ff',
  GOLD:       '#ffd700',
  PURPLE:     '#a78bfa',
  ORANGE:     '#fb923c',
  EMERALD:    '#34d399',
  AMBER:      '#fbbf24',
  ROSE:       '#f472b6',
  BRANCH_SELECTED_BACK: '#491427',

  // ── Text colours ──────────────────────────────────────────────────────────
  WHITE:      '#ffffff',
  LIGHT_GRAY: '#cccccc',
  MID_GRAY:   '#888888',
  DIM_GRAY:   '#555555',
  DARK_GRAY:  '#1a1a1a',

  // ── Branch background tints ───────────────────────────────────────────────
  DARK_GREEN: '#002200',
  DARK_CYAN:  '#001122',

  // ── Semantic aliases ──────────────────────────────────────────────────────
  get PRIMARY()  { return this.NEON_CYAN; },
  get SECONDARY(){ return this.TERMINAL_GREEN; },
  get ACCENT()   { return this.HOT_PINK; },
  get WARNING()  { return this.ELECTRIC_ORANGE; },
  get DANGER()   { return this.HEAT_RED; },
};

// Box drawing styles using proper Unicode box-drawing characters
export const BoxStyles = {
  SINGLE: {
    topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘',
    horizontal: '─', vertical: '│',
    teeDown: '┬', teeUp: '┴', teeRight: '├', teeLeft: '┤', cross: '┼',
  },

  DOUBLE: {
    topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
    horizontal: '═', vertical: '║',
    teeDown: '╦', teeUp: '╩', teeRight: '╠', teeLeft: '╣', cross: '╬',
  },

  HEAVY: {
    // CP437-safe fallback: true heavy Unicode box chars are missing in VGA fonts.
    topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
    horizontal: '═', vertical: '║',
    teeDown: '╦', teeUp: '╩', teeRight: '╠', teeLeft: '╣', cross: '╬',
  },

  ASCII: {
    topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+',
    horizontal: '-', vertical: '|',
    teeDown: '+', teeUp: '+', teeRight: '+', teeLeft: '+', cross: '+',
  },
};
