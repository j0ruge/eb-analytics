/**
 * Convert a hex color string to rgba with the given alpha.
 * Supports 3-char (#RGB), 4-char (#RGBA), 6-char (#RRGGBB),
 * 8-char (#RRGGBBAA) hex, and passthrough for rgb()/rgba() strings.
 *
 * @param hex  The color string (e.g. '#007AFF', '#FFF', 'rgba(…)')
 * @param alpha Opacity value between 0 and 1
 * @returns An rgba() color string
 */
export function hexToRgba(hex: string, alpha: number): string {
  // If already rgb/rgba, replace or append alpha
  if (hex.startsWith('rgb')) {
    const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    return hex;
  }

  let r: number;
  let g: number;
  let b: number;

  const clean = hex.replace('#', '');

  switch (clean.length) {
    case 3: // #RGB
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
      break;
    case 4: // #RGBA – ignore existing alpha
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
      break;
    case 8: // #RRGGBBAA – ignore existing alpha
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
      break;
    case 6: // #RRGGBB
    default:
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
      break;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
