
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { Icons, Card } from '../../components/UI';

const LearningSettings = () => {
  // [i18n] Added `t` function for multi-language support
  const { settings, updateSettings, navigate, t } = useContext(AppContext);
  return (
    // [i18n] Replaced hardcoded title with t()
    <SettingsLayout title={t('settings.learningGoals')}>
       {/* [i18n] Replaced hardcoded labels with t() */}
       <SettingItem label={t('settings.dailyWordGoal')} value={`${settings.learning.dailyWordGoal} ${t('library.words')}`} onClick={() => {/* Modal logic */}} />
       <SettingItem label={t('settings.dailyReviewGoal')} value={`${settings.learning.dailyReviewGoal} ${t('library.words')}`} />
       <SettingItem label={t('settings.sessionSize')} value={settings.learning.sessionSize} />

       {/* [i18n] Replaced hardcoded "Sequential Player" with t() */}
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">{t('settings.sequentialPlayer')}</div>
       <div onClick={() => navigate('playlist_config')} className="holo-card p-4 rounded-2xl mx-5 mb-4 flex items-center justify-between cursor-pointer hover:bg-white/60">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                 <span>▶</span>
              </div>
              <div>
                 {/* [i18n] Replaced hardcoded "Playlist Config" with t() */}
                 <h4 className="font-bold dark:text-white">{t('settings.playlistConfig')}</h4>
                 {/* [i18n] Replaced hardcoded description with t() */}
                 <p className="text-xs text-slate-500">{t('settings.configureIntervals')}</p>
              </div>
           </div>
           <Icons.ChevronRight />
       </div>

       {/* [i18n] Replaced hardcoded "Flow Control" with t() */}
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">{t('settings.flowControl')}</div>
       {/* [i18n] Replaced hardcoded labels with t() */}
       <SettingItem label={t('settings.instantReview')} type="toggle" active={settings.learning.instantReviewEnabled} onClick={() => updateSettings({ learning: { ...settings.learning, instantReviewEnabled: !settings.learning.instantReviewEnabled } })} />
       <SettingItem label={t('settings.autoAdvance')} type="toggle" active={settings.learning.autoAdvance} onClick={() => updateSettings({ learning: { ...settings.learning, autoAdvance: !settings.learning.autoAdvance } })} />
    </SettingsLayout>
  );
};

export default LearningSettings;
