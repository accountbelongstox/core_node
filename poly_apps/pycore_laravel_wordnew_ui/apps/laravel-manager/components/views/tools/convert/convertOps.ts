/** Pure case, slug, list, number-base and temperature conversions for the converter workbenches. */

export type CaseStyleId =
  | 'camel' | 'pascal' | 'snake' | 'constant' | 'kebab' | 'cobol' | 'train' | 'dot' | 'path'
  | 'title' | 'sentence' | 'lower' | 'upper' | 'alternating';
export type ListSeparatorId = 'newline' | 'comma' | 'semicolon' | 'pipe' | 'space' | 'tab' | 'custom';
export type ListSortId = 'none' | 'asc' | 'desc' | 'natural' | 'length' | 'reverse';
export type ListQuoteId = 'none' | 'single' | 'double' | 'backtick';
export type ListBracketId = 'none' | 'square' | 'round' | 'curly';
export type TemperatureUnit = 'C' | 'F' | 'K' | 'R' | 'Re';

export interface SlugOptions {
  separator: string;
  lowercase: boolean;
  maxLength: number;
  keepUnicode: boolean;
}

export interface ListOptions {
  from: ListSeparatorId;
  fromCustom: string;
  to: ListSeparatorId;
  toCustom: string;
  trim: boolean;
  dropEmpty: boolean;
  unique: boolean;
  sort: ListSortId;
  quote: ListQuoteId;
  bracket: ListBracketId;
}

export const CASE_STYLE_IDS: CaseStyleId[] = ['camel', 'pascal', 'snake', 'constant', 'kebab', 'cobol', 'train', 'dot', 'path', 'title', 'sentence', 'lower', 'upper', 'alternating'];
export const LIST_SEPARATOR_IDS: ListSeparatorId[] = ['newline', 'comma', 'semicolon', 'pipe', 'space', 'tab', 'custom'];
export const LIST_SORT_IDS: ListSortId[] = ['none', 'asc', 'desc', 'natural', 'length', 'reverse'];
export const LIST_QUOTE_IDS: ListQuoteId[] = ['none', 'single', 'double', 'backtick'];
export const LIST_BRACKET_IDS: ListBracketId[] = ['none', 'square', 'round', 'curly'];
export const TEMPERATURE_UNITS: TemperatureUnit[] = ['C', 'F', 'K', 'R', 'Re'];
export const ABSOLUTE_ZERO_C = -273.15;
export const BASE_MIN = 2;
export const BASE_MAX = 36;
export const DEFAULT_SLUG_OPTIONS: SlugOptions = { separator: '-', lowercase: true, maxLength: 0, keepUnicode: true };
export const DEFAULT_LIST_OPTIONS: ListOptions = {
  from: 'newline', fromCustom: ',', to: 'comma', toCustom: ', ', trim: true, dropEmpty: true, unique: false, sort: 'none', quote: 'none', bracket: 'none',
};

const LIST_SEPARATORS: Record<Exclude<ListSeparatorId, 'custom'>, string> = {
  newline: '\n', comma: ',', semicolon: ';', pipe: '|', space: ' ', tab: '\t',
};
const LIST_QUOTES: Record<ListQuoteId, string> = { none: '', single: "'", double: '"', backtick: '`' };
const LIST_BRACKETS: Record<ListBracketId, [string, string]> = { none: ['', ''], square: ['[', ']'], round: ['(', ')'], curly: ['{', '}'] };
const TRANSLITERATIONS: Record<string, string> = {
  'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'ø': 'o', 'Ø': 'O', 'đ': 'd', 'Đ': 'D', 'ł': 'l', 'Ł': 'L',
  'œ': 'oe', 'Œ': 'OE', 'þ': 'th', 'Þ': 'TH', 'ð': 'd', 'Ð': 'D', 'ı': 'i',
};
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

const capitalize = (word: string): string => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word);

export const splitWords = (line: string): string[] => line
  .split(/[^\p{L}\p{N}]+/u)
  .filter(Boolean)
  .flatMap((chunk) => chunk.split(/(?<=[\p{Ll}\p{N}])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u));

const CASE_STYLES: Record<CaseStyleId, (words: string[], line: string) => string> = {
  camel: (w) => w.map((word, i) => (i === 0 ? word.toLowerCase() : capitalize(word))).join(''),
  pascal: (w) => w.map(capitalize).join(''),
  snake: (w) => w.map((word) => word.toLowerCase()).join('_'),
  constant: (w) => w.map((word) => word.toUpperCase()).join('_'),
  kebab: (w) => w.map((word) => word.toLowerCase()).join('-'),
  cobol: (w) => w.map((word) => word.toUpperCase()).join('-'),
  train: (w) => w.map(capitalize).join('-'),
  dot: (w) => w.map((word) => word.toLowerCase()).join('.'),
  path: (w) => w.map((word) => word.toLowerCase()).join('/'),
  title: (w) => w.map(capitalize).join(' '),
  sentence: (w) => w.map((word, i) => (i === 0 ? capitalize(word) : word.toLowerCase())).join(' '),
  lower: (_w, line) => line.toLowerCase(),
  upper: (_w, line) => line.toUpperCase(),
  alternating: (_w, line) => Array.from(line.toLowerCase(), (ch, i) => (i % 2 === 1 ? ch.toUpperCase() : ch)).join(''),
};

export const convertCaseText = (text: string, style: CaseStyleId): string => text
  .split(/\r?\n/)
  .map((line) => CASE_STYLES[style](splitWords(line), line))
  .join('\n');

export const slugifyText = (text: string, options: SlugOptions): string => text.split(/\r?\n/).map((line) => {
  let value = line.replace(/[ßæÆøØđĐłŁœŒþÞðÐı]/g, (ch) => TRANSLITERATIONS[ch]);
  value = value.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
  if (options.lowercase) value = value.toLowerCase();
  const allowed = options.keepUnicode ? /[^\p{L}\p{N}]+/gu : /[^A-Za-z0-9]+/g;
  value = value.replace(allowed, ' ').trim().replace(/ +/g, options.separator);
  if (options.maxLength > 0 && value.length > options.maxLength) {
    const next = value[options.maxLength];
    value = value.slice(0, options.maxLength);
    const cut = value.lastIndexOf(options.separator);
    if (next !== options.separator && cut > 0) value = value.slice(0, cut);
  }
  return value;
}).join('\n');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const separatorValue = (id: ListSeparatorId, custom: string): string => (id === 'custom' ? custom : LIST_SEPARATORS[id]);

export const parseListItems = (text: string, options: ListOptions): string[] => {
  if (!text) return [];
  const separator = separatorValue(options.from, options.fromCustom);
  let items = separator ? text.split(options.from === 'newline' ? /\r?\n/ : separator) : [text];
  if (options.trim) items = items.map((item) => item.trim());
  if (options.dropEmpty) items = items.filter((item) => item !== '');
  if (options.unique) items = Array.from(new Set(items));
  switch (options.sort) {
    case 'asc': items = [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); break;
    case 'desc': items = [...items].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); break;
    case 'natural': items = [...items].sort(collator.compare); break;
    case 'length': items = [...items].sort((a, b) => a.length - b.length); break;
    case 'reverse': items = [...items].reverse(); break;
    default: break;
  }
  return items;
};

export const joinListItems = (items: string[], options: ListOptions): string => {
  const quote = LIST_QUOTES[options.quote];
  const [open, close] = LIST_BRACKETS[options.bracket];
  const separator = separatorValue(options.to, options.toCustom);
  return open + items.map((item) => `${quote}${quote ? item.split(quote).join(`\\${quote}`) : item}${quote}`).join(separator) + close;
};

export const sanitizeBaseDigits = (input: string, base: number): string => {
  let value = input.trim().replace(/[\s_,]/g, '').toLowerCase();
  const prefixes: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
  const sign = value.startsWith('-') ? '-' : '';
  value = value.replace(/^[-+]/, '');
  if (prefixes[base] && value.startsWith(prefixes[base])) value = value.slice(2);
  return sign + value;
};

export const parseBaseValue = (input: string, base: number): bigint | null => {
  const clean = sanitizeBaseDigits(input, base);
  const negative = clean.startsWith('-');
  const digits = negative ? clean.slice(1) : clean;
  if (!digits) return null;
  let total = BigInt(0);
  const big = BigInt(base);
  for (const ch of digits) {
    const digit = DIGITS.indexOf(ch);
    if (digit < 0 || digit >= base) return null;
    total = total * big + BigInt(digit);
  }
  return negative ? -total : total;
};

export const formatBaseValue = (value: bigint, base: number): string => value.toString(base).toUpperCase();

export const groupDigits = (digits: string, size: number): string => {
  const negative = digits.startsWith('-');
  const body = negative ? digits.slice(1) : digits;
  const groups: string[] = [];
  for (let end = body.length; end > 0; end -= size) groups.unshift(body.slice(Math.max(0, end - size), end));
  return (negative ? '-' : '') + groups.join(' ');
};

export const toCelsius = (value: number, unit: TemperatureUnit): number => {
  switch (unit) {
    case 'F': return (value - 32) * 5 / 9;
    case 'K': return value + ABSOLUTE_ZERO_C;
    case 'R': return (value - 491.67) * 5 / 9;
    case 'Re': return value * 5 / 4;
    default: return value;
  }
};

export const fromCelsius = (celsius: number, unit: TemperatureUnit): number => {
  switch (unit) {
    case 'F': return celsius * 9 / 5 + 32;
    case 'K': return celsius - ABSOLUTE_ZERO_C;
    case 'R': return (celsius - ABSOLUTE_ZERO_C) * 9 / 5;
    case 'Re': return celsius * 4 / 5;
    default: return celsius;
  }
};

export const formatNumber = (value: number, digits = 4): string => {
  if (!Number.isFinite(value)) return '';
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
};
