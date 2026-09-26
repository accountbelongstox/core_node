import React from 'react';
import { RotateCw } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmPublicHomeSnapshot } from '../../api/CmPublicApi';
import { formatCmAmount } from './cmPublicFormat';

export interface CmPlatformStatsProps {
  data: CmPublicHomeSnapshot | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

function formatCount(value: number | null | undefined, language: string, unavailable: string): string {
  return value === null || value === undefined ? unavailable : new Intl.NumberFormat(language).format(value);
}

export const CmPlatformStats: React.FC<CmPlatformStatsProps> = ({ data, loading, failed, onRetry }) => {
  const { t, i18n } = useTranslation('cm');
  const unavailable = loading ? t('common.loading') : t('common.unavailable');
  const amount = data?.total_amount ? formatCmAmount(data.total_amount, data.currency, i18n.language) : unavailable;
  const amountLabel = data?.total_amount_source === 'published_budgets'
    ? t('publicHome.metrics.publishedBudgets')
    : t('publicHome.metrics.protectedFunds');
  const metrics = [
    { key: 'amount', value: amount, label: amountLabel },
    { key: 'projects', value: formatCount(data?.project_count, i18n.language, unavailable), label: t('publicHome.metrics.projectCount') },
    { key: 'developers', value: formatCount(data?.developer_count, i18n.language, unavailable), label: t('publicHome.metrics.activeDevelopers') },
    { key: 'tasks', value: formatCount(data?.active_task_count, i18n.language, unavailable), label: t('publicHome.metrics.activeTasks') },
  ];

  return (
    <section className="cm-platform-stats" aria-label={t('publicHome.metrics.regionLabel')} aria-busy={loading}>
      {failed && !loading ? (
        <div className="cm-public-container cm-platform-stats__error" role="alert">
          <span>{t('publicHome.metrics.loadFailed')}</span>
          <button type="button" className="cm-public-button cm-public-button--primary" onClick={onRetry}>
            <RotateCw aria-hidden="true" /> {t('publicHome.metrics.retry')}
          </button>
        </div>
      ) : (
        <>
          <div className="cm-public-container cm-platform-stats__inner">
            {metrics.map((metric) => (
              <div className="cm-platform-stats__item" key={metric.key}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
          <p className="cm-public-container cm-platform-stats__caption">{t('publicHome.metrics.caption')}</p>
        </>
      )}
    </section>
  );
};

export default CmPlatformStats;
