/** Temperature: five linked unit fields, a live thermometer, slider and reference points. */
import React, { useState } from 'react';
import { RangeField } from '@/shared/ui/RangeField';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ABSOLUTE_ZERO_C, formatNumber, fromCelsius, TEMPERATURE_UNITS, toCelsius, type TemperatureUnit } from './convertOps';
import { ConvertPage, CopyButton, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Notice, Panel, prefillOf, SkyChips, useConvertT, useDebouncedRecord } from './convertKit';

interface TemperatureInput {
  celsius: number;
}

const SYMBOLS: Record<TemperatureUnit, string> = { C: '\u00b0C', F: '\u00b0F', K: 'K', R: '\u00b0R', Re: '\u00b0R\u00e9' };
const REFERENCES: Array<{ id: string; celsius: number }> = [
  { id: 'absolute_zero', celsius: ABSOLUTE_ZERO_C },
  { id: 'freezing', celsius: 0 },
  { id: 'room', celsius: 20 },
  { id: 'body', celsius: 37 },
  { id: 'boiling', celsius: 100 },
];
const SLIDER_MIN = -50;
const SLIDER_MAX = 150;
const GAUGE_HUE_COLD = 215;
const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

const gaugeColor = (celsius: number): string => {
  const ratio = Math.min(1, Math.max(0, (celsius - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)));
  return `hsl(${Math.round(GAUGE_HUE_COLD * (1 - ratio))}, 85%, 52%)`;
};

const TemperatureWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<TemperatureInput>(lastRun);
  const [celsius, setCelsius] = useState(Number.isFinite(prefill.celsius) ? (prefill.celsius as number) : 25);
  const [editing, setEditing] = useState<{ unit: TemperatureUnit; text: string } | null>(null);
  const [belowZero, setBelowZero] = useState(false);

  const edit = (unit: TemperatureUnit, text: string): void => {
    setEditing({ unit, text });
    const trimmed = text.trim();
    if (!NUMBER_PATTERN.test(trimmed)) {
      setBelowZero(false);
      return;
    }
    const next = toCelsius(Number(trimmed), unit);
    if (next < ABSOLUTE_ZERO_C - 1e-9) {
      setBelowZero(true);
      return;
    }
    setBelowZero(false);
    setCelsius(next);
  };

  const setExact = (next: number): void => {
    setEditing(null);
    setBelowZero(false);
    setCelsius(next);
  };

  useDebouncedRecord(tool.id, variant, { celsius: Number(formatNumber(celsius, 4)) }, TEMPERATURE_UNITS.map((unit) => `${formatNumber(fromCelsius(celsius, unit))} ${SYMBOLS[unit]}`).join(' | '), true);

  const fill = Math.min(100, Math.max(4, ((celsius - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));
  const color = gaugeColor(celsius);

  return (
    <ConvertPage>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <Panel className="flex items-center justify-center gap-4 p-4 md:flex-col md:px-8">
          <div className="relative flex h-56 w-10 items-end justify-center" aria-hidden>
            <div className="absolute bottom-5 top-0 w-4 overflow-hidden rounded-t-full bg-slate-200 dark:bg-slate-700">
              <div className="absolute bottom-0 w-full transition-all duration-300" style={{ height: `${fill}%`, backgroundColor: color }} />
            </div>
            <div className="h-9 w-9 rounded-full transition-colors duration-300" style={{ backgroundColor: color }} />
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">{formatNumber(celsius, 2)}{SYMBOLS.C}</div>
            <div className="font-mono text-sm text-slate-500 dark:text-slate-400">{formatNumber(fromCelsius(celsius, 'F'), 2)}{SYMBOLS.F}</div>
          </div>
        </Panel>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TEMPERATURE_UNITS.map((unit) => {
              const text = editing?.unit === unit ? editing.text : formatNumber(fromCelsius(celsius, unit));
              const invalid = editing?.unit === unit && (belowZero || (editing.text.trim() !== '' && !NUMBER_PATTERN.test(editing.text.trim())));
              return (
                <Panel key={unit} className={`space-y-1 p-3 ${invalid ? 'ring-1 ring-rose-400/60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={LABEL_CLASS}>{tc(`temperature.unit_${unit}`)}</span>
                    <CopyButton text={formatNumber(fromCelsius(celsius, unit))} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      value={text}
                      inputMode="decimal"
                      onChange={(event) => edit(unit, event.target.value)}
                      onBlur={() => {
                        setEditing(null);
                        setBelowZero(false);
                      }}
                      aria-label={tc(`temperature.unit_${unit}`)}
                      className={`${INPUT_CLASS} ${MONO_CLASS} text-lg`}
                    />
                    <span className="w-8 shrink-0 font-mono text-sm text-slate-500 dark:text-slate-400">{SYMBOLS[unit]}</span>
                  </div>
                </Panel>
              );
            })}
          </div>
          {belowZero && <Notice>{tc('temperature.below_absolute_zero')}</Notice>}
          <Panel className="space-y-3 p-3">
            <RangeField
              value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.round(celsius * 2) / 2))}
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={0.5}
              onChange={setExact}
              leading={<span className="font-mono text-xs text-slate-500">{SLIDER_MIN}{SYMBOLS.C}</span>}
              trailing={<span className="font-mono text-xs text-slate-500">{SLIDER_MAX}{SYMBOLS.C}</span>}
            />
            <SkyChips
              value={REFERENCES.find((ref) => Math.abs(ref.celsius - celsius) < 0.005)?.id ?? ''}
              onChange={(id) => {
                const ref = REFERENCES.find((entry) => entry.id === id);
                if (ref) setExact(ref.celsius);
              }}
              options={REFERENCES.map((ref) => ({ value: ref.id, label: tc(`temperature.ref_${ref.id}`) }))}
            />
          </Panel>
        </div>
      </div>
    </ConvertPage>
  );
};

export default TemperatureWorkbench;
