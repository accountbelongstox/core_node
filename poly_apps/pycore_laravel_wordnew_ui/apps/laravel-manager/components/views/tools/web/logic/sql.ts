/** Dialect-neutral SQL tokenizer, pretty printer and minifier. */

export type SqlKeywordCase = 'upper' | 'lower' | 'preserve';

export interface SqlFormatOptions {
  indent: 2 | 4 | 'tab';
  keywordCase: SqlKeywordCase;
}

type TokenKind = 'word' | 'str' | 'qid' | 'num' | 'op' | 'open' | 'close' | 'comma' | 'semi' | 'dot' | 'lc' | 'bc' | 'param' | 'bracket';

interface Token {
  kind: TokenKind;
  text: string;
  ws: boolean;
  nl: boolean;
}

interface Frame {
  base: number;
  block: boolean;
  cond: boolean;
  inline: number;
  andLevel: number;
  pendingBreak: boolean;
  cases: number[];
  between: boolean;
}

interface ParenInfo {
  kind: 'inline' | 'sub' | 'list';
  indent: number;
}

const OPERATORS_3 = ['->>', '<=>', '!~*'];
const OPERATORS_2 = ['<>', '<=', '>=', '!=', '||', '::', '->', '=>', ':=', '<<', '>>', '!~', '~*', '&&', '@>', '<@', '#>'];
const OPERATOR_CHARS = '<>=!+-*/%|&^~:#@';
const BLOCK_CLAUSES = new Set(['SELECT', 'GROUP BY', 'ORDER BY', 'SET', 'RETURNING', 'VALUES']);
const PLAIN_CLAUSES = new Set([
  'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'WINDOW', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'INSERT INTO', 'REPLACE INTO',
  'UPDATE', 'DELETE FROM', 'WITH', 'ON CONFLICT', 'QUALIFY', 'MERGE INTO', 'TRUNCATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'CREATE TABLE', 'CREATE INDEX', 'CREATE VIEW',
]);
const JOIN_PHRASES = ['INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'NATURAL LEFT JOIN', 'NATURAL RIGHT JOIN', 'NATURAL INNER JOIN', 'JOIN'];
const CLAUSE_PHRASES = [...Array.from(BLOCK_CLAUSES), ...Array.from(PLAIN_CLAUSES), ...JOIN_PHRASES].sort((a, b) => b.split(' ').length - a.split(' ').length);
const SELECT_MODIFIERS = new Set(['DISTINCT', 'ALL']);
const SUBQUERY_STARTS = new Set(['SELECT', 'WITH', 'VALUES']);
const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'FETCH', 'FIRST', 'NEXT', 'ROWS', 'ROW', 'ONLY', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'INSERT', 'INTO',
  'VALUES', 'UPDATE', 'SET', 'DELETE', 'WITH', 'RETURNING', 'AS', 'ON', 'USING', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'DISTINCT', 'TOP', 'ASC', 'DESC', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'LATERAL', 'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER', 'ADD',
  'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK', 'CONSTRAINT', 'IF', 'REPLACE', 'TRUNCATE', 'MERGE', 'MATCHED', 'OVER', 'PARTITION', 'WINDOW', 'FILTER',
  'TRUE', 'FALSE', 'CAST', 'INTERVAL', 'CONFLICT', 'DO', 'NOTHING', 'ESCAPE', 'COLLATE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'RANGE', 'RECURSIVE', 'TEMPORARY', 'TEMP', 'DATABASE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'GRANT', 'REVOKE', 'EXPLAIN', 'ANALYZE', 'QUALIFY', 'NULLS', 'LAST',
]);
const FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'IFNULL', 'ISNULL', 'NVL', 'LOWER', 'UPPER', 'LENGTH', 'LEN', 'SUBSTR', 'SUBSTRING', 'TRIM', 'LTRIM', 'RTRIM', 'CONCAT', 'REPLACE',
  'ROUND', 'FLOOR', 'CEIL', 'CEILING', 'ABS', 'NOW', 'DATE', 'EXTRACT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'ARRAY_AGG', 'STRING_AGG', 'GROUP_CONCAT',
  'JSON_EXTRACT', 'TO_CHAR', 'TO_DATE', 'DATE_TRUNC', 'DATEDIFF', 'DATE_ADD', 'CURRENT_DATE', 'CURRENT_TIMESTAMP', 'GREATEST', 'LEAST', 'NTILE',
]);

const isWordStart = (c: string): boolean => /[A-Za-z_\u0080-￿]/.test(c);
const isWordChar = (c: string): boolean => /[A-Za-z0-9_$\u0080-￿]/.test(c);
const isDigit = (c: string): boolean => c >= '0' && c <= '9';

export function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let ws = false;
  let nl = false;
  const push = (kind: TokenKind, text: string): void => {
    tokens.push({ kind, text, ws, nl });
    ws = false;
    nl = false;
  };
  const readQuoted = (quote: string): string => {
    let j = i + 1;
    while (j < sql.length) {
      if (sql[j] === quote) {
        if (sql[j + 1] === quote) { j += 2; continue; }
        j++;
        break;
      }
      j++;
    }
    return sql.slice(i, j);
  };
  while (i < sql.length) {
    const c = sql[i];
    if (c === '\n') { nl = true; ws = true; i++; continue; }
    if (/\s/.test(c)) { ws = true; i++; continue; }
    if (c === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      push('lc', sql.slice(i, j).trimEnd());
      i = j;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end < 0 ? sql.length : end + 2;
      push('bc', sql.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "'") { const text = readQuoted("'"); push('str', text); i += text.length; continue; }
    if (c === '"' || c === '`') { const text = readQuoted(c); push('qid', text); i += text.length; continue; }
    if (c === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 40));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end < 0 ? sql.length : end + tag[0].length;
        push('str', sql.slice(i, stop));
        i = stop;
        continue;
      }
      const numbered = /^\$\d+/.exec(sql.slice(i, i + 12));
      if (numbered) { push('param', numbered[0]); i += numbered[0].length; continue; }
    }
    if (isDigit(c) || (c === '.' && isDigit(sql[i + 1] ?? ''))) {
      const match = /^(0[xX][0-9a-fA-F]+|\d*\.?\d+([eE][+-]?\d+)?|\d+\.)/.exec(sql.slice(i, i + 60));
      const text = match ? match[0] : c;
      push('num', text);
      i += text.length;
      continue;
    }
    if (isWordStart(c)) {
      let j = i + 1;
      while (j < sql.length && isWordChar(sql[j])) j++;
      const word = sql.slice(i, j);
      if ((word === 'E' || word === 'e' || word === 'N' || word === 'n' || word === 'X' || word === 'x') && sql[j] === "'") {
        i = j;
        const text = readQuoted("'");
        push('str', word + text);
        i += text.length;
        continue;
      }
      push('word', word);
      i = j;
      continue;
    }
    if ((c === ':' && isWordStart(sql[i + 1] ?? '') && sql[i - 1] !== ':') || (c === '@' && isWordStart(sql[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < sql.length && isWordChar(sql[j])) j++;
      push('param', sql.slice(i, j));
      i = j;
      continue;
    }
    if (c === '?') { push('param', c); i++; continue; }
    if (c === '(') { push('open', c); i++; continue; }
    if (c === ')') { push('close', c); i++; continue; }
    if (c === ',') { push('comma', c); i++; continue; }
    if (c === ';') { push('semi', c); i++; continue; }
    if (c === '.') { push('dot', c); i++; continue; }
    if (c === '[') {
      const prev = tokens[tokens.length - 1];
      const identifier = /^\[[^\]\n]+\]/.exec(sql.slice(i, i + 130));
      if (identifier && (!prev || ['dot', 'comma', 'open', 'op'].includes(prev.kind) || (prev.kind === 'word' && KEYWORDS.has(prev.text.toUpperCase())))) {
        push('qid', identifier[0]);
        i += identifier[0].length;
        continue;
      }
    }
    if (c === '[' || c === ']') { push('bracket', c); i++; continue; }
    if (OPERATOR_CHARS.includes(c)) {
      const three = sql.slice(i, i + 3);
      const two = sql.slice(i, i + 2);
      const text = OPERATORS_3.includes(three) ? three : OPERATORS_2.includes(two) ? two : c;
      push('op', text);
      i += text.length;
      continue;
    }
    push('op', c);
    i++;
  }
  return tokens;
}

const applyCase = (word: string, mode: SqlKeywordCase): string => (mode === 'upper' ? word.toUpperCase() : mode === 'lower' ? word.toLowerCase() : word);

const matchPhrase = (tokens: Token[], at: number, phrases: string[]): { phrase: string; length: number } | null => {
  for (const phrase of phrases) {
    const words = phrase.split(' ');
    if (words.every((word, k) => tokens[at + k]?.kind === 'word' && tokens[at + k].text.toUpperCase() === word)) return { phrase, length: words.length };
  }
  return null;
};

export function formatSql(sql: string, options: SqlFormatOptions): string {
  const tokens = tokenizeSql(sql);
  const unit = options.indent === 'tab' ? '\t' : ' '.repeat(options.indent);
  const lines: string[] = [];
  let line = '';
  let lineLevel = 0;
  let frames: Frame[] = [{ base: 0, block: false, cond: false, inline: 0, andLevel: 1, pendingBreak: false, cases: [], between: false }];
  let parens: ParenInfo[] = [];
  let last: { kind: TokenKind; text: string; keyword: boolean; fn: boolean; unary: boolean } | null = null;
  let statementKind = '';
  let forceBreak = false;

  const frame = (): Frame => frames[frames.length - 1];
  const flush = (): void => {
    if (line.trim()) lines.push(line.replace(/\s+$/, ''));
    line = '';
  };
  const newline = (level: number): void => {
    flush();
    lineLevel = level;
    line = unit.repeat(level);
    last = null;
  };
  const spaceBefore = (kind: TokenKind, text: string, hadWs: boolean): boolean => {
    if (!last || !line.trim()) return false;
    if (last.kind === 'open' || last.kind === 'dot' || last.text === '[' || last.unary || last.text === '::') return false;
    if (kind === 'close' || kind === 'comma' || kind === 'semi' || kind === 'dot' || kind === 'bracket' || text === '::') return false;
    if (kind === 'open') {
      if (last.fn) return false;
      if (last.kind === 'word') return last.keyword || hadWs;
      return last.kind === 'qid' ? hadWs : true;
    }
    return true;
  };
  const emit = (kind: TokenKind, text: string, hadWs: boolean, keyword = false, fn = false): void => {
    if (forceBreak) {
      newline(frame().base + (frame().block ? 1 : 0));
      forceBreak = false;
    }
    let unary = false;
    if (kind === 'op' && (text === '-' || text === '+') && (!last || ['op', 'open', 'comma'].includes(last.kind) || (last.kind === 'word' && last.keyword && !last.fn))) unary = true;
    if (spaceBefore(kind, text, hadWs)) line += ' ';
    line += text;
    last = { kind, text, keyword, fn, unary };
  };
  const startClause = (phrase: string): void => {
    const f = frame();
    const isBlock = BLOCK_CLAUSES.has(phrase);
    const isJoin = JOIN_PHRASES.includes(phrase);
    f.block = isBlock;
    f.cond = phrase === 'WHERE' || phrase === 'HAVING' || isJoin;
    f.andLevel = f.base + (isJoin ? 2 : 1);
    f.pendingBreak = isBlock;
    f.between = false;
    forceBreak = false;
    newline(f.base);
  };
  const closeStatement = (): void => {
    flush();
    frames = [{ base: 0, block: false, cond: false, inline: 0, andLevel: 1, pendingBreak: false, cases: [], between: false }];
    parens = [];
    statementKind = '';
    last = null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const f = frame();
    if (token.kind === 'lc' || token.kind === 'bc') {
      if (line.trim()) {
        if (token.nl) newline(lineLevel);
        else line += ' ';
      }
      line += token.text;
      last = { kind: token.kind, text: token.text, keyword: false, fn: false, unary: false };
      if (token.kind === 'lc') forceBreak = true;
      continue;
    }
    if (token.kind === 'word') {
      const upper = token.text.toUpperCase();
      const clause = f.inline === 0 && f.cases.length === 0 ? matchPhrase(tokens, i, CLAUSE_PHRASES) : null;
      if (clause) {
        if (!statementKind) statementKind = clause.phrase;
        if (frame().pendingBreak && !frame().block) frame().pendingBreak = false;
        startClause(clause.phrase);
        clause.phrase.split(' ').forEach((word, k) => emit('word', applyCase(tokens[i + k].text, options.keywordCase), false, true));
        i += clause.length - 1;
        forceBreak = false;
        continue;
      }
      if (f.pendingBreak) {
        const isModifier = SELECT_MODIFIERS.has(upper) || (upper === 'TOP' && tokens[i + 1]?.kind === 'num');
        if (!isModifier) {
          f.pendingBreak = false;
          newline(f.base + 1);
        } else if (upper === 'TOP') {
          emit('word', applyCase(token.text, options.keywordCase), token.ws, true);
          emit('num', tokens[i + 1].text, true);
          i++;
          continue;
        }
      }
      if ((upper === 'AND' || upper === 'OR') && f.cond && f.inline === 0 && f.cases.length === 0) {
        if (upper === 'AND' && f.between) {
          f.between = false;
        } else {
          newline(f.andLevel);
        }
      } else if (upper === 'BETWEEN' && f.inline === 0) {
        f.between = true;
      } else if (upper === 'ON' && f.cond && f.inline === 0 && f.cases.length === 0) {
        newline(f.base + 1);
      } else if (upper === 'CASE') {
        f.cases.push(lineLevel);
      } else if ((upper === 'WHEN' || upper === 'ELSE') && f.cases.length > 0) {
        newline(f.cases[f.cases.length - 1] + 1);
      } else if (upper === 'END' && f.cases.length > 0) {
        newline(f.cases[f.cases.length - 1]);
        f.cases.pop();
      }
      const nextIsOpen = tokens[i + 1]?.kind === 'open';
      const isFn = FUNCTIONS.has(upper) && nextIsOpen;
      const isKeyword = KEYWORDS.has(upper);
      const text = isKeyword || isFn ? applyCase(token.text, options.keywordCase) : token.text;
      emit('word', text, token.ws, isKeyword || isFn, isFn);
      if (last && isFn) last.fn = true;
      continue;
    }
    if (f.pendingBreak && token.kind !== 'semi') {
      f.pendingBreak = false;
      newline(f.base + 1);
    }
    if (token.kind === 'open') {
      let kind: ParenInfo['kind'] = 'inline';
      const next = tokens[i + 1];
      if (next?.kind === 'word' && SUBQUERY_STARTS.has(next.text.toUpperCase())) kind = 'sub';
      else if (statementKind === 'CREATE TABLE' && parens.length === 0) kind = 'list';
      emit('open', '(', token.ws);
      parens.push({ kind, indent: lineLevel });
      if (kind === 'inline') f.inline++;
      else {
        frames.push({ base: lineLevel + 1, block: false, cond: false, inline: 0, andLevel: lineLevel + 2, pendingBreak: false, cases: [], between: false });
        newline(lineLevel + 1);
      }
      continue;
    }
    if (token.kind === 'close') {
      const info = parens.pop();
      if (info && info.kind !== 'inline') {
        frames.pop();
        newline(info.indent);
        emit('close', ')', false);
      } else {
        if (info) f.inline = Math.max(0, f.inline - 1);
        emit('close', ')', false);
      }
      continue;
    }
    if (token.kind === 'comma') {
      emit('comma', ',', false);
      const inListParen = parens.length > 0 && parens[parens.length - 1].kind === 'list';
      if (f.inline === 0 && f.cases.length === 0 && (f.block || inListParen || statementKind === 'WITH')) newline(f.block ? f.base + 1 : f.base);
      continue;
    }
    if (token.kind === 'semi') {
      emit('semi', ';', false);
      closeStatement();
      lines.push('');
      continue;
    }
    emit(token.kind, token.text, token.ws);
  }
  flush();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

export function minifySql(sql: string): string {
  const tokens = tokenizeSql(sql).filter((token) => token.kind !== 'lc' && token.kind !== 'bc');
  let out = '';
  let prev: Token | null = null;
  let beforePrev: Token | null = null;
  tokens.forEach((token) => {
    if (prev) {
      const unary = prev.kind === 'op' && (prev.text === '-' || prev.text === '+')
        && (!beforePrev || ['op', 'open', 'comma'].includes(beforePrev.kind) || (beforePrev.kind === 'word' && KEYWORDS.has(beforePrev.text.toUpperCase())));
      const glue = prev.kind === 'open' || prev.kind === 'dot' || prev.text === '[' || token.kind === 'close' || token.kind === 'comma'
        || token.kind === 'semi' || token.kind === 'dot' || token.kind === 'bracket' || prev.text === '::' || token.text === '::' || unary
        || (token.kind === 'open' && !token.ws && (prev.kind === 'qid' || (prev.kind === 'word' && !KEYWORDS.has(prev.text.toUpperCase()))));
      if (!glue) out += ' ';
    }
    out += token.text;
    beforePrev = prev;
    prev = token;
  });
  return out;
}

export const countStatements = (sql: string): number => {
  const tokens = tokenizeSql(sql).filter((token) => token.kind !== 'lc' && token.kind !== 'bc');
  let count = 0;
  let open = false;
  tokens.forEach((token) => {
    if (token.kind === 'semi') { open = false; return; }
    if (!open) { open = true; count++; }
  });
  return count;
};
