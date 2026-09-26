import React from 'react';
import { BadgeCheck, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import authWelcomeImage from '../assets/images/auth-welcome.webp';
import { CmPublicFooter } from '../components/public-home/CmPublicFooter';
import { CmPublicHeader } from '../components/public-home/CmPublicHeader';
import { useCmPageTitle } from '../components/public-home/useCmPageTitle';

const AUTH_IMAGE_WIDTH = 720;
const AUTH_IMAGE_HEIGHT = 960;
const AUTH_POINTS = [
  { key: 'escrow', Icon: ShieldCheck },
  { key: 'verified', Icon: BadgeCheck },
  { key: 'review', Icon: ClipboardCheck },
] as const;

export interface CmAuthLayoutProps {
  titleKey: string;
  leadKey: string;
  icon: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * Shared frame of the CodeMart account pages (sign in, register, password
 * recovery): public header and footer, an illustrated side panel, and the form panel.
 */
export const CmAuthLayout: React.FC<CmAuthLayoutProps> = ({ titleKey, leadKey, icon, wide = false, children }) => {
  const { t } = useTranslation('cm');
  useCmPageTitle(titleKey, leadKey);

  return (
    <div className="cm-public-home cm-auth-shell" data-end="codemart">
      <CmPublicHeader />
      <main className="cm-auth-shell__main">
        <div className={`cm-public-container cm-auth-shell__grid ${wide ? 'is-wide' : ''}`}>
          <aside className="cm-auth-shell__aside">
            <img
              className="cm-auth-shell__image"
              src={authWelcomeImage}
              alt=""
              width={AUTH_IMAGE_WIDTH}
              height={AUTH_IMAGE_HEIGHT}
              decoding="async"
            />
            <div className="cm-auth-shell__aside-copy">
              <h2>{t('publicAuth.aside.title')}</h2>
              <ul>
                {AUTH_POINTS.map(({ key, Icon }) => (
                  <li key={key}>
                    <Icon aria-hidden="true" />
                    <span>{t(`publicAuth.aside.points.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          <section className="cm-auth-shell__panel" aria-labelledby="cm-auth-title">
            <p className="cm-auth-shell__eyebrow">{icon} {t('publicAuth.eyebrow')}</p>
            <h1 id="cm-auth-title">{t(titleKey)}</h1>
            <p className="cm-auth-shell__lead">{t(leadKey)}</p>
            {children}
          </section>
        </div>
      </main>
      <CmPublicFooter />
    </div>
  );
};

export default CmAuthLayout;
