/** TOML 1.0 parser and emitter (tables, arrays of tables, inline tables, all string forms, date-times kept as text). */
import { ConvertError } from './convertCodecs';
import type { JsonValue } from './structuredYaml';

type TomlTable = { [key: string]: JsonValue };

const BARE_KEY = /^[A-Za-z0-9_-]+$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?$|^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const BASIC_ESCAPES: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };

class TomlParser {
  private pos = 0;

  private readonly root: TomlTable = {};

  private current: TomlTable = this.root;

  private readonly explicitTables = new Set<TomlTable>();

  private readonly inlineTables = new Set<TomlTable>();

  constructor(private readonly text: string) {}

  parse(): TomlTable {
    for (;;) {
      this.skipBlank();
      if (this.pos >= this.text.length) return this.root;
      if (this.text[this.pos] === '[') this.header();
      else this.keyValue(this.current);
      this.endOfLine();
    }
  }

  private peek(offset = 0): string {
    return this.text[this.pos + offset] ?? '';
  }

  private skipSpaces(): void {
    while (this.peek() === ' ' || this.peek() === '\t') this.pos += 1;
  }

  private skipBlank(): void {
    for (;;) {
      this.skipSpaces();
      if (this.peek() === '#') {
        while (this.pos < this.text.length && this.peek() !== '\n') this.pos += 1;
      }
      if (this.peek() === '\n' || this.peek() === '\r') this.pos += 1;
      else return;
    }
  }

  private endOfLine(): void {
    this.skipSpaces();
    if (this.peek() === '#') while (this.pos < this.text.length && this.peek() !== '\n') this.pos += 1;
    if (this.pos < this.text.length && this.peek() !== '\n' && this.peek() !== '\r') throw new ConvertError('toml_unexpected_text');
  }

  private header(): void {
    const isArray = this.peek(1) === '[';
    this.pos += isArray ? 2 : 1;
    const path = this.keyPath();
    this.skipSpaces();
    if (this.text.slice(this.pos, this.pos + (isArray ? 2 : 1)) !== (isArray ? ']]' : ']')) throw new ConvertError('toml_bad_header');
    this.pos += isArray ? 2 : 1;
    let table = this.root;
    path.forEach((key, i) => {
      const last = i === path.length - 1;
      let next = table[key];
      if (last && isArray) {
        if (next === undefined) {
          next = [];
          table[key] = next;
        }
        if (!Array.isArray(next)) throw new ConvertError('toml_key_conflict');
        const entry: TomlTable = {};
        next.push(entry);
        table = entry;
      } else {
        if (next === undefined) {
          next = {};
          table[key] = next;
        }
        if (Array.isArray(next)) next = next[next.length - 1];
        if (!next || typeof next !== 'object' || Array.isArray(next) || this.inlineTables.has(next as TomlTable)) throw new ConvertError('toml_key_conflict');
        table = next as TomlTable;
        if (last) {
          if (this.explicitTables.has(table)) throw new ConvertError('toml_duplicate_table');
          this.explicitTables.add(table);
        }
      }
    });
    this.current = table;
  }

  private keyPath(): string[] {
    const path: string[] = [];
    for (;;) {
      this.skipSpaces();
      path.push(this.key());
      this.skipSpaces();
      if (this.peek() === '.') this.pos += 1;
      else return path;
    }
  }

  private key(): string {
    const ch = this.peek();
    if (ch === '"') return this.basicString();
    if (ch === "'") return this.literalString();
    const start = this.pos;
    while (BARE_KEY.test(this.peek() || ' ')) this.pos += 1;
    if (start === this.pos) throw new ConvertError('toml_bad_key');
    return this.text.slice(start, this.pos);
  }

  private keyValue(target: TomlTable): void {
    const path = this.keyPath();
    this.skipSpaces();
    if (this.peek() !== '=') throw new ConvertError('toml_expected_equals');
    this.pos += 1;
    this.skipSpaces();
    const value = this.value();
    let table = target;
    path.slice(0, -1).forEach((key) => {
      let next = table[key];
      if (next === undefined) {
        next = {};
        table[key] = next;
      }
      if (!next || typeof next !== 'object' || Array.isArray(next) || this.inlineTables.has(next as TomlTable)) throw new ConvertError('toml_key_conflict');
      table = next as TomlTable;
    });
    const last = path[path.length - 1];
    if (last in table) throw new ConvertError('toml_duplicate_key');
    table[last] = value;
  }

  private value(): JsonValue {
    const ch = this.peek();
    if (ch === '"') return this.text.startsWith('"""', this.pos) ? this.multilineBasic() : this.basicString();
    if (ch === "'") return this.text.startsWith("'''", this.pos) ? this.multilineLiteral() : this.literalString();
    if (ch === '[') return this.array();
    if (ch === '{') return this.inlineTable();
    const match = /^[^\s,\]}#]+(?:[ ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?/.exec(this.text.slice(this.pos));
    if (!match) throw new ConvertError('toml_bad_value');
    this.pos += match[0].length;
    return this.scalar(match[0]);
  }

  private scalar(raw: string): JsonValue {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (DATETIME.test(raw)) return raw;
    if (/^[+-]?inf$/.test(raw)) return raw.startsWith('-') ? -Infinity : Infinity;
    if (/^[+-]?nan$/.test(raw)) return NaN;
    const clean = raw.replace(/_/g, '');
    if (/^0x[0-9a-fA-F]+$/.test(clean)) return parseInt(clean.slice(2), 16);
    if (/^0o[0-7]+$/.test(clean)) return parseInt(clean.slice(2), 8);
    if (/^0b[01]+$/.test(clean)) return parseInt(clean.slice(2), 2);
    if (/^[+-]?(?:0|[1-9]\d*)$/.test(clean)) return Number(clean);
    if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(clean)) return Number(clean);
    throw new ConvertError('toml_bad_value');
  }

  private escape(): string {
    const code = this.peek();
    this.pos += 1;
    if (code in BASIC_ESCAPES) return BASIC_ESCAPES[code];
    if (code === 'u' || code === 'U') {
      const length = code === 'u' ? 4 : 8;
      const hex = this.text.slice(this.pos, this.pos + length);
      if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) throw new ConvertError('toml_bad_escape');
      this.pos += length;
      return String.fromCodePoint(parseInt(hex, 16));
    }
    throw new ConvertError('toml_bad_escape');
  }

  private basicString(): string {
    this.pos += 1;
    let out = '';
    for (;;) {
      const ch = this.peek();
      if (!ch || ch === '\n') throw new ConvertError('toml_unterminated_string');
      this.pos += 1;
      if (ch === '"') return out;
      out += ch === '\\' ? this.escape() : ch;
    }
  }

  private literalString(): string {
    this.pos += 1;
    const end = this.text.indexOf("'", this.pos);
    const newline = this.text.indexOf('\n', this.pos);
    if (end < 0 || (newline >= 0 && newline < end)) throw new ConvertError('toml_unterminated_string');
    const out = this.text.slice(this.pos, end);
    this.pos = end + 1;
    return out;
  }

  private multilineBasic(): string {
    this.pos += 3;
    if (this.peek() === '\r') this.pos += 1;
    if (this.peek() === '\n') this.pos += 1;
    let out = '';
    for (;;) {
      if (this.pos >= this.text.length) throw new ConvertError('toml_unterminated_string');
      if (this.text.startsWith('"""', this.pos)) {
        let extra = 0;
        while (this.text[this.pos + 3 + extra] === '"' && extra < 2) extra += 1;
        out += '"'.repeat(extra);
        this.pos += 3 + extra;
        return out;
      }
      const ch = this.peek();
      this.pos += 1;
      if (ch === '\\') {
        if (/^[ \t]*\r?\n/.test(this.text.slice(this.pos))) {
          while (/\s/.test(this.peek()) && this.pos < this.text.length) this.pos += 1;
        } else out += this.escape();
      } else out += ch;
    }
  }

  private multilineLiteral(): string {
    this.pos += 3;
    if (this.peek() === '\r') this.pos += 1;
    if (this.peek() === '\n') this.pos += 1;
    const end = this.text.indexOf("'''", this.pos);
    if (end < 0) throw new ConvertError('toml_unterminated_string');
    let close = end;
    while (this.text[close + 3] === "'" && close - end < 2) close += 1;
    const out = this.text.slice(this.pos, close);
    this.pos = close + 3;
    return out;
  }

  private array(): JsonValue {
    this.pos += 1;
    const items: JsonValue[] = [];
    for (;;) {
      this.skipBlank();
      if (this.peek() === ']') {
        this.pos += 1;
        return items;
      }
      if (this.pos >= this.text.length) throw new ConvertError('toml_unterminated_array');
      items.push(this.value());
      this.skipBlank();
      if (this.peek() === ',') this.pos += 1;
      else if (this.peek() !== ']') throw new ConvertError('toml_unterminated_array');
    }
  }

  private inlineTable(): JsonValue {
    this.pos += 1;
    const table: TomlTable = {};
    this.inlineTables.add(table);
    this.skipSpaces();
    if (this.peek() === '}') {
      this.pos += 1;
      return table;
    }
    for (;;) {
      this.skipSpaces();
      this.keyValue(table);
      this.skipSpaces();
      if (this.peek() === ',') this.pos += 1;
      else if (this.peek() === '}') {
        this.pos += 1;
        return table;
      } else throw new ConvertError('toml_unterminated_table');
    }
  }
}

export const parseToml = (text: string): JsonValue => new TomlParser(text.replace(/^\ufeff/, '')).parse();

export interface TomlOutput {
  text: string;
  nullsOmitted: boolean;
}

const tomlKey = (key: string): string => (BARE_KEY.test(key) ? key : JSON.stringify(key));

const isPlainObject = (value: JsonValue | undefined): value is TomlTable => typeof value === 'object' && value !== null && !Array.isArray(value);

const isTableArray = (value: JsonValue | undefined): value is TomlTable[] => Array.isArray(value) && value.length > 0 && value.every(isPlainObject);

export const stringifyToml = (value: JsonValue): TomlOutput => {
  if (!isPlainObject(value)) throw new ConvertError('toml_root_not_table');
  let nullsOmitted = false;

  const inline = (item: JsonValue): string | null => {
    if (item === null) {
      nullsOmitted = true;
      return null;
    }
    if (typeof item === 'boolean') return String(item);
    if (typeof item === 'number') return Number.isNaN(item) ? 'nan' : !Number.isFinite(item) ? (item > 0 ? 'inf' : '-inf') : String(item);
    if (typeof item === 'string') return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(inline).filter((entry): entry is string => entry !== null).join(', ')}]`;
    const pairs = Object.entries(item).map(([k, v]) => {
      const rendered = inline(v);
      return rendered === null ? null : `${tomlKey(k)} = ${rendered}`;
    }).filter((entry): entry is string => entry !== null);
    return pairs.length ? `{ ${pairs.join(', ')} }` : '{}';
  };

  const emit = (table: TomlTable, path: string[], lines: string[]): void => {
    const nested: Array<[string, JsonValue]> = [];
    Object.entries(table).forEach(([key, item]) => {
      if (isPlainObject(item) || isTableArray(item)) nested.push([key, item]);
      else {
        const rendered = inline(item);
        if (rendered !== null) lines.push(`${tomlKey(key)} = ${rendered}`);
      }
    });
    nested.forEach(([key, item]) => {
      const childPath = [...path, tomlKey(key)];
      if (isTableArray(item)) {
        item.forEach((entry) => {
          lines.push('', `[[${childPath.join('.')}]]`);
          emit(entry, childPath, lines);
        });
      } else {
        lines.push('', `[${childPath.join('.')}]`);
        emit(item as TomlTable, childPath, lines);
      }
    });
  };

  const lines: string[] = [];
  emit(value, [], lines);
  return { text: `${lines.join('\n').replace(/^\n+/, '')}\n`, nullsOmitted };
};
