/** Browser SVG optimizer: structure clean-up, number rounding, path and colour minification. */
import { parseXml } from './xml';

export interface SvgOptimizeOptions {
  precision: number;
  removeComments: boolean;
  removeMetadata: boolean;
  removeEditorData: boolean;
  removeTitleDesc: boolean;
  removeScripts: boolean;
  removeEmpty: boolean;
  collapseGroups: boolean;
  removeUnusedIds: boolean;
  shortenColors: boolean;
  removeDeclaration: boolean;
  removeDimensions: boolean;
}

export type SvgOptimizeResult =
  | { ok: true; output: string }
  | { ok: false; code: 'empty' | 'invalid' | 'not_svg'; message: string };

export const DEFAULT_SVG_OPTIONS: SvgOptimizeOptions = {
  precision: 3,
  removeComments: true,
  removeMetadata: true,
  removeEditorData: true,
  removeTitleDesc: false,
  removeScripts: true,
  removeEmpty: true,
  collapseGroups: true,
  removeUnusedIds: true,
  shortenColors: true,
  removeDeclaration: true,
  removeDimensions: false,
};

const ELEMENT = 1;
const TEXT = 3;
const COMMENT = 8;
const PI = 7;
const EDITOR_NAMESPACES = ['inkscape', 'sodipodi', 'sketch', 'dc', 'cc', 'rdf', 'i', 'x', 'a', 'ns', 'serif', 'svg'];
const TEXT_ELEMENTS = new Set(['text', 'tspan', 'textPath', 'style', 'script', 'title', 'desc']);
const NUMERIC_ATTRIBUTES = new Set([
  'd', 'points', 'transform', 'gradientTransform', 'patternTransform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'fx', 'fy',
  'viewBox', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stdDeviation', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'font-size', 'dx', 'dy',
]);
const COLOR_ATTRIBUTES = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);
const PATH_ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const NUMBER_GLOBAL = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const COLOR_NAMES_SHORTER: Record<string, string> = { black: '#000', white: '#fff', yellow: '#ff0', fuchsia: '#f0f', magenta: '#f0f', aqua: '#0ff', cyan: '#0ff', lime: '#0f0', blue: '#00f' };
const HEX_TO_NAME: Record<string, string> = { '#f00': 'red', '#008000': 'green', '#808080': 'gray', '#800000': 'maroon', '#000080': 'navy', '#808000': 'olive', '#800080': 'purple', '#ffa500': 'orange', '#ffc0cb': 'pink' };
const DEFAULT_ATTRIBUTES: Array<[string, string]> = [['opacity', '1'], ['version', '1.1'], ['baseProfile', 'full'], ['xml:space', 'default']];

export const formatNumber = (value: number, precision: number): string => {
  const rounded = Number(value.toFixed(precision));
  if (rounded === 0) return '0';
  const text = String(rounded);
  if (text.startsWith('0.')) return text.slice(1);
  if (text.startsWith('-0.')) return `-${text.slice(2)}`;
  return text;
};

export const roundNumbers = (value: string, precision: number): string => value.replace(NUMBER_GLOBAL, (match) => {
  const number = Number(match);
  const rounded = formatNumber(number, precision);
  return rounded === '0' && number !== 0 ? formatNumber(Number(number.toPrecision(2)), 8) : rounded;
});

export function minifyPath(d: string, precision: number): string {
  const tokens: Array<{ text: string; kind: 'cmd' | 'num' | 'flag' }> = [];
  let i = 0;
  let command = '';
  let lastEmitted = '';
  let arg = 0;
  while (i < d.length) {
    const c = d[i];
    if (/[\s,]/.test(c)) { i++; continue; }
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) {
      command = c;
      arg = 0;
      i++;
      const lower = c.toLowerCase();
      if (!(c === lastEmitted && lower !== 'm' && lower !== 'z')) tokens.push({ text: c, kind: 'cmd' });
      lastEmitted = c;
      continue;
    }
    const lower = command.toLowerCase();
    const argCount = PATH_ARGS[lower] ?? 0;
    if (!argCount) { i++; continue; }
    if (lower === 'a' && (arg % 7 === 3 || arg % 7 === 4)) {
      tokens.push({ text: c === '0' ? '0' : '1', kind: 'flag' });
      i++;
    } else {
      NUMBER.lastIndex = i;
      const match = NUMBER.exec(d);
      if (!match) { i++; continue; }
      tokens.push({ text: formatNumber(Number(match[0]), precision), kind: 'num' });
      i += match[0].length;
    }
    arg = (arg + 1) % argCount;
  }
  let out = '';
  tokens.forEach((token, k) => {
    const prev = tokens[k - 1];
    if (token.kind === 'cmd' || !prev || prev.kind === 'cmd') { out += token.text; return; }
    if (token.kind === 'flag' || prev.kind === 'flag') { out += ` ${token.text}`; return; }
    if (token.text.startsWith('-') || (token.text.startsWith('.') && prev.text.includes('.'))) out += token.text;
    else out += ` ${token.text}`;
  });
  return out;
}

const shortenColor = (value: string): string => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(lower);
  let hex = lower;
  if (rgb) hex = `#${[rgb[1], rgb[2], rgb[3]].map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('')}`;
  if (/^#[0-9a-f]{6}$/.test(hex) && hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) hex = `#${hex[1]}${hex[3]}${hex[5]}`;
  if (HEX_TO_NAME[hex] && HEX_TO_NAME[hex].length < hex.length) return HEX_TO_NAME[hex];
  if (COLOR_NAMES_SHORTER[hex] && COLOR_NAMES_SHORTER[hex].length < hex.length) return COLOR_NAMES_SHORTER[hex];
  if (COLOR_NAMES_SHORTER[lower] && COLOR_NAMES_SHORTER[lower].length < lower.length) return COLOR_NAMES_SHORTER[lower];
  return /^#[0-9a-f]{3,8}$/.test(hex) ? hex : trimmed;
};

const shortenColorsInText = (text: string): string => text
  .replace(/rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/gi, (match) => shortenColor(match))
  .replace(/#[0-9a-fA-F]{6}\b/g, (match) => shortenColor(match));

const minifyCss = (css: string, shorten: boolean): string => {
  const compact = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  return shorten ? shortenColorsInText(compact) : compact;
};

const isEditorName = (name: string): boolean => {
  if (name.startsWith('xmlns:')) return EDITOR_NAMESPACES.includes(name.slice(6));
  return name.includes(':') && EDITOR_NAMESPACES.includes(name.split(':')[0]);
};

const collectReferences = (root: Element): Set<string> => {
  const refs = new Set<string>();
  const scan = (text: string): void => {
    for (const match of text.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) refs.add(match[1]);
    for (const match of text.matchAll(/#([A-Za-z_][\w:.-]*)/g)) refs.add(match[1]);
  };
  const visit = (el: Element): void => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name === 'href' || attr.name.endsWith(':href')) { if (attr.value.startsWith('#')) refs.add(attr.value.slice(1)); } else if (attr.name !== 'id') scan(attr.value);
    });
    if (el.localName === 'style') scan(el.textContent ?? '');
    Array.from(el.children).forEach(visit);
  };
  visit(root);
  return refs;
};

export function optimizeSvg(source: string, options: SvgOptimizeOptions): SvgOptimizeResult {
  const parsed = parseXml(source);
  if ('error' in parsed) return parsed.error.empty ? { ok: false, code: 'empty', message: '' } : { ok: false, code: 'invalid', message: parsed.error.message };
  const root = parsed.doc.documentElement;
  if (root.localName !== 'svg') return { ok: false, code: 'not_svg', message: root.localName };
  const precision = Math.min(6, Math.max(0, Math.round(options.precision)));
  const hasScript = !options.removeScripts && root.getElementsByTagName('script').length > 0;

  const cleanAttributes = (el: Element): void => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name;
      const value = attr.value;
      if (options.removeScripts && /^on/i.test(name)) { el.removeAttribute(name); return; }
      if (options.removeEditorData && isEditorName(name)) { el.removeAttribute(name); return; }
      if (value.trim() === '' && name !== 'd') { el.removeAttribute(name); return; }
      if (name === 'style') {
        const css = minifyCss(value, options.shortenColors).replace(/-?\d*\.\d+/g, (match) => formatNumber(Number(match), precision));
        if (css) el.setAttribute(name, css); else el.removeAttribute(name);
        return;
      }
      if (name === 'd' && el.localName === 'path') { el.setAttribute(name, minifyPath(value, precision)); return; }
      if (NUMERIC_ATTRIBUTES.has(name)) el.setAttribute(name, roundNumbers(value, /transform/i.test(name) ? Math.min(6, precision + 2) : precision).replace(/\s+/g, ' ').trim());
      if (options.shortenColors && COLOR_ATTRIBUTES.has(name)) el.setAttribute(name, shortenColor(value));
      if (DEFAULT_ATTRIBUTES.some(([key, def]) => key === name && value === def)) el.removeAttribute(name);
    });
    if (el === root) {
      if (el.getAttribute('x') === '0') el.removeAttribute('x');
      if (el.getAttribute('y') === '0') el.removeAttribute('y');
      el.removeAttribute('enable-background');
      if (options.removeDimensions && el.hasAttribute('viewBox')) {
        el.removeAttribute('width');
        el.removeAttribute('height');
      }
      const usesXlink = [root, ...Array.from(root.getElementsByTagName('*'))].some((node) => Array.from(node.attributes).some((attr) => attr.name.startsWith('xlink:')));
      if (!usesXlink) el.removeAttribute('xmlns:xlink');
    }
  };

  const clean = (el: Element): void => {
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === COMMENT) {
        if (options.removeComments && !/^\s*!/.test(node.nodeValue ?? '')) el.removeChild(node);
        return;
      }
      if (node.nodeType === PI) { el.removeChild(node); return; }
      if (node.nodeType === TEXT) {
        if (!(node.nodeValue ?? '').trim() && !TEXT_ELEMENTS.has(el.localName)) el.removeChild(node);
        return;
      }
      if (node.nodeType !== ELEMENT) return;
      const child = node as Element;
      const name = child.localName;
      const prefix = child.prefix ?? '';
      if ((options.removeMetadata && name === 'metadata') || (options.removeEditorData && (EDITOR_NAMESPACES.includes(prefix) || name === 'namedview'))
        || (options.removeScripts && name === 'script') || (options.removeTitleDesc && (name === 'title' || name === 'desc'))) {
        el.removeChild(child);
        return;
      }
      clean(child);
      if (name === 'style') child.textContent = minifyCss(child.textContent ?? '', options.shortenColors);
      if (options.removeScripts && name === 'a') Array.from(child.attributes).forEach((attr) => { if (/^(xlink:)?href$/.test(attr.name) && /^\s*javascript:/i.test(attr.value)) child.removeAttribute(attr.name); });
    });
    cleanAttributes(el);
  };
  clean(root);

  if (options.removeUnusedIds && !hasScript) {
    const refs = collectReferences(root);
    const strip = (el: Element): void => {
      if (el.hasAttribute('id') && !refs.has(el.getAttribute('id') as string)) el.removeAttribute('id');
      Array.from(el.children).forEach(strip);
    };
    strip(root);
  }

  const simplify = (el: Element): void => {
    Array.from(el.children).forEach(simplify);
    Array.from(el.children).forEach((child) => {
      const name = child.localName;
      if (options.removeEmpty && (name === 'g' || name === 'defs' || name === 'symbol' || name === 'clipPath' || name === 'mask') && !child.childNodes.length && !(name !== 'g' && child.hasAttribute('id'))) {
        el.removeChild(child);
        return;
      }
      if (options.collapseGroups && name === 'g' && !child.attributes.length) {
        while (child.firstChild) el.insertBefore(child.firstChild, child);
        el.removeChild(child);
      }
    });
  };
  simplify(root);

  let output = new XMLSerializer().serializeToString(root);
  if (!options.removeDeclaration) {
    const declaration = /^\s*<\?xml[\s\S]*?\?>/.exec(source)?.[0].trim();
    if (declaration) output = `${declaration}\n${output}`;
  }
  return { ok: true, output };
}

export const svgDataUri = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
