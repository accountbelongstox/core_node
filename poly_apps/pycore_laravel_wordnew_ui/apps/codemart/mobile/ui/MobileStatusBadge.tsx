import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmHumanize } from '../../components/workspace/cmWorkspaceFormat';
import { cmStatusTone } from '../../shared/cmStatusTone';

interface MobileStatusBadgeProps {
  status: string | null | undefined;
  /** Server state group: translates `states.<group>.<status>`. */
  group?: string;
  /** Translation prefix that replaces `states.<group>` (e.g. `admin.states.deposit`). */
  prefix?: string;
}

/** Translated status pill; the colour follows the server state vocabulary, never a local list per screen. */
export const MobileStatusBadge: React.FC<MobileStatusBadgeProps> = ({ status, group, prefix }) => {
  const { t } = useTranslation('cm');
  if (!status) return null;
  const namespace = prefix ?? `states.${group}`;
  return (
    <span className="cmm-badge" data-tone={cmStatusTone(status)}>
      {t(`${namespace}.${status}`, { defaultValue: cmHumanize(status) })}
    </span>
  );
};
