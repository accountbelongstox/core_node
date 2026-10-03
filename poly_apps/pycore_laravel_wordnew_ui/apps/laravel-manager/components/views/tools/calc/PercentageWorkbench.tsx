/** Percentage calculator built from four sentence-style questions with a visual share bar. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, Lcd, MUTED_TEXT, NumField, Seg, formatFixed, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { calculatePercent, type PercentMode } from './mathLogic';

const MODES: readonly PercentMode[] = ['of', 'whatPercent', 'whole', 'change'];
const FIELD_UNIT: Record<PercentMode, { a: string; b: string }> = {
  of: { a: '%', b: '' },
  whatPercent: { a: '', b: '' },
  whole: { a: '', b: '%' },
  change: { a: '', b: '' },
};
const RESULT_UNIT: Record<PercentMode, string> = { of: '', whatPercent: '%', whole: '', change: '%' };
const FRACTION_DIGITS = 4;

const PercentageWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { mode: 'of', a: 15, b: 200 }), [lastRun]);
  const [mode, setMode] = useState<PercentMode>(MODES.includes(initial.mode as PercentMode) ? (initial.mode as PercentMode) : 'of');
  const [valueA, setValueA] = useState(initial.a);
  const [valueB, setValueB] = useState(initial.b);

  const result = useMemo(() => calculatePercent(mode, valueA, valueB), [mode, valueA, valueB]);
  const complete = Number.isFinite(valueA) && Number.isFinite(valueB);
  const ready = complete && result.valid;
  const resultText = ready ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: FRACTION_DIGITS }).format(result.value) : '—';
  const signed = mode === 'change' && ready && result.value > 0 ? `+${resultText}` : resultText;
  const barShare = Math.min(100, Math.max(0, result.share));
  const overflow = result.share > 100;
  const labelKey = (part: string): string => `toolsCalc.percentage.${mode}.${part}`;

  useAutoRecord(record, { mode, a: valueA, b: valueB }, { value: result.value }, ready);

  const fieldBox = (value: number, onChange: (n: number) => void, unit: string, label: string): React.ReactNode => (
    <NumField value={value} onChange={onChange} negative ariaLabel={label} suffix={unit || undefined} className="w-32" inputClassName="text-lg font-bold" />
  );

  const comparison = mode === 'change' && ready
    ? { from: Math.abs(valueA), to: Math.abs(valueB) }
    : null;
  const comparisonMax = comparison ? Math.max(comparison.from, comparison.to, Number.EPSILON) : 1;

  return (
    <Bench accent="math">
      <Seg
        value={mode}
        onChange={setMode}
        ariaLabel={t('toolsCalc.percentage.mode')}
        options={MODES.map((m) => ({ value: m, label: t(`toolsCalc.percentage.${m}.tab`) }))}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-base text-slate-700 dark:text-slate-200 sm:text-lg">
          {t(labelKey('before')) && <span>{t(labelKey('before'))}</span>}
          {fieldBox(valueA, setValueA, FIELD_UNIT[mode].a, t(labelKey('field_a')))}
          {t(labelKey('between')) && <span>{t(labelKey('between'))}</span>}
          {fieldBox(valueB, setValueB, FIELD_UNIT[mode].b, t(labelKey('field_b')))}
          {t(labelKey('after')) && <span>{t(labelKey('after'))}</span>}
        </div>
      </Card>

      <Lcd className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="min-w-0 break-all text-4xl font-bold sm:text-6xl">
            {ready ? signed : '—'}<span className="ml-1 text-2xl opacity-70 sm:text-3xl">{ready ? RESULT_UNIT[mode] : ''}</span>
          </p>
          {mode === 'change' && ready && (result.value > 0 ? <ArrowUpRight className="h-10 w-10 shrink-0 text-emerald-400" /> : result.value < 0 ? <ArrowDownRight className="h-10 w-10 shrink-0 text-rose-400" /> : null)}
        </div>
        {complete && !result.valid && <p className="text-xs opacity-70">{t('toolsCalc.percentage.undefined')}</p>}
        {ready && !comparison && (
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full ${a.bar} transition-[width] duration-300`} style={{ width: `${barShare}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] opacity-60"><span>0%</span><span>{overflow ? t('toolsCalc.percentage.over_hundred') : '100%'}</span></div>
          </div>
        )}
        {comparison && (
          <div className="space-y-1.5">
            {[{ key: 'from', value: valueA, size: comparison.from }, { key: 'to', value: valueB, size: comparison.to }].map((row) => (
              <div key={row.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 shrink-0 opacity-70">{t(`toolsCalc.percentage.change.${row.key}`)}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${row.key === 'to' ? (result.value >= 0 ? 'bg-emerald-400' : 'bg-rose-400') : a.bar} transition-[width] duration-300`} style={{ width: `${(row.size / comparisonMax) * 100}%` }} />
                </div>
                <span className="w-20 truncate text-right">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Lcd>

      {ready && (
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={`${resultText}${RESULT_UNIT[mode]}`} label={t('toolsCalc.common.copy')}>{t('toolsCalc.common.copy')}</CopyButton>
          {mode === 'of' && (
            <>
              <span className={`rounded-full ${a.tint} px-3 py-1 font-mono text-xs ${a.text}`}>{t('toolsCalc.percentage.plus')} {formatFixed(valueB + result.value, 2, i18n.language)}</span>
              <span className={`rounded-full ${a.tint} px-3 py-1 font-mono text-xs ${a.text}`}>{t('toolsCalc.percentage.minus')} {formatFixed(valueB - result.value, 2, i18n.language)}</span>
            </>
          )}
          <span className={`text-xs ${MUTED_TEXT}`}>{t(labelKey('hint'))}</span>
        </div>
      )}
    </Bench>
  );
};

export default PercentageWorkbench;
