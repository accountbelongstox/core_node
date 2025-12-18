import React, { useContext } from 'react';
import { SettingsLayout, SettingItem } from './Layout';
import { AppContext } from '../../contexts/AppContext';

const AboutPage = () => {
  // [i18n] Added `t` function for multi-language support
  const { t } = useContext(AppContext);

  return (
    // [i18n] Replaced hardcoded title with t()
    <SettingsLayout title={t('settings.about')}>
       <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-2xl shadow-xl flex items-center justify-center text-3xl text-white font-bold mb-4">W</div>
          {/* [i18n] Replaced hardcoded app name with t() */}
          <h2 className="font-bold text-xl dark:text-white">{t('settings.appName')}</h2>
          {/* [i18n] Replaced hardcoded version info with t() */}
          <p className="text-slate-500 text-sm">{t('settings.versionInfo')}</p>
       </div>

       {/* [i18n] Replaced hardcoded "Legal" with t() */}
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-2">{t('settings.legal')}</div>
       {/* [i18n] Replaced hardcoded labels with t() */}
       <SettingItem label={t('settings.termsOfService')} />
       <SettingItem label={t('settings.privacyPolicy')} />
       <SettingItem label={t('settings.openSourceLicenses')} />

       {/* [i18n] Replaced hardcoded "Connect" with t() */}
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">{t('settings.connect')}</div>
       {/* [i18n] Replaced hardcoded labels with t() */}
       <SettingItem label={t('settings.website')} value="wordflow.ai" />
       <SettingItem label={t('settings.twitter')} value="@wordflow" />
       <SettingItem label={t('settings.contactSupport')} />
    </SettingsLayout>
  );
};

export default AboutPage;
