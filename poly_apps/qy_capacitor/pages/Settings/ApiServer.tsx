/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { BackButton, SectionTitle, Card } from '../../components/UI';
import { ApiEndpointSwitcher } from '../../components/ApiEndpointSwitcher';
import { InitComplianceModal } from '../../components/InitComplianceModal';

const ApiServerSettings = () => {
  const { navigate, t } = useContext(AppContext);
  const [showInitCheck, setShowInitCheck] = useState(false);

  const points = [
    t('settings.serversTestedInOrder'),
    t('settings.firstWorkingSelected'),
    t('settings.healthChecksRun'),
    t('settings.manualSelectionPersists'),
  ];

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.apiServer')}
          </h1>
          <BackButton onClick={() => navigate('settings')} />
        </div>

        {/* Backend API config — gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">{t('settings.backendApiConfig')}</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              {t('settings.backendApiDescription')}
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Endpoint Switcher (untouched component) */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.apiServer')} className="px-1 mb-1" />
          <Card>
            <div className="flex justify-center">
              <ApiEndpointSwitcher />
            </div>
          </Card>
        </div>

        {/* API Initialization Check — opens a centered compliance modal */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.initCheck')} className="px-1 mb-1" />
          <Card onClick={() => setShowInitCheck(true)} className="cursor-pointer">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)]">{t('settings.initCheck')}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{t('settings.initCheckDesc')}</p>
              </div>
              <svg className="w-5 h-5 text-[var(--color-text-tertiary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        </div>

        {/* How It Works */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.howItWorks')} className="px-1 mb-1" />
          <Card>
            <ul className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              {points.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Technical Details */}
        <div className="px-1 text-xs text-[var(--color-text-tertiary)] space-y-1.5">
          <p>{t('settings.healthChecksVerify')}</p>
          <p>{t('settings.responseTimesMeasured')}</p>
          <p>{t('settings.endpointSavedLocalStorage')}</p>
        </div>
      </div>

      {showInitCheck && <InitComplianceModal onClose={() => setShowInitCheck(false)} />}
    </div>
  );
};

export default ApiServerSettings;
