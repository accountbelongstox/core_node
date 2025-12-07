import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from '../Settings/Layout';
import { Button } from '../../components/UI';

const PlaylistConfigPage = () => {
  const { playlistSettings, updatePlaylistSettings, navigate } = useContext(AppContext);

  return (
    <SettingsLayout title="Playlist Config">
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
           <>
              <SettingItem label="IR Interval" value={`Every ${playlistSettings.instantReviewInterval}`} onClick={() => updatePlaylistSettings({ instantReviewInterval: playlistSettings.instantReviewInterval >= 10 ? 3 : playlistSettings.instantReviewInterval + 1 })} />
              <SettingItem label="Jump Back" value={`${playlistSettings.instantReviewBackCount} words`} onClick={() => updatePlaylistSettings({ instantReviewBackCount: playlistSettings.instantReviewBackCount >= 5 ? 1 : playlistSettings.instantReviewBackCount + 1 })} />
              <SettingItem label="IR Repeat" value={`${playlistSettings.instantReviewRepeat}x`} onClick={() => updatePlaylistSettings({ instantReviewRepeat: playlistSettings.instantReviewRepeat >= 2 ? 1 : playlistSettings.instantReviewRepeat + 1 })} />
           </>
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
       </div>
    </SettingsLayout>
  );
};

export default PlaylistConfigPage;