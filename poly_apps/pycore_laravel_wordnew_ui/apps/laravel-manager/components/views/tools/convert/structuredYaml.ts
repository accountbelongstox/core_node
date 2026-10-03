/** YAML 1.2 subset parser and emitter (block/flow collections, quoted and block scalars, anchors, merge keys). */
import { ConvertError } from './convertCodecs';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface ParserState {
  lines: string[];
  index: number;
  anchors: Map<string, JsonValue>;
}

const INT_PATTERN = /^[-+]?(?:0|[1-9][0-9_]*)$/;
const FLOAT_PATTERN = /^[-+]?(?:\.[0-9]+|[0-9][0-9_]*(?:\.[0-9_]*)?)(?:[eE][-+]?[0-9]+)?$/;
const NEEDS_QUOTES = /^(?:null|Null|NULL|~|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N)$/;
const SPECIAL_START = /^[\s\-?:,[\]{}#&*!|>'"%@`]/;
const DOUBLE_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', e: '\x1b', ' ': ' ', N: '\u0085', _: '\u00a0' };

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isBlank = (line: string): boolean => line.trim() === '' || line.trim().startsWith('#');
const isSeqText = (text: string): boolean => text === '-' || text.startsWith('- ');

export const stripComment = (text: string): string => {
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i += 1;
      else if (ch === quote) {
        if (quote === "'" && text[i + 1] === "'") i += 1;
        else quote = '';
      }
    } else if ((ch === '"' || ch === "'") && (i === 0 || /[\s[{,:]/.test(text[i - 1]))) quote = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd();
  }
  return text.trimEnd();
};

const unquoteDouble = (body: string): string => body.replace(/\\(?:u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|x([0-9a-fA-F]{2})|(.))/gs, (_m, u, bigU, x, simple: string) => {
  if (u || bigU || x) return String.fromCodePoint(parseInt(u ?? bigU ?? x, 16));
  if (simple in DOUBLE_ESCAPES) return DOUBLE_ESCAPES[simple];
  throw new ConvertError('yaml_bad_escape');
});

export const resolvePlain = (text: string): JsonValue => {
  if (text === '' || text === '~' || /^(?:null|Null|NULL)$/.test(text)) return null;
  if (/^(?:true|True|TRUE)$/.test(text)) return true;
  if (/^(?:false|False|FALSE)$/.test(text)) return false;
  if (INT_PATTERN.test(text)) return Number(text.replace(/_/g, ''));
  if (/^0x[0-9a-fA-F]+$/.test(text)) return parseInt(text.slice(2), 16);
  if (/^0o[0-7]+$/.test(text)) return parseInt(text.slice(2), 8);
  if (FLOAT_PATTERN.test(text) && /[0-9]/.test(text)) return Number(text.replace(/_/g, ''));
  if (/^[-+]?\.(?:inf|Inf|INF)$/.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
  if (/^\.(?:nan|NaN|NAN)$/.test(text)) return NaN;
  return text;
};

/** Finds the closing quote of a quoted scalar starting at text[0]; -1 when it is not closed on this text. */
const closingQuote = (text: string): number => {
  const quote = text[0];
  for (let i = 1; i < text.length; i += 1) {
    if (quote === '"' && text[i] === '\\') i += 1;
    else if (text[i] === quote) {
      if (quote === "'" && text[i + 1] === "'") i += 1;
      else return i;
    }
  }
  return -1;
};

const readQuoted = (text: string): string => {
  const end = closingQuote(text);
  const body = text.slice(1, end);
  return text[0] === '"' ? unquoteDouble(body) : body.replace(/''/g, "'");
};

const splitKey = (text: string): { key: string; rest: string } | null => {
  if (!text || /^[[{|>*]/.test(text)) return null;
  if (text[0] === '"' || text[0] === "'") {
    const end = closingQuote(text);
    if (end < 0) return null;
    const after = text.slice(end + 1);
    const match = /^\s*:(?:\s+(.*))?$/.exec(after);
    return match ? { key: readQuoted(text.slice(0, end + 1)), rest: match[1] ?? '' } : null;
  }
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === ':' && (i + 1 === text.length || text[i + 1] === ' ')) {
      const key = text.slice(0, i).trim();
      return key ? { key, rest: text.slice(i + 1).trim() } : null;
    }
    if (text[i] === '#' && i > 0 && text[i - 1] === ' ') return null;
  }
  return null;
};

class FlowReader {
  private pos = 0;

  constructor(private readonly text: string, private readonly anchors: Map<string, JsonValue>) {}

  parse(): JsonValue {
    const value = this.value();
    this.skipSpace();
    if (this.pos < this.text.length) throw new ConvertError('yaml_flow_trailing');
    return value;
  }

  private skipSpace(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos += 1;
  }

  private value(stop = ',]}'): JsonValue {
    this.skipSpace();
    const ch = this.text[this.pos];
    if (ch === '[') return this.sequence();
    if (ch === '{') return this.mapping();
    if (ch === '"' || ch === "'") {
      const end = closingQuote(this.text.slice(this.pos));
      if (end < 0) throw new ConvertError('yaml_unterminated_quote');
      const raw = this.text.slice(this.pos, this.pos + end + 1);
      this.pos += end + 1;
      return readQuoted(raw);
    }
    if (ch === '*') {
      const name = /^\*([^\s,\]}]+)/.exec(this.text.slice(this.pos));
      if (!name || !this.anchors.has(name[1])) throw new ConvertError('yaml_unknown_alias');
      this.pos += name[0].length;
      return this.anchors.get(name[1]) as JsonValue;
    }
    const start = this.pos;
    while (this.pos < this.text.length) {
      const c = this.text[this.pos];
      if (stop.includes(c)) break;
      if (c === ':' && (this.text[this.pos + 1] === ' ' || stop.includes(this.text[this.pos + 1] ?? ','))) break;
      this.pos += 1;
    }
    return resolvePlain(this.text.slice(start, this.pos).trim());
  }

  private sequence(): JsonValue {
    this.pos += 1;
    const items: JsonValue[] = [];
    for (;;) {
      this.skipSpace();
      if (this.text[this.pos] === ']') {
        this.pos += 1;
        return items;
      }
      if (this.pos >= this.text.length) throw new ConvertError('yaml_flow_unclosed');
      items.push(this.value());
      this.skipSpace();
      if (this.text[this.pos] === ',') this.pos += 1;
      else if (this.text[this.pos] !== ']') throw new ConvertError('yaml_flow_unclosed');
    }
  }

  private mapping(): JsonValue {
    this.pos += 1;
    const out: { [key: string]: JsonValue } = {};
    for (;;) {
      this.skipSpace();
      if (this.text[this.pos] === '}') {
        this.pos += 1;
        return out;
      }
      if (this.pos >= this.text.length) throw new ConvertError('yaml_flow_unclosed');
      const key = String(this.value(',:}'));
      this.skipSpace();
      let value: JsonValue = null;
      if (this.text[this.pos] === ':') {
        this.pos += 1;
        this.skipSpace();
        if (![',', '}'].includes(this.text[this.pos])) value = this.value();
      }
      out[key] = value;
      this.skipSpace();
      if (this.text[this.pos] === ',') this.pos += 1;
      else if (this.text[this.pos] !== '}') throw new ConvertError('yaml_flow_unclosed');
    }
  }
}

const bracketBalance = (text: string): number => {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i += 1;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
  }
  return depth;
};

const nextMeaningful = (state: ParserState): string | null => {
  while (state.index < state.lines.length && isBlank(state.lines[state.index])) state.index += 1;
  return state.index < state.lines.length ? state.lines[state.index] : null;
};

const blockScalar = (state: ParserState, header: string, parentIndent: number): string => {
  const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip';
  const explicit = /[1-9]/.exec(header);
  const folded = header[0] === '>';
  const raw: string[] = [];
  let blockIndent = explicit ? parentIndent + Number(explicit[0]) : -1;
  while (state.index < state.lines.length) {
    const line = state.lines[state.index];
    if (line.trim() === '') {
      raw.push('');
      state.index += 1;
      continue;
    }
    const indent = indentOf(line);
    if (blockIndent < 0 && indent > parentIndent) blockIndent = indent;
    if (blockIndent < 0 || indent < blockIndent) break;
    raw.push(line.slice(blockIndent));
    state.index += 1;
  }
  let trailing = 0;
  while (raw.length && raw[raw.length - 1] === '') {
    raw.pop();
    trailing += 1;
  }
  let body: string;
  if (folded) {
    body = '';
    raw.forEach((line, i) => {
      if (i === 0) body = line;
      else if (line === '') body += '\n';
      else if (raw[i - 1] === '' || /^\s/.test(line) || /^\s/.test(raw[i - 1])) body += (raw[i - 1] === '' ? '' : '\n') + line;
      else body += ` ${line}`;
    });
  } else body = raw.join('\n');
  if (raw.length === 0) return chomp === 'keep' ? '\n'.repeat(trailing) : '';
  return chomp === 'strip' ? body : chomp === 'keep' ? body + '\n'.repeat(trailing + 1) : `${body}\n`;
};

const mergeInto = (target: { [key: string]: JsonValue }, source: JsonValue): void => {
  const sources = Array.isArray(source) ? source : [source];
  sources.forEach((entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      Object.entries(entry).forEach(([k, v]) => {
        if (!(k in target)) target[k] = v;
      });
    }
  });
};

const parseValue = (state: ParserState, restRaw: string, parentIndent: number, sameIndentSeq: boolean): JsonValue => {
  let rest = stripComment(restRaw).trim();
  let anchor = '';
  let forceString = false;
  for (;;) {
    const prop = /^(?:&([^\s]+)|!(!?[^\s]*))\s*/.exec(rest);
    if (!prop) break;
    if (prop[1]) anchor = prop[1];
    else if (prop[2] === '!str') forceString = true;
    rest = rest.slice(prop[0].length);
  }
  let value: JsonValue;
  if (rest === '') {
    const line = nextMeaningful(state);
    const indent = line === null ? -1 : indentOf(line);
    if (line !== null && (indent > parentIndent || (sameIndentSeq && indent === parentIndent && isSeqText(line.trim())))) value = parseNode(state, indent);
    else value = null;
  } else if (rest[0] === '|' || rest[0] === '>') {
    value = blockScalar(state, rest, parentIndent);
  } else if (rest[0] === '*') {
    const name = rest.slice(1).trim();
    if (!state.anchors.has(name)) throw new ConvertError('yaml_unknown_alias');
    value = state.anchors.get(name) as JsonValue;
  } else if (rest[0] === '[' || rest[0] === '{') {
    let text = rest;
    while (bracketBalance(text) > 0 && state.index < state.lines.length) {
      text += ` ${stripComment(state.lines[state.index]).trim()}`;
      state.index += 1;
    }
    value = new FlowReader(text, state.anchors).parse();
  } else if ((rest[0] === '"' || rest[0] === "'") && closingQuote(rest) < 0) {
    let text = rest;
    while (closingQuote(text) < 0 && state.index < state.lines.length) {
      text += ` ${state.lines[state.index].trim()}`;
      state.index += 1;
    }
    if (closingQuote(text) < 0) throw new ConvertError('yaml_unterminated_quote');
    value = readQuoted(text);
  } else if (rest[0] === '"' || rest[0] === "'") {
    const end = closingQuote(rest);
    if (rest.slice(end + 1).trim() !== '') throw new ConvertError('yaml_unexpected_text');
    value = readQuoted(rest);
  } else {
    let text = rest;
    while (state.index < state.lines.length) {
      const line = state.lines[state.index];
      if (line.trim() === '' || indentOf(line) <= parentIndent || isBlank(line)) break;
      text += ` ${stripComment(line).trim()}`;
      state.index += 1;
    }
    value = forceString ? text : resolvePlain(text);
  }
  if (anchor) state.anchors.set(anchor, value);
  return value;
};

const parseSequence = (state: ParserState, indent: number): JsonValue[] => {
  const items: JsonValue[] = [];
  for (;;) {
    const line = nextMeaningful(state);
    if (line === null || indentOf(line) !== indent || !isSeqText(line.trim())) {
      if (line !== null && indentOf(line) > indent) throw new ConvertError('yaml_bad_indent');
      return items;
    }
    const afterDash = line.trim().slice(1);
    const rest = afterDash.trimStart();
    const column = indent + 1 + (afterDash.length - rest.length);
    const content = stripComment(rest);
    if (content === '') {
      state.index += 1;
      items.push(parseValue(state, '', indent, false));
    } else if (isSeqText(content) || splitKey(content)) {
      state.lines[state.index] = ' '.repeat(column) + rest;
      items.push(parseNode(state, column));
    } else {
      state.index += 1;
      items.push(parseValue(state, rest, indent, false));
    }
  }
};

const parseMapping = (state: ParserState, indent: number): JsonValue => {
  const out: { [key: string]: JsonValue } = {};
  for (;;) {
    const line = nextMeaningful(state);
    if (line === null || indentOf(line) < indent) return out;
    if (indentOf(line) > indent) throw new ConvertError('yaml_bad_indent');
    const text = stripComment(line.trim());
    if (isSeqText(text)) return out;
    const pair = splitKey(text);
    if (!pair) throw new ConvertError('yaml_bad_line');
    state.index += 1;
    const value = parseValue(state, pair.rest, indent, true);
    if (pair.key === '<<') mergeInto(out, value);
    else out[pair.key] = value;
  }
};

const parseNode = (state: ParserState, indent: number): JsonValue => {
  const text = stripComment(state.lines[state.index].trim());
  if (isSeqText(text)) return parseSequence(state, indent);
  if (splitKey(text)) return parseMapping(state, indent);
  state.index += 1;
  return parseValue(state, text, indent - 1, false);
};

const splitDocuments = (text: string): string[][] => {
  const docs: string[][] = [[]];
  text.replace(/^\ufeff/, '').split(/\r?\n/).forEach((line) => {
    if (/^---(\s|$)/.test(line)) {
      const tail = line.slice(3).trim();
      if (docs[docs.length - 1].some((l) => !isBlank(l))) docs.push([]);
      if (tail && !tail.startsWith('#')) docs[docs.length - 1].push(tail);
    } else if (/^\.\.\.\s*$/.test(line)) docs.push([]);
    else if (!/^%/.test(line)) docs[docs.length - 1].push(line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)));
  });
  return docs.filter((doc) => doc.some((l) => !isBlank(l)));
};

export const parseYaml = (text: string): JsonValue => {
  const docs = splitDocuments(text);
  if (docs.length === 0) return null;
  const results = docs.map((lines) => {
    const state: ParserState = { lines, index: 0, anchors: new Map() };
    const first = nextMeaningful(state);
    if (first === null) return null;
    const value = parseNode(state, indentOf(first));
    if (nextMeaningful(state) !== null) throw new ConvertError('yaml_bad_indent');
    return value;
  });
  return results.length === 1 ? results[0] : results;
};

const scalarToYaml = (value: string, forKey: boolean): string => {
  if (value === '') return "''";
  const needsQuote = SPECIAL_START.test(value) || /\s$/.test(value) || NEEDS_QUOTES.test(value) || /: |:$| #|[\u0000-\u001f\u007f\u0085\u2028\u2029]/.test(value)
    || resolvePlain(value) !== value || /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2})/.test(value) || (forKey && /[[\]{},]/.test(value));
  if (!needsQuote) return value;
  return /[\u0000-\u001f\u007f\u0085\u2028\u2029]/.test(value) || value.includes("'") ? JSON.stringify(value) : `'${value}'`;
};

const numberToYaml = (value: number): string => {
  if (Number.isNaN(value)) return '.nan';
  if (!Number.isFinite(value)) return value > 0 ? '.inf' : '-.inf';
  return String(value);
};

const isContainer = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } => typeof value === 'object' && value !== null;
const isEmptyContainer = (value: JsonValue): boolean => isContainer(value) && (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0);

const inlineScalar = (value: JsonValue): string => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return numberToYaml(value);
  if (typeof value === 'string') return scalarToYaml(value, false);
  return Array.isArray(value) ? '[]' : '{}';
};

const emitBlock = (value: JsonValue, level: number, step: number): string[] => {
  const pad = ' '.repeat(level * step);
  const lines: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isContainer(item) && !isEmptyContainer(item)) {
        const child = emitBlock(item, level + 1, step);
        lines.push(`${pad}-${' '.repeat(step - 1)}${child[0].slice((level + 1) * step)}`, ...child.slice(1));
      } else if (typeof item === 'string' && item.includes('\n')) {
        lines.push(`${pad}- ${blockString(item, (level + 1) * step)}`);
      } else lines.push(`${pad}- ${inlineScalar(item)}`);
    });
    return lines;
  }
  if (isContainer(value)) {
    Object.entries(value).forEach(([key, item]) => {
      const head = `${pad}${scalarToYaml(key, true)}:`;
      if (isContainer(item) && !isEmptyContainer(item)) {
        lines.push(head, ...emitBlock(item, level + 1, step));
      } else if (typeof item === 'string' && item.includes('\n')) {
        lines.push(`${head} ${blockString(item, (level + 1) * step)}`);
      } else lines.push(`${head} ${inlineScalar(item)}`);
    });
    return lines;
  }
  return [`${pad}${inlineScalar(value)}`];
};

const blockString = (value: string, indent: number): string => {
  const trailing = (/\n*$/.exec(value) as RegExpExecArray)[0].length;
  const body = value.slice(0, value.length - trailing);
  if (body === '' || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value) || /^[ \t]/.test(value)) return JSON.stringify(value);
  const keep = trailing === 0 ? '-' : trailing === 1 ? '' : '+';
  const pad = ' '.repeat(indent);
  return `|${keep}\n${body.split('\n').map((line) => (line ? pad + line : '')).join('\n')}${keep === '+' ? '\n'.repeat(trailing - 1) : ''}`;
};

export const stringifyYaml = (value: JsonValue, indent = 2): string => {
  const step = Math.max(2, indent);
  if (!isContainer(value) || isEmptyContainer(value)) {
    if (typeof value === 'string' && value.includes('\n')) return `${blockString(value, step)}\n`;
    return `${inlineScalar(value)}\n`;
  }
  return `${emitBlock(value, 0, step).join('\n')}\n`;
};
