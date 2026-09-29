import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmPageTitle } from '../public-home/useCmPageTitle';

export type CmPageHeaderVariant = 'workspace' | 'admin';

const HEADING_CLASS: Record<CmPageHeaderVariant, string> = {
  workspace: 'cm-page-heading',
  admin: 'cm-admin-heading',
};
const ADMIN_EYEBROW_KEY = 'admin.badge';

interface CmPageHeaderProps {
  titleKey: string;
  purposeKey: string;
  eyebrowKey?: string;
  title?: string;
  purpose?: string;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  aside?: React.ReactNode;
  variant?: CmPageHeaderVariant;
}

/** Workspace and admin page heading: eyebrow, heading, one-line purpose, actions; also sets the document title. */
export const CmPageHeader: React.FC<CmPageHeaderProps> = ({
  titleKey,
  purposeKey,
  eyebrowKey,
  title,
  purpose,
  actions,
  onRefresh,
  aside,
  variant = 'workspace',
}) => {
  const { t } = useTranslation('cm');
  useCmPageTitle(titleKey, purposeKey);
  const base = HEADING_CLASS[variant];
  const admin = variant === 'admin';
  const eyebrow = eyebrowKey ?? (admin ? ADMIN_EYEBROW_KEY : null);
  const actionBlock = actions || onRefresh ? (
    <div className={`${base}__actions`}>
      {actions}
      {onRefresh && (
        <button type="button" className="cm-workspace-button" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      )}
    </div>
  ) : null;

  return (
    <header className={admin ? base : `${base} is-split`}>
      <div className={`${base}__text`}>
        {eyebrow && <span className={`${base}__eyebrow`}>{t(eyebrow)}</span>}
        <h1>{title ?? t(titleKey)}</h1>
        <p>{purpose ?? t(purposeKey)}</p>
        {admin && actionBlock}
      </div>
      {!admin && actionBlock}
      {aside}
    </header>
  );
};

export default CmPageHeader;
