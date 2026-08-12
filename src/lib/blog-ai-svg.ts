const MAX_SVG_CHARS = 40_000;
const MIN_SVG_CHARS = 80;
const FORBIDDEN_SVG = /<script|foreignObject|iframe|object|embed|<link[\s>]|javascript:|on[a-z]+\s*=/iu;

/**
 * Extracts and sanitizes SVG markup returned by Claude.
 * @param raw Untrusted SVG or fenced code block.
 * @returns Safe SVG markup, or null when the payload is unusable.
 */
export function sanitizeClaudeSvg(raw: string) {
  const trimmed = raw
    .trim()
    .replace(/^```(?:svg)?\s*/iu, '')
    .replace(/```$/u, '')
    .trim();
  const start = trimmed.search(/<svg[\s>]/iu);
  const end = trimmed.toLowerCase().lastIndexOf('</svg>');
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  const svg = trimmed.slice(start, end + '</svg>'.length).trim();
  if (svg.length < MIN_SVG_CHARS || svg.length > MAX_SVG_CHARS) {
    return null;
  }
  if (FORBIDDEN_SVG.test(svg)) {
    return null;
  }

  return svg.includes('xmlns=')
    ? svg
    : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

/**
 * Returns true when a blog image URL is a vector file that Next.js should not optimize.
 * @param src Public image URL.
 */
export function isBlogVectorImage(src: string) {
  return /\.svg(?:$|[?#])/iu.test(src);
}
