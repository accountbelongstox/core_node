/** Small form fields of the video look editor (color, range, select, toggle, font). */
import React from 'react';
import type { OrchVideoFont } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import { ORCH_INPUT_CLASS } from './orchStyles';
import { orchFontOptions, type OrchVideoRange } from './orchVideoSettings';

const FIELD_LABEL_CLASS = 'block text-xs text-slate-400';
const COLOR_HEX_LENGTH = 7;

export const OrchColorField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className={FIELD_LABEL_CLASS}>
    {label}
    <span className="mt-1 flex items-center gap-2">
      <input
        type="color"
        value={value.slice(0, COLOR_HEX_LENGTH)}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
      />
      <span className="font-mono text-[11px] text-slate-500">{value.toUpperCase()}</span>
    </span>
  </label>
);

export const OrchRangeField: React.FC<{
  label: string;
  value: number;
  range: OrchVideoRange;
  onChange: (value: number) => void;
}> = ({ label, value, range, onChange }) => (
  <label className={FIELD_LABEL_CLASS}>
    {label}
    <span className="mt-1 flex items-center gap-2">
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1"
      />
      <input
        type="number"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(range.max, Math.max(range.min, next)));
        }}
        className="w-20 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
      />
    </span>
  </label>
);

export const OrchSelectField: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className={FIELD_LABEL_CLASS}>
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 ${ORCH_INPUT_CLASS}`}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

export const OrchToggleField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-xs text-slate-300 pt-5">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    {label}
  </label>
);

export const OrchFontField: React.FC<{
  label: string;
  value: string;
  fonts: OrchVideoFont[];
  cjk: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, fonts, cjk, onChange }) => (
  <label className={FIELD_LABEL_CLASS}>
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 ${ORCH_INPUT_CLASS}`}>
      {orchFontOptions(fonts, cjk, value).map((option) => (
        <option key={option.family} value={option.family} disabled={!option.available && option.family !== value}>
          {option.family}{option.available ? '' : ` (${ORCH_L.fontNotInstalled})`}
        </option>
      ))}
    </select>
  </label>
);

export const OrchFieldGroup: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ title, hint, children }) => (
  <fieldset className="rounded-lg border border-slate-700/60 p-3 space-y-2">
    <legend className="px-1 text-xs font-semibold text-slate-300">{title}</legend>
    {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </fieldset>
);
