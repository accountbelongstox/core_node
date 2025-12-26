<<<<<<< HEAD

=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from '../Settings/Layout';
import { Button } from '../../components/UI';

const PlaylistConfigPage = () => {
  const { playlistSettings, updatePlaylistSettings, navigate } = useContext(AppContext);

  return (
    <SettingsLayout title="Playlist Config">
<<<<<<< HEAD
       <div className="px-5 mb-4">
          <p className="text-slate-500 text-sm">Configure your automated sequential learning experience.</p>
       </div>

       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 mb-2 pl-2">Playback</div>
       <SettingItem label="Words Per Page" value={playlistSettings.wordsPerPage} onClick={() => updatePlaylistSettings({ wordsPerPage: playlistSettings.wordsPerPage === 20 ? 50 : playlistSettings.wordsPerPage === 50 ? 100 : 20 })} />
       <SettingItem label="Playback Speed" value={`${playlistSettings.playbackSpeed}x`} onClick={() => updatePlaylistSettings({ playbackSpeed: playlistSettings.playbackSpeed >= 2.0 ? 0.5 : playlistSettings.playbackSpeed + 0.25 })} />
       <SettingItem label="Interval (sec)" value={`${playlistSettings.playInterval}s`} onClick={() => updatePlaylistSettings({ playInterval: playlistSettings.playInterval >= 5 ? 1 : playlistSettings.playInterval + 1 })} />
       <SettingItem label="Repeat Word" value={`${playlistSettings.repeatCount}x`} onClick={() => updatePlaylistSettings({ repeatCount: playlistSettings.repeatCount >= 3 ? 1 : playlistSettings.repeatCount + 1 })} />

       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Instant Review (IR)</div>
       <SettingItem label="Enable IR" type="toggle" active={playlistSettings.instantReviewEnabled} onClick={() => updatePlaylistSettings({ instantReviewEnabled: !playlistSettings.instantReviewEnabled })} />
       {playlistSettings.instantReviewEnabled && (
=======
       <div className="px-1 mb-6">
          <p className="text-secondary text-sm leading-relaxed">Customize your audio learning experience. Adjust speed, repetition, and automated review cycles.</p>
       </div>

       <div className="settings-section-title">Playback Control</div>
       <div className="settings-glass-group">
         <SettingItem label="Words Per Page" value={playlistSettings.wordsPerPage} onClick={() => updatePlaylistSettings({ wordsPerPage: playlistSettings.wordsPerPage === 20 ? 50 : playlistSettings.wordsPerPage === 50 ? 100 : 20 })} />
         <SettingItem label="Playback Speed" value={`${playlistSettings.playbackSpeed}x`} onClick={() => updatePlaylistSettings({ playbackSpeed: playlistSettings.playbackSpeed >= 2.0 ? 0.5 : playlistSettings.playbackSpeed + 0.25 })} />
         <SettingItem label="Interval (sec)" value={`${playlistSettings.playInterval}s`} onClick={() => updatePlaylistSettings({ playInterval: playlistSettings.playInterval >= 5 ? 1 : playlistSettings.playInterval + 1 })} />
         <SettingItem label="Repeat Word" value={`${playlistSettings.repeatCount}x`} onClick={() => updatePlaylistSettings({ repeatCount: playlistSettings.repeatCount >= 3 ? 1 : playlistSettings.repeatCount + 1 })} />
       </div>

       <div className="settings-section-title">Instant Review (IR)</div>
       <div className="settings-glass-group">
         <SettingItem label="Enable IR" type="toggle" active={playlistSettings.instantReviewEnabled} onClick={() => updatePlaylistSettings({ instantReviewEnabled: !playlistSettings.instantReviewEnabled })} />
         {playlistSettings.instantReviewEnabled && (
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
           <>
              <SettingItem label="IR Interval" value={`Every ${playlistSettings.instantReviewInterval}`} onClick={() => updatePlaylistSettings({ instantReviewInterval: playlistSettings.instantReviewInterval >= 10 ? 3 : playlistSettings.instantReviewInterval + 1 })} />
              <SettingItem label="Jump Back" value={`${playlistSettings.instantReviewBackCount} words`} onClick={() => updatePlaylistSettings({ instantReviewBackCount: playlistSettings.instantReviewBackCount >= 5 ? 1 : playlistSettings.instantReviewBackCount + 1 })} />
              <SettingItem label="IR Repeat" value={`${playlistSettings.instantReviewRepeat}x`} onClick={() => updatePlaylistSettings({ instantReviewRepeat: playlistSettings.instantReviewRepeat >= 2 ? 1 : playlistSettings.instantReviewRepeat + 1 })} />
           </>
<<<<<<< HEAD
       )}

       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Review Mode</div>
       <SettingItem label="Review After Page" type="toggle" active={playlistSettings.reviewModeEnabled} onClick={() => updatePlaylistSettings({ reviewModeEnabled: !playlistSettings.reviewModeEnabled })} />
       {playlistSettings.reviewModeEnabled && (
         <SettingItem label="Disable IR during Review" type="toggle" active={playlistSettings.disableIRInReview} onClick={() => updatePlaylistSettings({ disableIRInReview: !playlistSettings.disableIRInReview })} />
       )}

       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Appearance & Audio</div>
       <SettingItem label="Display Mode" value={playlistSettings.displayMode === 'simple' ? 'Simple' : 'Detailed'} onClick={() => updatePlaylistSettings({ displayMode: playlistSettings.displayMode === 'simple' ? 'detailed' : 'simple' })} />
       <SettingItem label="Large Font" type="toggle" active={playlistSettings.largeFont} onClick={() => updatePlaylistSettings({ largeFont: !playlistSettings.largeFont })} />
       <SettingItem label="Accent" value={playlistSettings.accent} onClick={() => updatePlaylistSettings({ accent: playlistSettings.accent === 'US' ? 'UK' : 'US' })} />
       <SettingItem label="Auto Scroll" type="toggle" active={playlistSettings.autoScroll} onClick={() => updatePlaylistSettings({ autoScroll: !playlistSettings.autoScroll })} />
       <SettingItem label="Show Animation" type="toggle" active={playlistSettings.showAnimation} onClick={() => updatePlaylistSettings({ showAnimation: !playlistSettings.showAnimation })} />

       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Goals</div>
       <SettingItem label="Daily Word Goal" value={playlistSettings.dailyGoal} onClick={() => updatePlaylistSettings({ dailyGoal: playlistSettings.dailyGoal + 100 })} />

       <div className="px-5 mt-8">
         <Button onClick={() => navigate('playlist')}>Start Playing</Button>
=======
         )}
       </div>

       <div className="settings-section-title">Review Mode</div>
       <div className="settings-glass-group">
         <SettingItem label="Review After Page" type="toggle" active={playlistSettings.reviewModeEnabled} onClick={() => updatePlaylistSettings({ reviewModeEnabled: !playlistSettings.reviewModeEnabled })} />
         {playlistSettings.reviewModeEnabled && (
           <SettingItem label="Disable IR during Review" type="toggle" active={playlistSettings.disableIRInReview} onClick={() => updatePlaylistSettings({ disableIRInReview: !playlistSettings.disableIRInReview })} />
         )}
       </div>

       <div className="settings-section-title">Appearance</div>
       <div className="settings-glass-group">
         <SettingItem label="Display Mode" value={playlistSettings.displayMode === 'simple' ? 'Simple' : 'Detailed'} onClick={() => updatePlaylistSettings({ displayMode: playlistSettings.displayMode === 'simple' ? 'detailed' : 'simple' })} />
         <SettingItem label="Large Font" type="toggle" active={playlistSettings.largeFont} onClick={() => updatePlaylistSettings({ largeFont: !playlistSettings.largeFont })} />
         <SettingItem label="Auto Scroll" type="toggle" active={playlistSettings.autoScroll} onClick={() => updatePlaylistSettings({ autoScroll: !playlistSettings.autoScroll })} />
         <SettingItem label="Show Animation" type="toggle" active={playlistSettings.showAnimation} onClick={() => updatePlaylistSettings({ showAnimation: !playlistSettings.showAnimation })} />
       </div>

       <div className="px-2 mt-8 mb-8">
         <Button onClick={() => navigate('playlist')} className="shadow-lg shadow-blue-500/40">Start Playing</Button>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
       </div>
    </SettingsLayout>
  );
};

<<<<<<< HEAD
export default PlaylistConfigPage;
=======
export default PlaylistConfigPage;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
