/** Pure math helpers for the calculator workbenches: expression parser, finance, dates and number words. */

export type AngleMode = 'deg' | 'rad';
export type ExprErrorCode =
  | 'empty' | 'too_long' | 'too_deep' | 'unexpected_char' | 'unexpected_token' | 'missing_paren'
  | 'unknown_name' | 'bad_arguments' | 'div_zero' | 'domain' | 'overflow';

export class ExprError extends Error {
  constructor(public readonly code: ExprErrorCode, public readonly pos = 0, public readonly detail = '') {
    super(code);
  }
}

interface Token {
  type: 'num' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'end';
  value: string;
  num: number;
  pos: number;
}

interface EvalContext {
  angle: AngleMode;
  ans: number;
}

type MathFn = (args: number[], ctx: EvalContext) => number;

const MAX_EXPR_LENGTH = 500;
const MAX_DEPTH = 120;
const MAX_FACTORIAL = 170;
const TINY = 1e-15;
const SIGNIFICANT_DIGITS = 12;
const OPERAND_START = new Set<Token['type']>(['num', 'id', 'lp']);
const SYMBOL_ALIASES: Record<string, string> = { '×': '*', '·': '*', '÷': '/', '−': '-', '–': '-', '（': '(', '）': ')', '，': ',' };
const NUMBER_PATTERN = /^(?:0x[0-9a-f]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i;
const ID_PATTERN = /^[A-Za-z_π][A-Za-z0-9_]*/;

const CONSTANTS: Record<string, number> = {
  pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2,
};

const toRad = (x: number, ctx: EvalContext): number => (ctx.angle === 'deg' ? (x * Math.PI) / 180 : x);
const fromRad = (x: number, ctx: EvalContext): number => (ctx.angle === 'deg' ? (x * 180) / Math.PI : x);
const snap = (x: number): number => (Math.abs(x) < TINY ? 0 : x);

const domain = (ok: boolean, value: number): number => {
  if (!ok) throw new ExprError('domain');
  return value;
};

const factorial = (n: number): number => {
  if (!Number.isInteger(n) || n < 0 || n > MAX_FACTORIAL) throw new ExprError('domain');
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
};

const FUNCTIONS: Record<string, { min: number; max: number; fn: MathFn }> = {
  sin: { min: 1, max: 1, fn: ([x], c) => snap(Math.sin(toRad(x, c))) },
  cos: { min: 1, max: 1, fn: ([x], c) => snap(Math.cos(toRad(x, c))) },
  tan: { min: 1, max: 1, fn: ([x], c) => domain(!(c.angle === 'deg' && Math.abs(x % 180) === 90), snap(Math.tan(toRad(x, c)))) },
  asin: { min: 1, max: 1, fn: ([x], c) => domain(Math.abs(x) <= 1, snap(fromRad(Math.asin(x), c))) },
  acos: { min: 1, max: 1, fn: ([x], c) => domain(Math.abs(x) <= 1, snap(fromRad(Math.acos(x), c))) },
  atan: { min: 1, max: 1, fn: ([x], c) => snap(fromRad(Math.atan(x), c)) },
  sinh: { min: 1, max: 1, fn: ([x]) => Math.sinh(x) },
  cosh: { min: 1, max: 1, fn: ([x]) => Math.cosh(x) },
  tanh: { min: 1, max: 1, fn: ([x]) => Math.tanh(x) },
  sqrt: { min: 1, max: 1, fn: ([x]) => domain(x >= 0, Math.sqrt(x)) },
  cbrt: { min: 1, max: 1, fn: ([x]) => Math.cbrt(x) },
  abs: { min: 1, max: 1, fn: ([x]) => Math.abs(x) },
  ln: { min: 1, max: 1, fn: ([x]) => domain(x > 0, Math.log(x)) },
  log: { min: 1, max: 2, fn: ([x, base]) => domain(x > 0 && (base === undefined || (base > 0 && base !== 1)), base === undefined ? Math.log10(x) : Math.log(x) / Math.log(base)) },
  log2: { min: 1, max: 1, fn: ([x]) => domain(x > 0, Math.log2(x)) },
  exp: { min: 1, max: 1, fn: ([x]) => Math.exp(x) },
  floor: { min: 1, max: 1, fn: ([x]) => Math.floor(x) },
  ceil: { min: 1, max: 1, fn: ([x]) => Math.ceil(x) },
  round: { min: 1, max: 2, fn: ([x, digits = 0]) => { const f = 10 ** Math.trunc(digits); return Math.round(x * f) / f; } },
  trunc: { min: 1, max: 1, fn: ([x]) => Math.trunc(x) },
  sign: { min: 1, max: 1, fn: ([x]) => Math.sign(x) },
  min: { min: 1, max: 32, fn: (a) => Math.min(...a) },
  max: { min: 1, max: 32, fn: (a) => Math.max(...a) },
  pow: { min: 2, max: 2, fn: ([a, b]) => a ** b },
  hypot: { min: 1, max: 32, fn: (a) => Math.hypot(...a) },
  fact: { min: 1, max: 1, fn: ([x]) => factorial(x) },
  deg: { min: 1, max: 1, fn: ([x]) => (x * 180) / Math.PI },
  rad: { min: 1, max: 1, fn: ([x]) => (x * Math.PI) / 180 },
  mod: { min: 2, max: 2, fn: ([a, b]) => { if (b === 0) throw new ExprError('div_zero'); return a - b * Math.floor(a / b); } },
  gcd: { min: 2, max: 2, fn: ([a, b]) => { let x = Math.abs(Math.trunc(a)); let y = Math.abs(Math.trunc(b)); while (y) { [x, y] = [y, x % y]; } return x; } },
};

export const EXPR_FUNCTION_NAMES = Object.keys(FUNCTIONS);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const raw = source[i];
    const ch = SYMBOL_ALIASES[raw] ?? raw;
    if (/\s/.test(ch)) { i += 1; continue; }
    const rest = source.slice(i);
    const numMatch = NUMBER_PATTERN.exec(rest);
    if (numMatch) {
      const text = numMatch[0];
      const lower = text.toLowerCase();
      const num = lower.startsWith('0x') ? parseInt(lower.slice(2), 16) : lower.startsWith('0b') ? parseInt(lower.slice(2), 2) : Number(text);
      tokens.push({ type: 'num', value: text, num, pos: i });
      i += text.length;
      continue;
    }
    if (ch === '√') { tokens.push({ type: 'id', value: 'sqrt', num: 0, pos: i }); i += 1; continue; }
    const idMatch = ID_PATTERN.exec(rest);
    if (idMatch) {
      tokens.push({ type: 'id', value: idMatch[0].toLowerCase(), num: 0, pos: i });
      i += idMatch[0].length;
      continue;
    }
    if (ch === '*' && source[i + 1] === '*') { tokens.push({ type: 'op', value: '^', num: 0, pos: i }); i += 2; continue; }
    if ('+-*/%^!'.includes(ch)) { tokens.push({ type: 'op', value: ch, num: 0, pos: i }); i += 1; continue; }
    if (ch === '(') { tokens.push({ type: 'lp', value: ch, num: 0, pos: i }); i += 1; continue; }
    if (ch === ')') { tokens.push({ type: 'rp', value: ch, num: 0, pos: i }); i += 1; continue; }
    if (ch === ',') { tokens.push({ type: 'comma', value: ch, num: 0, pos: i }); i += 1; continue; }
    throw new ExprError('unexpected_char', i, raw);
  }
  tokens.push({ type: 'end', value: '', num: 0, pos: source.length });
  return tokens;
}

const checkFinite = (x: number): number => {
  if (Number.isNaN(x)) throw new ExprError('domain');
  if (!Number.isFinite(x)) throw new ExprError('overflow');
  return x;
};

/** Evaluates an arithmetic expression with a recursive-descent parser (no eval / Function). */
export function evaluateExpression(source: string, options: { angle?: AngleMode; ans?: number } = {}): number {
  const text = source.trim();
  if (!text) throw new ExprError('empty');
  if (text.length > MAX_EXPR_LENGTH) throw new ExprError('too_long');
  const ctx: EvalContext = { angle: options.angle ?? 'deg', ans: options.ans ?? 0 };
  const tokens = tokenize(text);
  let index = 0;
  let depth = 0;

  const peek = (offset = 0): Token => tokens[Math.min(index + offset, tokens.length - 1)];
  const next = (): Token => tokens[index++];
  const isOp = (token: Token, value: string): boolean => token.type === 'op' && token.value === value;

  const enter = (): void => { depth += 1; if (depth > MAX_DEPTH) throw new ExprError('too_deep'); };
  const leave = (): void => { depth -= 1; };

  function parseExpression(): number {
    enter();
    let left = parseTerm();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = next().value;
      const right = parseTerm();
      left = checkFinite(op === '+' ? left + right : left - right);
    }
    leave();
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (isOp(token, '*') || isOp(token, '/')) {
        next();
        const right = parseUnary();
        if (token.value === '/' && right === 0) throw new ExprError('div_zero', token.pos);
        left = checkFinite(token.value === '*' ? left * right : left / right);
      } else if (isOp(token, '%') && OPERAND_START.has(peek(1).type)) {
        next();
        const right = parseUnary();
        if (right === 0) throw new ExprError('div_zero', token.pos);
        left = checkFinite(left - right * Math.floor(left / right));
      } else if (token.type === 'id' || token.type === 'lp') {
        left = checkFinite(left * parseUnary());
      } else {
        return left;
      }
    }
  }

  function parseUnary(): number {
    const token = peek();
    if (isOp(token, '-')) { next(); enter(); const value = -parseUnary(); leave(); return value; }
    if (isOp(token, '+')) { next(); enter(); const value = parseUnary(); leave(); return value; }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePostfix();
    if (isOp(peek(), '^')) {
      next();
      enter();
      const exponent = parseUnary();
      leave();
      return checkFinite(base ** exponent);
    }
    return base;
  }

  function parsePostfix(): number {
    let value = parsePrimary();
    for (;;) {
      const token = peek();
      if (isOp(token, '!')) { next(); value = factorial(value); continue; }
      if (isOp(token, '%') && !OPERAND_START.has(peek(1).type)) { next(); value /= 100; continue; }
      return value;
    }
  }

  function parsePrimary(): number {
    const token = next();
    if (token.type === 'num') return checkFinite(token.num);
    if (token.type === 'lp') {
      const value = parseExpression();
      if (peek().type !== 'rp') throw new ExprError('missing_paren', peek().pos);
      next();
      return value;
    }
    if (token.type === 'id') {
      if (peek().type === 'lp') {
        const spec = FUNCTIONS[token.value];
        if (!spec) throw new ExprError('unknown_name', token.pos, token.value);
        next();
        const args: number[] = [];
        if (peek().type !== 'rp') {
          args.push(parseExpression());
          while (peek().type === 'comma') { next(); args.push(parseExpression()); }
        }
        if (peek().type !== 'rp') throw new ExprError('missing_paren', peek().pos);
        next();
        if (args.length < spec.min || args.length > spec.max) throw new ExprError('bad_arguments', token.pos, token.value);
        return checkFinite(spec.fn(args, ctx));
      }
      const prefixFn = FUNCTIONS[token.value];
      if (prefixFn && prefixFn.min === 1 && prefixFn.max === 1 && OPERAND_START.has(peek().type)) return checkFinite(prefixFn.fn([parseUnary()], ctx));
      if (token.value === 'ans') return ctx.ans;
      if (token.value in CONSTANTS) return CONSTANTS[token.value];
      throw new ExprError('unknown_name', token.pos, token.value);
    }
    if (token.type === 'end') throw new ExprError('unexpected_token', token.pos, '');
    throw new ExprError('unexpected_token', token.pos, token.value);
  }

  const result = parseExpression();
  if (peek().type !== 'end') {
    const stray = peek();
    throw new ExprError(stray.type === 'rp' ? 'missing_paren' : 'unexpected_token', stray.pos, stray.value);
  }
  return result;
}

/** Plain decimal text of a computed value, trimmed to 12 significant digits. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}

/** Groups the integer digits of a plain number string for display. */
export function groupDigits(text: string, separator = ','): string {
  if (/e/i.test(text)) return text;
  const [intPart, frac] = text.split('.');
  const negative = intPart.startsWith('-');
  const digits = negative ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return `${negative ? '-' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}

export interface RadixView { hex: string; bin: string; oct: string }

export const radixView = (value: number): RadixView | null => (
  Number.isSafeInteger(value) && value >= 0
    ? { hex: value.toString(16).toUpperCase(), bin: value.toString(2), oct: value.toString(8) }
    : null
);

// ---------------------------------------------------------------- percentage

export type PercentMode = 'of' | 'whatPercent' | 'whole' | 'change';

export interface PercentResult { value: number; share: number; valid: boolean }

/** `of`: a% of b; `whatPercent`: a is ?% of b; `whole`: a is b% of ?; `change`: a to b as % change. */
export function calculatePercent(mode: PercentMode, a: number, b: number): PercentResult {
  let value = NaN;
  if (mode === 'of') value = (a / 100) * b;
  else if (mode === 'whatPercent') value = b === 0 ? NaN : (a / b) * 100;
  else if (mode === 'whole') value = b === 0 ? NaN : a / (b / 100);
  else value = a === 0 ? NaN : ((b - a) / Math.abs(a)) * 100;
  const valid = Number.isFinite(value);
  const share = !valid ? 0 : mode === 'of' ? a : mode === 'whatPercent' ? value : mode === 'whole' ? b : Math.abs(value);
  return { value: valid ? value : 0, share, valid };
}

// ---------------------------------------------------------------- eta

export interface EtaProgress { rate: number; remainingSeconds: number; totalSeconds: number; fraction: number }

export function etaFromProgress(total: number, done: number, elapsedSeconds: number): EtaProgress | null {
  if (!(total > 0) || !(done > 0) || !(elapsedSeconds > 0) || done > total) return null;
  const rate = done / elapsedSeconds;
  const remainingSeconds = (total - done) / rate;
  return { rate, remainingSeconds, totalSeconds: elapsedSeconds + remainingSeconds, fraction: done / total };
}

export const splitSeconds = (seconds: number): { d: number; h: number; m: number; s: number } => {
  const whole = Math.max(0, Math.round(seconds));
  return { d: Math.floor(whole / 86400), h: Math.floor((whole % 86400) / 3600), m: Math.floor((whole % 3600) / 60), s: whole % 60 };
};

// ---------------------------------------------------------------- age

export interface AgeParts { years: number; months: number; days: number; hours: number; minutes: number; seconds: number }

const MS_PER_DAY = 86400000;
const dayNumber = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY;
const secondsOfDay = (d: Date): number => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();

const addMonthsClamped = (from: Date, months: number): Date => {
  const target = new Date(from.getFullYear(), from.getMonth() + months, 1, from.getHours(), from.getMinutes(), from.getSeconds());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return target;
};

/** Calendar difference (years, months, days, h:m:s) from `from` to `to`; `to` must not precede `from`. */
export function calendarDiff(from: Date, to: Date): AgeParts {
  let totalMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  let anchor = addMonthsClamped(from, totalMonths);
  if (anchor.getTime() > to.getTime()) { totalMonths -= 1; anchor = addMonthsClamped(from, totalMonths); }
  let days = dayNumber(to) - dayNumber(anchor);
  let seconds = secondsOfDay(to) - secondsOfDay(anchor);
  if (seconds < 0) { seconds += 86400; days -= 1; }
  return {
    years: Math.floor(totalMonths / 12), months: totalMonths % 12, days,
    hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60,
  };
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

export const toDateInput = (d: Date): string => `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface NextBirthday { date: Date; msLeft: number; today: boolean; turning: number }

export function nextBirthday(birth: Date, now: Date): NextBirthday {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let year = now.getFullYear();
  let date = new Date(year, birth.getMonth(), birth.getDate());
  if (date.getTime() < startOfToday.getTime()) { year += 1; date = new Date(year, birth.getMonth(), birth.getDate()); }
  return { date, msLeft: date.getTime() - now.getTime(), today: date.getTime() === startOfToday.getTime(), turning: year - birth.getFullYear() };
}

// ---------------------------------------------------------------- bmi

export type BmiBand = 'under' | 'normal' | 'over' | 'obese1' | 'obese2' | 'obese3';

export const BMI_BANDS: ReadonlyArray<{ band: BmiBand; from: number; to: number }> = [
  { band: 'under', from: 10, to: 18.5 },
  { band: 'normal', from: 18.5, to: 25 },
  { band: 'over', from: 25, to: 30 },
  { band: 'obese1', from: 30, to: 35 },
  { band: 'obese2', from: 35, to: 40 },
  { band: 'obese3', from: 40, to: 50 },
];

export const BMI_SCALE = { min: 10, max: 50 };
export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

export interface BmiResult { bmi: number; band: BmiBand; healthyMinKg: number; healthyMaxKg: number; deltaKg: number }

export function calculateBmi(heightCm: number, weightKg: number): BmiResult | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  const band = (BMI_BANDS.find((b) => bmi < b.to) ?? BMI_BANDS[BMI_BANDS.length - 1]).band;
  const healthyMinKg = 18.5 * m * m;
  const healthyMaxKg = 24.9 * m * m;
  const deltaKg = weightKg < healthyMinKg ? healthyMinKg - weightKg : weightKg > healthyMaxKg ? healthyMaxKg - weightKg : 0;
  return { bmi, band, healthyMinKg, healthyMaxKg, deltaKg };
}

// ---------------------------------------------------------------- loan

export interface LoanRow { month: number; payment: number; principal: number; interest: number; balance: number }
export interface LoanResult { emi: number; totalInterest: number; totalPayment: number; schedule: LoanRow[] }

export function calculateLoan(principal: number, annualRatePercent: number, months: number): LoanResult | null {
  if (!(principal > 0) || !(months >= 1) || !(annualRatePercent >= 0)) return null;
  const n = Math.round(months);
  const r = annualRatePercent / 1200;
  const emi = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const schedule: LoanRow[] = [];
  let balance = principal;
  for (let month = 1; month <= n; month += 1) {
    const interest = balance * r;
    const principalPart = month === n ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    schedule.push({ month, payment: principalPart + interest, principal: principalPart, interest, balance });
  }
  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  return { emi, totalInterest: totalPayment - principal, totalPayment, schedule };
}

// ---------------------------------------------------------------- gst

export type GstMode = 'exclusive' | 'inclusive';
export interface GstResult { net: number; tax: number; total: number }

export function calculateGst(amount: number, ratePercent: number, mode: GstMode): GstResult | null {
  if (!(amount >= 0) || !(ratePercent >= 0)) return null;
  if (mode === 'exclusive') {
    const tax = (amount * ratePercent) / 100;
    return { net: amount, tax, total: amount + tax };
  }
  const net = amount / (1 + ratePercent / 100);
  return { net, tax: amount - net, total: amount };
}

// ---------------------------------------------------------------- number words

export type WordsLang = 'en' | 'zh';
export type WordsStyle = 'plain' | 'ordinal' | 'currency';
export type WordsCurrency = 'USD' | 'EUR' | 'GBP' | 'CNY';
export type NumberWordsError = 'empty' | 'invalid' | 'too_large';

export interface WordsOptions { lang: WordsLang; style: WordsStyle; currency: WordsCurrency; british: boolean; financial: boolean }

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];
const EN_ORDINAL_IRREGULAR: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const EN_CURRENCY: Record<WordsCurrency, { major: [string, string]; minor: [string, string] }> = {
  USD: { major: ['dollar', 'dollars'], minor: ['cent', 'cents'] },
  EUR: { major: ['euro', 'euros'], minor: ['cent', 'cents'] },
  GBP: { major: ['pound', 'pounds'], minor: ['penny', 'pence'] },
  CNY: { major: ['yuan', 'yuan'], minor: ['fen', 'fen'] },
};
const ZH_NORMAL = { digits: '零一二三四五六七八九', units: ['', '十', '百', '千'], scales: ['', '万', '亿', '兆', '京', '垓', '秭'] };
const ZH_FINANCIAL = { digits: '零壹贰叁肆伍陆柒捌玖', units: ['', '拾', '佰', '仟'], scales: ['', '万', '亿', '兆', '京', '垓', '秭'] };
const MAX_EN_DIGITS = EN_SCALES.length * 3;
const MAX_ZH_DIGITS = ZH_NORMAL.scales.length * 4;
const THOUSAND = BigInt(1000);
const TEN_THOUSAND = BigInt(10000);
const HUNDRED = BigInt(100);

const enBelowThousand = (n: number, british: boolean): string => {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${EN_ONES[hundreds]} hundred`);
  if (rest) {
    const tail = rest < 20 ? EN_ONES[rest] : `${EN_TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${EN_ONES[rest % 10]}` : ''}`;
    parts.push(hundreds && british ? `and ${tail}` : tail);
  }
  return parts.join(' ');
};

export function englishWords(value: bigint, british = false): string {
  if (value === BigInt(0)) return EN_ONES[0];
  const groups: number[] = [];
  let rest = value;
  while (rest > BigInt(0)) { groups.push(Number(rest % THOUSAND)); rest /= THOUSAND; }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!groups[i]) continue;
    let text = enBelowThousand(groups[i], british);
    if (i === 0 && british && groups.length > 1 && groups[0] < 100) text = `and ${text}`;
    parts.push(i ? `${text} ${EN_SCALES[i]}` : text);
  }
  return parts.join(' ');
}

export function englishOrdinal(words: string): string {
  const match = /^(.*?)([a-z]+)$/.exec(words);
  if (!match) return words;
  const [, head, last] = match;
  if (EN_ORDINAL_IRREGULAR[last]) return `${head}${EN_ORDINAL_IRREGULAR[last]}`;
  if (last.endsWith('y')) return `${head}${last.slice(0, -1)}ieth`;
  return `${head}${last}th`;
}

const zhGroupText = (n: number, kit: typeof ZH_NORMAL): string => {
  let out = '';
  let zero = false;
  for (let i = 3; i >= 0; i -= 1) {
    const digit = Math.floor(n / 10 ** i) % 10;
    if (digit === 0) { if (out) zero = true; continue; }
    if (zero) { out += kit.digits[0]; zero = false; }
    out += kit.digits[digit] + kit.units[i];
  }
  return out;
};

export function chineseWords(value: bigint, financial = false): string {
  const kit = financial ? ZH_FINANCIAL : ZH_NORMAL;
  if (value === BigInt(0)) return kit.digits[0];
  const groups: number[] = [];
  let rest = value;
  while (rest > BigInt(0)) { groups.push(Number(rest % TEN_THOUSAND)); rest /= TEN_THOUSAND; }
  let out = '';
  let pendingZero = false;
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    if (g === 0) { if (out) pendingZero = true; continue; }
    let text = zhGroupText(g, kit);
    if (!out && !financial && g >= 10 && g < 20) text = text.slice(1);
    if (out && (pendingZero || g < 1000)) out += kit.digits[0];
    out += text + kit.scales[i];
    pendingZero = false;
  }
  return out;
}

const splitDecimal = (input: string): { negative: boolean; int: string; frac: string } | NumberWordsError => {
  const cleaned = input.trim().replace(/[,_\s]/g, '');
  if (!cleaned) return 'empty';
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[2] && !match[3])) return 'invalid';
  return { negative: match[1] === '-', int: (match[2] || '0').replace(/^0+(?=\d)/, ''), frac: match[3] ?? '' };
};

const roundToCents = (int: string, frac: string): { major: bigint; minor: number } => {
  const padded = `${frac}00`.slice(0, 2);
  let cents = BigInt(int) * HUNDRED + BigInt(padded);
  if (frac.length > 2 && frac[2] >= '5') cents += BigInt(1);
  return { major: cents / HUNDRED, minor: Number(cents % HUNDRED) };
};

export type WordsResult = { ok: true; text: string } | { ok: false; error: NumberWordsError };

/** Spells a decimal string (arbitrary size up to the language limit) in English or Chinese. */
export function numberToWords(input: string, options: WordsOptions): WordsResult {
  const parts = splitDecimal(input);
  if (typeof parts === 'string') return { ok: false, error: parts };
  const limit = options.lang === 'en' ? MAX_EN_DIGITS : MAX_ZH_DIGITS;
  if (parts.int.length > limit) return { ok: false, error: 'too_large' };
  const sign = parts.negative && (BigInt(parts.int) !== BigInt(0) || /[1-9]/.test(parts.frac)) ? (options.lang === 'en' ? 'minus ' : '负') : '';

  if (options.lang === 'en') {
    const british = options.british;
    if (options.style === 'currency') {
      const cur = EN_CURRENCY[options.currency];
      const { major, minor } = roundToCents(parts.int, parts.frac);
      const majorText = `${englishWords(major, british)} ${major === BigInt(1) ? cur.major[0] : cur.major[1]}`;
      const minorText = minor ? `${englishWords(BigInt(minor), british)} ${minor === 1 ? cur.minor[0] : cur.minor[1]}` : '';
      const body = minor ? (major === BigInt(0) ? minorText : `${majorText} and ${minorText}`) : majorText;
      return { ok: true, text: sign + body };
    }
    const intWords = englishWords(BigInt(parts.int), british);
    if (options.style === 'ordinal') {
      return { ok: true, text: sign + englishOrdinal(intWords) };
    }
    const fracWords = parts.frac ? ` point ${parts.frac.split('').map((d) => EN_ONES[Number(d)]).join(' ')}` : '';
    return { ok: true, text: sign + intWords + fracWords };
  }

  const financial = options.financial || options.style === 'currency';
  const kit = financial ? ZH_FINANCIAL : ZH_NORMAL;
  if (options.style === 'currency') {
    const { major, minor } = roundToCents(parts.int, parts.frac);
    const jiao = Math.floor(minor / 10);
    const fen = minor % 10;
    let body = `${chineseWords(major, true)}元`;
    if (!minor) body += '整';
    else {
      if (jiao) body += `${kit.digits[jiao]}角`;
      else if (major !== BigInt(0)) body += kit.digits[0];
      if (fen) body += `${kit.digits[fen]}分`;
      else body += '整';
    }
    if (major === BigInt(0)) body = body.replace(/^零元/, '');
    return { ok: true, text: sign + body };
  }
  const intText = chineseWords(BigInt(parts.int), financial);
  const fracText = parts.frac ? `点${parts.frac.split('').map((d) => kit.digits[Number(d)]).join('')}` : '';
  return { ok: true, text: sign + intText + fracText };
}
