// Crime Committer VI - Gradient System
// Color interpolation and gradient definitions for TUI rendering

/**
 * Filmic colour exposure adjustment.
 *
 * Works in linear light (not sRGB), so exposure changes are perceptually
 * smooth. Reinhard tone mapping is applied per-channel after the exposure
 * shift — this is what produces the filmic highlight rolloff: when one
 * channel is near saturation the others keep lifting, so colours trend
 * toward white rather than toward a harder, more saturated version.
 *
 * @param {string} hex   - Input hex colour, e.g. '#cc2200'
 * @param {number} stops - Exposure stops. Positive = brighter, negative = darker.
 *                         Useful range is roughly -3 to +3.
 * @returns {string} Adjusted hex colour.
 */
export function filmicAdjust(hex, stops) {
  const ri = parseInt(hex.slice(1, 3), 16);
  const gi = parseInt(hex.slice(3, 5), 16);
  const bi = parseInt(hex.slice(5, 7), 16);

  // sRGB → linear (gamma 2.2)
  let r = Math.pow(ri / 255, 2.2);
  let g = Math.pow(gi / 255, 2.2);
  let b = Math.pow(bi / 255, 2.2);

  // Exposure in linear space
  const exposure = Math.pow(2, stops);
  r *= exposure;
  g *= exposure;
  b *= exposure;

  // Reinhard per-channel: saturating channels compress while others keep
  // rising, naturally desaturating highlights toward white
  r = r / (1 + r);
  g = g / (1 + g);
  b = b / (1 + b);

  // linear → sRGB
  r = Math.pow(r, 1 / 2.2);
  g = Math.pow(g, 1 / 2.2);
  b = Math.pow(b, 1 / 2.2);

  const toHex = (n) => {
    const h = Math.round(Math.min(255, Math.max(0, n * 255))).toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convenience: brighten a colour by `stops` stops (filmic). */
export const filmicBrighten = (hex, stops = 1) => filmicAdjust(hex, stops);

/** Convenience: darken a colour by `stops` stops (filmic). */
export const filmicDarken = (hex, stops = 1) => filmicAdjust(hex, -stops);

/**
 * Interpolate between two hex colors
 * @param {string} color1 - Hex color (e.g., '#00ffff')
 * @param {string} color2 - Hex color (e.g., '#7bff9f')
 * @param {number} t - Interpolation factor (0.0 to 1.0)
 * @returns {string} Interpolated hex color
 */
export function interpolateColor(color1, color2, t) {
  // Parse hex colors
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  // Convert back to hex
  const toHex = (n) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Named gradient definitions
 * Each gradient is an array of hex colors that will be interpolated smoothly
 */
export const GRADIENTS = {
  // Cyberpunk/tech themes
  cyber: ['#9966ff', '#6688ff', '#42c7b8'],
  cool: ['#00ffff', '#33ddbb', '#7bff9f'],
  neon: ['#ff00ff', '#ff1493', '#ff6600'],

  // Temperature/danger themes
  heat: ['#ff4d4d', '#ff8844', '#ffcc55'],
  warm: ['#ff00ff', '#dd33aa', '#bb6688'],
  toxic: ['#00ff00', '#88ff00', '#ffff00'],
  blackbody: ['#330000', '#cc0000', '#ff4400', '#ff8800', '#ffcc00', '#ffffff'],

  // Natural themes
  ocean: ['#0066cc', '#0099dd', '#00cccc', '#00ffcc'],
  forest: ['#004400', '#228844', '#55aa55', '#88dd88'],
  sunset: ['#ff6600', '#ff8844', '#ffaa66', '#ffcc99'],

  // Criminal/danger themes
  blood: ['#660000', '#aa0000', '#ff0000'],
  money: ['#004400', '#008800', '#00ff00', '#88ff88'],
  gold: ['#664400', '#aa8800', '#ffcc00'],

  // Abstract/moody
  purple: ['#440044', '#880088', '#cc00cc', '#ff44ff'],
  blue: ['#000088', '#0000ff', '#4488ff', '#88ccff'],
  green: ['#004400', '#008800', '#00cc00', '#44ff44'],

  // Crime Committer specific
  street: ['#00ff00', '#88ff44', '#ccff88'],
  commerce: ['#00ffff', '#44dddd', '#88bbbb'],
  fraud: ['#ff00ff', '#dd44dd', '#bb88bb'],
  smuggling: ['#ff6600', '#dd8844', '#bbaa88'],
  new_branch: ['#ff3300', '#ff6600', '#ffaa00'],
};

/**
 * Get colors for a gradient at specific positions
 * @param {string} gradientName - Name of the gradient from GRADIENTS
 * @param {number} length - Number of colors needed
 * @returns {string[]} Array of interpolated hex colors
 */
export function getGradientColors(gradientName, length) {
  const gradient = GRADIENTS[gradientName];
  if (!gradient || length < 1) return [];

  if (length === 1) return [gradient[0]];

  const colors = [];
  const step = (gradient.length - 1) / (length - 1);

  for (let i = 0; i < length; i++) {
    const position = i * step;
    const colorIndex = Math.floor(position);
    const nextIndex = Math.min(colorIndex + 1, gradient.length - 1);
    const t = position - colorIndex;

    const color = interpolateColor(gradient[colorIndex], gradient[nextIndex], t);
    colors.push(color);
  }

  return colors;
}
