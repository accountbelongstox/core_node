import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmPageTitle } from '../public-home/useCmPageTitle';

interface CmPageHeaderProps {
  eyebrowKey: string;
  titleKey: string;
  purposeKey: string;
  title?: string;
  purpose?: string;
  actions?: React.ReactNode;
}

/** Workspace page heading: eyebrow, heading, one-line purpose, actions; also sets the document title. */
export const CmPageHeader: React.FC<CmPageHeaderProps> = ({ eyebrowKey, titleKey, purposeKey, title, purpose, actions }) => {
  const { t } = useTranslation('cm');
  useCmPageTitle(titleKey, purposeKey);
  return (
    <header className="cm-page-heading is-split">
      <div className="cm-page-heading__text">
        <span>{t(eyebrowKey)}</span>
        <h1>{title ?? t(titleKey)}</h1>
        <p>{purpose ?? t(purposeKey)}</p>
      </div>
      {actions && <div className="cm-page-heading__actions">{actions}</div>}
    </header>
  );
};

export default CmPageHeader;
