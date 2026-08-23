import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmPublicHomeData } from '../../api';

export interface CmPlatformStatsProps {
  data: CmPublicHomeData | null;
  loading: boolean;
}

function formatCount(value: number | null, language: string, unavailable: string): string {
  return value === null ? unavailable : new Intl.NumberFormat(language).format(value);
}

function formatAmount(data: CmPublicHomeData | null, language: string, unavailable: string): string {
  if (!data?.total_amount) return unavailable;
  const amount = Number(data.total_amount);
  if (!Number.isFinite(amount)) return data.total_amount;
  if (!data.currency) return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(amount);
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: data.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const CmPlatformStats: React.FC<CmPlatformStatsProps> = ({ data, loading }) => {
  const { t, i18n } = useTranslation('cm');
  const unavailable = loading ? t('common.loading') : t('common.unavailable');
  const metrics = [
    { key: 'amount', value: formatAmount(data, i18n.language, unavailable), label: t('publicHome.metrics.totalAmount') },
    { key: 'projects', value: formatCount(data?.project_count ?? null, i18n.language, unavailable), label: t('publicHome.metrics.projectCount') },
    { key: 'developers', value: formatCount(data?.developer_count ?? null, i18n.language, unavailable), label: t('publicHome.metrics.developerCount') },
  ];

  return (
    <section className="cm-platform-stats" aria-label={t('publicHome.metrics.projectCount')}>
      <div className="cm-public-container cm-platform-stats__inner">
        {metrics.map((metric) => (
          <div className="cm-platform-stats__item" key={metric.key}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CmPlatformStats;
