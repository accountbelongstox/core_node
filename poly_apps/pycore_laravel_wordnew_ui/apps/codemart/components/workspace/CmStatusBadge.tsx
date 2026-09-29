import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmHumanize } from './cmWorkspaceFormat';

interface CmStatusBadgeProps {
  status: string | null | undefined;
  group?: string;
  prefix?: string;
}

/** Translated status badge; `group` selects `states.<group>`, `prefix` replaces it (e.g. `admin.states.deposit`). */
export const CmStatusBadge: React.FC<CmStatusBadgeProps> = ({ group, status, prefix }) => {
  const { t } = useTranslation('cm');
  if (!status) return null;
  const namespace = prefix ?? `states.${group}`;
  return (
    <span className="cm-status" data-status={status}>
      {t(`${namespace}.${status}`, { defaultValue: cmHumanize(status) })}
    </span>
  );
};

export default CmStatusBadge;
