/** Pure color model (HSL canonical) with HEX / RGB / HSL / HSV / CMYK parsing and formatting. */

export type ColorFieldId = 'hex' | 'rgb' | 'hsl' | 'hsv' | 'cmyk';

export interface Hsla {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const COLOR_FIELD_IDS: ColorFieldId[] = ['hex', 'rgb', 'hsl', 'hsv', 'cmyk'];
export const DEFAULT_HSLA: Hsla = { h: 211, s: 100, l: 50, a: 1 };

const NUMBER = '(-?\\d*\\.?\\d+)';
const PERCENT = `${NUMBER}%?`;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const functionArgs = (input: string, names: string[], count: number): number[] | null => {
  const match = new RegExp(`^(?:${names.join('|')})\\(\\s*(.+?)\\s*\\)$`, 'i').exec(input.trim());
  if (!match) return null;
  const parts = match[1].split(/\s*[,/\s]\s*/).filter(Boolean);
  if (parts.length < count || parts.length > count + 1) return null;
  const numbers = parts.map((part) => {
    const parsed = new RegExp(`^${PERCENT}(?:deg)?$`, 'i').exec(part);
    return parsed ? Number(parsed[1]) : NaN;
  });
  return numbers.some((n) => Number.isNaN(n)) ? null : numbers;
};
const alphaOf = (numbers: number[], count: number, raw: string): number => {
  if (numbers.length <= count) return 1;
  return clamp(raw.includes('%') && /%\s*\)$/.test(raw) ? numbers[count] / 100 : numbers[count], 0, 1);
};

export const rgbToHsl = ({ r, g, b, a }: Rgba): Hsla => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100, a };
};

export const hslToRgb = ({ h, s, l, a }: Hsla): Rgba => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a };
};

const rgbToHsv = ({ r, g, b }: Rgba): { h: number; s: number; v: number } => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const { h } = rgbToHsl({ r, g, b, a: 1 });
  return { h, s: max === 0 ? 0 : ((max - min) / max) * 100, v: max * 100 };
};

const hsvToRgb = (h: number, s: number, v: number, a: number): Rgba => {
  const sn = s / 100;
  const vn = v / 100;
  const l = vn * (1 - sn / 2);
  const sl = l === 0 || l === 1 ? 0 : (vn - l) / Math.min(l, 1 - l);
  return hslToRgb({ h, s: sl * 100, l: l * 100, a });
};

const rgbToCmyk = ({ r, g, b }: Rgba): { c: number; m: number; y: number; k: number } => {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: ((1 - r / 255 - k) / (1 - k)) * 100,
    m: ((1 - g / 255 - k) / (1 - k)) * 100,
    y: ((1 - b / 255 - k) / (1 - k)) * 100,
    k: k * 100,
  };
};

const toHex2 = (value: number): string => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');

export const formatHex = (rgba: Rgba, withAlpha = rgba.a < 1): string => `#${toHex2(rgba.r)}${toHex2(rgba.g)}${toHex2(rgba.b)}${withAlpha ? toHex2(rgba.a * 255) : ''}`.toUpperCase();

export const formatColorField = (field: ColorFieldId, hsla: Hsla): string => {
  const rgba = hslToRgb(hsla);
  const alpha = hsla.a < 1 ? round(hsla.a, 2) : null;
  switch (field) {
    case 'hex': return formatHex(rgba);
    case 'rgb': return alpha === null ? `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})` : `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`;
    case 'hsl': {
      const body = `${round(hsla.h)}, ${round(hsla.s)}%, ${round(hsla.l)}%`;
      return alpha === null ? `hsl(${body})` : `hsla(${body}, ${alpha})`;
    }
    case 'hsv': {
      const hsv = rgbToHsv(rgba);
      return `hsv(${round(hsv.h)}, ${round(hsv.s)}%, ${round(hsv.v)}%)`;
    }
    default: {
      const cmyk = rgbToCmyk(rgba);
      return `cmyk(${round(cmyk.c)}%, ${round(cmyk.m)}%, ${round(cmyk.y)}%, ${round(cmyk.k)}%)`;
    }
  }
};

const parseHex = (input: string): Rgba | null => {
  const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length <= 4) hex = Array.from(hex, (ch) => ch + ch).join('');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? round(parseInt(hex.slice(6, 8), 16) / 255, 3) : 1,
  };
};

const namedToRgba = (input: string): Rgba | null => {
  if (typeof document === 'undefined' || !/^[a-z]+$/i.test(input.trim())) return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#010203';
  ctx.fillStyle = input.trim();
  const first = ctx.fillStyle;
  ctx.fillStyle = '#fdfcfb';
  ctx.fillStyle = input.trim();
  return first === ctx.fillStyle ? parseHex(first) : null;
};

/** Parses a CSS-like color string in any supported notation; null when it is not a color. */
export const parseColor = (input: string, previous: Hsla = DEFAULT_HSLA): Hsla | null => {
  const text = input.trim();
  if (!text) return null;
  let rgba = parseHex(text);
  if (!rgba) {
    const rgb = functionArgs(text, ['rgb', 'rgba'], 3);
    if (rgb) {
      const scale = /^rgba?\(\s*[\d.]+%/i.test(text) ? 2.55 : 1;
      rgba = { r: clamp(Math.round(rgb[0] * scale), 0, 255), g: clamp(Math.round(rgb[1] * scale), 0, 255), b: clamp(Math.round(rgb[2] * scale), 0, 255), a: alphaOf(rgb, 3, text) };
    }
  }
  if (!rgba) {
    const hsl = functionArgs(text, ['hsl', 'hsla'], 3);
    if (hsl) return { h: ((hsl[0] % 360) + 360) % 360, s: clamp(hsl[1], 0, 100), l: clamp(hsl[2], 0, 100), a: alphaOf(hsl, 3, text) };
  }
  if (!rgba) {
    const hsv = functionArgs(text, ['hsv', 'hsb'], 3);
    if (hsv) rgba = hsvToRgb(((hsv[0] % 360) + 360) % 360, clamp(hsv[1], 0, 100), clamp(hsv[2], 0, 100), alphaOf(hsv, 3, text));
  }
  if (!rgba) {
    const cmyk = functionArgs(text, ['cmyk'], 4);
    if (cmyk) {
      const [c, m, y, k] = cmyk.map((n) => clamp(n, 0, 100) / 100);
      rgba = { r: Math.round(255 * (1 - c) * (1 - k)), g: Math.round(255 * (1 - m) * (1 - k)), b: Math.round(255 * (1 - y) * (1 - k)), a: 1 };
    }
  }
  if (!rgba) rgba = namedToRgba(text);
  if (!rgba) return null;
  const next = rgbToHsl(rgba);
  return next.s === 0 ? { ...next, h: previous.h } : next;
};

const luminance = ({ r, g, b }: Rgba): number => {
  const channel = (v: number): number => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (a: Rgba, b: Rgba): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const shadeStrip = (hsla: Hsla, steps = 9): Hsla[] => Array.from({ length: steps }, (_v, i) => ({ ...hsla, l: round(8 + (i * 84) / (steps - 1)) }));
