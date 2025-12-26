<<<<<<< HEAD

=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { Icons, Card } from '../../components/UI';

const LearningSettings = () => {
  const { settings, updateSettings, navigate } = useContext(AppContext);
  return (
    <SettingsLayout title="Learning Goals">
<<<<<<< HEAD
       <SettingItem label="Daily Word Goal" value={`${settings.learning.dailyWordGoal} words`} onClick={() => {/* Modal logic */}} />
       <SettingItem label="Daily Review Goal" value={`${settings.learning.dailyReviewGoal} words`} />
       <SettingItem label="Session Size" value={settings.learning.sessionSize} />
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Sequential Player</div>
       <div onClick={() => navigate('playlist_config')} className="holo-card p-4 rounded-2xl mx-5 mb-4 flex items-center justify-between cursor-pointer hover:bg-white/60">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                 <span>▶</span>
              </div>
              <div>
                 <h4 className="font-bold dark:text-white">Playlist Config</h4>
                 <p className="text-xs text-slate-500">Configure intervals, IR, and display</p>
=======
       <div className="settings-section-title">Daily Targets</div>
       <div className="settings-glass-group">
         <SettingItem label="Daily Word Goal" value={`${settings.learning.dailyWordGoal} words`} onClick={() => {/* Modal logic */}} />
         <SettingItem label="Daily Review Goal" value={`${settings.learning.dailyReviewGoal} words`} />
         <SettingItem label="Session Size" value={settings.learning.sessionSize} />
       </div>
       
       <div className="settings-section-title">Sequential Player</div>
       <div onClick={() => navigate('playlist_config')} className="app-card p-4 flex items-center justify-between cursor-pointer hover:bg-white/60 mb-4 border-blue-500/30">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                 <span>▶</span>
              </div>
              <div>
                 <h4 className="font-bold text-primary">Playlist Config</h4>
                 <p className="text-xs text-secondary">Configure intervals, IR, and display</p>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
              </div>
           </div>
           <Icons.ChevronRight />
       </div>

<<<<<<< HEAD
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Flow Control</div>
       <SettingItem label="Instant Review" type="toggle" active={settings.learning.instantReviewEnabled} onClick={() => updateSettings({ learning: { ...settings.learning, instantReviewEnabled: !settings.learning.instantReviewEnabled } })} />
       <SettingItem label="Auto Advance" type="toggle" active={settings.learning.autoAdvance} onClick={() => updateSettings({ learning: { ...settings.learning, autoAdvance: !settings.learning.autoAdvance } })} />
=======
       <div className="settings-section-title">Flow Control</div>
       <div className="settings-glass-group">
         <SettingItem label="Instant Review" type="toggle" active={settings.learning.instantReviewEnabled} onClick={() => updateSettings({ learning: { ...settings.learning, instantReviewEnabled: !settings.learning.instantReviewEnabled } })} />
         <SettingItem label="Auto Advance" type="toggle" active={settings.learning.autoAdvance} onClick={() => updateSettings({ learning: { ...settings.learning, autoAdvance: !settings.learning.autoAdvance } })} />
       </div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    </SettingsLayout>
  );
};

<<<<<<< HEAD
export default LearningSettings;
=======
export default LearningSettings;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
