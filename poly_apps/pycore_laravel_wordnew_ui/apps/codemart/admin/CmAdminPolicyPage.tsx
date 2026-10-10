import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, Undo2 } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { cmAdminApi } from './CmAdminApi';
import { CmPolicyField, cmPolicyCurrenciesValid, cmPolicyList } from './CmAdminPolicyFields';
import type { CmAdminPolicy } from './CmAdminTypes';

const SUPPORTED_CURRENCIES_KEY = 'supported_currencies';
const HTTP_VALIDATION_STATUS = 422;

type CmPolicyDraft = Record<string, unknown>;
type CmPolicyErrors = Record<string, string[]>;

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Server validation messages keyed by the policy setting they belong to (`reviewer_exam.0.code` -> `reviewer_exam`). */
function fieldErrorsOf(details: unknown): CmPolicyErrors {
  const result: CmPolicyErrors = {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) return result;
  Object.entries(details as Record<string, unknown>).forEach(([path, messages]) => {
    const key = path.replace(/^settings\./, '').split('.')[0];
    const list = Array.isArray(messages) ? messages.map(String) : [String(messages)];
    result[key] = [...(result[key] ?? []), ...list];
  });
  return result;
}

/**
 * Administrator editor for every operator-controlled platform rule. Values
 * left alone keep the platform default; a reset sends null so the server
 * drops the stored override.
 */
export const CmAdminPolicyPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const notice = useCmNotice();
  const [policy, setPolicy] = useState<CmAdminPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CmPolicyDraft>({});
  const [errors, setErrors] = useState<CmPolicyErrors>({});
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    const response = await cmAdminApi.policy();
    if (response.success && response.data) {
      setPolicy(response.data);
      setLoadError(null);
      setGroup((current) => current || response.data?.groups[0] || '');
    } else {
      setLoadError(cmErrorMessage(t, response, 'admin.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const effective = useCallback((key: string): unknown => {
    if (!policy) return undefined;
    if (key in draft) return draft[key] === null ? policy.defaults[key] : draft[key];
    return policy.settings[key];
  }, [draft, policy]);

  const setField = (key: string, value: unknown): void => {
    if (!policy) return;
    setErrors((current) => ({ ...current, [key]: [] }));
    setDraft((current) => {
      const next = { ...current };
      if (sameValue(value, policy.settings[key])) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const resetField = (key: string): void => {
    if (!policy) return;
    setErrors((current) => ({ ...current, [key]: [] }));
    setDraft((current) => {
      const next = { ...current };
      if (policy.overridden.includes(key)) next[key] = null;
      else if (sameValue(policy.settings[key], policy.defaults[key])) delete next[key];
      else next[key] = null;
      return next;
    });
  };

  const dirtyKeys = Object.keys(draft);
  const supportedCurrencies = useMemo(() => {
    const value = policy ? effective(SUPPORTED_CURRENCIES_KEY) : [];
    return cmPolicyList(value).map(String);
  }, [effective, policy]);
  const localInvalid = 'supported_currencies' in draft && draft[SUPPORTED_CURRENCIES_KEY] !== null && !cmPolicyCurrenciesValid(draft[SUPPORTED_CURRENCIES_KEY]);

  const save = async (): Promise<void> => {
    if (busy || dirtyKeys.length === 0 || localInvalid) return;
    setBusy(true);
    notice.clear();
    const response = await cmAdminApi.updatePolicy(draft);
    setBusy(false);
    if (response.success && response.data) {
      setPolicy(response.data);
      setDraft({});
      setErrors({});
      notice.success(t('admin.policyEditor.saved'));
      await refresh();
    } else {
      if (response.status === HTTP_VALIDATION_STATUS) setErrors(fieldErrorsOf(response.debugInfo?.data));
      notice.error(cmErrorMessage(t, response, 'admin.policyEditor.saveFailed'));
    }
  };

  const discard = (): void => {
    setDraft({});
    setErrors({});
    notice.clear();
  };

  const groupKeys = (name: string): string[] => (
    policy ? Object.entries(policy.schema).filter(([, entry]) => entry.group === name).map(([key]) => key) : []
  );
  const groupDirty = (name: string): number => groupKeys(name).filter((key) => key in draft).length;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        variant="admin"
        titleKey="admin.nav.policy"
        purposeKey="admin.purpose.policy"
        onRefresh={() => { setLoading(true); setDraft({}); void load(); }}
      />
      {loading ? (
        <CmLoadingState />
      ) : loadError || !policy ? (
        <CmErrorState message={loadError ?? t('admin.loadFailed')} onRetry={() => { setLoading(true); void load(); }} />
      ) : (
        <>
          <CmNotice notice={notice.notice} onDismiss={notice.clear} />
          <nav className="cm-tabs cm-policy-tabs" role="tablist" aria-label={t('admin.policyEditor.groupsLabel')}>
            {policy.groups.map((name) => (
              <button key={name} type="button" role="tab" aria-selected={group === name} className={group === name ? 'is-active' : ''} onClick={() => setGroup(name)}>
                {t(`admin.policyEditor.groups.${name}.title`)}
                {groupDirty(name) > 0 && <span className="cm-policy-dirty-dot" aria-label={t('admin.policyEditor.unsaved')} />}
              </button>
            ))}
          </nav>
          <section className="cm-section-card cm-policy-panel" role="tabpanel">
            <p className="cm-section-card__lead">{t(`admin.policyEditor.groups.${group}.lead`)}</p>
            <div className="cm-policy-list">
              {groupKeys(group).map((key) => {
                const entry = policy.schema[key];
                const customized = key in draft ? draft[key] !== null : policy.overridden.includes(key);
                const canReset = key in draft ? draft[key] !== null || policy.overridden.includes(key) : policy.overridden.includes(key);
                const fieldErrors = errors[key] ?? [];
                return (
                  <article key={key} className="cm-policy-item" data-invalid={fieldErrors.length > 0 || undefined}>
                    <div className="cm-policy-item__head">
                      <div>
                        <label className="cm-policy-item__label" htmlFor={`cm-policy-${key}`}>{t(`admin.policyEditor.fields.${key}.label`)}</label>
                        <p className="cm-field-hint">{t(`admin.policyEditor.fields.${key}.hint`)}</p>
                      </div>
                      <div className="cm-policy-item__state">
                        <span className="cm-status" data-status={customized ? 'in_progress' : 'completed'}>
                          {customized ? t('admin.policyEditor.customized') : t('admin.policyEditor.default')}
                        </span>
                        <button type="button" className="cm-workspace-button is-small" disabled={!canReset} onClick={() => resetField(key)}>
                          <RotateCcw aria-hidden="true" /> {t('admin.policyEditor.reset')}
                        </button>
                      </div>
                    </div>
                    <div className="cm-policy-item__control">
                      <CmPolicyField name={key} schema={entry} value={effective(key)} supportedCurrencies={supportedCurrencies} onChange={(value) => setField(key, value)} />
                    </div>
                    {fieldErrors.map((message, index) => <small key={index} className="cm-field-error">{message}</small>)}
                    {key === SUPPORTED_CURRENCIES_KEY && localInvalid && <small className="cm-field-error">{t('admin.policyEditor.currencyFormat')}</small>}
                  </article>
                );
              })}
            </div>
          </section>
          <div className="cm-policy-savebar" data-dirty={dirtyKeys.length > 0 || undefined}>
            <span>{dirtyKeys.length > 0 ? t('admin.policyEditor.pending', { count: dirtyKeys.length }) : t('admin.policyEditor.noChanges')}</span>
            <div className="cm-table-actions">
              <button type="button" className="cm-workspace-button" disabled={busy || dirtyKeys.length === 0} onClick={discard}>
                <Undo2 aria-hidden="true" /> {t('admin.policyEditor.discard')}
              </button>
              <button type="button" className="cm-workspace-button is-primary" disabled={busy || dirtyKeys.length === 0 || localInvalid} onClick={() => void save()}>
                <Save aria-hidden="true" /> {busy ? t('common.saving') : t('admin.policyEditor.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default CmAdminPolicyPage;
