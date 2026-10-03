/** JSON parsing with exact error positions, formatting and structural diff. */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonErrorCode = 'empty' | 'unexpected_end' | 'unexpected_char' | 'bad_string' | 'bad_escape' | 'bad_number' | 'trailing_data';

export interface JsonErrorInfo {
  code: JsonErrorCode;
  offset: number;
  line: number;
  column: number;
  char: string;
}

export type JsonParseResult = { ok: true; value: JsonValue } | { ok: false; error: JsonErrorInfo };

export type JsonIndent = 2 | 4 | 8 | 'tab';

export type DiffKind = 'added' | 'removed' | 'changed' | 'type';

export interface JsonDiffEntry {
  kind: DiffKind;
  path: string;
  pointer: string;
  before?: JsonValue;
  after?: JsonValue;
}

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: JsonValue;
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const HEX = /^[0-9a-fA-F]{4}$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/;

class JsonScanError extends Error {
  constructor(readonly code: JsonErrorCode, readonly offset: number) {
    super(code);
  }
}

const locate = (text: string, offset: number): { line: number; column: number } => {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
};

const scanValue = (text: string, start: number, depth: number): number => {
  const skip = (from: number): number => {
    let i = from;
    while (i < text.length && WHITESPACE.has(text[i])) i++;
    return i;
  };
  const fail = (code: JsonErrorCode, at: number): never => {
    throw new JsonScanError(at >= text.length && code === 'unexpected_char' ? 'unexpected_end' : code, at);
  };
  const scanString = (from: number): number => {
    let i = from + 1;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') return i + 1;
      if (c < ' ') return fail('bad_string', i);
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!HEX.test(text.slice(i + 2, i + 6))) return fail('bad_escape', i);
          i += 6;
        } else if (e !== undefined && ESCAPES.has(e)) i += 2;
        else return fail('bad_escape', i);
      } else i++;
    }
    return fail('unexpected_end', text.length);
  };
  const scan = (from: number, level: number): number => {
    if (level > 2000) return fail('unexpected_char', from);
    let i = skip(from);
    const c = text[i];
    if (c === undefined) return fail('unexpected_end', i);
    if (c === '{') {
      i = skip(i + 1);
      if (text[i] === '}') return i + 1;
      for (;;) {
        if (text[i] !== '"') return fail('unexpected_char', i);
        i = skip(scanString(i));
        if (text[i] !== ':') return fail('unexpected_char', i);
        i = skip(scan(i + 1, level + 1));
        if (text[i] === ',') { i = skip(i + 1); continue; }
        if (text[i] === '}') return i + 1;
        return fail('unexpected_char', i);
      }
    }
    if (c === '[') {
      i = skip(i + 1);
      if (text[i] === ']') return i + 1;
      for (;;) {
        i = skip(scan(i, level + 1));
        if (text[i] === ',') { i = skip(i + 1); continue; }
        if (text[i] === ']') return i + 1;
        return fail('unexpected_char', i);
      }
    }
    if (c === '"') return scanString(i);
    for (const word of ['true', 'false', 'null']) if (text.startsWith(word, i)) return i + word.length;
    if (c === '-' || (c >= '0' && c <= '9')) {
      const match = NUMBER.exec(text.slice(i, i + 400));
      if (!match) return fail('bad_number', i);
      return i + match[0].length;
    }
    return fail('unexpected_char', i);
  };
  return scan(start, depth);
};

/** Strict JSON parse; failures carry the exact offset, line and column. */
export function parseJson(text: string): JsonParseResult {
  if (!text.trim()) return { ok: false, error: { code: 'empty', offset: 0, line: 1, column: 1, char: '' } };
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    let offset = 0;
    let code: JsonErrorCode = 'unexpected_char';
    try {
      let end = scanValue(text, 0, 0);
      while (end < text.length && WHITESPACE.has(text[end])) end++;
      if (end < text.length) {
        offset = end;
        code = 'trailing_data';
      }
    } catch (error) {
      if (error instanceof JsonScanError) {
        offset = error.offset;
        code = error.code;
      }
    }
    return { ok: false, error: { code, offset, ...locate(text, offset), char: text[offset] ?? '' } };
  }
}

export const sortKeysDeep = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    Object.keys(value).sort().forEach((key) => { out[key] = sortKeysDeep(value[key]); });
    return out;
  }
  return value;
};

export const stringifyJson = (value: JsonValue, indent: JsonIndent | 0): string => (
  indent === 0 ? JSON.stringify(value) : JSON.stringify(value, null, indent === 'tab' ? '\t' : indent)
);

export const jsonTypeOf = (value: JsonValue): 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object' => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as 'boolean' | 'number' | 'string' | 'object';
};

export const jsonChildCount = (value: JsonValue): number => (Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0);

const pathKey = (path: string, key: string | number): string => {
  if (typeof key === 'number') return `${path}[${key}]`;
  return IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
};

const pointerKey = (pointer: string, key: string | number): string => `${pointer}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** Structural comparison by path: key order is ignored, arrays compare by index. */
export function diffJson(before: JsonValue, after: JsonValue): JsonDiffEntry[] {
  const entries: JsonDiffEntry[] = [];
  const walk = (a: JsonValue, b: JsonValue, path: string, pointer: string): void => {
    const typeA = jsonTypeOf(a);
    const typeB = jsonTypeOf(b);
    if (typeA !== typeB) {
      entries.push({ kind: 'type', path, pointer, before: a, after: b });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const shared = Math.min(a.length, b.length);
      for (let i = 0; i < shared; i++) walk(a[i], b[i], pathKey(path, i), pointerKey(pointer, i));
      for (let i = shared; i < b.length; i++) entries.push({ kind: 'added', path: pathKey(path, i), pointer: pointerKey(pointer, i), after: b[i] });
      for (let i = a.length - 1; i >= shared; i--) entries.push({ kind: 'removed', path: pathKey(path, i), pointer: pointerKey(pointer, i), before: a[i] });
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const objA = a as { [key: string]: JsonValue };
      const objB = b as { [key: string]: JsonValue };
      const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
      keys.forEach((key) => {
        const childPath = pathKey(path, key);
        const childPointer = pointerKey(pointer, key);
        if (!(key in objB)) entries.push({ kind: 'removed', path: childPath, pointer: childPointer, before: objA[key] });
        else if (!(key in objA)) entries.push({ kind: 'added', path: childPath, pointer: childPointer, after: objB[key] });
        else walk(objA[key], objB[key], childPath, childPointer);
      });
      return;
    }
    if (a !== b) entries.push({ kind: 'changed', path, pointer, before: a, after: b });
  };
  walk(before, after, '$', '');
  return entries;
}

export const toJsonPatch = (entries: JsonDiffEntry[]): JsonPatchOp[] => entries.map((entry) => {
  if (entry.kind === 'added') return { op: 'add', path: entry.pointer, value: entry.after };
  if (entry.kind === 'removed') return { op: 'remove', path: entry.pointer };
  return { op: 'replace', path: entry.pointer, value: entry.after };
});

export const countNodes = (value: JsonValue): number => {
  if (Array.isArray(value)) return 1 + value.reduce((sum: number, item) => sum + countNodes(item), 0);
  if (value && typeof value === 'object') return 1 + Object.values(value).reduce((sum: number, item) => sum + countNodes(item), 0);
  return 1;
};
