import React from 'react';
import { useAuthSession } from '../../../../core/auth/useAuthSession';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrand } from '../CmBrand';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from './cmPublicRoutes';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

interface CmFooterLink {
  key: string;
  to: string;
  guestOnly?: boolean;
}

const FOOTER_GROUPS: Array<{ titleKey: string; links: CmFooterLink[] }> = [
  {
    titleKey: 'publicHome.footer.platformTitle',
    links: [
      { key: 'publicHome.footer.about', to: CM_PUBLIC_ROUTE.about },
      { key: 'publicHome.footer.delivery', to: CM_PUBLIC_ROUTE.delivery },
      { key: 'publicHome.footer.showcase', to: CM_PUBLIC_ROUTE.showcase },
      { key: 'publicHome.footer.download', to: CM_PUBLIC_ROUTE.download },
    ],
  },
  {
    titleKey: 'publicHome.footer.serviceTitle',
    links: [
      { key: 'publicHome.footer.services', to: CM_PUBLIC_ROUTE.services },
      { key: 'publicHome.footer.marketplace', to: CM_PROTECTED_ROUTE.marketplace },
      { key: 'publicHome.footer.estimate', to: CM_PUBLIC_ROUTE.estimate },
    ],
  },
  {
    titleKey: 'publicHome.footer.accountTitle',
    links: [
      { key: 'publicHome.footer.register', to: CM_PUBLIC_ROUTE.register, guestOnly: true },
      { key: 'publicHome.footer.dashboard', to: CM_PROTECTED_ROUTE.dashboard },
      { key: 'publicHome.footer.verification', to: CM_PROTECTED_ROUTE.verification },
      { key: 'publicHome.footer.account', to: CM_PROTECTED_ROUTE.profile },
    ],
  },
  {
    titleKey: 'publicHome.footer.legalTitle',
    links: [
      { key: 'publicHome.footer.information', to: CM_PUBLIC_ROUTE.information },
      { key: 'publicHome.footer.privacy', to: CM_PUBLIC_ROUTE.privacy },
      { key: 'publicHome.footer.terms', to: CM_PUBLIC_ROUTE.terms },
    ],
  },
];

export const CmPublicFooter: React.FC = () => {
  const { t } = useTranslation('cm');
  const openLink = useCmProtectedNavigate();
  const authenticated = useAuthSession();
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
            {group.links.filter((link) => !(link.guestOnly && authenticated)).map((link) => (
              <a
                key={link.key}
                href={link.to}
                onClick={(event) => {
                  event.preventDefault();
                  openLink(link.to);
                }}
              >
                {t(link.key)}
              </a>
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
