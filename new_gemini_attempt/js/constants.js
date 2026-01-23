export const Palette = {
    // Backgrounds
    BLACK: '#000000',
    DARK_BLUE: '#0a1628',
    DARKER_BLUE: '#1a2332',
  
    // Primary UI
    TERMINAL_GREEN: '#00ff00',
    TERMINAL_GREEN_DIM: '#33ff33',
    NEON_CYAN: '#00ffff',
    NEON_TEAL: '#40e0d0',
  
    // Accents
    HOT_PINK: '#ff00ff',
    MAGENTA: '#ff1493',
    ELECTRIC_ORANGE: '#ff6600',
    BRIGHT_ORANGE: '#ff8c00',
    BRIGHT_YELLOW: '#ffff00',
  
    // Semantic
    HEAT_ORANGE: '#ff4500',
    HEAT_RED: '#ff0000',
    SUCCESS_GREEN: '#00ff00',
  
    // Text
    WHITE: '#ffffff',
    LIGHT_GRAY: '#cccccc',
    MID_GRAY: '#888888',
    DIM_GRAY: '#555555',
};

export const BoxStyles = {
    SINGLE: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      teeDown: '┬',
      teeUp: '┴',
      teeRight: '├',
      teeLeft: '┤',
      cross: '┼',
    },
  
    DOUBLE: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
      teeDown: '╦',
      teeUp: '╩',
      teeRight: '╠',
      teeLeft: '╣',
      cross: '╬',
    },
  
    HEAVY: {
      topLeft: '┏',
      topRight: '┓',
      bottomLeft: '┗',
      bottomRight: '┛',
      horizontal: '━',
      vertical: '┃',
      teeDown: '┳',
      teeUp: '┻',
      teeRight: '┣',
      teeLeft: '┫',
      cross: '╋',
    },
};

export const Layout = {
    statusRail: { x: 0, y: 0, width: 80, height: 2 },
    tabBar: { x: 0, y: 2, width: 80, height: 1 },
    mainPanel: { x: 0, y: 3, width: 80, height: 22 },
};

export const Viewport = {
    width: 80,
    height: 25
};
