/** PDF helpers for the server-backed PDF workbenches: page-count sniffing, page ranges, password strength, result decoding. */
export interface PdfInfo { pages: number | null; encrypted: boolean }
export interface PageRange { from: number; to: number }

const MAX_SNIFF_BYTES = 64 * 1024 * 1024;
const PAGES_NODE = /\/Type\s*\/Pages\b/g;
const PAGE_NODE = /\/Type\s*\/Page\b(?!s)/g;
const COUNT_ENTRY = /\/Count\s+(\d+)/g;
const NODE_WINDOW = 400;
const DATA_URL_PREFIX = /^data:[^;,]*;base64,/;
const PASSWORD_LENGTHS = [8, 12, 16];
export const PDF_MAX_STRENGTH = 4;

export const isPdfFile = (file: File): boolean => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

const latin1 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return out;
};

export const sniffPdfText = (text: string): PdfInfo => {
  const encrypted = /\/Encrypt\b/.test(text);
  let pages = 0;
  for (const match of text.matchAll(PAGES_NODE)) {
    const start = Math.max(0, (match.index ?? 0) - NODE_WINDOW);
    const window = text.slice(start, (match.index ?? 0) + NODE_WINDOW);
    for (const count of window.matchAll(COUNT_ENTRY)) pages = Math.max(pages, Number(count[1]));
  }
  if (pages === 0) pages = (text.match(PAGE_NODE) ?? []).length;
  return { pages: pages > 0 ? pages : null, encrypted };
};

const OBJECT_STREAM = /\/Type\s*\/ObjStm\b/g;
const MAX_OBJECT_STREAMS = 200;

const inflate = async (data: Uint8Array): Promise<string> => {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return latin1(await new Response(stream).arrayBuffer());
};

/** Page-tree nodes of modern PDFs live inside compressed object streams; their text is appended for the sniffer. */
const readObjectStreams = async (text: string): Promise<string> => {
  let out = '';
  let seen = 0;
  for (const match of text.matchAll(OBJECT_STREAM)) {
    if (seen++ >= MAX_OBJECT_STREAMS) break;
    const dataStart = /stream\r?\n/.exec(text.slice(match.index ?? 0, (match.index ?? 0) + 2000));
    if (!dataStart) continue;
    const begin = (match.index ?? 0) + dataStart.index + dataStart[0].length;
    const end = text.indexOf('endstream', begin);
    if (end < 0) continue;
    const bytes = Uint8Array.from(text.slice(begin, end), (c) => c.charCodeAt(0));
    try {
      out += await inflate(bytes);
    } catch {
      /* not Flate-encoded or truncated: skip this stream */
    }
  }
  return out;
};

export const readPdfInfo = async (file: File): Promise<PdfInfo> => {
  if (file.size > MAX_SNIFF_BYTES) return { pages: null, encrypted: false };
  try {
    const text = latin1(await file.arrayBuffer());
    const direct = sniffPdfText(text);
    if (direct.pages !== null || typeof DecompressionStream === 'undefined') return direct;
    const inner = sniffPdfText(await readObjectStreams(text));
    return { pages: inner.pages, encrypted: direct.encrypted };
  } catch {
    return { pages: null, encrypted: false };
  }
};

export const clampPage = (value: number, total: number | null): number =>
  Math.max(1, Math.min(Number.isFinite(value) ? Math.floor(value) : 1, total ?? Number.MAX_SAFE_INTEGER));

/** `3-5`-style range strings sent to the backend (`ranges`), one output file per entry. */
export const serializeRanges = (rows: readonly PageRange[]): string[] =>
  rows.map(({ from, to }) => (from === to ? String(from) : `${Math.min(from, to)}-${Math.max(from, to)}`));

export type RangePreset = 'each' | 'odd' | 'even' | 'halves' | 'every';

export const presetRanges = (kind: RangePreset, total: number, step: number): PageRange[] => {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  if (kind === 'each') return pages.map((p) => ({ from: p, to: p }));
  if (kind === 'odd') return pages.filter((p) => p % 2 === 1).map((p) => ({ from: p, to: p }));
  if (kind === 'even') return pages.filter((p) => p % 2 === 0).map((p) => ({ from: p, to: p }));
  if (kind === 'halves') {
    const mid = Math.ceil(total / 2);
    return total > 1 ? [{ from: 1, to: mid }, { from: mid + 1, to: total }] : [{ from: 1, to: 1 }];
  }
  const size = Math.max(1, Math.floor(step));
  const rows: PageRange[] = [];
  for (let from = 1; from <= total; from += size) rows.push({ from, to: Math.min(total, from + size - 1) });
  return rows;
};

/** Parses `1-3, 5, 8-10`; returns null when a token is malformed or outside 1..total. */
export const parseRangeText = (text: string, total: number | null): PageRange[] | null => {
  const rows: PageRange[] = [];
  for (const token of text.split(/[,\s]+/).filter(Boolean)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) return null;
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to < 1 || (total !== null && (from > total || to > total))) return null;
    rows.push({ from: Math.min(from, to), to: Math.max(from, to) });
  }
  return rows.length > 0 ? rows : null;
};

export const rangesToText = (rows: readonly PageRange[]): string => serializeRanges(rows).join(', ');

/** Which output part (index) first claims each page, 0-based by page-1; -1 when unused. */
export const pagePartMap = (rows: readonly PageRange[], total: number): number[] => {
  const map = new Array<number>(total).fill(-1);
  rows.forEach((row, index) => {
    for (let p = Math.max(1, row.from); p <= Math.min(total, row.to); p += 1) if (map[p - 1] < 0) map[p - 1] = index;
  });
  return map;
};

export const rowsToPages = (rows: readonly PageRange[], total: number | null): number[] => {
  const set = new Set<number>();
  rows.forEach((row) => {
    for (let p = row.from; p <= row.to && (total === null || p <= total); p += 1) set.add(p);
  });
  return Array.from(set).sort((a, b) => a - b);
};

export const pagesToRows = (pages: readonly number[]): PageRange[] => {
  const rows: PageRange[] = [];
  [...pages].sort((a, b) => a - b).forEach((p) => {
    const last = rows[rows.length - 1];
    if (last && p === last.to + 1) last.to = p;
    else if (!last || p > last.to) rows.push({ from: p, to: p });
  });
  return rows;
};

export interface PasswordStrength { score: number; hasLength: boolean; hasMixedCase: boolean; hasDigit: boolean; hasSymbol: boolean }

export const passwordStrength = (password: string): PasswordStrength => {
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasLength = password.length >= PASSWORD_LENGTHS[0];
  let score = 0;
  if (password.length > 0) score += 1;
  if (hasLength && (hasMixedCase || hasDigit)) score += 1;
  if (password.length >= PASSWORD_LENGTHS[1] && [hasMixedCase, hasDigit, hasSymbol].filter(Boolean).length >= 2) score += 1;
  if (password.length >= PASSWORD_LENGTHS[2] && hasMixedCase && hasDigit && hasSymbol) score += 1;
  return { score: Math.min(PDF_MAX_STRENGTH, score), hasLength, hasMixedCase, hasDigit, hasSymbol };
};

export const dataUrlToBlob = (dataUrl: string, fallbackMime = 'application/pdf'): Blob => {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? fallbackMime;
  const binary = atob(dataUrl.replace(DATA_URL_PREFIX, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};
