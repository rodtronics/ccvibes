export const Palette = {
  BLACK: "#000000",
  DARK_BLUE: "#0a1628",
  DARKER_BLUE: "#1a2332",

  TERMINAL_GREEN: "#00ff00",
  TERMINAL_GREEN_DIM: "#33ff33",
  NEON_CYAN: "#00ffff",
  NEON_TEAL: "#40e0d0",

  HOT_PINK: "#ff00ff",
  MAGENTA: "#ff1493",
  ELECTRIC_ORANGE: "#ff6600",
  BRIGHT_ORANGE: "#ff8c00",
  BRIGHT_YELLOW: "#ffff00",

  HEAT_ORANGE: "#ff4500",
  HEAT_RED: "#ff0000",
  SUCCESS_GREEN: "#00ff00",

  WHITE: "#ffffff",
  LIGHT_GRAY: "#cccccc",
  MID_GRAY: "#888888",
  DIM_GRAY: "#555555",
};

export const Gradients = {
  street: ["#00ff00", "#44ff22", "#66ff33", "#88ff44", "#aaff55", "#ccff88"],
  commerce: ["#00ffff", "#40e0d0", "#5ff5f5", "#80ffff"],
  heat: ["#ff4500", "#ff6600", "#ff8800", "#ffaa00"],
};

export function lerpColor(colorA, colorB, t) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bVal = Math.round(a.b + (b.b - a.b) * t);
  return rgbToHex(r, g, bVal);
}

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

export function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((val) => {
        const clamped = Math.max(0, Math.min(255, val));
        return clamped.toString(16).padStart(2, "0");
      })
      .join("")
  );
}
