import React from 'react';
import { RotateCw } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmPublicHomeSnapshot } from '../../api/CmPublicApi';
import { useCmPlatformMetrics } from '../../shared/useCmPlatformMetrics';

export interface CmPlatformStatsProps {
  data: CmPublicHomeSnapshot | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

export const CmPlatformStats: React.FC<CmPlatformStatsProps> = ({ data, loading, failed, onRetry }) => {
  const { t } = useTranslation('cm');
  const metrics = useCmPlatformMetrics(data, loading);

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
