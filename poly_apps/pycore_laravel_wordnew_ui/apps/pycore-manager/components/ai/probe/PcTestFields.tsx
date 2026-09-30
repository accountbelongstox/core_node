/**
 * PcTestFields — renders a hub `test_schema` as a form. The schema is the only
 * source of fields, defaults, options and visibility; labels localize through the
 * field's `label_key` with the server label as the English fallback.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AiHubFieldOption, AiHubTestField, AiHubTestSchema } from '@/apps/pycore-manager/api';

export type PcTestValue = string | boolean;
export type PcTestValues = Record<string, PcTestValue>;

const TEXTAREA_ROWS = 3;
const FIELD_NUMBER = 'number';
const FIELD_BOOLEAN = 'boolean';
const FIELD_SELECT = 'select';
const FIELD_TEXTAREA = 'textarea';

export const PC_TEST_INPUT_CLASS = 'w-full rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50';

/** Initial form values from the schema defaults. */
export function pcTestInitialValues(schema?: AiHubTestSchema | null): PcTestValues {
  const values: PcTestValues = {};
  for (const field of schema?.fields ?? []) {
    if (field.type === FIELD_BOOLEAN) values[field.key] = !!field.default;
    else values[field.key] = field.default == null ? '' : String(field.default);
  }
  return values;
}

export function pcTestFieldVisible(field: AiHubTestField, values: PcTestValues): boolean {
  const condition = field.visible_when;
  if (!condition) return true;
  return Object.entries(condition).every(([key, expected]) => values[key] === expected);
}

/** Request params of the visible fields: numbers coerced, blanks left for the API layer to drop. */
export function pcTestParams(schema: AiHubTestSchema | null | undefined, values: PcTestValues): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const field of schema?.fields ?? []) {
    if (!pcTestFieldVisible(field, values)) continue;
    const value = values[field.key];
    if (field.type === FIELD_NUMBER) params[field.key] = value === '' || value === undefined ? undefined : Number(value);
    else params[field.key] = value;
  }
  return params;
}

const FieldShell: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

export const PcTestFields: React.FC<{
  schema?: AiHubTestSchema | null;
  values: PcTestValues;
  onChange: (key: string, value: PcTestValue) => void;
  skipKeys?: string[];
}> = ({ schema, values, onChange, skipKeys }) => {
  const { t } = useTranslation('pc');
  const fieldLabel = (field: AiHubTestField) => t(field.label_key || `aiHub.field.${field.key}`, { defaultValue: field.label });
  const optionLabel = (option: AiHubFieldOption) => (option.label_key
    ? t(option.label_key, { defaultValue: option.label ?? option.value })
    : (option.label ?? option.value));

  return (
    <div className="space-y-3">
      {(schema?.fields ?? []).filter((field) => !skipKeys?.includes(field.key) && pcTestFieldVisible(field, values)).map((field) => {
        const label = fieldLabel(field);
        const value = values[field.key];
        if (field.type === FIELD_BOOLEAN) {
          return (
            <label key={field.key} className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={!!value} onChange={(e) => onChange(field.key, e.target.checked)} className="rounded border-slate-300" />
              {label}
            </label>
          );
        }
        if (field.type === FIELD_TEXTAREA) {
          return (
            <FieldShell key={field.key} label={label} hint={field.hint}>
              <textarea
                value={String(value ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
                rows={TEXTAREA_ROWS}
                maxLength={field.max_chars}
                placeholder={field.placeholder}
                className={PC_TEST_INPUT_CLASS}
              />
            </FieldShell>
          );
        }
        if (field.type === FIELD_SELECT && field.options) {
          return (
            <FieldShell key={field.key} label={label} hint={field.hint}>
              <select value={String(value ?? '')} onChange={(e) => onChange(field.key, e.target.value)} className={PC_TEST_INPUT_CLASS}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{optionLabel(option)}</option>
                ))}
              </select>
            </FieldShell>
          );
        }
        return (
          <FieldShell key={field.key} label={label} hint={field.hint}>
            <input
              type={field.type === FIELD_NUMBER ? 'number' : 'text'}
              value={String(value ?? '')}
              onChange={(e) => onChange(field.key, e.target.value)}
              min={field.min}
              max={field.max}
              step={field.step}
              placeholder={field.placeholder}
              className={PC_TEST_INPUT_CLASS}
            />
          </FieldShell>
        );
      })}
    </div>
  );
};
