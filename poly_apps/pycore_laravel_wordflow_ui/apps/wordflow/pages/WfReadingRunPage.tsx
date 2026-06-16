/* [v4.1-Iris] Reading Run (immersive / fullscreen) — ported from
 * qy_capacitor/pages/Reading/Run.tsx. Self-contained: loads a group's words via
 * wordflowApi.getWordsForGroup(), then flows word-by-word with an auto-play timer
 * and an instant-review rewind. No bottom chrome — fullscreen runner. Closes /
 * finishes back to the learn home via wfPath(). API call is try/caught with a
 * LoadingState fallback. Faithful Iris look. */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Icons, IconButton, LoadingState, EmptyState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfReadingProgressCenter } from '../services/WfReadingProgressCenter';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

// Display + playback defaults (the original sourced these from app settings;
// here we keep faithful, sensible defaults so the runner is self-contained).
const SHOW_PHONETIC = true;
const SHOW_TRANSLATION = true;
const AUTO_ADVANCE_MS = 3000;

const WfReadingRunPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [searchParams] = useSearchParams();
  // No placeholder 'g1' fallback — an empty id means "no active group" and we
  // must NOT call getWordsForGroup('g1') (backend has no such group → error).
  const groupId = searchParams.get('groupId') || searchParams.get('library') || '';

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const [loading, setLoading] = useState(true);

  const historyRef = useRef<number[]>([]);

  const exit = () => navigate(wfPath('learn'));

  // Reading-progress persistence key — per group, 'default' when none.
  const progressKey = groupId || 'default';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // No active group → show the empty state, don't hit the API.
      if (!groupId) {
        if (!cancelled) {
          setWords([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const result = await wordflowApi.getWordsForGroup(groupId);
        const list = Array.isArray(result) ? result : [];
        // Restore the last reading position before rendering, so the save
        // effect below never clobbers the stored index with 0.
        let startIndex = 0;
        try {
          const saved = await wfReadingProgressCenter.get(progressKey);
          if (saved && saved.index > 0 && saved.index < list.length) startIndex = saved.index;
        } catch { /* start from the beginning */ }
        if (!cancelled) {
          setWords(list);
          if (startIndex > 0) setCurrentIndex(startIndex);
        }
      } catch (error) {
        console.error('[WfReadingRun] Failed to load words:', error);
        if (!cancelled) setWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Persist the reading position whenever it changes (fire-and-forget).
  useEffect(() => {
    if (words.length === 0) return;
    wfReadingProgressCenter
      .set(progressKey, { index: currentIndex, total: words.length })
      .catch((e) => console.error('[WfReadingRun] Failed to save progress:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, words.length]);

  const handleNext = () => {
    historyRef.current.push(currentIndex);
    if (historyRef.current.length > 10) historyRef.current.shift();

    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
      exit();
    }
  };

  // Auto-advance timer.
  useEffect(() => {
    if (!isPlaying || words.length === 0) return;
    const interval = setInterval(handleNext, AUTO_ADVANCE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentIndex, words]);

  const handleInstantReview = () => {
    setIsPlaying(false);
    const prev = historyRef.current.pop();
    if (prev !== undefined) setCurrentIndex(prev);
    else if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const currentWord = words[currentIndex];

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center">
        <LoadingState label="Preparing your reading session…" />
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8">
        <EmptyState
          icon={<Icons.Book />}
          title={groupId ? 'No words to read' : (t('library.noGroups') || 'No groups yet')}
          description={
            groupId
              ? 'This library has no words yet. Pick another material to begin.'
              : (t('library.noGroupsHint') || 'Import or pick a word group to start reading.')
          }
        />
        <button
          onClick={exit}
          className="mt-6 text-sm font-bold text-[var(--klein-blue)]"
        >
          {t('reading.next') || 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-safe relative overflow-hidden">
      {/* Top bar */}
      <div className="relative z-10 flex justify-between items-center mb-10 gap-3">
        <div className="px-4 py-1.5 rounded-full ds-glass ds-glass-edge text-xs font-bold text-[var(--color-text-secondary)]">
          {currentIndex + 1} <span className="text-[var(--color-text-tertiary)] mx-1">/</span> {words.length}
        </div>
        <div className="flex gap-2">
          <IconButton
            icon={<Eye className="w-5 h-5" />}
            label="Toggle detail"
            active={showDetail}
            onClick={() => setShowDetail(!showDetail)}
          />
          <IconButton icon={<Icons.Close />} label="Close" onClick={exit} />
        </div>
      </div>

      {/* Word card */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-float">
        <div className="relative">
          <h1 className="text-6xl font-black text-[var(--color-text-primary)] tracking-tighter mb-5 transition-all duration-300">
            {currentWord.text}
          </h1>
          {SHOW_PHONETIC && currentWord.phonetic && (
            <div className="inline-block px-5 py-2 rounded-2xl ds-glass ds-glass-edge text-[var(--klein-blue)] font-mono text-lg">
              {currentWord.phonetic}
            </div>
          )}
        </div>

        <div className={`transition-all duration-700 ease-out transform ${showDetail ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          {SHOW_TRANSLATION && currentWord.translation && (
            <div className="text-3xl font-bold text-[var(--color-text-secondary)] mb-10 tracking-tight">
              {currentWord.translation}
            </div>
          )}

          {currentWord.example && (
            <div className="ds-card p-8 rounded-[var(--radius-card)] max-w-xs mx-auto">
              <p className="text-[var(--color-text-primary)] text-lg leading-relaxed italic">
                &quot;{currentWord.example}&quot;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 h-32 flex items-center justify-center gap-8 pb-4">
        <button onClick={handleInstantReview} className="flex flex-col items-center gap-3 group">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg group-active:scale-90 transition-all hover:bg-amber-500/25">
            <Icons.Rewind />
          </div>
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest group-hover:text-amber-500 transition-colors">
            Review
          </span>
        </button>

        <button onClick={() => setIsPlaying(!isPlaying)} className="transform transition-transform active:scale-95 group">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isPlaying ? 'ds-glass ds-glass-edge text-[var(--color-text-secondary)]' : 'text-[var(--klein-on)] hover:scale-105'}`}
            style={isPlaying ? undefined : { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            {isPlaying ? <Icons.Pause /> : <Icons.Play />}
          </div>
        </button>

        <button onClick={handleNext} className="flex flex-col items-center gap-3 group">
          <div className="w-16 h-16 rounded-full ds-glass ds-glass-edge flex items-center justify-center text-[var(--color-text-primary)] shadow-lg group-active:scale-90 transition-all">
            <Icons.ChevronRight />
          </div>
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest group-hover:text-[var(--klein-blue)] transition-colors">
            Next
          </span>
        </button>
      </div>
    </div>
  );
};

export default WfReadingRunPage;
