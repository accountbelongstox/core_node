import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, RotateCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi, type CmEstimateOptions, type CmPublicEstimateResult } from '../api/CmPublicApi';
import { formatCmAmount, formatCmAmountRange } from '../components/public-home/cmPublicFormat';
import { CmPublicIllustration, CmPublicSection } from '../components/public-home/CmPublicBlocks';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../components/public-home/useCmProtectedNavigate';

interface CmEstimateDraft {
  complexity: string;
  budgetType: string;
  platforms: number;
  features: number;
}

const HOURLY_BUDGET_TYPE = 'hourly';
const ESTIMATE_HOW_STEPS = ['policy', 'range', 'proposal'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
}

function initialDraft(options: CmEstimateOptions): CmEstimateDraft {
  return {
    complexity: options.default_complexity,
    budgetType: options.default_budget_type,
    platforms: options.platforms.default,
    features: options.features.default,
  };
}

/**
 * Public project-estimate page. Options and limits come from Laravel, which
 * owns the rates and policy; the browser only renders the returned ranges.
 */
export const CmEstimatePage: React.FC = () => {
  const { t, i18n } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const [options, setOptions] = useState<CmEstimateOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [draft, setDraft] = useState<CmEstimateDraft | null>(null);
  const [result, setResult] = useState<CmPublicEstimateResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runEstimate = useCallback(async (next: CmEstimateDraft) => {
    setPending(true);
    setError(null);
    const response = await cmPublicApi.estimate({
      complexity: next.complexity,
      platforms: next.platforms,
      features: next.features,
      budget_type: next.budgetType || undefined,
    });
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setResult(null);
      setError(cmErrorMessage(t, response, 'estimate.failed'));
    }
    setPending(false);
  }, [t]);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    setOptionsError(null);
    void cmPublicApi.getEstimateOptions().then((response) => {
      if (!active) return;
      setOptionsLoading(false);
      if (!response.success || !response.data) {
        setOptionsError(cmErrorMessage(t, response, 'estimate.optionsFailed'));
        return;
      }
      const nextDraft = initialDraft(response.data);
      setOptions(response.data);
      setDraft(nextDraft);
      void runEstimate(nextDraft);
    });
    return () => {
      active = false;
    };
    // Options load once per explicit retry; translations must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsAttempt]);

  const updateDraft = (patch: Partial<CmEstimateDraft>): void => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const currency = result?.currency || options?.currency || null;
  const money = (value: string | number): string => formatCmAmount(value, currency, i18n.language);
  const teamRoles = result?.team_roles && result.team_roles.length > 0
    ? result.team_roles
    : (result?.recommended_team ?? []).map((role) => ({ role, count: 1 }));
  const isHourly = result?.budget_type === HOURLY_BUDGET_TYPE;

  return (
    <CmPublicPage
      titleKey="estimate.title"
      descriptionKey="estimate.lead"
      eyebrow={t('estimate.eyebrow')}
      lead={t('estimate.lead')}
      className="cm-estimate-page"
    >
      <CmPublicSection>
        <div className="cm-estimate-layout">
          <div className="cm-estimate-main">
            {optionsLoading && <p className="cm-public-form__notice" role="status">{t('common.loading')}</p>}
            {optionsError && (
              <div className="cm-public-form__notice is-error" role="alert">
                <span>{optionsError}</span>
                <button type="button" className="cm-public-form__link" onClick={() => setOptionsAttempt((current) => current + 1)}>
                  <RotateCw aria-hidden="true" /> {t('estimate.retry')}
                </button>
              </div>
            )}

            {options && draft && (
              <form
                className="cm-estimate-form cm-estimate-form--options"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runEstimate(draft);
                }}
              >
                <label>
                  <span>{t('estimate.complexity')}</span>
                  <select value={draft.complexity} onChange={(event) => updateDraft({ complexity: event.target.value })}>
                    {options.complexities.map((value) => (
                      <option key={value} value={value}>{t(`estimate.complexities.${value}`, { defaultValue: value })}</option>
                    ))}
                  </select>
                </label>
                {options.budget_types.length > 0 && (
                  <label>
                    <span>{t('estimate.budgetType')}</span>
                    <select value={draft.budgetType} onChange={(event) => updateDraft({ budgetType: event.target.value })}>
                      {options.budget_types.map((value) => (
                        <option key={value} value={value}>{t(`estimate.budgetTypes.${value}`, { defaultValue: value })}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  <span>{t('estimate.platforms')}</span>
                  <input
                    type="number"
                    min={options.platforms.min}
                    max={options.platforms.max}
                    value={draft.platforms}
                    onChange={(event) => updateDraft({ platforms: clamp(Number(event.target.value), options.platforms.min, options.platforms.max) })}
                  />
                  <small>{t('estimate.range', { min: options.platforms.min, max: options.platforms.max })}</small>
                </label>
                <label>
                  <span>{t('estimate.features')}</span>
                  <input
                    type="number"
                    min={options.features.min}
                    max={options.features.max}
                    value={draft.features}
                    onChange={(event) => updateDraft({ features: clamp(Number(event.target.value), options.features.min, options.features.max) })}
                  />
                  <small>{t('estimate.range', { min: options.features.min, max: options.features.max })}</small>
                </label>
                <button type="submit" className="cm-estimate-submit" disabled={pending}>
                  <Calculator aria-hidden="true" />
                  {pending ? t('common.loading') : t('estimate.calculate')}
                </button>
              </form>
            )}

            {error && (
              <div className="cm-public-form__notice is-error" role="alert">
                <span>{error}</span>
                {draft && (
                  <button type="button" className="cm-public-form__link" onClick={() => void runEstimate(draft)}>
                    <RotateCw aria-hidden="true" /> {t('estimate.retry')}
                  </button>
                )}
              </div>
            )}
            {options && !result && !error && !pending && <p className="cm-public-page__status">{t('estimate.empty')}</p>}

            {result && !error && (
              <section className="cm-estimate-result" aria-live="polite">
                <div className="cm-estimate-result__row">
                  <span>{t('estimate.costRange')}</span>
                  <strong>{formatCmAmountRange(result.estimated_cost_min, result.estimated_cost_max, currency, i18n.language)}</strong>
                </div>
                {isHourly && result.hourly_rate_min && result.hourly_rate_max && (
                  <div className="cm-estimate-result__row">
                    <span>{t('estimate.hourlyRange')}</span>
                    <strong>{t('estimate.perHour', { range: `${money(result.hourly_rate_min)} – ${money(result.hourly_rate_max)}` })}</strong>
                  </div>
                )}
                <div className="cm-estimate-result__row">
                  <span>{t('estimate.durationRange')}</span>
                  <strong>{t('estimate.weeks', { min: result.estimated_duration_weeks_min, max: result.estimated_duration_weeks_max })}</strong>
                </div>
                <div className="cm-estimate-result__row">
                  <span>{t('estimate.effortRange')}</span>
                  <strong>{t('estimate.hours', { min: result.estimated_hours_min, max: result.estimated_hours_max })}</strong>
                </div>
                <div className="cm-estimate-result__row">
                  <span>{t('estimate.team')}</span>
                  <strong>
                    {teamRoles.map((entry) => t('estimate.teamRole', {
                      role: t(`estimate.roles.${entry.role}`, { defaultValue: entry.role }),
                      number: entry.count,
                    })).join(t('estimate.teamSeparator'))}
                  </strong>
                </div>
                {Number.isFinite(result.platform_commission_rate) && (
                  <div className="cm-estimate-result__row">
                    <span>{t('estimate.commission')}</span>
                    <strong>{new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 2 }).format(result.platform_commission_rate)}</strong>
                  </div>
                )}
                <p className="cm-estimate-result__note">{t('estimate.commissionNote')}</p>
                <p className="cm-estimate-result__note">{t('estimate.note')}</p>
                <button
                  type="button"
                  className="cm-estimate-result__cta"
                  onClick={() => openProtected(CM_PROTECTED_ROUTE.projectCreate, 'project-create')}
                >
                  {t('estimate.startProject')}
                </button>
              </section>
            )}
          </div>
          <aside className="cm-estimate-aside">
            <CmPublicIllustration name="estimate-calculator" altKey="estimate.imageAlt" eager />
            <h2>{t('estimate.how.title')}</h2>
            <ol>
              {ESTIMATE_HOW_STEPS.map((step) => (
                <li key={step}>
                  <strong>{t(`estimate.how.${step}.title`)}</strong>
                  <span>{t(`estimate.how.${step}.body`)}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </CmPublicSection>
      <CmPublicCta titleKey="estimate.cta.title" bodyKey="estimate.cta.body" />
    </CmPublicPage>
  );
};

export default CmEstimatePage;
