/** QR symbol renderers: SVG markup, PNG canvas and colour contrast. */
import type { QrSymbol } from './qr';

export type QrModuleStyle = 'square' | 'rounded' | 'dots';

export interface QrRenderOptions {
  fg: string;
  bg: string;
  margin: number;
  style: QrModuleStyle;
  /** Transparent background instead of the bg colour. */
  transparent?: boolean;
}

const FINDER_SPAN = 7;
const ROUNDED_RADIUS = 0.32;
const DOT_RADIUS = 0.46;

const inFinder = (x: number, y: number, size: number): boolean => (
  (x < FINDER_SPAN && y < FINDER_SPAN) || (x >= size - FINDER_SPAN && y < FINDER_SPAN) || (x < FINDER_SPAN && y >= size - FINDER_SPAN)
);

const squarePath = (symbol: QrSymbol, margin: number): string => {
  const parts: string[] = [];
  for (let y = 0; y < symbol.size; y++) {
    for (let x = 0; x < symbol.size;) {
      if (!symbol.modules[y][x]) { x++; continue; }
      let end = x;
      while (end < symbol.size && symbol.modules[y][end]) end++;
      parts.push(`M${x + margin} ${y + margin}h${end - x}v1h${x - end}z`);
      x = end;
    }
  }
  return parts.join('');
};

/** Standalone SVG document text; width/height are in CSS pixels. */
export function qrToSvg(symbol: QrSymbol, options: QrRenderOptions, pixels: number): string {
  const total = symbol.size + options.margin * 2;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${pixels}" height="${pixels}"${options.style === 'square' ? ' shape-rendering="crispEdges"' : ''}>`;
  const background = options.transparent ? '' : `<rect width="${total}" height="${total}" fill="${options.bg}"/>`;
  if (options.style === 'square') return `${head}${background}<path fill="${options.fg}" d="${squarePath(symbol, options.margin)}"/></svg>`;
  const shapes: string[] = [];
  for (let y = 0; y < symbol.size; y++) {
    for (let x = 0; x < symbol.size; x++) {
      if (!symbol.modules[y][x]) continue;
      const px = x + options.margin;
      const py = y + options.margin;
      if (options.style === 'dots' && !inFinder(x, y, symbol.size)) shapes.push(`<circle cx="${px + 0.5}" cy="${py + 0.5}" r="${DOT_RADIUS}"/>`);
      else shapes.push(`<rect x="${px}" y="${py}" width="1" height="1" rx="${options.style === 'rounded' ? ROUNDED_RADIUS : 0}"/>`);
    }
  }
  return `${head}${background}<g fill="${options.fg}">${shapes.join('')}</g></svg>`;
}

/** Draws the symbol on a canvas using whole-pixel modules; returns the final edge length. */
export function drawQrCanvas(canvas: HTMLCanvasElement, symbol: QrSymbol, options: QrRenderOptions, requestedPixels: number): number {
  const total = symbol.size + options.margin * 2;
  const scale = Math.max(1, Math.floor(requestedPixels / total));
  const edge = scale * total;
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext('2d');
  if (!ctx) return edge;
  ctx.clearRect(0, 0, edge, edge);
  if (!options.transparent) {
    ctx.fillStyle = options.bg;
    ctx.fillRect(0, 0, edge, edge);
  }
  ctx.fillStyle = options.fg;
  for (let y = 0; y < symbol.size; y++) {
    for (let x = 0; x < symbol.size; x++) {
      if (!symbol.modules[y][x]) continue;
      const px = (x + options.margin) * scale;
      const py = (y + options.margin) * scale;
      if (options.style === 'dots' && !inFinder(x, y, symbol.size)) {
        ctx.beginPath();
        ctx.arc(px + scale / 2, py + scale / 2, scale * DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      } else if (options.style === 'rounded') {
        ctx.beginPath();
        ctx.roundRect(px, py, scale, scale, scale * ROUNDED_RADIUS);
        ctx.fill();
      } else {
        ctx.fillRect(px, py, scale, scale);
      }
    }
  }
  return edge;
}

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const hexLuminance = (hex: string): number => {
  const value = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
};

export interface QrContrast {
  ratio: number;
  inverted: boolean;
}

export const qrContrast = (fg: string, bg: string): QrContrast => {
  const a = hexLuminance(fg);
  const b = hexLuminance(bg);
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), inverted: a > b };
};
