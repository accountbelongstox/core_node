/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, BackButton, SectionTitle, Badge } from '../../components/UI';

interface InfoItemProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

/** Reference settings row: soft rounded icon-chip + label + value + chevron. */
const InfoItem: React.FC<InfoItemProps> = ({ label, value, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="ds-row w-full p-4 flex items-center justify-between gap-3 text-left group disabled:cursor-default enabled:cursor-pointer enabled:ds-touch-target"
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <span className="font-semibold text-[var(--color-text-primary)] truncate group-enabled:group-hover:text-[var(--klein-blue)] transition-colors">
        {label}
      </span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {value && <span className="text-sm text-[var(--color-text-tertiary)] truncate max-w-[7rem]">{value}</span>}
      {onClick && (
        <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors">
          <Icons.ChevronRight />
        </span>
      )}
    </div>
  </button>
);

const AboutPage = () => {
  const { navigate, t } = useContext(AppContext);

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.about')}
          </h1>
          <BackButton onClick={() => navigate('settings')} />
        </div>

        {/* App Info — gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-center text-center py-4">
            <div className="w-24 h-24 bg-white/15 rounded-3xl flex items-center justify-center text-5xl font-black mb-4">
              W
            </div>
            <h2 className="text-2xl font-bold mb-1">{t('settings.appName')}</h2>
            <p className="text-white/80 text-sm mb-4">{t('settings.versionInfo')}</p>
            <div className="flex gap-2 text-xs">
              <span className="px-3 py-1 bg-white/15 rounded-full">AI-Powered</span>
              <span className="px-3 py-1 bg-white/15 rounded-full">Multi-Language</span>
              <span className="px-3 py-1 bg-white/15 rounded-full">Open Source</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* System Statistics link */}
        <div className="ds-stack-tight flex flex-col">
          <InfoItem
            label="System Statistics"
            value="View Details"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            onClick={() => navigate('settings_statistics')}
          />
        </div>

        {/* Features Highlight */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Why WordFlow AI?" className="px-1 mb-1" />
          <Card>
            <div className="space-y-4">
              {[
                { d: 'M13 10V3L4 14h7v7l9-11h-7z', t: 'AI-Powered Learning', s: 'Personalized vocabulary recommendations' },
                { d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', t: 'Spaced Repetition', s: 'Scientifically proven memory technique' },
                { d: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', t: 'Multi-Language Support', s: 'Learn words in multiple languages' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.d} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)] text-sm">{f.t}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{f.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Legal Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.legal')} className="px-1 mb-1" />

          <InfoItem
            label={t('settings.termsOfService')}
            onClick={() => handleOpenLink('https://wordflow.ai/terms')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />

          <InfoItem
            label={t('settings.privacyPolicy')}
            onClick={() => handleOpenLink('https://wordflow.ai/privacy')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          <InfoItem
            label={t('settings.openSourceLicenses')}
            onClick={() => handleOpenLink('https://github.com/wordflow-ai')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }
          />
        </div>

        {/* Connect Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.connect')} className="px-1 mb-1" />

          <InfoItem
            label={t('settings.website')}
            value="wordflow.ai"
            onClick={() => handleOpenLink('https://wordflow.ai')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            }
          />

          <InfoItem
            label={t('settings.twitter')}
            value="@wordflow"
            onClick={() => handleOpenLink('https://twitter.com/wordflow')}
            icon={
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
            }
          />

          <InfoItem
            label={t('settings.contactSupport')}
            onClick={() => handleOpenLink('mailto:support@wordflow.ai')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* Credits & Team */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Made with Love</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                WordFlow AI is crafted by a dedicated team of language enthusiasts and AI researchers who believe in making language learning accessible to everyone.
              </p>
              <Badge tone="klein">© 2025 WordFlow AI</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AboutPage;
