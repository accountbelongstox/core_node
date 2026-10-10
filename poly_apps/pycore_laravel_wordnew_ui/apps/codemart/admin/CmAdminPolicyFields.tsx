import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmAdminAppDownload, CmAdminExamQuestion, CmAdminPolicySchemaEntry } from './CmAdminTypes';

export const CM_POLICY_RATING_KEYS = ['quality', 'readability', 'efficiency'] as const;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const RATING_MIN = 1;
const RATING_MAX = 5;
const DEFAULT_RATING = 3;
const TEAM_ROLE_MAX_COUNT = 20;
const RANGE_LABEL_KEYS = ['min', 'max', 'default'] as const;
const MAX_DOWNLOAD_ROWS = 20;
const MAX_EXAM_QUESTIONS = 20;

export type CmPolicyValue = unknown;

export interface CmPolicyFieldProps {
  name: string;
  schema: CmAdminPolicySchemaEntry;
  value: CmPolicyValue;
  supportedCurrencies: string[];
  onChange: (value: CmPolicyValue) => void;
}

export function cmPolicyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function cmPolicyList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOf(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Number input that keeps the typed text and commits only valid numbers. */
const CmPolicyNumberInput: React.FC<{
  id: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  onCommit: (value: number) => void;
}> = ({ id, value, min, max, step, ariaLabel, onCommit }) => {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      aria-label={ariaLabel}
      onChange={(event) => {
        setText(event.target.value);
        if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onCommit(Number(event.target.value));
      }}
    />
  );
};

const CmPolicyRange: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const parts = cmPolicyList(value).map(numberOf);
  return (
    <div className="cm-policy-inline">
      {RANGE_LABEL_KEYS.map((labelKey, index) => (
        <label key={labelKey} className="cm-stacked-field">
          <span>{t(`admin.policyEditor.range.${labelKey}`)}</span>
          <CmPolicyNumberInput
            id={`cm-policy-${name}-${labelKey}`}
            value={parts[index] ?? 0}
            min={schema.min}
            max={schema.max}
            step={1}
            onCommit={(next) => {
              const copy = [0, 1, 2].map((position) => parts[position] ?? 0);
              copy[index] = next;
              onChange(copy);
            }}
          />
        </label>
      ))}
    </div>
  );
};

const CmPolicyOptions: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const selected = cmPolicyList(value).map(String);
  const options = schema.options ?? [];
  return (
    <div className="cm-policy-checks" role="group" aria-label={t(`admin.policyEditor.fields.${name}.label`)}>
      {options.map((option) => (
        <label key={option} className="cm-policy-check">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
          />
          <span>{t(`admin.policyEditor.options.${name}.${option}`, { defaultValue: t(`wallet.methods.${option}`, { defaultValue: option }) })}</span>
        </label>
      ))}
    </div>
  );
};

const CmPolicyCurrencyList: React.FC<CmPolicyFieldProps> = ({ name, value, onChange }) => {
  const { t } = useTranslation('cm');
  const codes = cmPolicyList(value).map(String);
  const [text, setText] = useState(codes.join(', '));

  useEffect(() => {
    setText((current) => {
      const parsed = current.split(/[\s,]+/).filter(Boolean).map((code) => code.toUpperCase());
      return parsed.join(',') === codes.join(',') ? current : codes.join(', ');
    });
  }, [codes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      id={`cm-policy-${name}`}
      type="text"
      value={text}
      aria-label={t(`admin.policyEditor.fields.${name}.label`)}
      placeholder="CNY, USD, EUR"
      onChange={(event) => {
        setText(event.target.value);
        const parsed = event.target.value.split(/[\s,]+/).filter(Boolean).map((code) => code.toUpperCase());
        onChange(Array.from(new Set(parsed)));
      }}
    />
  );
};

export function cmPolicyCurrenciesValid(value: unknown): boolean {
  const codes = cmPolicyList(value).map(String);
  return codes.length > 0 && codes.every((code) => CURRENCY_PATTERN.test(code));
}

const CmPolicyCurrencySelect: React.FC<CmPolicyFieldProps> = ({ name, value, supportedCurrencies, onChange }) => {
  const { t } = useTranslation('cm');
  const current = String(value ?? '');
  const options = supportedCurrencies.includes(current) || current === '' ? supportedCurrencies : [current, ...supportedCurrencies];
  return (
    <select id={`cm-policy-${name}`} value={current} aria-label={t(`admin.policyEditor.fields.${name}.label`)} onChange={(event) => onChange(event.target.value)}>
      {options.map((code) => <option key={code} value={code}>{code}</option>)}
    </select>
  );
};

const CmPolicyTierMap: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const record = cmPolicyRecord(value);
  return (
    <div className="cm-policy-inline">
      {(schema.keys ?? []).map((key) => (
        <label key={key} className="cm-stacked-field">
          <span>{t(`estimate.complexities.${key}`, { defaultValue: t(`admin.policyEditor.keys.${key}`, { defaultValue: key }) })}</span>
          <CmPolicyNumberInput
            id={`cm-policy-${name}-${key}`}
            value={numberOf(record[key])}
            min={schema.min}
            max={schema.max}
            step={1}
            onCommit={(next) => onChange({ ...record, [key]: next })}
          />
        </label>
      ))}
    </div>
  );
};

const CmPolicyTextMap: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const record = cmPolicyRecord(value);
  return (
    <div className="cm-policy-inline">
      {(schema.keys ?? []).map((key) => (
        <label key={key} className="cm-stacked-field">
          <span>{t(`admin.policyEditor.keys.${key}`, { defaultValue: key })}</span>
          <input
            id={`cm-policy-${name}-${key}`}
            type="text"
            value={String(record[key] ?? '')}
            onChange={(event) => onChange({ ...record, [key]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
};

const CmPolicyTeam: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const record = cmPolicyRecord(value);
  const roles = schema.options ?? [];

  const countOf = (tier: string, role: string): number => cmPolicyList(record[tier]).filter((item) => item === role).length;
  const setCount = (tier: string, role: string, count: number): void => {
    const list = cmPolicyList(record[tier]).map(String);
    const rebuilt = roles.flatMap((candidate) => {
      const amount = candidate === role ? count : list.filter((item) => item === candidate).length;
      return Array.from({ length: amount }, () => candidate);
    });
    onChange({ ...record, [tier]: rebuilt });
  };

  return (
    <div className="cm-policy-team">
      {(schema.keys ?? []).map((tier) => (
        <fieldset key={tier} className="cm-policy-team__tier">
          <legend>{t(`estimate.complexities.${tier}`, { defaultValue: t(`admin.policyEditor.keys.${tier}`, { defaultValue: tier }) })}</legend>
          <div className="cm-policy-inline">
            {roles.map((role) => (
              <label key={role} className="cm-stacked-field">
                <span>{t(`roles.${role}`, { defaultValue: role })}</span>
                <CmPolicyNumberInput
                  id={`cm-policy-${name}-${tier}-${role}`}
                  value={countOf(tier, role)}
                  min={0}
                  max={TEAM_ROLE_MAX_COUNT}
                  step={1}
                  onCommit={(next) => setCount(tier, role, Math.max(0, Math.min(TEAM_ROLE_MAX_COUNT, Math.floor(next))))}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
};

const CmPolicyDownloads: React.FC<CmPolicyFieldProps> = ({ name, schema, value, onChange }) => {
  const { t } = useTranslation('cm');
  const rows = cmPolicyList(value).map((item) => {
    const row = cmPolicyRecord(item);
    return { platform: String(row.platform ?? ''), version: String(row.version ?? ''), url: String(row.url ?? ''), min_os: String(row.min_os ?? '') } as CmAdminAppDownload;
  });
  const platforms = schema.platforms ?? [];
  const update = (index: number, patch: Partial<CmAdminAppDownload>): void => {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="cm-policy-rows">
      {rows.length === 0 && <p className="cm-field-hint">{t('admin.policyEditor.downloads.empty')}</p>}
      {rows.map((row, index) => (
        <div key={index} className="cm-policy-row">
          <label className="cm-stacked-field">
            <span>{t('admin.policyEditor.downloads.platform')}</span>
            <select id={`cm-policy-${name}-${index}-platform`} value={row.platform} onChange={(event) => update(index, { platform: event.target.value })}>
              {platforms.map((platform) => <option key={platform} value={platform}>{t(`downloadPage.platforms.${platform}`, { defaultValue: platform })}</option>)}
            </select>
          </label>
          <label className="cm-stacked-field">
            <span>{t('admin.policyEditor.downloads.version')}</span>
            <input id={`cm-policy-${name}-${index}-version`} type="text" value={row.version} onChange={(event) => update(index, { version: event.target.value })} />
          </label>
          <label className="cm-stacked-field cm-policy-row__wide">
            <span>{t('admin.policyEditor.downloads.url')}</span>
            <input id={`cm-policy-${name}-${index}-url`} type="text" value={row.url} placeholder="https://" onChange={(event) => update(index, { url: event.target.value })} />
          </label>
          <label className="cm-stacked-field">
            <span>{t('admin.policyEditor.downloads.minOs')}</span>
            <input id={`cm-policy-${name}-${index}-minos`} type="text" value={row.min_os} placeholder={t('admin.policyEditor.downloads.minOsDefault')} onChange={(event) => update(index, { min_os: event.target.value })} />
          </label>
          <button type="button" className="cm-workspace-button is-small" aria-label={t('admin.policyEditor.removeRow')} onClick={() => onChange(rows.filter((_, position) => position !== index))}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="cm-table-actions">
        <button
          type="button"
          className="cm-workspace-button"
          disabled={rows.length >= MAX_DOWNLOAD_ROWS}
          onClick={() => onChange([...rows, { platform: platforms[0] ?? '', version: '', url: '', min_os: '' }])}
        >
          <Plus aria-hidden="true" /> {t('admin.policyEditor.downloads.add')}
        </button>
      </div>
    </div>
  );
};

const CmPolicyExam: React.FC<CmPolicyFieldProps> = ({ name, value, onChange }) => {
  const { t } = useTranslation('cm');
  const questions = cmPolicyList(value).map((item) => {
    const row = cmPolicyRecord(item);
    const ratings = cmPolicyRecord(row.expected_ratings);
    return {
      code_snippet_id: numberOf(row.code_snippet_id),
      code: String(row.code ?? ''),
      expected_ratings: {
        quality: numberOf(ratings.quality) || DEFAULT_RATING,
        readability: numberOf(ratings.readability) || DEFAULT_RATING,
        efficiency: numberOf(ratings.efficiency) || DEFAULT_RATING,
      },
    } as CmAdminExamQuestion;
  });
  const update = (index: number, patch: Partial<CmAdminExamQuestion>): void => {
    onChange(questions.map((question, position) => (position === index ? { ...question, ...patch } : question)));
  };
  const nextId = questions.reduce((highest, question) => Math.max(highest, question.code_snippet_id), 0) + 1;

  return (
    <div className="cm-policy-rows">
      {questions.map((question, index) => (
        <fieldset key={question.code_snippet_id || index} className="cm-policy-exam">
          <legend>{t('admin.policyEditor.exam.question', { number: index + 1 })}</legend>
          <label className="cm-stacked-field">
            <span>{t('admin.policyEditor.exam.code')}</span>
            <textarea id={`cm-policy-${name}-${index}-code`} rows={5} value={question.code} spellCheck={false} onChange={(event) => update(index, { code: event.target.value })} />
          </label>
          <div className="cm-policy-inline">
            {CM_POLICY_RATING_KEYS.map((dimension) => (
              <label key={dimension} className="cm-stacked-field">
                <span>{t(`reviews.${dimension}`, { defaultValue: dimension })}</span>
                <select
                  value={question.expected_ratings[dimension]}
                  onChange={(event) => update(index, { expected_ratings: { ...question.expected_ratings, [dimension]: Number(event.target.value) } })}
                >
                  {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, offset) => RATING_MIN + offset).map((rating) => (
                    <option key={rating} value={rating}>{rating}</option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              className="cm-workspace-button is-small"
              disabled={questions.length <= 1}
              aria-label={t('admin.policyEditor.removeRow')}
              onClick={() => onChange(questions.filter((_, position) => position !== index))}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        </fieldset>
      ))}
      <div className="cm-table-actions">
        <button
          type="button"
          className="cm-workspace-button"
          disabled={questions.length >= MAX_EXAM_QUESTIONS}
          onClick={() => onChange([...questions, { code_snippet_id: nextId, code: '', expected_ratings: { quality: DEFAULT_RATING, readability: DEFAULT_RATING, efficiency: DEFAULT_RATING } }])}
        >
          <Plus aria-hidden="true" /> {t('admin.policyEditor.exam.add')}
        </button>
      </div>
    </div>
  );
};

const CURRENCY_SELECT_KEYS = ['default_currency', 'ai_estimate_currency'];
const CURRENCY_LIST_KEYS = ['supported_currencies'];
const TEAM_KEYS = ['estimate_team'];
const TEXT_MAP_KEYS = ['app_default_min_os'];

/** One editable policy value, rendered from the server schema entry. */
export const CmPolicyField: React.FC<CmPolicyFieldProps> = (props) => {
  const { name, schema, value, onChange } = props;
  switch (schema.type) {
    case 'int':
    case 'float':
      return (
        <CmPolicyNumberInput
          id={`cm-policy-${name}`}
          value={numberOf(value)}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          ariaLabel={undefined}
          onCommit={(next) => onChange(schema.type === 'int' ? Math.round(next) : next)}
        />
      );
    case 'string':
      return CURRENCY_SELECT_KEYS.includes(name) ? <CmPolicyCurrencySelect {...props} /> : (
        <input id={`cm-policy-${name}`} type="text" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      );
    case 'list':
      if (CURRENCY_LIST_KEYS.includes(name)) return <CmPolicyCurrencyList {...props} />;
      if (schema.options) return <CmPolicyOptions {...props} />;
      return <CmPolicyRange {...props} />;
    case 'map':
      if (TEAM_KEYS.includes(name)) return <CmPolicyTeam {...props} />;
      return TEXT_MAP_KEYS.includes(name) ? <CmPolicyTextMap {...props} /> : <CmPolicyTierMap {...props} />;
    case 'exam':
      return <CmPolicyExam {...props} />;
    case 'downloads':
      return <CmPolicyDownloads {...props} />;
    default:
      return null;
  }
};
