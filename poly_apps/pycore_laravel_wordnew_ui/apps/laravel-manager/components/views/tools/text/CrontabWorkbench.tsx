/** Crontab parser: field-by-field breakdown with value strips, human description and upcoming run times. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RefreshCw } from 'lucide-react';
import { Stepper } from '@/shared/ui/Stepper';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperInput, SoftButton, prefillNumber, prefillString, useToolRecord } from './textKit';
import { CRON_FIELDS, CRON_PRESETS, FIELD_SPECS, nextRuns, parseCron, replaceField, type CronField, type CronParse, type ParsedField } from './logic/cronLogic';

const DEFAULT_EXPRESSION = '*/15 9-17 * * 1-5';
const RUN_COUNTS = { min: 1, max: 30 };
const REFERENCE_SUNDAY = 7;

interface Describe {
  t: TFunction;
  locale: string;
}

const listText = (locale: string, items: string[]): string => {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
};

const nameOf = (locale: string, field: CronField, value: number): string => {
  if (field === 'month') return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, value - 1, 1));
  if (field === 'dayOfWeek') return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, REFERENCE_SUNDAY + value));
  return String(value);
};

const valueText = ({ t, locale }: Describe, field: CronField, parsed: ParsedField): string => {
  const range = /^([\w]+)-([\w]+)$/.exec(parsed.raw);
  if (range && parsed.values.length > 2 && parsed.kind === 'list') {
    return t('toolsText.cron.d_range', { from: nameOf(locale, field, parsed.values[0]), to: nameOf(locale, field, parsed.values[parsed.values.length - 1]) });
  }
  return listText(locale, parsed.values.map((value) => nameOf(locale, field, value)));
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const describeCron = (ctx: Describe, parse: CronParse): string => {
  const { t, locale } = ctx;
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parse.fields;
  const parts: string[] = [];
  if (minute.kind === 'list' && hour.kind === 'list' && minute.values.length * hour.values.length <= 6) {
    const times = hour.values.flatMap((h) => minute.values.map((m) => `${pad2(h)}:${pad2(m)}`));
    parts.push(t('toolsText.cron.d_at_times', { v: listText(locale, times) }));
  } else {
    parts.push(minute.kind === 'any' ? t('toolsText.cron.d_every_minute')
      : minute.kind === 'step' ? t('toolsText.cron.d_every_n_minutes', { n: minute.step })
        : t('toolsText.cron.d_at_minute', { v: listText(locale, minute.values.map(String)) }));
    if (hour.kind === 'step') parts.push(t('toolsText.cron.d_every_n_hours', { n: hour.step }));
    else if (hour.kind === 'list') parts.push(t('toolsText.cron.d_past_hour', { v: hour.values.length > 2 && /^\d+-\d+$/.test(hour.raw) ? t('toolsText.cron.d_range', { from: hour.values[0], to: hour.values[hour.values.length - 1] }) : listText(locale, hour.values.map(String)) }));
  }
  if (dayOfMonth.kind === 'step') parts.push(t('toolsText.cron.d_every_n_days', { n: dayOfMonth.step }));
  else if (dayOfMonth.kind === 'list') parts.push(t('toolsText.cron.d_on_day', { v: valueText(ctx, 'dayOfMonth', dayOfMonth) }));
  if (month.kind !== 'any') parts.push(t('toolsText.cron.d_in_month', { v: valueText(ctx, 'month', month) }));
  if (dayOfWeek.kind !== 'any') parts.push(t('toolsText.cron.d_on_weekday', { v: valueText(ctx, 'dayOfWeek', dayOfWeek) }));
  return parts.join(', ');
};

const ValueStrip: React.FC<{ field: CronField; parsed: ParsedField; locale: string }> = ({ field, parsed, locale }) => {
  const spec = FIELD_SPECS[field];
  const max = field === 'dayOfWeek' ? 6 : spec.max;
  const cells = Array.from({ length: max - spec.min + 1 }, (_, index) => spec.min + index);
  const columns = field === 'minute' ? 15 : field === 'hour' ? 12 : field === 'dayOfMonth' ? 11 : cells.length;
  const labelled = field === 'month' || field === 'dayOfWeek';
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden>
      {cells.map((value) => {
        const on = !parsed.error && parsed.values.includes(value);
        const label = labelled ? nameOf(locale, field, value).slice(0, field === 'month' ? 3 : 2) : String(value);
        return (
          <span
            key={value}
            title={nameOf(locale, field, value)}
            className={`flex items-center justify-center overflow-hidden rounded-[3px] text-[8px] font-bold leading-none ${on ? 'bg-violet-600 text-white' : 'bg-stone-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'} ${labelled ? 'py-1.5 text-[9px]' : 'aspect-square'}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
};

const CrontabWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [expression, setExpression] = useState(() => prefillString(lastRun, 'expression', DEFAULT_EXPRESSION));
  const [count, setCount] = useState(() => prefillNumber(lastRun, 'count', 8));
  const [tick, setTick] = useState(0);
  const locale = i18n.language || 'en';

  const parse = useMemo(() => parseCron(expression), [expression]);
  const description = useMemo(() => (parse.valid ? describeCron({ t, locale }, parse) : ''), [parse, t, locale]);
  const runs = useMemo(() => nextRuns(parse, count, new Date()), [parse, count, tick]);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), [locale]);
  const relative = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);
  const bothDays = parse.valid && parse.fields.dayOfMonth.restricted && parse.fields.dayOfWeek.restricted;
  const incomplete = parse.tokens.length < 5;

  const relativeTo = (date: Date): string => {
    const minutes = Math.round((date.getTime() - Date.now()) / 60000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    if (Math.abs(minutes) < 60 * 48) return relative.format(Math.round(minutes / 60), 'hour');
    return relative.format(Math.round(minutes / 1440), 'day');
  };

  return (
    <Desk wide>
      <Paper title={t('toolsText.cron.expression')} actions={<CopyButton text={expression} onCopied={() => record({ expression, count }, { description })} />}>
        <PaperInput value={expression} onChange={setExpression} invalid={!parse.valid} ariaLabel={t('toolsText.cron.expression')} placeholder="* * * * *" className="py-3 text-lg tracking-wide" />
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('toolsText.cron.presets')}>
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setExpression(preset.expression)}
              className="shrink-0 cursor-pointer rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
            >
              {t(`toolsText.cron.preset_${preset.id}`)}
            </button>
          ))}
        </div>
        {incomplete && <Notice tone="warn" className="mt-3">{t('toolsText.cron.need_five')}</Notice>}
        {parse.valid && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-500/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">{t('toolsText.cron.meaning')}</p>
            <p className="mt-0.5 font-serif text-xl leading-snug text-slate-800 dark:text-slate-100">{description}</p>
            {parse.command && <p className="mt-1.5 break-all font-mono text-xs text-slate-500">{t('toolsText.cron.command')}: {parse.command}</p>}
          </div>
        )}
        {bothDays && <Notice tone="info" className="mt-3">{t('toolsText.cron.dom_dow_or')}</Notice>}
      </Paper>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CRON_FIELDS.map((field) => {
          const parsed = parse.fields[field];
          const spec = FIELD_SPECS[field];
          return (
            <Paper key={field} title={t(`toolsText.cron.field_${field}`)}>
              <FieldLabel hint={`${spec.min}-${spec.max}`}>{t('toolsText.cron.value')}</FieldLabel>
              <PaperInput
                value={parse.tokens[CRON_FIELDS.indexOf(field)] ?? ''}
                onChange={(value) => setExpression(replaceField(expression, field, value))}
                invalid={Boolean(parsed.error) && parse.tokens.length >= 5}
                ariaLabel={t(`toolsText.cron.field_${field}`)}
                className="text-center text-base font-bold"
              />
              <p className={`mt-1 min-h-[1rem] text-[11px] ${parsed.error ? 'text-rose-500' : 'text-slate-400'}`}>
                {parsed.error ? t(`toolsText.cron.err_${parsed.error}`) : t('toolsText.cron.matches', { n: parsed.values.length })}
              </p>
              <div className="mt-2"><ValueStrip field={field} parsed={parsed} locale={locale} /></div>
            </Paper>
          );
        })}
      </div>

      <Paper
        title={t('toolsText.cron.next_runs')}
        actions={(
          <>
            <Stepper value={count} min={RUN_COUNTS.min} max={RUN_COUNTS.max} step={1} onChange={setCount} />
            <SoftButton icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setTick((value) => value + 1)}>{t('toolsText.cron.refresh')}</SoftButton>
          </>
        )}
      >
        {runs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{parse.valid ? t('toolsText.cron.never') : t('toolsText.cron.fix_first')}</p>
        ) : (
          <>
            <ol className="grid gap-2 sm:grid-cols-2">
              {runs.map((run, index) => (
                <li key={run.getTime()} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{dateFormat.format(run)}</span>
                    <span className="block truncate text-[11px] text-slate-400">{relativeTo(run)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-slate-400">{t('toolsText.cron.timezone', { zone })}</p>
          </>
        )}
      </Paper>
    </Desk>
  );
};

export default CrontabWorkbench;
