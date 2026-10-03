/** Regex tester engine: match scanning, segments for highlighting and replace preview. */
export const REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;
export type RegexFlag = (typeof REGEX_FLAGS)[number];

export const MAX_MATCHES = 1000;

export interface RegexGroup {
  index: number;
  name: string;
  value: string | undefined;
}

export interface RegexMatch {
  index: number;
  end: number;
  value: string;
  groups: RegexGroup[];
}

export interface RegexScan {
  matches: RegexMatch[];
  truncated: boolean;
  error: string | null;
}

export interface RegexSegment {
  text: string;
  matchIndex: number;
}

export interface RegexPreset {
  id: string;
  pattern: string;
  flags: string;
  sample: string;
}

export const REGEX_PRESETS: readonly RegexPreset[] = [
  { id: 'email', pattern: '([\\w.+-]+)@([\\w-]+\\.[\\w.-]+)', flags: 'gi', sample: 'Write to hello@example.com or sales+eu@shop.example.org today.' },
  { id: 'url', pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', flags: 'gi', sample: 'Docs at https://example.com/docs?page=2 and http://localhost:8080/health.' },
  { id: 'ipv4', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', flags: 'g', sample: 'Hosts 192.168.1.10, 10.0.0.255 and 999.1.1.1 (invalid).' },
  { id: 'isoDate', pattern: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])', flags: 'g', sample: 'Released 2024-03-15, patched 2024-04-02, retired 2026-12-31.' },
  { id: 'hexColor', pattern: '#(?:[0-9a-f]{3}){1,2}\\b', flags: 'gi', sample: 'Colors: #fff, #8B5CF6, #12345 and #00ff7f.' },
  { id: 'uuid', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', flags: 'gi', sample: 'id=550e8400-e29b-41d4-a716-446655440000 ref=not-a-uuid' },
  { id: 'htmlTag', pattern: '<\\/?([a-z][a-z0-9-]*)\\b[^>]*>', flags: 'gi', sample: '<div class="box"><p>Hello <b>world</b></p></div>' },
  { id: 'numbers', pattern: '-?\\d+(?:\\.\\d+)?', flags: 'g', sample: 'Temperatures: -4.5, 0, 18 and 31.25 degrees.' },
  { id: 'words', pattern: '\\b\\w+\\b', flags: 'g', sample: 'Count every word in this sentence.' },
  { id: 'duplicates', pattern: '\\b(\\w+)\\s+\\1\\b', flags: 'gi', sample: 'This is is a test of the the duplicate finder.' },
];

const toFlagString = (flags: string): string => {
  const set = new Set(flags.split('').filter((flag) => (REGEX_FLAGS as readonly string[]).includes(flag)));
  return REGEX_FLAGS.filter((flag) => set.has(flag)).join('');
};

export const normalizeFlags = toFlagString;

export const compileRegex = (pattern: string, flags: string): { regex: RegExp | null; error: string | null } => {
  if (!pattern) return { regex: null, error: null };
  try {
    return { regex: new RegExp(pattern, toFlagString(flags)), error: null };
  } catch (err) {
    return { regex: null, error: err instanceof Error ? err.message : String(err) };
  }
};

export const scanMatches = (pattern: string, flags: string, text: string): RegexScan => {
  const { regex, error } = compileRegex(pattern, flags);
  if (!regex) return { matches: [], truncated: false, error };
  const matches: RegexMatch[] = [];
  const global = regex.global || regex.sticky;
  const scanner = global ? regex : new RegExp(regex.source, `${regex.flags}g`);
  const order = namedGroupOrder(pattern);
  let truncated = false;
  let found: RegExpExecArray | null = scanner.exec(text);
  while (found) {
    const groups: RegexGroup[] = found.slice(1).map((value, position) => ({ index: position + 1, name: order[position] ?? '', value }));
    matches.push({ index: found.index, end: found.index + found[0].length, value: found[0], groups });
    if (matches.length >= MAX_MATCHES) { truncated = true; break; }
    if (!global) break;
    if (found[0] === '') scanner.lastIndex += 1;
    found = scanner.exec(text);
  }
  return { matches, truncated, error: null };
};

/** Group names in declaration order (names appear in source order, matching capture indexes). */
export const namedGroupOrder = (pattern: string): Array<string | null> => {
  const order: Array<string | null> = [];
  const scan = /\\.|\[(?:\\.|[^\]])*\]|\((\?<([A-Za-z_$][\w$]*)>|\?[:=!]|\?<[=!])?/g;
  let hit: RegExpExecArray | null = scan.exec(pattern);
  while (hit) {
    if (hit[0].startsWith('(')) {
      if (hit[1] === undefined) order.push(null);
      else if (hit[2]) order.push(hit[2]);
    }
    hit = scan.exec(pattern);
  }
  return order;
};

export const toSegments = (text: string, matches: RegexMatch[]): RegexSegment[] => {
  const segments: RegexSegment[] = [];
  let cursor = 0;
  matches.forEach((match, matchIndex) => {
    if (match.end <= match.index || match.index < cursor) return;
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), matchIndex: -1 });
    segments.push({ text: text.slice(match.index, match.end), matchIndex });
    cursor = match.end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matchIndex: -1 });
  return segments;
};

export const previewReplace = (pattern: string, flags: string, text: string, replacement: string): string | null => {
  const { regex } = compileRegex(pattern, flags);
  if (!regex) return null;
  try {
    return text.replace(regex, replacement);
  } catch {
    return null;
  }
};
