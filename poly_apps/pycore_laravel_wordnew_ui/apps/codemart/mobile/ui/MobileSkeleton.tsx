import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

const DEFAULT_ROWS = 4;

/** Placeholder rows shown while a list loads. */
export const MobileSkeletonList: React.FC<{ rows?: number }> = ({ rows = DEFAULT_ROWS }) => {
  const { t } = useTranslation('cm');
  return (
    <div className="cmm-list cmm-skeleton-list" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="cmm-row cmm-skeleton-row" aria-hidden="true">
          <span className="cmm-skeleton cmm-skeleton--avatar" />
          <span className="cmm-row__body">
            <span className="cmm-skeleton cmm-skeleton--line" />
            <span className="cmm-skeleton cmm-skeleton--line is-short" />
          </span>
        </div>
      ))}
    </div>
  );
};

export const MobileSkeletonBlock: React.FC<{ height?: number }> = ({ height = 96 }) => (
  <div className="cmm-skeleton cmm-skeleton--block" style={{ height }} aria-hidden="true" />
);
