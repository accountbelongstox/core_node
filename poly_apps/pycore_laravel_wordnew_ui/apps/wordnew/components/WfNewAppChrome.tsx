import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { wfNewApi } from '../api';
import { useWfNewAppState, type WordNewTab } from '../hooks/useWfNewAppState';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wfNewNotify } from '../WfNewNotify';
import { WfNewBottomDock } from './WfNewBottomDock';
import { WfNewConfirmAddLibraryModal } from './WfNewConfirmAddLibraryModal';
import { WfNewSearchOverlay } from './WfNewSearchOverlay';
import { WfNewToast } from './WfNewToast';
import { WfNewWordDetailModal } from './WfNewWordDetailModal';
import { WfNewOnboarding } from '../pages/WfNewOnboarding';

interface WfNewAppChromeProps {
  dark: boolean;
  state: ReturnType<typeof useWfNewAppState>;
}

export const WfNewAppChrome: React.FC<WfNewAppChromeProps> = ({ dark, state }) => {
  const {
    activeTab,
    activeTheme,
    addLibraryConfirm,
    closeAddLibraryConfirm,
    confirmAddLibraryNow,
    courseWords,
    favorites,
    goHome,
    handleOnboardingComplete,
    handleToggleFavorite,
    isSearchOverlayOpen,
    playPhoneticSpeech,
    practiceMode,
    searchQuery,
    searchResults,
    searching,
    selectedWordDetail,
    setActiveTab,
    setActiveThemeId,
    setIsSearchOverlayOpen,
    setPracticeMode,
    setSearchQuery,
    setSelectedCourse,
    setSelectedWordDetail,
    setUserStats,
    setWordGroupRouteId,
    showOnboarding,
    toasts,
    trans,
  } = state;

  return (
    <>
      <WfNewSearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        searching={searching}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelectWord={(word) => {
          setSelectedWordDetail(word);
          setIsSearchOverlayOpen(false);
        }}
        onPlayAudio={playPhoneticSpeech}
        trans={trans}
        activeTheme={activeTheme}
        dark={dark}
      />

      <WfNewWordDetailModal
        word={selectedWordDetail}
        activeTheme={activeTheme}
        isFavorite={!!selectedWordDetail && favorites.some((favorite) => favorite.id === selectedWordDetail.id)}
        onClose={() => setSelectedWordDetail(null)}
        onToggleFavorite={handleToggleFavorite}
        onPlay={playPhoneticSpeech}
      />

      <WfNewConfirmAddLibraryModal
        open={!!addLibraryConfirm}
        groupTitle={addLibraryConfirm?.group.title ?? ''}
        loading={!!addLibraryConfirm?.loading}
        submitting={!!addLibraryConfirm?.submitting}
        preview={addLibraryConfirm?.preview ?? null}
        error={addLibraryConfirm?.error ?? null}
        onCancel={closeAddLibraryConfirm}
        onConfirm={confirmAddLibraryNow}
        trans={trans}
      />

      {activeTab !== 'daily-reading' && (
        <WfNewBottomDock
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'home') goHome();
            else setActiveTab(tab as WordNewTab);
            if (tab === 'shelf') setWordGroupRouteId(null);
            setSelectedCourse(null);
            setPracticeMode(null);
          }}
          trans={trans}
          activeTheme={activeTheme}
          dark={dark}
        />
      )}

      <AnimatePresence>
        {showOnboarding && (
          <WfNewOnboarding
            onComplete={handleOnboardingComplete}
            trans={trans}
            activeTheme={activeTheme}
            onSelectTheme={(themeId) => {
              setActiveThemeId(themeId);
              wfNewSettings.setField('themeId', themeId);
              void wfNewApi.updatePreferences({ app_settings: { themeId } }).catch(() => {});
            }}
            onSetGoal={(goal) => {
              setUserStats((previous) => ({ ...previous, dailyGoal: goal }));
              wfNewSettings.setField('dailyGoal', goal);
              void wfNewApi.updatePreferences({ daily_goal: goal }).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>

      <WfNewToast toasts={toasts} onDismiss={wfNewNotify.dismiss} />
    </>
  );
};
