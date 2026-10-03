/** Roman numerals: linked Arabic/Roman fields with stepper, slider and symbol breakdown. */
import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { RangeField } from '@/shared/ui/RangeField';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { fromRoman, ROMAN_MAX, romanBreakdown, toRoman } from './convertCodecs';
import {
  ConvertPage, CopyButton, ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Notice, Panel, prefillOf, SkyChips, useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

interface RomanInput {
  value: number;
}

const QUICK_VALUES = [4, 9, 49, 99, 444, 1994, 2026, ROMAN_MAX];
const DEFAULT_VALUE = new Date().getFullYear();

const RomanWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<RomanInput>(lastRun);
  const initial = Number.isInteger(prefill.value) && (prefill.value as number) >= 1 && (prefill.value as number) <= ROMAN_MAX ? (prefill.value as number) : DEFAULT_VALUE;
  const [value, setValue] = useState<number | null>(initial);
  const [arabicText, setArabicText] = useState(String(initial));
  const [romanText, setRomanText] = useState(toRoman(initial));
  const [invalid, setInvalid] = useState<'arabic' | 'roman' | null>(null);
  const record = useRecorder(tool.id, variant);

  const commit = (next: number): void => {
    setValue(next);
    setArabicText(String(next));
    setRomanText(toRoman(next));
    setInvalid(null);
  };

  const editArabic = (raw: string): void => {
    setArabicText(raw);
    const parsed = Number(raw);
    if (/^\d+$/.test(raw.trim()) && parsed >= 1 && parsed <= ROMAN_MAX) {
      setValue(parsed);
      setRomanText(toRoman(parsed));
      setInvalid(null);
    } else {
      setValue(null);
      setInvalid(raw.trim() === '' ? null : 'arabic');
    }
  };

  const editRoman = (raw: string): void => {
    setRomanText(raw);
    try {
      const parsed = fromRoman(raw);
      setValue(parsed);
      setArabicText(String(parsed));
      setInvalid(null);
    } catch {
      setValue(null);
      setInvalid(raw.trim() === '' ? null : 'roman');
    }
  };

  useDebouncedRecord(tool.id, variant, { value }, romanText, value !== null);

  const parts = value === null ? [] : romanBreakdown(value);

  return (
    <ConvertPage>
      <Panel className="space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className={LABEL_CLASS}>{tc('roman.arabic')}</span>
            <div className="flex items-center gap-2">
              <button type="button" className={ICON_BUTTON_CLASS} aria-label={tc('roman.decrease')} disabled={value === null || value <= 1} onClick={() => value !== null && commit(value - 1)}><Minus className="h-4 w-4" /></button>
              <input
                value={arabicText}
                inputMode="numeric"
                onChange={(event) => editArabic(event.target.value)}
                className={`${INPUT_CLASS} ${MONO_CLASS} text-center text-lg ${invalid === 'arabic' ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              />
              <button type="button" className={ICON_BUTTON_CLASS} aria-label={tc('roman.increase')} disabled={value === null || value >= ROMAN_MAX} onClick={() => value !== null && commit(value + 1)}><Plus className="h-4 w-4" /></button>
            </div>
          </label>
          <label className="space-y-1.5">
            <span className={LABEL_CLASS}>{tc('roman.roman')}</span>
            <div className="flex items-center gap-2">
              <input
                value={romanText}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(event) => editRoman(event.target.value)}
                className={`${INPUT_CLASS} ${MONO_CLASS} text-center text-lg tracking-widest ${invalid === 'roman' ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              />
              <CopyButton text={romanText} onCopied={() => value !== null && record({ value }, romanText)} />
            </div>
          </label>
        </div>
        <RangeField value={value ?? 1} min={1} max={ROMAN_MAX} step={1} onChange={commit} leading={<span className="font-mono text-xs text-slate-500">1</span>} trailing={<span className="font-mono text-xs text-slate-500">{ROMAN_MAX}</span>} />
        <SkyChips value={value ?? 0} onChange={commit} options={QUICK_VALUES.map((quick) => ({ value: quick, label: String(quick) }))} />
        {invalid === 'arabic' && <Notice>{tc('errors.roman_range', { max: ROMAN_MAX })}</Notice>}
        {invalid === 'roman' && <Notice>{tc('errors.invalid_roman')}</Notice>}
      </Panel>
      {parts.length > 0 && (
        <Panel className="space-y-2 p-4">
          <div className={LABEL_CLASS}>{tc('roman.breakdown')}</div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            {parts.map((part, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-slate-400">+</span>}
                <div className="flex min-w-[3.2rem] flex-col items-center rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 dark:border-sky-500/30 dark:bg-sky-500/10">
                  <span className="text-lg font-bold text-sky-700 dark:text-sky-300">{part.symbol}</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{part.amount}</span>
                </div>
              </React.Fragment>
            ))}
            <span className="text-slate-400">=</span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</span>
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default RomanWorkbench;
