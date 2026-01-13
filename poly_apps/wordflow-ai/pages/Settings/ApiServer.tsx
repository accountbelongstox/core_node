import React from 'react';
import { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
import { ApiEndpointSwitcher } from '../../components/ApiEndpointSwitcher';

const ApiServerSettings = () => {
  // [i18n] Added `t` function for multi-language support
  const { navigate, t } = useContext(AppContext);

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up-fade">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('settings')}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5"
        >
          <Icons.ChevronLeft />
        </button>
        {/* [i18n] Replaced hardcoded title with t() */}
        <h1 className="text-2xl font-serif text-slate-800 dark:text-white tracking-tight">{t('settings.apiServer')}</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
        <div className="w-full sm:max-w-lg sm:mx-auto space-y-6">
          {/* Info Card */}
          <div className="holo-card p-5 rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/40">
            {/* [i18n] Replaced hardcoded "Backend API Configuration" with t() */}
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">{t('settings.backendApiConfig')}</h3>
            {/* [i18n] Replaced hardcoded description with t() */}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {t('settings.backendApiDescription')}
            </p>

            {/* Endpoint Switcher Component */}
            <div className="flex justify-center mt-6">
              <ApiEndpointSwitcher />
            </div>
          </div>

          {/* How It Works */}
          <div className="holo-card p-5 rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/40">
            {/* [i18n] Replaced hardcoded "How It Works" with t() */}
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">{t('settings.howItWorks')}</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {/* [i18n] Replaced all hardcoded list items with t() */}
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{t('settings.serversTestedInOrder')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{t('settings.firstWorkingSelected')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{t('settings.healthChecksRun')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{t('settings.manualSelectionPersists')}</span>
              </li>
            </ul>
          </div>

          {/* Technical Details */}
          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
            {/* [i18n] Replaced all hardcoded technical details with t() */}
            <p>{t('settings.healthChecksVerify')}</p>
            <p>{t('settings.responseTimesMeasured')}</p>
            <p>{t('settings.endpointSavedLocalStorage')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiServerSettings;
