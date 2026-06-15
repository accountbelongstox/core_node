/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from '../Settings/Layout';
import { Button, SectionLabel } from '../../components/UI';

const PlaylistConfigPage = () => {
  const { playlistSettings, updatePlaylistSettings, navigate, t } = useContext(AppContext);

  return (
    <SettingsLayout title="Playlist Config">
       <div className="px-5 mb-5">
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">Configure your automated sequential learning experience.</p>
       </div>

       <SectionLabel className="mt-2 mb-2 px-2">{t('settings.playback')}</SectionLabel>
       <SettingItem label="Words Per Page" value={playlistSettings.wordsPerPage} onClick={() => updatePlaylistSettings({ wordsPerPage: playlistSettings.wordsPerPage === 20 ? 50 : playlistSettings.wordsPerPage === 50 ? 100 : 20 })} />
       <SettingItem label="Playback Speed" value={`${playlistSettings.playbackSpeed}x`} onClick={() => updatePlaylistSettings({ playbackSpeed: playlistSettings.playbackSpeed >= 2.0 ? 0.5 : playlistSettings.playbackSpeed + 0.25 })} />
       <SettingItem label="Interval (sec)" value={`${playlistSettings.playInterval}s`} onClick={() => updatePlaylistSettings({ playInterval: playlistSettings.playInterval >= 5 ? 1 : playlistSettings.playInterval + 1 })} />
       <SettingItem label="Repeat Word" value={`${playlistSettings.repeatCount}x`} onClick={() => updatePlaylistSettings({ repeatCount: playlistSettings.repeatCount >= 3 ? 1 : playlistSettings.repeatCount + 1 })} />

       <SectionLabel className="mt-6 mb-2 px-2">Instant Review (IR)</SectionLabel>
       <SettingItem label="Enable IR" type="toggle" active={playlistSettings.instantReviewEnabled} onClick={() => updatePlaylistSettings({ instantReviewEnabled: !playlistSettings.instantReviewEnabled })} />
       {playlistSettings.instantReviewEnabled && (
           <>
              <SettingItem label="IR Interval" value={`Every ${playlistSettings.instantReviewInterval}`} onClick={() => updatePlaylistSettings({ instantReviewInterval: playlistSettings.instantReviewInterval >= 10 ? 3 : playlistSettings.instantReviewInterval + 1 })} />
              <SettingItem label="Jump Back" value={`${playlistSettings.instantReviewBackCount} words`} onClick={() => updatePlaylistSettings({ instantReviewBackCount: playlistSettings.instantReviewBackCount >= 5 ? 1 : playlistSettings.instantReviewBackCount + 1 })} />
              <SettingItem label="IR Repeat" value={`${playlistSettings.instantReviewRepeat}x`} onClick={() => updatePlaylistSettings({ instantReviewRepeat: playlistSettings.instantReviewRepeat >= 2 ? 1 : playlistSettings.instantReviewRepeat + 1 })} />
           </>
       )}

       <SectionLabel className="mt-6 mb-2 px-2">Review Mode</SectionLabel>
       <SettingItem label="Review After Page" type="toggle" active={playlistSettings.reviewModeEnabled} onClick={() => updatePlaylistSettings({ reviewModeEnabled: !playlistSettings.reviewModeEnabled })} />
       {playlistSettings.reviewModeEnabled && (
         <SettingItem label="Disable IR during Review" type="toggle" active={playlistSettings.disableIRInReview} onClick={() => updatePlaylistSettings({ disableIRInReview: !playlistSettings.disableIRInReview })} />
       )}

       <SectionLabel className="mt-6 mb-2 px-2">Appearance & Audio</SectionLabel>
       <SettingItem label="Display Mode" value={playlistSettings.displayMode === 'simple' ? 'Simple' : 'Detailed'} onClick={() => updatePlaylistSettings({ displayMode: playlistSettings.displayMode === 'simple' ? 'detailed' : 'simple' })} />
       <SettingItem label="Large Font" type="toggle" active={playlistSettings.largeFont} onClick={() => updatePlaylistSettings({ largeFont: !playlistSettings.largeFont })} />
       <SettingItem label="Accent" value={playlistSettings.accent} onClick={() => updatePlaylistSettings({ accent: playlistSettings.accent === 'US' ? 'UK' : 'US' })} />
       <SettingItem label="Auto Scroll" type="toggle" active={playlistSettings.autoScroll} onClick={() => updatePlaylistSettings({ autoScroll: !playlistSettings.autoScroll })} />
       <SettingItem label="Show Animation" type="toggle" active={playlistSettings.showAnimation} onClick={() => updatePlaylistSettings({ showAnimation: !playlistSettings.showAnimation })} />

       <SectionLabel className="mt-6 mb-2 px-2">{t('settings.goals')}</SectionLabel>
       <SettingItem label="Daily Word Goal" value={playlistSettings.dailyGoal} onClick={() => updatePlaylistSettings({ dailyGoal: playlistSettings.dailyGoal + 100 })} />

       <div className="px-5 mt-8">
         <Button variant="klein" onClick={() => navigate('playlist')}>
           Start Playing
         </Button>
       </div>
    </SettingsLayout>
  );
};

export default PlaylistConfigPage;
