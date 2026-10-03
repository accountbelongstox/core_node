/** Crontab engine: five-field parser with names and macros, field summaries and next-run computation. */
export const CRON_FIELDS = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'] as const;
export type CronField = (typeof CRON_FIELDS)[number];

interface FieldSpec {
  min: number;
  max: number;
  names?: string[];
}

export const FIELD_SPECS: Record<CronField, FieldSpec> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] },
  dayOfWeek: { min: 0, max: 7, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
};

export const CRON_MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export const CRON_PRESETS: ReadonlyArray<{ id: string; expression: string }> = [
  { id: 'everyMinute', expression: '* * * * *' },
  { id: 'every5Minutes', expression: '*/5 * * * *' },
  { id: 'hourly', expression: '0 * * * *' },
  { id: 'daily', expression: '0 0 * * *' },
  { id: 'weekdays9', expression: '0 9 * * 1-5' },
  { id: 'weekly', expression: '0 0 * * 0' },
  { id: 'monthly', expression: '0 0 1 * *' },
  { id: 'yearly', expression: '0 0 1 1 *' },
];

export type FieldKind = 'any' | 'step' | 'list';

export interface ParsedField {
  raw: string;
  values: number[];
  kind: FieldKind;
  step: number;
  restricted: boolean;
  error: string | null;
}

export interface CronParse {
  fields: Record<CronField, ParsedField>;
  command: string;
  tokens: string[];
  valid: boolean;
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

const toNumber = (token: string, spec: FieldSpec): number => {
  if (/^\d+$/.test(token)) return Number(token);
  const index = spec.names ? spec.names.indexOf(token.toUpperCase()) : -1;
  if (index < 0) return NaN;
  return spec.min === 1 ? index + 1 : index;
};

export const parseField = (raw: string, field: CronField): ParsedField => {
  const spec = FIELD_SPECS[field];
  const fail = (error: string): ParsedField => ({ raw, values: [], kind: 'list', step: 1, restricted: true, error });
  if (!raw) return fail('empty');
  const values = new Set<number>();
  let kind: FieldKind = 'list';
  let step = 1;
  const parts = raw.split(',');
  for (const part of parts) {
    const [base, stepText, extra] = part.split('/');
    if (extra !== undefined || part === '') return fail('syntax');
    const stepValue = stepText === undefined ? 1 : Number(stepText);
    if (stepText !== undefined && (!/^\d+$/.test(stepText) || stepValue < 1)) return fail('step');
    let from: number;
    let to: number;
    if (base === '*' || base === '?') {
      from = spec.min;
      to = field === 'dayOfWeek' ? 6 : spec.max;
      if (parts.length === 1) kind = stepText === undefined ? 'any' : 'step';
    } else if (base.includes('-')) {
      const [left, right, more] = base.split('-');
      if (more !== undefined) return fail('syntax');
      from = toNumber(left, spec);
      to = toNumber(right, spec);
    } else {
      from = toNumber(base, spec);
      to = stepText === undefined ? from : spec.max;
    }
    if (Number.isNaN(from) || Number.isNaN(to)) return fail('syntax');
    if (from < spec.min || to > spec.max || from > to) return fail('range');
    if (parts.length === 1 && stepText !== undefined) { kind = 'step'; step = stepValue; }
    range(from, to, stepValue).forEach((value) => values.add(field === 'dayOfWeek' && value === 7 ? 0 : value));
  }
  const sorted = Array.from(values).sort((a, b) => a - b);
  const full = field === 'dayOfWeek' ? 7 : spec.max - spec.min + 1;
  return { raw, values: sorted, kind, step, restricted: sorted.length < full, error: null };
};

export const splitCronLine = (line: string): { tokens: string[]; command: string } => {
  const trimmed = line.trim();
  const macro = CRON_MACROS[trimmed.split(/\s+/)[0].toLowerCase()];
  const words = macro ? [...macro.split(' '), ...trimmed.split(/\s+/).slice(1)] : trimmed.split(/\s+/).filter(Boolean);
  return { tokens: words.slice(0, 5), command: words.slice(5).join(' ') };
};

export const parseCron = (line: string): CronParse => {
  const { tokens, command } = splitCronLine(line);
  const fields = {} as Record<CronField, ParsedField>;
  CRON_FIELDS.forEach((field, index) => {
    const raw = tokens[index] ?? '';
    fields[field] = parseField(raw, field);
  });
  return { fields, command, tokens, valid: CRON_FIELDS.every((field) => !fields[field].error) };
};

const dayMatches = (date: Date, parse: CronParse): boolean => {
  const dom = parse.fields.dayOfMonth;
  const dow = parse.fields.dayOfWeek;
  const domHit = dom.values.includes(date.getDate());
  const dowHit = dow.values.includes(date.getDay());
  if (dom.restricted && dow.restricted) return domHit || dowHit;
  return domHit && dowHit;
};

const MAX_DAYS = 366 * 8;

/** Next run times after `from`, in the viewer's local timezone. */
export const nextRuns = (parse: CronParse, count: number, from: Date): Date[] => {
  if (!parse.valid) return [];
  const runs: Date[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const start = from.getTime();
  for (let offset = 0; offset < MAX_DAYS && runs.length < count; offset += 1) {
    const current = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
    if (!parse.fields.month.values.includes(current.getMonth() + 1) || !dayMatches(current, parse)) continue;
    for (const hour of parse.fields.hour.values) {
      for (const minute of parse.fields.minute.values) {
        const candidate = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hour, minute, 0, 0);
        if (candidate.getTime() > start && candidate.getHours() === hour) {
          runs.push(candidate);
          if (runs.length >= count) return runs;
        }
      }
    }
  }
  return runs;
};

export const replaceField = (line: string, field: CronField, value: string): string => {
  const { tokens, command } = splitCronLine(line);
  const next = CRON_FIELDS.map((name, index) => (name === field ? value.trim().replace(/\s+/g, '') : tokens[index] ?? '*'));
  return [...next, ...(command ? [command] : [])].join(' ');
};
