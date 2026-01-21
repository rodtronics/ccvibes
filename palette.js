// Crime Committer VI - Color Palette
// Single source of truth for all colors used in the game
// Based on 02_ui_spec.md color palette section

export const Palette = {
  //intro colours
  INTRO_A: "#fdd475",
  INTRO_B: "#ff5e9f",
  LOGO: "#ff89a5",

  //   // Background colors
  BLACK: "#000000",
  DARK_BLUE: "#0a1628",
  DARKER_BLUE: "#1a2332",
  VGA_BLUE: "#0000aa",
  VGA_BLUE_DARK: "#00007a",

  // Primary UI colors
  TERMINAL_GREEN: "#00ff00",
  TERMINAL_GREEN_DIM: "#33ff33",
  TERMINAL_GREEN_DIMMER: "#1a7a1a",
  NEON_CYAN: "#00ffff",
  NEON_CYAN_DIM: "#006666",
  NEON_TEAL: "#40e0d0",
  NEON_TEAL_DIM: "#1a5a52",

  // Accent colors
  HOT_PINK: "#ff00ff",
  HOT_PINK_DIM: "#660066",
  MAGENTA: "#ff1493",
  ELECTRIC_ORANGE: "#ff6600",
  ELECTRIC_ORANGE_DIM: "#663300",
  BRIGHT_ORANGE: "#ff8c00",
  BRIGHT_YELLOW: "#ffff00",

  // Semantic colors
  HEAT_ORANGE: "#ff4500",
  HEAT_RED: "#ff0000",
  SUCCESS_GREEN: "#00ff00",

  // Branch UI colors
  LAVA_RED: "#ff3300",
  ELECTRIC_BLUE: "#0066ff",
  GOLD: "#ffd700",

  // Text colors
  WHITE: "#ffffff",
  LIGHT_GRAY: "#cccccc",
  MID_GRAY: "#888888",
  DIM_GRAY: "#555555",
  DARK_GRAY: "#1a1a1a",

  // Branch background colors (subtle tints)
  DARK_GREEN: "#002200", // Street branch background
  DARK_CYAN: "#001122", // Commerce branch background

  // Semantic aliases for common use cases
  get PRIMARY() {
    return this.NEON_CYAN;
  },
  get SECONDARY() {
    return this.TERMINAL_GREEN;
  },
  get ACCENT() {
    return this.HOT_PINK;
  },
  get WARNING() {
    return this.ELECTRIC_ORANGE;
  },
  get DANGER() {
    return this.HEAT_RED;
  },
};

// Box drawing styles using proper Unicode box-drawing characters
export const BoxStyles = {
  SINGLE: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    teeDown: "┬",
    teeUp: "┴",
    teeRight: "├",
    teeLeft: "┤",
    cross: "┼",
  },

  DOUBLE: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
    teeDown: "╦",
    teeUp: "╩",
    teeRight: "╠",
    teeLeft: "╣",
    cross: "╬",
  },

  HEAVY: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
    teeDown: "┳",
    teeUp: "┻",
    teeRight: "┣",
    teeLeft: "┫",
    cross: "╋",
  },

  // Fallback for compatibility (ASCII-only)
  ASCII: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
    teeDown: "+",
    teeUp: "+",
    teeRight: "+",
    teeLeft: "+",
    cross: "+",
  },
};
