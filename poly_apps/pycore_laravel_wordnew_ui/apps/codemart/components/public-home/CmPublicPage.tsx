import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmPublicFooter } from './CmPublicFooter';
import { CmPublicHeader } from './CmPublicHeader';
import { useCmPageTitle } from './useCmPageTitle';

export interface CmPublicPageProps {
  titleKey: string;
  descriptionKey: string;
  eyebrow?: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared frame for every public CodeMart page: public header with the mobile
 * menu, a banner carrying the localized title and lead, the page body, and
 * the public footer. Also owns the document title and meta description.
 */
export const CmPublicPage: React.FC<CmPublicPageProps> = ({
  titleKey,
  descriptionKey,
  eyebrow,
  lead,
  className,
  children,
}) => {
  const { t } = useTranslation('cm');
  const { hash } = useLocation();
  useCmPageTitle(titleKey, descriptionKey);

  useEffect(() => {
    const anchor = hash.replace('#', '');
    if (!anchor) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className={`cm-public-home cm-public-page ${className ?? ''}`} data-end="codemart">
      <CmPublicHeader />
      <main>
        <section className="cm-download-hero cm-public-page__banner">
          <div className="cm-public-container">
            {eyebrow && <p className="cm-download-hero__eyebrow">{eyebrow}</p>}
            <h1>{t(titleKey)}</h1>
            {lead && <p className="cm-download-hero__subtitle">{lead}</p>}
          </div>
        </section>
        <div className="cm-public-page__body">{children}</div>
      </main>
      <CmPublicFooter />
    </div>
  );
};

export default CmPublicPage;
