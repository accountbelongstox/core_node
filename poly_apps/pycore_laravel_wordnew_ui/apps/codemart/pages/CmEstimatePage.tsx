import React from 'react';
import { Calculator, RotateCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmPublicIllustration, CmPublicSection } from '../components/public-home/CmPublicBlocks';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../components/public-home/useCmProtectedNavigate';
import { CM_ESTIMATE_COUNT_FIELDS, useCmEstimate } from '../shared/useCmEstimate';
import { CM_WHOLE_MONEY_DIGITS, cmFormatMoneyRange, cmFormatPercent } from '../components/workspace/cmWorkspaceFormat';

const ESTIMATE_HOW_STEPS = ['policy', 'range', 'proposal'];

/**
 * Public project-estimate page. Options and limits come from Laravel, which
 * owns the rates and policy; the browser only renders the returned ranges.
 */
export const CmEstimatePage: React.FC = () => {
  const { t, i18n } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const estimate = useCmEstimate();
  const { options, optionsLoading, optionsError, draft, result, pending, error, currency, isHourly, teamRoles, updateDraft, commitCount } = estimate;
  const moneyRange = (min: string | number, max: string | number): string => cmFormatMoneyRange(min, max, currency, i18n.language, CM_WHOLE_MONEY_DIGITS);

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
                <button type="button" className="cm-public-form__link" onClick={() => estimate.retryOptions()}>
                  <RotateCw aria-hidden="true" /> {t('estimate.retry')}
                </button>
              </div>
            )}

            {options && draft && (
              <form
                className="cm-estimate-form cm-estimate-form--options"
                onSubmit={(event) => {
                  event.preventDefault();
                  estimate.submit();
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
                {CM_ESTIMATE_COUNT_FIELDS.map((field) => (
                  <label key={field}>
                    <span>{t(`estimate.${field}`)}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={options[field].min}
                      max={options[field].max}
                      value={draft[field]}
                      onChange={(event) => updateDraft({ [field]: event.target.value })}
                      onBlur={() => commitCount(field)}
                    />
                    <small>{t('estimate.range', { min: options[field].min, max: options[field].max })}</small>
                  </label>
                ))}
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
                  <button type="button" className="cm-public-form__link" onClick={estimate.submit}>
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
                  <strong>{moneyRange(result.estimated_cost_min, result.estimated_cost_max)}</strong>
                </div>
                {isHourly && result.hourly_rate_min && result.hourly_rate_max && (
                  <div className="cm-estimate-result__row">
                    <span>{t('estimate.hourlyRange')}</span>
                    <strong>{t('estimate.perHour', { range: moneyRange(result.hourly_rate_min, result.hourly_rate_max) })}</strong>
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
                {currency && (
                  <div className="cm-estimate-result__row">
                    <span>{t('estimate.currencyLabel')}</span>
                    <strong>{t(`estimate.currencyNames.${currency}`, { defaultValue: currency })}</strong>
                  </div>
                )}
                {Number.isFinite(result.platform_commission_rate) && (
                  <div className="cm-estimate-result__row">
                    <span>{t('estimate.commission')}</span>
                    <strong>{cmFormatPercent(result.platform_commission_rate, i18n.language)}</strong>
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
            <CmPublicIllustration name="estimate-calculator" />
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
