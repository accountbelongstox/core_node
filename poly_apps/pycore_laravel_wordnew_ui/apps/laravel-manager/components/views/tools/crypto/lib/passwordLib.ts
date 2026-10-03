/** Password strength estimation: pattern-aware entropy, crack-time scenarios and a rule checklist. */
export type PasswordFindingKind = 'common' | 'sequence' | 'repeat' | 'keyboard' | 'year';
export type DurationUnit = 'instant' | 'second' | 'minute' | 'hour' | 'day' | 'year' | 'century' | 'forever';
export type CrackScenarioId = 'throttled' | 'online' | 'slowHash' | 'fastHash' | 'cluster';

export interface PasswordFinding {
  kind: PasswordFindingKind;
  text: string;
}

export interface PasswordClasses {
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
  other: boolean;
}

export interface CrackEstimate {
  id: CrackScenarioId;
  seconds: number;
  unit: DurationUnit;
  value: number;
}

export interface PasswordReport {
  length: number;
  charsetSize: number;
  classes: PasswordClasses;
  naiveBits: number;
  entropyBits: number;
  score: 0 | 1 | 2 | 3 | 4;
  findings: PasswordFinding[];
  crack: CrackEstimate[];
}

export const CRACK_SCENARIOS: ReadonlyArray<{ id: CrackScenarioId; guessesPerSecond: number }> = [
  { id: 'throttled', guessesPerSecond: 100 / 3600 },
  { id: 'online', guessesPerSecond: 10 },
  { id: 'slowHash', guessesPerSecond: 1e4 },
  { id: 'fastHash', guessesPerSecond: 1e10 },
  { id: 'cluster', guessesPerSecond: 1e12 },
];

export const MAX_ENTROPY_BITS = 128;
export const RECOMMENDED_LENGTH = 12;

const COMMON_WORDS = [
  'password', 'passw0rd', 'admin', 'administrator', 'welcome', 'letmein', 'login', 'monkey', 'dragon', 'master', 'shadow', 'sunshine',
  'princess', 'football', 'baseball', 'soccer', 'hockey', 'batman', 'superman', 'iloveyou', 'trustno', 'qwerty', 'qwertyuiop', 'asdfgh',
  'zxcvbn', 'abc123', 'test', 'guest', 'root', 'user', 'default', 'secret', 'changeme', 'whatever', 'freedom', 'hello', 'charlie',
  'donald', 'michael', 'jordan', 'jennifer', 'hunter', 'ranger', 'buster', 'thomas', 'robert', 'daniel', 'andrew', 'joshua', 'summer',
  'winter', 'spring', 'autumn', 'google', 'apple', 'internet', 'computer', 'cheese', 'pepper', 'killer', 'starwars', 'matrix', 'pokemon',
  'ginger', 'cookie', 'flower', 'hammer', 'silver', 'golden', 'love', 'angel', 'jesus', 'lovely', 'purple', 'orange', 'yellow', 'tiger',
  'bailey', 'lakers', 'maggie', 'mustang', 'access', 'biteme', 'harley', 'ashley', 'nicole', 'pass', 'pwd',
];
const COMMON_DICTIONARY_BITS = Math.log2(COMMON_WORDS.length * 64);
const KEYBOARD_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc', 'qazwsxedc'];
const LEET: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' };
const MIN_PATTERN = 3;
const MIN_WORD = 4;
const SECONDS = { minute: 60, hour: 3600, day: 86400, year: 31_557_600, century: 3_155_760_000 };
const SCORE_THRESHOLDS = [28, 40, 60, 80];

const charClasses = (password: string): PasswordClasses => ({
  lower: /[a-z]/.test(password),
  upper: /[A-Z]/.test(password),
  digit: /[0-9]/.test(password),
  symbol: /[ -/:-@[-`{-~]/.test(password),
  other: /[^\x00-\x7f]/.test(password),
});

const poolSize = (classes: PasswordClasses): number => (classes.lower ? 26 : 0) + (classes.upper ? 26 : 0) + (classes.digit ? 10 : 0) + (classes.symbol ? 33 : 0) + (classes.other ? 100 : 0);

const deleet = (text: string): string => Array.from(text.toLowerCase(), (char) => LEET[char] ?? char).join('');

const sequenceLength = (chars: string[], start: number): number => {
  if (start + 1 >= chars.length) return 1;
  const step = chars[start + 1].codePointAt(0)! - chars[start].codePointAt(0)!;
  if (Math.abs(step) !== 1) return 1;
  let end = start + 1;
  while (end + 1 < chars.length && chars[end + 1].codePointAt(0)! - chars[end].codePointAt(0)! === step) end++;
  return end - start + 1;
};

const repeatLength = (chars: string[], start: number): number => {
  let end = start;
  while (end + 1 < chars.length && chars[end + 1] === chars[start]) end++;
  return end - start + 1;
};

const keyboardLength = (lower: string, start: number): number => {
  let best = 0;
  for (const row of KEYBOARD_ROWS) {
    for (const source of [row, [...row].reverse().join('')]) {
      const at = source.indexOf(lower[start]);
      if (at < 0) continue;
      let length = 1;
      while (start + length < lower.length && source[at + length] === lower[start + length]) length++;
      best = Math.max(best, length);
    }
  }
  return best;
};

const dictionaryLength = (normalized: string, start: number): number => {
  let best = 0;
  for (const word of COMMON_WORDS) if (word.length >= MIN_WORD && word.length > best && normalized.startsWith(word, start)) best = word.length;
  return best;
};

const estimateEntropy = (chars: string[], poolBits: number): { bits: number; findings: PasswordFinding[] } => {
  const lower = chars.join('').toLowerCase();
  const normalized = deleet(chars.join(''));
  const findings: PasswordFinding[] = [];
  let bits = 0;
  let index = 0;
  while (index < chars.length) {
    const word = dictionaryLength(normalized, index);
    const seq = sequenceLength(chars, index);
    const repeat = repeatLength(chars, index);
    const keyboard = keyboardLength(lower, index);
    const year = /^(19|20)\d{2}/.test(chars.slice(index, index + 4).join('')) ? 4 : 0;
    const longest = Math.max(word, seq >= MIN_PATTERN ? seq : 0, repeat >= MIN_PATTERN ? repeat : 0, keyboard >= 4 ? keyboard : 0, year);
    if (longest === 0) {
      bits += poolBits;
      index += 1;
      continue;
    }
    const text = chars.slice(index, index + longest).join('');
    if (longest === word) {
      findings.push({ kind: 'common', text });
      bits += COMMON_DICTIONARY_BITS + (text !== text.toLowerCase() ? 1 : 0) + (normalized.slice(index, index + longest) !== lower.slice(index, index + longest) ? 1 : 0);
    } else if (longest === year) {
      findings.push({ kind: 'year', text });
      bits += Math.log2(120);
    } else if (longest === repeat) {
      findings.push({ kind: 'repeat', text });
      bits += poolBits + Math.log2(longest);
    } else if (longest === keyboard) {
      findings.push({ kind: 'keyboard', text });
      bits += Math.log2(KEYBOARD_ROWS.length * 2 * 8) + Math.log2(longest);
    } else {
      findings.push({ kind: 'sequence', text });
      bits += poolBits + Math.log2(longest);
    }
    index += longest;
  }
  return { bits, findings };
};

export const durationOf = (seconds: number): { unit: DurationUnit; value: number } => {
  if (!Number.isFinite(seconds) || seconds >= SECONDS.century * 1e9) return { unit: 'forever', value: 0 };
  if (seconds < 1) return { unit: 'instant', value: 0 };
  if (seconds < SECONDS.minute) return { unit: 'second', value: Math.round(seconds) };
  if (seconds < SECONDS.hour) return { unit: 'minute', value: Math.round(seconds / SECONDS.minute) };
  if (seconds < SECONDS.day) return { unit: 'hour', value: Math.round(seconds / SECONDS.hour) };
  if (seconds < SECONDS.year) return { unit: 'day', value: Math.round(seconds / SECONDS.day) };
  if (seconds < SECONDS.century) return { unit: 'year', value: Math.round(seconds / SECONDS.year) };
  return { unit: 'century', value: Math.round(seconds / SECONDS.century) };
};

export const analyzePassword = (password: string): PasswordReport => {
  const chars = Array.from(password);
  const classes = charClasses(password);
  const charsetSize = poolSize(classes);
  const poolBits = charsetSize > 0 ? Math.log2(charsetSize) : 0;
  const naiveBits = chars.length * poolBits;
  const { bits, findings } = estimateEntropy(chars, poolBits);
  const entropyBits = Math.min(bits, naiveBits);
  const score = SCORE_THRESHOLDS.filter((threshold) => entropyBits >= threshold).length as PasswordReport['score'];
  const guesses = 2 ** Math.max(0, entropyBits - 1);
  const crack = CRACK_SCENARIOS.map(({ id, guessesPerSecond }) => {
    const seconds = entropyBits > 0 ? guesses / guessesPerSecond : 0;
    return { id, seconds, ...durationOf(seconds) };
  });
  return { length: chars.length, charsetSize, classes, naiveBits, entropyBits, score, findings, crack };
};

/** Entropy of a random string drawn uniformly from a pool of the given size. */
export const randomEntropyBits = (length: number, pool: number): number => (pool > 1 ? length * Math.log2(pool) : 0);
