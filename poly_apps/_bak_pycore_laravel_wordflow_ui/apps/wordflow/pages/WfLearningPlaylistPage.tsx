/* [v4.1-Iris] Playlist — ported from poly_apps/qy_capacitor/pages/Learning/Playlist.tsx.
 * Self-contained sequential auto-player: pulls words for the active group via
 * wordflowApi.getWordsForGroup (try/caught, degrades to empty state), reads the
 * persisted player config from StorageCenter.settings, and drives a paged
 * auto-advance engine. react-router useNavigate + wfPath() for all nav. Faithful
 * Iris look (centered floating-island controls, gradient play hero). */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { Icons, ProgressBar, IconButton, LoadingState, EmptyState, Button } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter } from '../../../core/api-libs/wordflow/WordflowStorage';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

/** Player config shape (mirrors the original AppContext.playlistSettings). */
interface PlaylistSettings {
  wordsPerPage: number;
  playbackSpeed: number;
  playInterval: number;
  reviewModeEnabled: boolean;
  autoScroll: boolean;
  showAnimation: boolean;
  displayMode: 'simple' | 'detailed';
  largeFont: boolean;
  dailyGoal: number;
}

const DEFAULT_SETTINGS: PlaylistSettings = {
  wordsPerPage: 20,
  playbackSpeed: 1,
  playInterval: 3,
  reviewModeEnabled: false,
  autoScroll: true,
  showAnimation: true,
  displayMode: 'detailed',
  largeFont: false,
  dailyGoal: 200,
};

const WfLearningPlaylistPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeGroupId, learningLanguage, t } = useWfApp();

  const [settings, setSettings] = useState<PlaylistSettings>(DEFAULT_SETTINGS);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageWords, setPageWords] = useState<Word[]>([]);

  // Player state
  const [localIndex, setLocalIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Per-entry remove state (real backend deletion).
  const [removingWordId, setRemovingWordId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Refs to avoid stale closures inside the interval.
  const playerStateRef = useRef({ localIndex: 0, isPlaying: true, isReviewing: false });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playerStateRef.current.localIndex = localIndex;
    playerStateRef.current.isPlaying = isPlaying;
    playerStateRef.current.isReviewing = isReviewMode;
  }, [localIndex, isPlaying, isReviewMode]);

  // Load persisted player config (graceful default).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await StorageCenter.settings.get();
        if (!cancelled && stored?.playlist) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored.playlist });
        }
      } catch (e) {
        console.error('[WfPlaylist] failed to load settings:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load words for the active group.
  useEffect(() => {
    let cancelled = false;
    // No active group → show the empty state, never call getWordsForGroup('').
    if (!activeGroupId) {
      setAllWords([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    (async () => {
      try {
        const words = await wordflowApi.getWordsForGroup(activeGroupId);
        if (!cancelled) setAllWords(Array.isArray(words) ? words : []);
      } catch (e) {
        console.error('[WfPlaylist] failed to load words:', e);
        if (!cancelled) setAllWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeGroupId, learningLanguage]);

  // Slice the current page.
  useEffect(() => {
    const start = currentPageIndex * settings.wordsPerPage;
    const end = start + settings.wordsPerPage;
    setPageWords(Array.isArray(allWords) ? allWords.slice(start, end) : []);
    setLocalIndex(0);
    setIsReviewMode(false);
  }, [allWords, currentPageIndex, settings.wordsPerPage]);

  const scrollToItem = (index: number) => {
    if (listRef.current && settings.autoScroll) {
      const item = listRef.current.children[index] as HTMLElement | undefined;
      item?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Auto-advance engine.
  useEffect(() => {
    if (!isPlaying || pageWords.length === 0) return;
    const intervalMs = (settings.playInterval * 1000) / Math.max(settings.playbackSpeed, 0.25);

    const tick = () => {
      const state = playerStateRef.current;
      if (!state.isPlaying || pageWords.length === 0) return;
      const nextIndex = state.localIndex + 1;

      if (nextIndex >= pageWords.length) {
        // Page finished.
        if (settings.reviewModeEnabled && !state.isReviewing) {
          setIsReviewMode(true);
          setLocalIndex(0);
          scrollToItem(0);
          return;
        }
        if ((currentPageIndex + 1) * settings.wordsPerPage < allWords.length) {
          setCurrentPageIndex((p) => p + 1);
          setIsReviewMode(false);
        } else {
          setIsPlaying(false); // End of all words.
        }
        return;
      }
      setLocalIndex(nextIndex);
      scrollToItem(nextIndex);
    };

    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, pageWords, settings, currentPageIndex, allWords.length]);

  const handleManualClick = (index: number) => {
    setLocalIndex(index);
    scrollToItem(index);
    setIsPlaying(true);
  };

  // Per-entry remove action — real backend deletion via
  // POST /group/remove_word ({ gid: activeGroupId, word_id }). Only drops the
  // entry from the local list after the backend confirms; on failure the list
  // is left untouched and an inline error notice is shown.
  const handleRemoveWord = async (wordId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Don't select/play the row being removed.
    if (removingWordId) return; // One in-flight removal at a time.
    setRemovingWordId(wordId);
    setRemoveError(null);
    try {
      // Backend validates word_id as integer — send a number when possible.
      const numericId = Number(wordId);
      await wordflowApi.removeWordFromGroup({
        gid: activeGroupId,
        word_id: Number.isFinite(numericId) ? numericId : wordId,
      });
      setAllWords((prev) => prev.filter((w) => w.id !== wordId));
    } catch (e) {
      console.error('[WfPlaylist] failed to remove word:', e);
      setRemoveError(t('playlist.removeWordFailed') || 'Failed to remove word');
    } finally {
      setRemovingWordId(null);
    }
  };

  const nextPage = () => {
    if ((currentPageIndex + 1) * settings.wordsPerPage < allWords.length) {
      setCurrentPageIndex((p) => p + 1);
    }
  };
  const prevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex((p) => p - 1);
  };

  const dailyProgress = user?.dailyProgress ?? 0;
  const progressPercent = Math.min(100, Math.round((dailyProgress / Math.max(settings.dailyGoal, 1)) * 100));

  return (
    <div className="h-full flex flex-col animate-slide-up relative overflow-hidden">
      {/* Header — stats + settings */}
      <div className="px-5 py-3 flex justify-between items-center ds-z-sticky backdrop-blur-md bg-[var(--color-surface)]/80 sticky top-0 border-b border-[var(--border-highlight)]">
        <IconButton icon={<Icons.Back />} onClick={() => navigate(wfPath('home'))} label="Back" />
        <div className="flex flex-col items-center min-w-0 px-3">
          <h1 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            {dailyProgress} / {settings.dailyGoal}
            <span className="text-[var(--color-text-tertiary)] text-[10px] font-normal">({allWords.length} total)</span>
          </h1>
          <ProgressBar value={progressPercent} className="w-32 mt-1.5 !h-1" />
        </div>
        <IconButton icon={<Icons.Settings />} onClick={() => navigate(wfPath('playlist_config'))} label="Playlist settings" />
      </div>

      {/* Info bar */}
      <div className="px-5 py-2.5 bg-[var(--klein-blue-soft)] flex justify-between items-center text-[10px] font-bold text-[var(--klein-blue)] uppercase tracking-widest border-b border-[var(--border-highlight)]">
        <span>Page {currentPageIndex + 1}</span>
        <span>{isReviewMode ? 'Review Mode' : 'Learning Mode'}</span>
        <span>{settings.playbackSpeed}x • {settings.playInterval}s</span>
      </div>

      {/* Remove-word failure notice */}
      {removeError && (
        <div
          role="alert"
          className="px-5 py-2 bg-red-500/10 text-red-500 text-xs font-semibold flex justify-between items-center border-b border-red-500/20"
        >
          <span>{removeError}</span>
          <button
            onClick={() => setRemoveError(null)}
            aria-label={t('common.close') || 'Close'}
            className="font-bold px-2"
          >
            ×
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Loading words…" />
        </div>
      ) : pageWords.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <EmptyState
            icon={<Icons.Book />}
            title={activeGroupId ? 'No words to play' : (t('library.noGroups') || 'No groups yet')}
            description={
              activeGroupId
                ? 'This group has no words yet. Add words to your active group to start a sequential session.'
                : (t('library.noGroupsHint') || 'Import or pick a word group to start a session.')
            }
            action={<Button variant="klein" onClick={() => navigate(wfPath('learn/library'))}>Browse library</Button>}
          />
        </div>
      ) : (
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-48 space-y-3">
          {pageWords.map((word, i) => {
            const isActive = i === localIndex;
            const isDetailed = settings.displayMode === 'detailed';
            return (
              <div
                key={`${word.id}-${i}`}
                onClick={() => handleManualClick(i)}
                className={`ds-row relative p-4 transition-all duration-300 cursor-pointer ${
                  isActive ? `z-10 scale-[1.02] ${settings.showAnimation ? 'animate-pulse-slow' : ''}` : 'opacity-90 hover:opacity-100'
                }`}
                style={isActive ? { borderColor: 'var(--klein-blue)', boxShadow: `0 0 0 2px var(--klein-ring), var(--klein-glow)` } : undefined}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold transition-all truncate ${isActive ? 'text-[color:var(--klein-blue)]' : 'text-[var(--color-text-primary)]'} ${settings.largeFont ? 'text-2xl' : 'text-lg'}`}>
                      {word.text}
                    </h3>
                    {isDetailed && word.phonetic && (
                      <p className={`font-mono text-xs mt-1 ${isActive ? 'text-[color:var(--klein-blue)] opacity-70' : 'text-[var(--color-text-tertiary)]'}`}>{word.phonetic}</p>
                    )}
                  </div>
                  {(isDetailed || isActive) && word.translation && (
                    <div className={`text-right max-w-[50%] min-w-0 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                      <p className={`font-bold leading-tight truncate ${settings.largeFont ? 'text-lg' : 'text-sm'} text-[var(--color-text-primary)]`}>{word.translation}</p>
                    </div>
                  )}
                  {/* Right-side remove icon (backend removal — see handleRemoveWord) */}
                  <button
                    onClick={(e) => handleRemoveWord(word.id, e)}
                    disabled={removingWordId !== null}
                    title={t('playlist.removeWord') || 'Remove from playlist'}
                    aria-label={t('playlist.removeWord') || 'Remove from playlist'}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {removingWordId === word.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isActive && isDetailed && word.example && (
                  <div className="mt-3 pt-3 border-t border-dashed border-[var(--border-highlight)]">
                    <p className="text-[var(--color-text-secondary)] text-xs italic">"{word.example}"</p>
                  </div>
                )}
              </div>
            );
          })}
          <div className="h-10 text-center text-xs text-[var(--color-text-tertiary)] uppercase font-bold tracking-widest pt-4">
            End of Page {currentPageIndex + 1}
          </div>
        </div>
      )}

      {/* Floating-island controls */}
      {!loading && pageWords.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 ds-z-sticky px-4 pb-[calc(env(safe-area-inset-bottom,12px)+14px)]">
          <div className="ds-bar-pill mx-auto !static !translate-x-0 !w-full max-w-[430px] px-4 py-3">
            <ProgressBar value={localIndex + 1} max={pageWords.length} className="!h-1 mb-3" />
            <div className="flex items-center justify-between">
              <button onClick={prevPage} disabled={currentPageIndex === 0} aria-label="Previous page" className="ds-touch-target flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] disabled:opacity-30 transition-colors">
                <Icons.Rewind />
              </button>
              <button onClick={() => setLocalIndex((i) => Math.max(0, i - 1))} aria-label="Previous word" className="ds-touch-target flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-16 h-16 text-[color:var(--klein-on)] rounded-full flex items-center justify-center active:scale-95 transition-transform -translate-y-3"
                style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>
              <button onClick={() => setLocalIndex((i) => Math.min(pageWords.length - 1, i + 1))} aria-label="Next word" className="ds-touch-target flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                <SkipForward className="w-6 h-6" />
              </button>
              <button onClick={nextPage} aria-label="Next page" className="ds-touch-target flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                <Icons.ChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WfLearningPlaylistPage;
