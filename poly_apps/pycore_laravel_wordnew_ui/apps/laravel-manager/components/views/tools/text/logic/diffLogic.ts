/** Text diff engine: Myers line diff, word-level refinement and split / unified row builders. */
export type DiffOp = 'equal' | 'delete' | 'insert';

export interface DiffEntry {
  op: DiffOp;
  aIndex: number;
  bIndex: number;
}

export interface WordPart {
  text: string;
  changed: boolean;
}

export interface SplitRow {
  kind: 'equal' | 'change' | 'delete' | 'insert';
  aNumber: number | null;
  bNumber: number | null;
  aText: string;
  bText: string;
  aParts?: WordPart[];
  bParts?: WordPart[];
}

export interface UnifiedRow {
  op: DiffOp;
  aNumber: number | null;
  bNumber: number | null;
  text: string;
  parts?: WordPart[];
}

export interface DiffOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

export interface DiffResult {
  split: SplitRow[];
  unified: UnifiedRow[];
  added: number;
  removed: number;
  unchanged: number;
  similarity: number;
  identical: boolean;
}

const MAX_EDIT_DISTANCE = 3000;
const TOKEN_PATTERN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

const myers = (a: string[], b: string[]): DiffEntry[] | null => {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, MAX_EDIT_DISTANCE);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let finalD = -1;
  for (let d = 0; d <= max && finalD < 0; d += 1) {
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x += 1; y += 1; }
      v[offset + k] = x;
      if (x >= n && y >= m) { finalD = d; break; }
    }
  }
  if (finalD < 0) return null;
  const out: DiffEntry[] = [];
  let x = n;
  let y = m;
  for (let d = finalD; d >= 0; d -= 1) {
    const snap = trace[d];
    const k = x - y;
    let prevX = 0;
    let prevY = 0;
    if (d > 0) {
      const prevK = k === -d || (k !== d && snap[k - 1 + d] < snap[k + 1 + d]) ? k + 1 : k - 1;
      prevX = snap[prevK + d];
      prevY = prevX - prevK;
    }
    while (x > prevX && y > prevY) { out.push({ op: 'equal', aIndex: x - 1, bIndex: y - 1 }); x -= 1; y -= 1; }
    if (d > 0) {
      if (x === prevX) { out.push({ op: 'insert', aIndex: -1, bIndex: y - 1 }); y -= 1; } else { out.push({ op: 'delete', aIndex: x - 1, bIndex: -1 }); x -= 1; }
    }
  }
  return out.reverse();
};

/** Shortest edit script between two token arrays (common prefix/suffix trimmed first). */
export const diffSequences = (a: string[], b: string[]): DiffEntry[] => {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA -= 1; endB -= 1; }
  const out: DiffEntry[] = [];
  for (let i = 0; i < start; i += 1) out.push({ op: 'equal', aIndex: i, bIndex: i });
  const middle = myers(a.slice(start, endA), b.slice(start, endB));
  if (middle) {
    middle.forEach((entry) => out.push({
      op: entry.op,
      aIndex: entry.aIndex < 0 ? -1 : entry.aIndex + start,
      bIndex: entry.bIndex < 0 ? -1 : entry.bIndex + start,
    }));
  } else {
    for (let i = start; i < endA; i += 1) out.push({ op: 'delete', aIndex: i, bIndex: -1 });
    for (let j = start; j < endB; j += 1) out.push({ op: 'insert', aIndex: -1, bIndex: j });
  }
  for (let i = 0; i < a.length - endA; i += 1) out.push({ op: 'equal', aIndex: endA + i, bIndex: endB + i });
  return out;
};

const comparable = (line: string, options: DiffOptions): string => {
  let value = line;
  if (options.ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim();
  if (options.ignoreCase) value = value.toLowerCase();
  return value;
};

const mergeParts = (parts: WordPart[]): WordPart[] => {
  const merged: WordPart[] = [];
  parts.forEach((part) => {
    const last = merged[merged.length - 1];
    if (last && last.changed === part.changed) last.text += part.text;
    else merged.push({ ...part });
  });
  return merged;
};

/** Word-level diff of one changed line pair. */
export const diffWords = (from: string, to: string, options: DiffOptions): { aParts: WordPart[]; bParts: WordPart[] } => {
  const a = from.match(TOKEN_PATTERN) ?? [];
  const b = to.match(TOKEN_PATTERN) ?? [];
  const entries = diffSequences(a.map((token) => comparable(token, options)), b.map((token) => comparable(token, options)));
  const aParts: WordPart[] = [];
  const bParts: WordPart[] = [];
  entries.forEach((entry) => {
    if (entry.op === 'equal') {
      aParts.push({ text: a[entry.aIndex], changed: false });
      bParts.push({ text: b[entry.bIndex], changed: false });
    } else if (entry.op === 'delete') aParts.push({ text: a[entry.aIndex], changed: true });
    else bParts.push({ text: b[entry.bIndex], changed: true });
  });
  return { aParts: mergeParts(aParts), bParts: mergeParts(bParts) };
};

export const computeDiff = (left: string, right: string, options: DiffOptions): DiffResult => {
  const aLines = left.split('\n');
  const bLines = right.split('\n');
  const entries = diffSequences(aLines.map((line) => comparable(line, options)), bLines.map((line) => comparable(line, options)));
  const split: SplitRow[] = [];
  const unified: UnifiedRow[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let cursor = 0;
  while (cursor < entries.length) {
    const entry = entries[cursor];
    if (entry.op === 'equal') {
      unchanged += 1;
      split.push({ kind: 'equal', aNumber: entry.aIndex + 1, bNumber: entry.bIndex + 1, aText: aLines[entry.aIndex], bText: bLines[entry.bIndex] });
      unified.push({ op: 'equal', aNumber: entry.aIndex + 1, bNumber: entry.bIndex + 1, text: bLines[entry.bIndex] });
      cursor += 1;
      continue;
    }
    const dels: DiffEntry[] = [];
    const inss: DiffEntry[] = [];
    while (cursor < entries.length && entries[cursor].op !== 'equal') {
      (entries[cursor].op === 'delete' ? dels : inss).push(entries[cursor]);
      cursor += 1;
    }
    removed += dels.length;
    added += inss.length;
    const paired = Math.min(dels.length, inss.length);
    const pairParts = Array.from({ length: paired }, (_, i) => diffWords(aLines[dels[i].aIndex], bLines[inss[i].bIndex], options));
    for (let i = 0; i < Math.max(dels.length, inss.length); i += 1) {
      const del = dels[i];
      const ins = inss[i];
      if (del && ins) {
        split.push({ kind: 'change', aNumber: del.aIndex + 1, bNumber: ins.bIndex + 1, aText: aLines[del.aIndex], bText: bLines[ins.bIndex], aParts: pairParts[i].aParts, bParts: pairParts[i].bParts });
      } else if (del) {
        split.push({ kind: 'delete', aNumber: del.aIndex + 1, bNumber: null, aText: aLines[del.aIndex], bText: '' });
      } else if (ins) {
        split.push({ kind: 'insert', aNumber: null, bNumber: ins.bIndex + 1, aText: '', bText: bLines[ins.bIndex] });
      }
    }
    dels.forEach((del, i) => unified.push({ op: 'delete', aNumber: del.aIndex + 1, bNumber: null, text: aLines[del.aIndex], parts: pairParts[i]?.aParts }));
    inss.forEach((ins, i) => unified.push({ op: 'insert', aNumber: null, bNumber: ins.bIndex + 1, text: bLines[ins.bIndex], parts: pairParts[i]?.bParts }));
  }
  const total = unchanged + Math.max(added, removed);
  return {
    split,
    unified,
    added,
    removed,
    unchanged,
    similarity: total === 0 ? 100 : Math.round((unchanged / total) * 100),
    identical: added === 0 && removed === 0,
  };
};
