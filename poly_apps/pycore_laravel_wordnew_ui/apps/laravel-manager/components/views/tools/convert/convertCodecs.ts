/** Pure text codecs and small text converters shared by the converter workbenches. */

const BASE64_STD = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2', sect: '\u00a7', deg: '\u00b0', plusmn: '\u00b1',
  times: '\u00d7', divide: '\u00f7', laquo: '\u00ab', raquo: '\u00bb', bull: '\u2022', middot: '\u00b7',
};
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const NATO_LETTERS: Record<string, string> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India',
  J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'Xray', Y: 'Yankee', Z: 'Zulu',
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Tree', '4': 'Four', '5': 'Fife', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Niner',
};
const NATO_REVERSE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(NATO_LETTERS).map(([ch, word]) => [word.toLowerCase(), ch])),
  alpha: 'A', juliet: 'J', 'x-ray': 'X', three: '3', five: '5', nine: '9',
};
const ROMAN_PAIRS: ReadonlyArray<readonly [string, number]> = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];
const ROMAN_VALID = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

export const ROMAN_MAX = 3999;
export const NATO_SPACE = '/';

export type TextCodecId = 'base64' | 'base64url' | 'base32' | 'hex' | 'url' | 'uri' | 'html' | 'quotedPrintable' | 'unicodeEscape' | 'jsonString';
export type BinaryRadix = 2 | 8 | 10 | 16;
export type UnicodeFormat = 'uplus' | 'js' | 'htmlHex' | 'htmlDec' | 'css';
export type UrlScope = 'component' | 'full' | 'form';

export interface TextCodec {
  id: TextCodecId;
  encode: (text: string) => string;
  decode: (text: string) => string;
}

export class ConvertError extends Error {
  constructor(public readonly code: string, public readonly detail = '') {
    super(code);
  }
}

const utf8Encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });
const lenientDecoder = new TextDecoder('utf-8');

export const utf8ToBytes = (text: string): Uint8Array => utf8Encoder.encode(text);

export const bytesToUtf8 = (bytes: Uint8Array, strict = true): string => {
  try {
    return (strict ? strictDecoder : lenientDecoder).decode(bytes);
  } catch {
    throw new ConvertError('not_utf8');
  }
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
};

export const toUrlSafeBase64 = (value: string, keepPadding = false): string => {
  const safe = value.replace(/\+/g, '-').replace(/\//g, '_');
  return keepPadding ? safe : safe.replace(/=+$/, '');
};

export const wrapLines = (value: string, width: number): string => {
  if (width <= 0) return value;
  const lines: string[] = [];
  for (let i = 0; i < value.length; i += width) lines.push(value.slice(i, i + width));
  return lines.join('\n');
};

/** Accepts standard and URL-safe alphabets, whitespace, a data URI prefix and missing padding. */
export const normalizeBase64 = (input: string): string => {
  const stripped = input.replace(/^\s*data:[^,]*,/i, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const unpadded = stripped.replace(/=+$/, '');
  if (!BASE64_STD.test(unpadded) || unpadded.length % 4 === 1) throw new ConvertError('invalid_base64');
  return unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
};

export const base64ToBytes = (input: string): Uint8Array => {
  const normalized = normalizeBase64(input);
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new ConvertError('invalid_base64');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const looksLikeBase64 = (input: string): boolean => {
  const compact = input.replace(/^\s*data:[^,]*,/i, '').replace(/\s+/g, '');
  return compact.length >= 4 && compact.length % 4 === 0 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(compact);
};

const bytesToBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  bytes.forEach((byte) => {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out + '='.repeat((8 - (out.length % 8)) % 8);
};

const base32ToBytes = (input: string): Uint8Array => {
  const clean = input.replace(/[\s=]+/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const index = BASE32_ALPHABET.indexOf(ch);
    if (index < 0) throw new ConvertError('invalid_base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
};

export const bytesToHex = (bytes: Uint8Array, separator = ''): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(separator);

const hexToBytes = (input: string): Uint8Array => {
  const clean = input.replace(/0x/gi, '').replace(/[\s,:;-]+/g, '');
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) throw new ConvertError('invalid_hex');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

const decodeEntity = (match: string, body: string): string => {
  if (body[0] === '#') {
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  const known = NAMED_ENTITIES[body];
  if (known !== undefined) return known;
  if (typeof document === 'undefined') return match;
  const holder = document.createElement('textarea');
  holder.innerHTML = match;
  return holder.value;
};

export const htmlEncode = (text: string, asciiOnly = false): string => {
  const escaped = text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  return asciiOnly ? escaped.replace(/[^\x00-\x7f]/gu, (ch) => `&#${ch.codePointAt(0)};`) : escaped;
};

export const htmlDecode = (text: string): string => text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, decodeEntity);

const quotedPrintableEncode = (text: string): string => {
  const bytes = utf8ToBytes(text);
  const lines: string[] = [];
  let line = '';
  const flush = (): void => {
    lines.push(line);
    line = '';
  };
  const push = (chunk: string): void => {
    if (line.length + chunk.length > 75) {
      line += '=';
      flush();
    }
    line += chunk;
  };
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === 10) {
      flush();
    } else if (byte === 13) {
      continue;
    } else if ((byte >= 33 && byte <= 126 && byte !== 61) || ((byte === 32 || byte === 9) && i + 1 < bytes.length && bytes[i + 1] !== 10 && bytes[i + 1] !== 13)) {
      push(String.fromCharCode(byte));
    } else {
      push(`=${byte.toString(16).toUpperCase().padStart(2, '0')}`);
    }
  }
  lines.push(line);
  return lines.join('\n');
};

const quotedPrintableDecode = (text: string): string => {
  const joined = text.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < joined.length; i += 1) {
    const ch = joined[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      out.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(...utf8ToBytes(ch));
    }
  }
  return bytesToUtf8(Uint8Array.from(out), false);
};

const unicodeEscapeEncode = (text: string): string => Array.from(text, (ch) => {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x20 && code < 0x7f) return ch === '\\' ? '\\\\' : ch;
  if (ch === '\n') return '\\n';
  if (ch === '\r') return '\\r';
  if (ch === '\t') return '\\t';
  if (code > 0xffff) return `\\u{${code.toString(16).toUpperCase()}}`;
  return `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
}).join('');

const unicodeEscapeDecode = (text: string): string => text.replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([nrt\\]))/g, (_m, brace, four, two, simple) => {
  if (simple) return simple === 'n' ? '\n' : simple === 'r' ? '\r' : simple === 't' ? '\t' : '\\';
  const hex = brace ?? four ?? two;
  const code = parseInt(hex, 16);
  return code <= 0xffff ? String.fromCharCode(code) : String.fromCodePoint(code);
});

const jsonStringDecode = (text: string): string => {
  try {
    return JSON.parse(`"${text.replace(/\r?\n/g, '\\n')}"`) as string;
  } catch {
    throw new ConvertError('invalid_escape');
  }
};

const guardUri = (fn: () => string): string => {
  try {
    return fn();
  } catch {
    throw new ConvertError('invalid_percent');
  }
};

export const urlEncode = (text: string, scope: UrlScope): string => {
  if (scope === 'full') return guardUri(() => encodeURI(text));
  const component = guardUri(() => encodeURIComponent(text)).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return scope === 'form' ? component.replace(/%20/g, '+') : component;
};

export const urlDecode = (text: string, scope: UrlScope): string => {
  if (scope === 'full') return guardUri(() => decodeURI(text));
  return guardUri(() => decodeURIComponent(scope === 'form' ? text.replace(/\+/g, ' ') : text));
};

export const TEXT_CODECS: Record<TextCodecId, TextCodec> = {
  base64: { id: 'base64', encode: (t) => bytesToBase64(utf8ToBytes(t)), decode: (t) => bytesToUtf8(base64ToBytes(t)) },
  base64url: { id: 'base64url', encode: (t) => toUrlSafeBase64(bytesToBase64(utf8ToBytes(t))), decode: (t) => bytesToUtf8(base64ToBytes(t)) },
  base32: { id: 'base32', encode: (t) => bytesToBase32(utf8ToBytes(t)), decode: (t) => bytesToUtf8(base32ToBytes(t)) },
  hex: { id: 'hex', encode: (t) => bytesToHex(utf8ToBytes(t), ' '), decode: (t) => bytesToUtf8(hexToBytes(t)) },
  url: { id: 'url', encode: (t) => urlEncode(t, 'component'), decode: (t) => urlDecode(t, 'component') },
  uri: { id: 'uri', encode: (t) => urlEncode(t, 'full'), decode: (t) => urlDecode(t, 'full') },
  html: { id: 'html', encode: (t) => htmlEncode(t, true), decode: htmlDecode },
  quotedPrintable: { id: 'quotedPrintable', encode: quotedPrintableEncode, decode: quotedPrintableDecode },
  unicodeEscape: { id: 'unicodeEscape', encode: unicodeEscapeEncode, decode: unicodeEscapeDecode },
  jsonString: { id: 'jsonString', encode: (t) => JSON.stringify(t).slice(1, -1), decode: jsonStringDecode },
};

export const TEXT_CODEC_IDS = Object.keys(TEXT_CODECS) as TextCodecId[];

export const parseUrlParts = (value: string): { origin: string; path: string; hash: string; params: Array<[string, string]> } | null => {
  try {
    const url = new URL(value);
    return { origin: url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin, path: url.pathname, hash: url.hash, params: Array.from(url.searchParams.entries()) };
  } catch {
    return null;
  }
};

export const formatByte = (byte: number, radix: BinaryRadix): string => byte.toString(radix).toUpperCase().padStart(radix === 2 ? 8 : radix === 8 ? 3 : radix === 16 ? 2 : 1, '0');

export const textToBytesRadix = (text: string, radix: BinaryRadix, separator = ' '): string => Array.from(utf8ToBytes(text), (b) => formatByte(b, radix)).join(separator);

export const parseRadixBytes = (input: string, radix: BinaryRadix): Uint8Array => {
  const compact = input.trim();
  const digitPattern = radix === 2 ? /^[01]+$/ : radix === 8 ? /^[0-7]+$/ : radix === 10 ? /^\d+$/ : /^[0-9a-fA-F]+$/;
  let tokens = compact.split(/[\s,;]+/).filter(Boolean).map((token) => (radix === 16 ? token.replace(/^0x/i, '') : radix === 2 ? token.replace(/^0b/i, '') : token));
  if (tokens.length === 1 && radix === 2 && tokens[0].length > 8) {
    if (tokens[0].length % 8 !== 0) throw new ConvertError('invalid_binary_length');
    tokens = tokens[0].match(/.{8}/g) ?? [];
  } else if (tokens.length === 1 && radix === 16 && tokens[0].length > 2) {
    if (tokens[0].length % 2 !== 0) throw new ConvertError('invalid_hex');
    tokens = tokens[0].match(/.{2}/g) ?? [];
  }
  const bytes = tokens.map((token) => {
    if (!digitPattern.test(token)) throw new ConvertError('invalid_digits');
    const value = parseInt(token, radix);
    if (value > 255) throw new ConvertError('byte_overflow');
    return value;
  });
  return Uint8Array.from(bytes);
};

export const bytesRadixToText = (input: string, radix: BinaryRadix): string => bytesToUtf8(parseRadixBytes(input, radix), false);

export interface CodePointInfo {
  char: string;
  code: number;
  hex: string;
  utf8: string;
  utf16: string;
}

export const describeCodePoints = (text: string): CodePointInfo[] => Array.from(text, (char) => {
  const code = char.codePointAt(0) ?? 0;
  const units: string[] = [];
  for (let i = 0; i < char.length; i += 1) units.push(char.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'));
  return {
    char,
    code,
    hex: code.toString(16).toUpperCase().padStart(4, '0'),
    utf8: bytesToHex(utf8ToBytes(char), ' ').toUpperCase(),
    utf16: units.join(' '),
  };
});

export const formatCodePoint = (code: number, format: UnicodeFormat): string => {
  const hex = code.toString(16).toUpperCase();
  switch (format) {
    case 'uplus': return `U+${hex.padStart(4, '0')}`;
    case 'js': return code > 0xffff ? `\\u{${hex}}` : `\\u${hex.padStart(4, '0')}`;
    case 'htmlHex': return `&#x${hex};`;
    case 'htmlDec': return `&#${code};`;
    default: return `\\${hex.padStart(4, '0')} `;
  }
};

export const encodeUnicodeText = (text: string, format: UnicodeFormat): string => Array.from(text, (ch) => formatCodePoint(ch.codePointAt(0) ?? 0, format)).join(format === 'css' ? '' : ' ').trimEnd();

export const decodeUnicodeText = (input: string, format: UnicodeFormat): string => {
  const base = 'U\\+(?<u>[0-9a-fA-F]{1,6})|\\\\u\\{(?<b>[0-9a-fA-F]{1,6})\\}|\\\\u(?<f>[0-9a-fA-F]{4})|&#[xX](?<x>[0-9a-fA-F]+);|&#(?<d>\\d+);';
  const pattern = new RegExp(`(?:${format === 'css' ? `${base}|\\\\(?<c>[0-9a-fA-F]{1,6})` : base})\\s*`, 'g');
  let found = false;
  const decoded = input.replace(pattern, (...args: unknown[]) => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    const decimal = groups.d;
    const hex = groups.u ?? groups.b ?? groups.f ?? groups.x ?? groups.c;
    const value = decimal !== undefined ? parseInt(decimal, 10) : parseInt(hex ?? '', 16);
    if (!Number.isFinite(value) || value > 0x10ffff) throw new ConvertError('invalid_code_point');
    found = true;
    return value <= 0xffff ? String.fromCharCode(value) : String.fromCodePoint(value);
  });
  if (!found && input.trim()) throw new ConvertError('no_code_points');
  return decoded;
};

export interface NatoToken {
  char: string;
  word: string | null;
}

export const textToNatoTokens = (text: string): NatoToken[] => Array.from(text.normalize('NFD').replace(/\p{M}/gu, '')).map((char) => {
  const upper = char.toUpperCase();
  return { char: /\s/.test(char) ? NATO_SPACE : char, word: NATO_LETTERS[upper] ?? null };
});

export const natoTokensToText = (tokens: NatoToken[]): string => tokens.map((token) => (token.word ? token.word : token.char)).join(' ').replace(/ +/g, ' ');

export const natoToText = (input: string): { text: string; unknown: string[] } => {
  const unknown: string[] = [];
  const text = input.split(/[\s,]+/).filter(Boolean).map((word) => {
    if (word === NATO_SPACE || word === '|') return ' ';
    const letter = NATO_REVERSE[word.toLowerCase()];
    if (letter) return letter;
    unknown.push(word);
    return '?';
  }).join('');
  return { text, unknown };
};

export const toRoman = (value: number): string => {
  if (!Number.isInteger(value) || value < 1 || value > ROMAN_MAX) throw new ConvertError('roman_range');
  let rest = value;
  let out = '';
  ROMAN_PAIRS.forEach(([symbol, amount]) => {
    while (rest >= amount) {
      out += symbol;
      rest -= amount;
    }
  });
  return out;
};

export const fromRoman = (input: string): number => {
  const upper = input.trim().toUpperCase();
  if (!upper || !ROMAN_VALID.test(upper)) throw new ConvertError('invalid_roman');
  let total = 0;
  let rest = upper;
  ROMAN_PAIRS.forEach(([symbol, amount]) => {
    while (rest.startsWith(symbol)) {
      total += amount;
      rest = rest.slice(symbol.length);
    }
  });
  return total;
};

export const romanBreakdown = (value: number): Array<{ symbol: string; amount: number }> => {
  const parts: Array<{ symbol: string; amount: number }> = [];
  let rest = value;
  ROMAN_PAIRS.forEach(([symbol, amount]) => {
    while (rest >= amount) {
      parts.push({ symbol, amount });
      rest -= amount;
    }
  });
  return parts;
};
