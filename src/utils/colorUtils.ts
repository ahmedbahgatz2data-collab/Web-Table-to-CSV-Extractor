/**
 * Color and styling utilities for HTML table color extraction and Excel export
 */

// Standard named HTML colors mapped to 6-digit uppercase HEX
const NAMED_COLORS: Record<string, string> = {
  red: 'FF0000',
  darkred: '8B0000',
  lightcoral: 'F08080',
  salmon: 'FA8072',
  darksalmon: 'E9967A',
  lightsalmon: 'FFA07A',
  crimson: 'DC143C',
  firebrick: 'B22222',
  pink: 'FFC0CB',
  lightpink: 'FFB6C1',
  orange: 'FFA500',
  darkorange: 'FF8C00',
  coral: 'FF7F50',
  tomato: 'FF6347',
  orangered: 'FF4500',
  gold: 'FFD700',
  yellow: 'FFFF00',
  lightyellow: 'FFFFE0',
  lemonchiffon: 'FFFACD',
  khaki: 'F0E68C',
  green: '008000',
  darkgreen: '006400',
  lightgreen: '90EE90',
  palegreen: '98FB98',
  limegreen: '32CD32',
  lime: '00FF00',
  forestgreen: '228B22',
  seagreen: '2E8B57',
  mediumseagreen: '3CB371',
  olive: '808000',
  olivedrab: '6B8E23',
  teal: '008080',
  darkcyan: '008B8B',
  cyan: '00FFFF',
  lightcyan: 'E0FFFF',
  lightblue: 'ADD8E6',
  skyblue: '87CEEB',
  blue: '0000FF',
  navy: '000080',
  purple: '800080',
  magenta: 'FF00FF',
  violet: 'EE82EE',
  plum: 'DDA0DD',
  gray: '808080',
  grey: '808080',
  lightgray: 'D3D3D3',
  lightgrey: 'D3D3D3',
  silver: 'C0C0C0',
  darkgray: 'A9A9A9',
  darkgrey: 'A9A9A9',
  white: 'FFFFFF',
  black: '000000',
};

// Semantic class keywords mapped to Excel highlight palette
const SEMANTIC_HIGHLIGHTS: { regex: RegExp; hexBg: string; hexColor: string; tag: string }[] = [
  // Not Recommended / Deprecated / Obsolete
  {
    regex: /(notrecommended|not-recommended|not_recommended|not\s*recommended)/i,
    hexBg: 'FCE4D6', // Soft orange/peach
    hexColor: 'C00000',
    tag: 'Not Recommended',
  },
  {
    regex: /(obsolete|deprecated|eol|end-of-life|discontinued|phaseout|phase-out)/i,
    hexBg: 'F8CBAD',
    hexColor: '833C0C',
    tag: 'Obsolete / EOL',
  },
  // Danger / Error / Critical
  {
    regex: /(danger|error|critical|alert|fail|failed|table-danger|bg-red)/i,
    hexBg: 'FFC7CE', // Excel soft red
    hexColor: '9C0006',
    tag: 'Danger / Error',
  },
  // Warning / Caution
  {
    regex: /(warning|warn|caution|pending|table-warning|bg-yellow|bg-amber)/i,
    hexBg: 'FFF2CC', // Excel soft yellow
    hexColor: '7F6000',
    tag: 'Warning',
  },
  // Success / Active / Recommended
  {
    regex: /(success|active|approved|recommended|instock|in-stock|available|table-success|bg-green|bg-emerald)/i,
    hexBg: 'C6EFCE', // Excel soft green
    hexColor: '006100',
    tag: 'Active / Success',
  },
  // Info / Highlight
  {
    regex: /(info|primary|highlight|table-info|bg-blue)/i,
    hexBg: 'D9E1F2', // Soft blue
    hexColor: '1F4E78',
    tag: 'Highlighted',
  },
  // Inactive / Disabled / Gray
  {
    regex: /(inactive|disabled|muted|unavailable|table-secondary|table-active|bg-gray|bg-slate)/i,
    hexBg: 'E7E6E6', // Soft gray
    hexColor: '595959',
    tag: 'Inactive',
  },
];

/**
 * Normalizes any color representation into 6-character uppercase HEX (without #)
 */
export function normalizeToHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();

  // 1. Check named colors
  if (NAMED_COLORS[clean]) {
    return NAMED_COLORS[clean];
  }

  // 2. Check 3-digit Hex e.g. #f00 or f00
  const hex3Match = clean.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3Match) {
    const [, r, g, b] = hex3Match;
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  // 3. Check 6-digit Hex e.g. #ff0000 or ff0000
  const hex6Match = clean.match(/^#?([0-9a-f]{6})$/i);
  if (hex6Match) {
    return hex6Match[1].toUpperCase();
  }

  // 4. Check rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = clean.match(/rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return null;
}

/**
 * Evaluates HTML element class and style attributes to determine if a color or semantic highlight applies.
 */
export function detectColorAndHighlight(
  className?: string,
  styleAttr?: string,
  bgcolorAttr?: string
): {
  hexBg?: string;
  hexColor?: string;
  tag?: string;
  source: 'inline-style' | 'bgcolor' | 'semantic-class' | 'none';
} {
  // 1. Direct bgcolor attribute
  if (bgcolorAttr) {
    const hex = normalizeToHex(bgcolorAttr);
    if (hex && hex !== 'FFFFFF') {
      return { hexBg: hex, tag: `Color: #${hex}`, source: 'bgcolor' };
    }
  }

  // 2. Inline style background / background-color
  if (styleAttr) {
    const bgMatch = styleAttr.match(/background(?:-color)?\s*:\s*([^;!]+)/i);
    const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);

    const hexBg = bgMatch ? normalizeToHex(bgMatch[1]) : null;
    const hexColor = colorMatch ? normalizeToHex(colorMatch[1]) : null;

    if (hexBg && hexBg !== 'FFFFFF') {
      return {
        hexBg,
        hexColor: hexColor || undefined,
        tag: `Color: #${hexBg}`,
        source: 'inline-style',
      };
    }
  }

  // 3. Semantic class matching (NotRecommended, warning, danger, etc.)
  if (className) {
    for (const h of SEMANTIC_HIGHLIGHTS) {
      if (h.regex.test(className)) {
        return {
          hexBg: h.hexBg,
          hexColor: h.hexColor,
          tag: h.tag,
          source: 'semantic-class',
        };
      }
    }
  }

  return { source: 'none' };
}
