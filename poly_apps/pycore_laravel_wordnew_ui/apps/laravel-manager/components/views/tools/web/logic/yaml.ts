/** Structure-preserving YAML re-indenter with lint findings (no value parsing). */

export type YamlIssueCode = 'tab_indent' | 'duplicate_key' | 'bad_dedent' | 'unclosed_quote' | 'unclosed_flow';

export interface YamlIssue {
  code: YamlIssueCode;
  line: number;
  key?: string;
}

export interface YamlFormatOptions {
  indent: 2 | 4;
  trimTrailing: boolean;
  collapseBlank: boolean;
  finalNewline: boolean;
}

export interface YamlFormatResult {
  output: string;
  issues: YamlIssue[];
  changedLines: number;
}

interface Level {
  orig: number;
  next: number;
  keys: Set<string>;
}

interface Region {
  parentOrig: number;
  parentNew: number;
  baseOrig: number | null;
  baseNew: number;
  explicit: number | null;
  /** Block scalar content keeps its characters verbatim. */
  literal: boolean;
  /** Ends when the quote or flow collection closes instead of by indentation. */
  scanned: boolean;
}

interface ScanState {
  quote: string;
  flow: number;
}

const MAPPING_KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#:{}[\],&*!|>'"%@`-][^:#]*?|-[^\s:][^:#]*?|\?)\s*:(?=\s|$)/;
const BLOCK_AFTER_KEY = /:\s+(?:[!&]\S*\s+)*[|>]([+-]?)([1-9]?)([+-]?)\s*(?:#.*)?$/;
const BLOCK_AFTER_DASH = /^(?:[!&]\S*\s+)*[|>]([+-]?)([1-9]?)([+-]?)\s*(?:#.*)?$/;
const PROPERTIES = /^(?:[!&]\S*\s+)+/;
const ANCHOR_ONLY = /^(?:[!&]\S*\s*)+$/;
const DASH = /^-(?:\s+|$)/;
const DOCUMENT_MARK = /^(---|\.\.\.)(?:\s|$)/;
const OPEN_SET = /[\s[{,:]/;

const leadingSpaces = (line: string): number => line.length - line.trimStart().length;

/** Tracks quote and flow-collection nesting; a new quote or bracket may only open at the start of a scalar or inside a flow collection. */
const scan = (content: string, state: ScanState, allowOpen: boolean): ScanState => {
  let { quote, flow } = state;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quote === '"') {
      if (c === '\\') i++;
      else if (c === '"') quote = '';
    } else if (quote === "'") {
      if (c === "'") {
        if (content[i + 1] === "'") i++;
        else quote = '';
      }
    } else if (c === '#' && (i === 0 || /\s/.test(content[i - 1]))) {
      break;
    } else if (c === '"' || c === "'") {
      if ((allowOpen && i === 0) || (flow > 0 && (i === 0 || OPEN_SET.test(content[i - 1])))) quote = c;
    } else if ((c === '[' || c === '{') && ((allowOpen && i === 0) || flow > 0)) {
      flow++;
    } else if ((c === ']' || c === '}') && flow > 0) {
      flow--;
    }
  }
  return { quote, flow };
};

const stripComment = (text: string): string => {
  const hash = text.search(/\s#/);
  return (hash >= 0 ? text.slice(0, hash) : text).trim();
};

export function formatYaml(source: string, options: YamlFormatOptions): YamlFormatResult {
  const step = options.indent;
  const inputLines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const issues: YamlIssue[] = [];
  let levels: Level[] = [];
  let region: Region | null = null;
  let state: ScanState = { quote: '', flow: 0 };
  let openedAt = 0;
  let pending: { orig: number; next: number } | null = null;
  let blankRun = 0;

  const trim = (text: string): string => (options.trimTrailing ? text.trimEnd() : text);

  const resolve = (orig: number, lineNo: number): Level => {
    let popped = false;
    while (levels.length && levels[levels.length - 1].orig > orig) {
      levels.pop();
      popped = true;
    }
    const top = levels[levels.length - 1];
    if (top && top.orig === orig) return top;
    if (top && popped) issues.push({ code: 'bad_dedent', line: lineNo });
    const level: Level = { orig, next: top ? top.next + step : 0, keys: new Set() };
    levels.push(level);
    return level;
  };

  const writeRegionLine = (reg: Region, ind: number, line: string): void => {
    if (reg.baseOrig === null) {
      reg.baseOrig = reg.explicit !== null ? reg.parentOrig + reg.explicit : ind;
      reg.baseNew = reg.explicit !== null ? reg.parentNew + reg.explicit : reg.parentNew + step;
    }
    const column = reg.scanned ? Math.max(reg.parentNew, reg.baseNew + ind - reg.baseOrig) : reg.baseNew + Math.max(0, ind - reg.baseOrig);
    const text = line.slice(ind);
    out.push(' '.repeat(column) + (reg.literal ? text : trim(text)));
  };

  inputLines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    let line = rawLine;
    const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
    if (lead.includes('\t')) {
      issues.push({ code: 'tab_indent', line: lineNo });
      line = lead.replace(/\t/g, '  ') + line.slice(lead.length);
    }
    const blank = line.trim() === '';
    const ind = leadingSpaces(line);
    const trimmed = line.slice(ind);

    if (!region && !blank && !trimmed.startsWith('#') && pending && ind > pending.orig) {
      region = { parentOrig: pending.orig, parentNew: pending.next, baseOrig: null, baseNew: 0, explicit: null, literal: false, scanned: false };
    }
    if (region) {
      if (blank) {
        out.push('');
        return;
      }
      if (region.scanned) {
        state = scan(trimmed, state, false);
        writeRegionLine(region, ind, line);
        if (!state.quote && state.flow === 0) region = null;
        return;
      }
      if (ind > region.parentOrig) {
        writeRegionLine(region, ind, line);
        return;
      }
      region = null;
    }
    pending = null;

    if (blank) {
      blankRun++;
      if (!(options.collapseBlank && blankRun > 1)) out.push('');
      return;
    }
    blankRun = 0;

    if (DOCUMENT_MARK.test(line)) {
      levels = [];
      out.push(trim(line));
      return;
    }

    if (trimmed.startsWith('#')) {
      const mapped = levels.filter((level) => level.orig <= ind).pop();
      const column = mapped ? mapped.next + (ind > mapped.orig ? step : 0) : 0;
      out.push(' '.repeat(column) + trim(trimmed));
      return;
    }

    let level = resolve(ind, lineNo);
    const startNew = level.next;
    let newColumn = startNew;
    let column = ind;
    let rest = trimmed;
    let dashes = '';
    let lastDashOrig = -1;
    let lastDashNew = -1;
    while (DASH.test(rest)) {
      const width = /^-\s*/.exec(rest)?.[0].length ?? 1;
      lastDashOrig = column;
      lastDashNew = newColumn;
      rest = rest.slice(width);
      dashes += rest ? '- ' : '-';
      if (!rest) break;
      column += width;
      newColumn += 2;
      level = { orig: column, next: newColumn, keys: new Set() };
      levels.push(level);
    }
    const key = rest ? MAPPING_KEY.exec(rest) : null;
    if (key) {
      const name = key[1].replace(/^["']|["']$/g, '').trim();
      if (level.keys.has(name)) issues.push({ code: 'duplicate_key', line: lineNo, key: name });
      level.keys.add(name);
    }
    out.push(' '.repeat(startNew) + dashes + trim(rest));

    const value = stripComment(key ? rest.slice(key[0].length) : rest);
    const block = key ? BLOCK_AFTER_KEY.exec(rest) : BLOCK_AFTER_DASH.exec(rest);
    if (block) {
      const explicit = block[2] ? Number(block[2]) : null;
      region = key
        ? { parentOrig: column, parentNew: level.next, baseOrig: null, baseNew: 0, explicit, literal: true, scanned: false }
        : { parentOrig: lastDashOrig, parentNew: lastDashNew, baseOrig: null, baseNew: 0, explicit, literal: true, scanned: false };
      return;
    }
    const properties = PROPERTIES.exec(value);
    const scalar = properties ? value.slice(properties[0].length) : value;
    state = scan(scalar, { quote: '', flow: 0 }, true);
    if (state.quote || state.flow > 0) {
      openedAt = lineNo;
      region = { parentOrig: key ? column : lastDashOrig, parentNew: key ? level.next : lastDashNew, baseOrig: null, baseNew: 0, explicit: null, literal: false, scanned: true };
      return;
    }
    if (value && !ANCHOR_ONLY.test(value)) pending = key ? { orig: column, next: level.next } : { orig: lastDashOrig, next: lastDashNew };
  });

  if (state.quote) issues.push({ code: 'unclosed_quote', line: openedAt });
  else if (state.flow > 0) issues.push({ code: 'unclosed_flow', line: openedAt });
  while (out.length && out[out.length - 1] === '') out.pop();
  const output = out.join('\n') + (options.finalNewline && out.length ? '\n' : '');
  const original = inputLines[inputLines.length - 1] === '' ? inputLines.slice(0, -1) : inputLines;
  const changedLines = out.reduce((sum, text, i) => sum + (text !== original[i] ? 1 : 0), 0);
  return { output, issues, changedLines };
}
