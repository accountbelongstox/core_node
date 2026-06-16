/* [v4.1-Iris] Listening Player (immersive / fullscreen) — ported from
 * qy_capacitor/pages/Listening/Player.tsx. Self-contained: loads a group's words
 * via wordflowApi.getWordsForGroup(), then plays them in passive looping mode.
 * TTS narration goes through wfAudioCenter's Web Speech helper (speechSynthesis)
 * — if unavailable it simply auto-advances on a timer. No bottom chrome —
 * fullscreen player. Closes back to the learn home via wfPath(). API call is
 * try/caught with a LoadingState fallback; never crashes. Faithful Iris look. */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Captions, Headphones, Repeat } from 'lucide-react';
import { Icons, BackButton, IconButton, ProgressBar, LoadingState, EmptyState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfAudioCenter } from '../services/WfAudioCenter';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

// Fallback auto-advance interval when Web Speech TTS is unavailable.
const FALLBACK_ADVANCE_MS = 3500;

// [restored] Playback-speed steps (original player's speed control).
const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
// Base utterance rate at 1.0x (kept from the original narration tuning).
const BASE_TTS_RATE = 0.9;

const fmtTime = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const WfListeningPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [searchParams] = useSearchParams();
  const { activeGroupId } = useWfApp();
  // No placeholder 'g1' fallback — fall back to the resolved active group; an
  // empty id means "no active group" and we must NOT call
  // getWordsForGroup('g1') (backend has no such group → error).
  const groupId = searchParams.get('groupId') || searchParams.get('library') || activeGroupId || '';
  const language = searchParams.get('language') || 'en';

  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [groupName, setGroupName] = useState('');
  // [restored] Playback speed (applied to SpeechSynthesis rate / fallback timer).
  const [speed, setSpeed] = useState(1.0);
  // [restored] Subtitle / translation panel (simplified word-tap translation).
  const [showCaptions, setShowCaptions] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exit = () => navigate(wfPath('learn/home'));

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Load the group's words once on mount.
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
        if (!cancelled) setWords(Array.isArray(result) ? result : []);
        // Best-effort: resolve a friendly group name (degrades silently).
        try {
          const groups = await wordflowApi.getWordGroups();
          const match = Array.isArray(groups) ? groups.find((g) => g.id === groupId) : undefined;
          if (!cancelled && match) setGroupName(match.name);
        } catch { /* name is optional */ }
      } catch (err) {
        console.error('[WfListeningPlayer] Failed to load words:', err);
        if (!cancelled) setWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  const advance = () => {
    setCurrentIndex((prev) => (words.length === 0 ? 0 : (prev + 1) % words.length));
  };

  // Playback driver: speak the current word via wfAudioCenter (Web Speech API);
  // on end, advance. Falls back to a plain timer when speech is unavailable.
  useEffect(() => {
    clearTimer();
    if (!playing || words.length === 0) return;

    const word = words[currentIndex];

    // Speed-scaled timings: the TTS rate and the fallback timer both follow
    // the user-selected playback speed.
    const fallbackMs = FALLBACK_ADVANCE_MS / speed;

    // speak() cancels any in-flight utterance first and returns false when
    // speech is unavailable or throws — then we advance on the plain timer.
    const spoke = word?.text
      ? wfAudioCenter.speak(word.text, {
          lang: language,
          rate: BASE_TTS_RATE * speed,
          onEnd: () => {
            // Brief pause, then advance to the next word.
            timerRef.current = setTimeout(advance, 600 / speed);
          },
          onError: () => {
            timerRef.current = setTimeout(advance, fallbackMs);
          },
        })
      : false;
    if (!spoke) {
      timerRef.current = setTimeout(advance, fallbackMs);
    }

    return () => {
      clearTimer();
      wfAudioCenter.cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentIndex, words, language, speed]);

  // Stop any narration on unmount.
  useEffect(() => () => {
    clearTimer();
    wfAudioCenter.cancelSpeech();
  }, []);

  const togglePlay = () => setPlaying((p) => !p);

  const handleRewind = () => {
    setCurrentIndex((prev) => (words.length === 0 ? 0 : (prev - 1 + words.length) % words.length));
  };

  // [restored] Cycle through the playback-speed steps (0.75 → 1.0 → … → 2.0).
  const cycleSpeed = () => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  };

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center">
        <LoadingState label={t('listening.loading') || 'Preparing your listening session…'} />
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8">
        <EmptyState
          icon={<Headphones className="w-10 h-10" />}
          title={groupId ? (t('listening.empty') || 'Nothing to play') : (t('library.noGroups') || 'No groups yet')}
          description={
            groupId
              ? (t('listening.emptyHint') || 'This library has no words yet. Pick another material to begin.')
              : (t('library.noGroupsHint') || 'Import or pick a word group to start listening.')
          }
        />
        <button onClick={exit} className="mt-6 text-sm font-bold text-[var(--klein-blue)]">
          {t('common.back') || 'Back'}
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const pct = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 gap-3">
        <BackButton onClick={exit} />
        <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-secondary)]">
          {t('listening.passiveMode') || 'Passive Mode'}
        </span>
        <div className="flex items-center gap-1">
          {/* [restored] Subtitle / translation panel toggle */}
          <IconButton
            icon={<Captions className="w-5 h-5" />}
            label={t('listening.captions') || 'Captions'}
            active={showCaptions}
            onClick={() => setShowCaptions((v) => !v)}
          />
          <IconButton icon={<Icons.Settings />} label="Settings" disabled />
        </div>
      </div>

      {/* Cover Art / now-playing word */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div
          className={`w-64 h-64 max-w-[80vw] aspect-square rounded-[var(--radius-card)] flex items-center justify-center text-[var(--klein-on)] mb-10 ${playing ? 'animate-pulse-slow' : ''}`}
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <Headphones className="w-24 h-24" />
        </div>

        {/* [restored] Tapping the word toggles the translation panel (simplified
            version of the original word-tap translation). */}
        <h2
          onClick={() => setShowCaptions((v) => !v)}
          className="text-2xl font-bold text-[var(--color-text-primary)] mb-2 truncate max-w-full cursor-pointer"
        >
          {currentWord.text}
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          {groupName || (t('listening.looping') || 'Looping')} • {words.length} {t('listening.words') || 'words'}
        </p>
        {currentWord.translation && (
          <p className="text-[var(--klein-blue)] font-medium mt-2">{currentWord.translation}</p>
        )}

        {/* [restored] Subtitle / translation panel — current word's meaning from
            the existing word fields (definition falls back to translation). */}
        {showCaptions && (
          <div className="ds-glass ds-glass-edge rounded-[var(--radius-card)] px-5 py-4 mt-6 max-w-full text-left">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--color-text-tertiary)] mb-2">
              {t('listening.captions') || 'Captions'}
            </p>
            {currentWord.phonetic && (
              <p className="font-mono text-xs text-[var(--color-text-tertiary)] mb-1">{currentWord.phonetic}</p>
            )}
            <p className="text-sm text-[var(--color-text-primary)]">
              {currentWord.definition || currentWord.translation || (t('listening.noTranslation') || 'No translation available')}
            </p>
            {currentWord.example && (
              <p className="text-xs text-[var(--color-text-secondary)] italic mt-2">"{currentWord.example}"</p>
            )}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mb-10">
        <ProgressBar value={pct} className="mb-2" />
        <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] font-bold">
          <span>{fmtTime(currentIndex + 1)}</span>
          <span>{fmtTime(words.length)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pb-8">
        <button
          aria-label="Loop"
          className="ds-touch-target flex items-center justify-center text-[var(--klein-blue)] transition-colors"
          title={t('listening.loop') || 'Loop'}
        >
          <Repeat className="w-6 h-6" />
        </button>
        <button
          onClick={handleRewind}
          aria-label="Previous"
          className="ds-touch-target flex items-center justify-center text-[var(--color-text-primary)] hover:scale-110 transition-transform"
        >
          <Icons.Rewind />
        </button>

        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-20 h-20 text-[var(--klein-on)] rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          {playing ? <Icons.Pause /> : <Icons.Play />}
        </button>

        <button
          onClick={advance}
          aria-label="Next"
          className="ds-touch-target flex items-center justify-center text-[var(--color-text-primary)] hover:scale-110 transition-transform"
        >
          <Icons.ChevronRight />
        </button>
        {/* [restored] Playback-speed control (0.75 / 1.0 / 1.25 / 1.5 / 2.0) */}
        <button
          onClick={cycleSpeed}
          aria-label={t('listening.speed') || 'Playback speed'}
          title={t('listening.speed') || 'Playback speed'}
          className={`ds-touch-target flex items-center justify-center font-bold text-xs transition-colors ${
            speed !== 1.0 ? 'text-[var(--klein-blue)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--klein-blue)]'
          }`}
        >
          {speed % 1 === 0 ? speed.toFixed(1) : String(speed)}x
        </button>
      </div>
    </div>
  );
};

export default WfListeningPlayerPage;
