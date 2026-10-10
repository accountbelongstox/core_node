import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmPublicHomeSnapshot } from '../api/CmPublicApi';
import { CM_WHOLE_MONEY_DIGITS, cmFormatMoney, cmFormatNumber } from '../components/workspace/cmWorkspaceFormat';

export interface CmPlatformMetric {
  key: string;
  value: string;
  label: string;
}

function formatCount(value: number | null | undefined, language: string, unavailable: string): string {
  return value === null || value === undefined ? unavailable : cmFormatNumber(value, language);
}

/** The public platform figures (value and label) shown on the web and mobile welcome screens. */
export function useCmPlatformMetrics(data: CmPublicHomeSnapshot | null, loading: boolean): CmPlatformMetric[] {
  const { t, i18n } = useTranslation('cm');
  const unavailable = loading ? t('common.loading') : t('common.unavailable');
  const amount = data?.total_amount ? cmFormatMoney(data.total_amount, data.currency, i18n.language, CM_WHOLE_MONEY_DIGITS) : unavailable;
  const amountLabel = data?.total_amount_source === 'published_budgets'
    ? t('publicHome.metrics.publishedBudgets')
    : t('publicHome.metrics.protectedFunds');
  return [
    { key: 'amount', value: amount, label: amountLabel },
    { key: 'projects', value: formatCount(data?.project_count, i18n.language, unavailable), label: t('publicHome.metrics.projectCount') },
    { key: 'developers', value: formatCount(data?.developer_count, i18n.language, unavailable), label: t('publicHome.metrics.activeDevelopers') },
    { key: 'tasks', value: formatCount(data?.active_task_count, i18n.language, unavailable), label: t('publicHome.metrics.activeTasks') },
  ];
}
