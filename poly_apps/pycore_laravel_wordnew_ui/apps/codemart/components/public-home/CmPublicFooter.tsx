import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrand } from '../CmBrand';

const FOOTER_GROUPS = [
  {
    titleKey: 'publicHome.footer.platformTitle',
    links: [
      { key: 'publicHome.footer.about', to: '/codemart/about' },
      { key: 'publicHome.footer.delivery', to: '/codemart/delivery-process' },
      { key: 'publicHome.footer.information', to: '/codemart/information' },
    ],
  },
  {
    titleKey: 'publicHome.footer.serviceTitle',
    links: [
      { key: 'publicHome.footer.services', to: '/codemart/services' },
      { key: 'publicHome.footer.marketplace', to: '/codemart/marketplace' },
      { key: 'publicHome.footer.estimate', to: '/codemart/estimate' },
    ],
  },
  {
    titleKey: 'publicHome.footer.accountTitle',
    links: [
      { key: 'publicHome.footer.dashboard', to: '/codemart/dashboard' },
      { key: 'publicHome.footer.verification', to: '/codemart/verification' },
      { key: 'publicHome.footer.account', to: '/codemart/profile' },
    ],
  },
  {
    titleKey: 'publicHome.footer.legalTitle',
    links: [
      { key: 'publicHome.footer.privacy', to: '/codemart/privacy' },
      { key: 'publicHome.footer.terms', to: '/codemart/terms' },
    ],
  },
] as const;

export const CmPublicFooter: React.FC = () => {
  const { t } = useTranslation('cm');
  const year = new Date().getFullYear();

  return (
    <footer className="cm-public-footer">
      <div className="cm-public-container cm-public-footer__main">
        <div className="cm-public-footer__identity">
          <CmBrand />
          <p>{t('publicHome.footer.description')}</p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.titleKey} aria-label={t(group.titleKey)}>
            <h3>{t(group.titleKey)}</h3>
            {group.links.map((link) => link.to.startsWith('#') ? (
              <a key={link.key} href={link.to}>{t(link.key)}</a>
            ) : (
              <Link key={link.key} to={link.to}>{t(link.key)}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="cm-public-footer__copyright">
        <div className="cm-public-container">{t('publicHome.footer.copyright', { year })}</div>
      </div>
    </footer>
  );
};

export default CmPublicFooter;
