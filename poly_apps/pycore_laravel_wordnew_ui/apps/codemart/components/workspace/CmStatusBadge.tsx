import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

interface CmStatusBadgeProps {
  group: string;
  status: string | null | undefined;
  prefix?: string;
}

/** Translated status badge; `group` selects `states.<group>`, `prefix` replaces it (e.g. `analysis.statuses`). */
export const CmStatusBadge: React.FC<CmStatusBadgeProps> = ({ group, status, prefix }) => {
  const { t } = useTranslation('cm');
  if (!status) return null;
  const namespace = prefix ?? `states.${group}`;
  return (
    <span className="cm-status" data-status={status}>
      {t(`${namespace}.${status}`, { defaultValue: status.replace(/_/g, ' ') })}
    </span>
  );
};

export default CmStatusBadge;
