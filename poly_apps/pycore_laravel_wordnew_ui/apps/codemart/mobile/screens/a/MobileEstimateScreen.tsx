import React from 'react';
import { Calculator, RotateCw } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../../../components/public-home/useCmProtectedNavigate';
import { CM_WHOLE_MONEY_DIGITS, cmFormatMoneyRange, cmFormatPercent } from '../../../components/workspace/cmWorkspaceFormat';
import { CM_ESTIMATE_COUNT_FIELDS, useCmEstimate } from '../../../shared/useCmEstimate';
import { MobileButton, MobileCard, MobileField, MobileNotice, MobileScreen, MobileSkeletonBlock } from '../../ui';
import { MobilePageHead } from './MobilePublicParts';

const ResultRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="cmm-a-result__row"><span>{label}</span><strong>{value}</strong></div>
);

/** Mobile public estimate: the server-owned pricing policy returns ranges for the chosen complexity, platforms and features. */
const MobileEstimateScreen: React.FC = () => {
  const { t, i18n } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const estimate = useCmEstimate();
  const { options, optionsLoading, optionsError, draft, result, pending, error, currency, isHourly, teamRoles, updateDraft, commitCount } = estimate;
  const moneyRange = (min: string | number, max: string | number): string => cmFormatMoneyRange(min, max, currency, i18n.language, CM_WHOLE_MONEY_DIGITS);

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    estimate.submit();
  };

  return (
    <MobileScreen onRefresh={estimate.retryOptions}>
      <MobilePageHead
        titleKey="estimate.title"
        leadKey="estimate.lead"
        title={t('estimate.title')}
        lead={t('estimate.lead')}
        icon={<Calculator aria-hidden="true" />}
      />
      {optionsLoading && <MobileSkeletonBlock height={220} />}
      {optionsError && (
        <MobileNotice tone="error" action={<button type="button" className="cmm-link-btn" onClick={estimate.retryOptions}><RotateCw aria-hidden="true" />{t('estimate.retry')}</button>}>
          {optionsError}
        </MobileNotice>
      )}
      {options && draft && (
        <MobileCard>
          <form className="cmm-a-form" onSubmit={submit}>
            <MobileField label={t('estimate.complexity')}>
              <select className="cmm-input" value={draft.complexity} onChange={(event) => updateDraft({ complexity: event.target.value })}>
                {options.complexities.map((value) => <option key={value} value={value}>{t(`estimate.complexities.${value}`, { defaultValue: value })}</option>)}
              </select>
            </MobileField>
            {options.budget_types.length > 0 && (
              <MobileField label={t('estimate.budgetType')}>
                <select className="cmm-input" value={draft.budgetType} onChange={(event) => updateDraft({ budgetType: event.target.value })}>
                  {options.budget_types.map((value) => <option key={value} value={value}>{t(`estimate.budgetTypes.${value}`, { defaultValue: value })}</option>)}
                </select>
              </MobileField>
            )}
            <div className="cmm-field-pair">
              {CM_ESTIMATE_COUNT_FIELDS.map((field) => (
                <MobileField key={field} label={t(`estimate.${field}`)} hint={t('estimate.range', { min: options[field].min, max: options[field].max })}>
                  <input
                    className="cmm-input"
                    type="number"
                    inputMode="numeric"
                    min={options[field].min}
                    max={options[field].max}
                    value={draft[field]}
                    onChange={(event) => updateDraft({ [field]: event.target.value })}
                    onBlur={() => commitCount(field)}
                  />
                </MobileField>
              ))}
            </div>
            <MobileButton type="submit" variant="primary" block loading={pending} icon={<Calculator aria-hidden="true" />}>
              {pending ? t('common.loading') : t('estimate.calculate')}
            </MobileButton>
          </form>
        </MobileCard>
      )}
      {error && (
        <MobileNotice tone="error" action={draft && <button type="button" className="cmm-link-btn" onClick={estimate.submit}><RotateCw aria-hidden="true" />{t('estimate.retry')}</button>}>
          {error}
        </MobileNotice>
      )}
      {options && !result && !error && !pending && <p className="cmm-summary">{t('estimate.empty')}</p>}
      {result && !error && (
        <MobileCard className="cmm-a-result" tone="accent">
          <div aria-live="polite">
            <ResultRow label={t('estimate.costRange')} value={moneyRange(result.estimated_cost_min, result.estimated_cost_max)} />
            {isHourly && result.hourly_rate_min && result.hourly_rate_max && (
              <ResultRow label={t('estimate.hourlyRange')} value={t('estimate.perHour', { range: moneyRange(result.hourly_rate_min, result.hourly_rate_max) })} />
            )}
            <ResultRow label={t('estimate.durationRange')} value={t('estimate.weeks', { min: result.estimated_duration_weeks_min, max: result.estimated_duration_weeks_max })} />
            <ResultRow label={t('estimate.effortRange')} value={t('estimate.hours', { min: result.estimated_hours_min, max: result.estimated_hours_max })} />
            <ResultRow
              label={t('estimate.team')}
              value={teamRoles.map((entry) => t('estimate.teamRole', { role: t(`estimate.roles.${entry.role}`, { defaultValue: entry.role }), number: entry.count })).join(t('estimate.teamSeparator'))}
            />
            {currency && <ResultRow label={t('estimate.currencyLabel')} value={t(`estimate.currencyNames.${currency}`, { defaultValue: currency })} />}
            {Number.isFinite(result.platform_commission_rate) && (
              <ResultRow label={t('estimate.commission')} value={cmFormatPercent(result.platform_commission_rate, i18n.language)} />
            )}
          </div>
          <p className="cmm-a-fine">{t('estimate.commissionNote')}</p>
          <p className="cmm-a-fine">{t('estimate.note')}</p>
          <MobileButton variant="primary" block onClick={() => openProtected(CM_PROTECTED_ROUTE.projectCreate, 'project-create')}>{t('estimate.startProject')}</MobileButton>
        </MobileCard>
      )}
    </MobileScreen>
  );
};

export default MobileEstimateScreen;
