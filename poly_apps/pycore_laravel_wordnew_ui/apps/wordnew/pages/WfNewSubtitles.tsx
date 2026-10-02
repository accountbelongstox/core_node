import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Pause, Languages, SkipBack, SkipForward,
  Repeat, Settings2, Film
} from 'lucide-react';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { WfNewSubtitleSources } from '../components/subtitles/WfNewSubtitleSources';
import { WfNewSubtitleLineList, pickSubtitleTranslation } from '../components/subtitles/WfNewSubtitleLineList';
import { WfNewSubtitleLookupCard } from '../components/subtitles/WfNewSubtitleLookupCard';
import { WfNewSubtitleWordStats } from '../components/subtitles/WfNewSubtitleWordStats';
import type { ElementTheme } from '../WfNewThemes';
import type { Word } from '../api/WfNewApiTypes';
import {
  wfNewApi,
  type WfNewContentGroup,
  type WfNewSubtitleDetail,
  type WfNewSubtitleSegment,
  type WfNewSubtitleSentence,
  type WfNewDictWord,
} from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { resolveAudioSync } from '../runtime-store/WfNewAudioCache';
import { wordNewQueueCenter } from '../services/WordNewQueueCenter';
import { formatClock } from '../../../core/utils/formatters';
import { cancelSpeech, speakText } from '../utils/WordNewSpeech';
import { SUBTITLE_DETAIL_PAGE_SIZE, SUBTITLE_GROUPS_PAGE_SIZE } from '../constants/uiTiming';

interface WfNewSubtitlesProps {
  activeTheme: ElementTheme;
  favorites: Word[];
  onToggleFavorite: (word: Word) => void;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  /** Subtitle pre-selected from the home hub (optional). */
  sourceKey?: string;
  /** Open the dedicated subtitle Playback Settings sub-page. */
  onOpenPlaybackSettings: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0].map((sp) => ({ value: sp, label: `${sp}x` }));
const STRIP_PUNCT = /[.,/#!$%^&*;:{}=\-_`~()"'?]/g;

export const WfNewSubtitles: React.FC<WfNewSubtitlesProps> = ({
  activeTheme,
  favorites,
  onToggleFavorite,
  addToast,
  sourceKey,
  onOpenPlaybackSettings,
  trans,
}) => {
  // ---- Sidebar A: all subtitle sources --------------------------------------
  const [groups, setGroups] = useState<WfNewContentGroup[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [detail, setDetail] = useState<WfNewSubtitleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // ---- Player state ---------------------------------------------------------
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  // Index into the playable-segment playlist (segments with a non-null mp3Url).
  const [playlistPos, setPlaylistPos] = useState<number>(0);
  // The segment index currently considered "active" (matches the playing line).
  const [activeSegIndex, setActiveSegIndex] = useState<number | null>(null);

  // ---- Playback prefs (read from the shared store, reactively) --------------
  const [speed, setSpeed] = useState<number>(() => wfNewSettings.get('subtitlePlaybackSpeed'));
  const [loopLine, setLoopLine] = useState<boolean>(() => wfNewSettings.get('subtitleLoopLine'));
  const [showTranslation, setShowTranslation] = useState<boolean>(() => wfNewSettings.get('subtitleShowTranslation'));
  const [autoNext, setAutoNext] = useState<boolean>(() => wfNewSettings.get('subtitleAutoNext'));

  useEffect(() => {
    return wfNewSettings.subscribe(() => {
      setSpeed(wfNewSettings.get('subtitlePlaybackSpeed'));
      setLoopLine(wfNewSettings.get('subtitleLoopLine'));
      setShowTranslation(wfNewSettings.get('subtitleShowTranslation'));
      setAutoNext(wfNewSettings.get('subtitleAutoNext'));
    });
  }, []);

  // ---- Word lookup card -----------------------------------------------------
  const [selectedLookupWord, setSelectedLookupWord] = useState<{
    text: string;
    translation: string;
    phonetic: string;
  } | null>(null);

  // ---- Word stats sidebar (Sidebar B) ---------------------------------------
  const [words, setWords] = useState<WfNewDictWord[]>([]);
  const [wordTotal, setWordTotal] = useState<number>(0);
  const [wordStart, setWordStart] = useState<number>(0);
  const [wordLoading, setWordLoading] = useState<boolean>(false);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);

  const subtitleListRef = useRef<HTMLDivElement | null>(null);

  // ---- Derived playlist (sequential, segIndex order, mp3Url only) -----------
  const playlist = useMemo<WfNewSubtitleSegment[]>(() => {
    if (!detail) return [];
    return [...detail.segments]
      .filter((seg) => !!seg.mp3Url)
      .sort((a, b) => a.segIndex - b.segIndex);
  }, [detail]);

  const hasAudioClips = playlist.length > 0;

  // All segments in order (for time-based matching / line jumps).
  const orderedSegments = useMemo<WfNewSubtitleSegment[]>(() => {
    if (!detail) return [];
    return [...detail.segments].sort((a, b) => a.segIndex - b.segIndex);
  }, [detail]);

  const sentences = detail?.sentences.items ?? [];

  // ---- Active line resolution ----------------------------------------------
  // Match the playing segment's segIndex first; else by currentTime window.
  const activeLineIndex = useMemo(() => {
    if (sentences.length === 0) return -1;
    if (activeSegIndex !== null) {
      const bySeg = sentences.findIndex((s) => s.segIndex === activeSegIndex);
      if (bySeg !== -1) return bySeg;
    }
    const byTime = sentences.findIndex(
      (s) => s.startSec != null && s.endSec != null && currentTime >= s.startSec && currentTime <= s.endSec,
    );
    return byTime;
  }, [sentences, activeSegIndex, currentTime]);

  const activeLine = activeLineIndex !== -1 ? sentences[activeLineIndex] : undefined;

  // ---- Load all subtitle sources -------------------------------------------
  useEffect(() => {
    let alive = true;
    wfNewApi.getSubtitleGroups(1, SUBTITLE_GROUPS_PAGE_SIZE)
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setGroups(list);
        // Pre-select: prop sourceKey > first source.
        const initial = (sourceKey && list.some((g) => g.sourceKey === sourceKey))
          ? sourceKey
          : (list[0]?.sourceKey || '');
        if (initial) setActiveSource((cur) => cur || initial);
      })
      .catch(() => { /* leave empty on failure */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to a sourceKey arriving from home after the list already loaded.
  useEffect(() => {
    if (sourceKey && groups.some((g) => g.sourceKey === sourceKey)) {
      setActiveSource(sourceKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // ---- Load the active source's detail --------------------------------------
  useEffect(() => {
    if (!activeSource) return;
    let alive = true;
    setLoadingDetail(true);
    setDetail(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaylistPos(0);
    setActiveSegIndex(null);
    if (audioRef.current) { audioRef.current.pause(); }
    cancelSpeech();
    wfNewApi.getSubtitleDetail(activeSource, { perPage: SUBTITLE_DETAIL_PAGE_SIZE })
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [activeSource]);

  // ---- speechSynthesis fallback (no mp3 clips) ------------------------------
  const speakLine = useCallback((text: string, onEnd?: () => void) => {
    if (!speakText(text, { lang: 'en', rate: speed, onEnd })) addToast(trans('subtitles.ttsUnavailable'), 'warning');
  }, [speed, addToast, trans]);

  // Speak a single word for the lookup card.
  const speakWord = useCallback((text: string) => {
    if (!speakText(text, { lang: 'en', rate: 1.0 })) addToast(trans('subtitles.ttsUnavailable'), 'warning');
  }, [addToast, trans]);

  // ---- Core playback: play a segment by playlist position -------------------
  const playPlaylistPos = useCallback((pos: number) => {
    if (!detail) return;
    if (hasAudioClips) {
      if (pos < 0 || pos >= playlist.length) { setIsPlaying(false); return; }
      const seg = playlist[pos];
      setPlaylistPos(pos);
      setActiveSegIndex(seg.segIndex);
      const el = audioRef.current;
      if (el && seg.mp3Url) {
        el.src = resolveAudioSync(seg.mp3Url) ?? seg.mp3Url;
        el.playbackRate = speed;
        el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else {
      // speechSynthesis fallback over the ordered sentence list.
      if (pos < 0 || pos >= sentences.length) { setIsPlaying(false); return; }
      const line = sentences[pos];
      setPlaylistPos(pos);
      setActiveSegIndex(line.segIndex ?? null);
      setIsPlaying(true);
      const text = line.text || '';
      speakLine(text, () => {
        if (loopLine) { playPlaylistPos(pos); return; }
        if (autoNext) { playPlaylistPos(pos + 1); } else { setIsPlaying(false); }
      });
    }
  }, [detail, hasAudioClips, playlist, sentences, speed, speakLine, loopLine, autoNext]);

  // Length of the active "playlist" — segments with audio, else sentences.
  const playableCount = hasAudioClips ? playlist.length : sentences.length;

  // ---- audio element wiring -------------------------------------------------
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed, playlistPos]);

  const handleAudioEnded = useCallback(() => {
    if (loopLine) { playPlaylistPos(playlistPos); return; }
    if (autoNext) { playPlaylistPos(playlistPos + 1); } else { setIsPlaying(false); }
  }, [loopLine, autoNext, playlistPos, playPlaylistPos]);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    // Offset the clip-local time by the active segment's start so the line
    // window matching still lines up with absolute sentence timestamps.
    const seg = hasAudioClips ? playlist[playlistPos] : undefined;
    setCurrentTime((seg?.startSec ?? 0) + el.currentTime);
  }, [hasAudioClips, playlist, playlistPos]);

  // ---- Transport controls ---------------------------------------------------
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (hasAudioClips) { audioRef.current?.pause(); } else { cancelSpeech(); }
    } else {
      if (hasAudioClips) {
        const el = audioRef.current;
        if (el && el.src) { el.playbackRate = speed; el.play().then(() => setIsPlaying(true)).catch(() => {}); }
        else { playPlaylistPos(playlistPos); }
      } else {
        playPlaylistPos(playlistPos);
      }
    }
  };

  const prevLine = () => playPlaylistPos(Math.max(0, playlistPos - 1));
  const nextLine = () => playPlaylistPos(Math.min(playableCount - 1, playlistPos + 1));

  // Start playback for a chosen source (Sidebar A Play button).
  const startSource = (key: string) => {
    if (key === activeSource) {
      // Already loaded — restart from the top.
      playPlaylistPos(0);
    } else {
      setActiveSource(key);
    }
  };

  // Jump to a specific line (click in the line list) → play its segment.
  const jumpToLine = (idx: number) => {
    const line = sentences[idx];
    if (!line) return;
    if (hasAudioClips && line.segIndex != null) {
      const pos = playlist.findIndex((seg) => seg.segIndex === line.segIndex);
      if (pos !== -1) { playPlaylistPos(pos); return; }
    }
    // Fallback: speech-synthesis playlist is sentence-indexed.
    if (!hasAudioClips) { playPlaylistPos(idx); return; }
    // Audio clips exist but this line has no clip — just highlight it.
    setActiveSegIndex(line.segIndex ?? null);
  };

  // Auto-scroll the line list to the active line.
  useEffect(() => {
    if (activeLineIndex !== -1 && subtitleListRef.current) {
      const el = document.getElementById(`wfsub-line-${activeLineIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeLineIndex]);

  // Apply speed live to the audio element when the setting changes.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // ---- Word lookup ----------------------------------------------------------
  const handleWordClick = (raw: string) => {
    const stripped = raw.replace(STRIP_PUNCT, '');
    if (!stripped) return;
    setSelectedLookupWord({ text: stripped, translation: trans('subtitles.fuzzyTracking'), phonetic: '/word/' });
    speakWord(stripped);
  };

  const handleAddLookupToFavorites = () => {
    if (!selectedLookupWord) return;
    const dup = favorites.some((f) => f.text.toLowerCase() === selectedLookupWord.text.toLowerCase());
    if (dup) { addToast(trans('subtitles.alreadyFav', { word: selectedLookupWord.text }), 'info'); return; }
    const w: Word = {
      id: `fav-sub-${Date.now()}`,
      text: selectedLookupWord.text,
      phonetic: selectedLookupWord.phonetic || '/lookup/',
      translation: selectedLookupWord.translation,
      definition: trans('subtitles.lookupDef'),
      example: trans('subtitles.lookupEx'),
      tags: [trans('subtitles.tagSubtitle')],
    };
    onToggleFavorite(w);
  };

  // ---- Word stats pagination ------------------------------------------------
  const loadWords = useCallback((start: number) => {
    setWordLoading(true);
    const language = wfNewSettings.get('wordListLanguage');
    const limit = wfNewSettings.get('wordListPageSize');
    wfNewApi.getDictionaryWords({ language, start, limit })
      .then((page) => {
        setWords(Array.isArray(page.words) ? page.words : []);
        setWordTotal(page.total || 0);
        setWordStart(page.start ?? start);
      })
      .catch(() => { setWords([]); setWordTotal(0); })
      .finally(() => setWordLoading(false));
  }, []);

  useEffect(() => { loadWords(0); }, [loadWords]);
  // Reload page 1 ONLY when the word-list language / page size actually changes
  // (the store fires for every setting; guard so playback toggles don't reload).
  useEffect(() => {
    let lastLang = wfNewSettings.get('wordListLanguage');
    let lastSize = wfNewSettings.get('wordListPageSize');
    return wfNewSettings.subscribe(() => {
      const lang = wfNewSettings.get('wordListLanguage');
      const size = wfNewSettings.get('wordListPageSize');
      if (lang !== lastLang || size !== lastSize) {
        lastLang = lang;
        lastSize = size;
        loadWords(0);
      }
    });
  }, [loadWords]);

  const wordPageSize = wfNewSettings.get('wordListPageSize');

  const playWordAudio = (w: WfNewDictWord) => {
    const language = wfNewSettings.get('wordListLanguage') || 'en';
    if (w.audioUrl) {
      const el = wordAudioRef.current;
      if (el) {
        el.src = resolveAudioSync(w.audioUrl) ?? w.audioUrl;
        el.play().catch(() => {
          wordNewQueueCenter.notifyMissingWord(w.content, language);
          speakWord(w.content);
        });
        return;
      }
    }
    wordNewQueueCenter.notifyMissingWord(w.content, language);
    speakWord(w.content);
  };

  const activeGroup = groups.find((g) => g.sourceKey === activeSource);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-2">
      {/* Hidden media elements */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />
      <audio ref={wordAudioRef} className="hidden" />

      <WfNewSubtitleSources
        groups={groups}
        activeSource={activeSource}
        activeTheme={activeTheme}
        trans={trans}
        onSelect={setActiveSource}
        onPlay={startSource}
      />

      {/* ===== MAIN PLAYER ===== */}
      <div className="lg:col-span-6 space-y-5">
        {/* Player surface */}
        <div className="rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <Film className="w-5 h-5 text-indigo-400 shrink-0" />
              <div className="font-mono text-xs min-w-0">
                <p className="text-slate-100 font-bold truncate">{activeGroup?.title || detail?.title || trans('subtitles.noSelection')}</p>
                <p className="text-zinc-400 text-[10px] mt-0.5">
                  {hasAudioClips ? trans('subtitles.modeClips') : trans('subtitles.modeTts')}
                </p>
              </div>
            </div>
            <button
              onClick={onOpenPlaybackSettings}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 cursor-pointer shrink-0"
              title={trans('subtitles.playbackSettings')}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          {/* Waveform / current line area */}
          <div className="px-6 py-8 min-h-[200px] flex flex-col items-center justify-center gap-5">
            {/* Animated bars */}
            <div className="flex gap-1.5 items-end h-16">
              {Array.from({ length: 16 }).map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{ height: isPlaying ? [10, 48, 16, 64, 10] : 14 }}
                  transition={{ repeat: Infinity, duration: 1.4 + (idx % 4) * 0.2, ease: 'easeInOut' }}
                  className="w-1 rounded-full bg-gradient-to-t from-indigo-500 to-fuchsia-500 opacity-30"
                />
              ))}
            </div>

            {/* Current line */}
            <div className="text-center space-y-2 w-full">
              {loadingDetail ? (
                <p className="text-xs text-zinc-500 font-mono">{trans('common.loading')}</p>
              ) : activeLine ? (
                <>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-xl mx-auto">
                    {(activeLine.text || '').split(' ').map((rawWord, wIdx) => {
                      const stripped = rawWord.replace(STRIP_PUNCT, '');
                      const isLookup = selectedLookupWord?.text.toLowerCase() === stripped.toLowerCase();
                      return (
                        <button
                          key={wIdx}
                          onClick={() => handleWordClick(rawWord)}
                          className={`px-1 rounded text-sm sm:text-base font-extrabold transition-all border outline-none cursor-pointer ${
                            isLookup
                              ? 'bg-fuchsia-500 text-white border-fuchsia-400 shadow-lg scale-105'
                              : 'text-slate-100 hover:text-indigo-400 bg-black/10 border-transparent hover:border-indigo-500/20 hover:scale-105'
                          }`}
                        >
                          {rawWord}
                        </button>
                      );
                    })}
                  </div>
                  {showTranslation && pickSubtitleTranslation(activeLine) && (
                    <p className="text-xs sm:text-sm font-semibold text-indigo-300 select-none tracking-wide">
                      {pickSubtitleTranslation(activeLine)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-500 font-mono">{trans('subtitles.pressPlay')}</p>
              )}
            </div>
          </div>

          {/* Controls bar */}
          <div className="px-5 py-4 bg-slate-950/90 border-t border-white/5 space-y-3">
            {/* Time */}
            <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
              <span>{formatClock(currentTime)}</span>
              <span>
                {playableCount > 0 ? trans('subtitles.posOfTotal', { i: Math.min(playlistPos + 1, playableCount), n: playableCount }) : '—'}
              </span>
              {detail?.durationSec != null ? <span>{formatClock(detail.durationSec)}</span> : <span>--:--</span>}
            </div>

            {/* Transport */}
            <div className="flex items-center justify-center gap-4">
              <button onClick={prevLine} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 active:scale-95 cursor-pointer" title={trans('subtitles.prevLine')}>
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay} className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 cursor-pointer" title={isPlaying ? trans('common.pause') : trans('common.play')}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={nextLine} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 active:scale-95 cursor-pointer" title={trans('subtitles.nextLine')}>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Secondary controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Loop current line */}
                <button
                  onClick={() => { const v = !loopLine; setLoopLine(v); wfNewSettings.setField('subtitleLoopLine', v); addToast(v ? trans('subtitles.loopOn') : trans('subtitles.loopOff'), 'info'); }}
                  className={`p-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 font-mono cursor-pointer ${loopLine ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10' : 'border-white/5 text-zinc-500'}`}
                  title={trans('subtitles.loopTitle')}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>{trans('subtitles.btnLoop')}</span>
                </button>

                {/* Show/hide translation */}
                <button
                  onClick={() => { const v = !showTranslation; setShowTranslation(v); wfNewSettings.setField('subtitleShowTranslation', v); }}
                  className={`p-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 font-mono cursor-pointer ${showTranslation ? 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10' : 'border-white/5 text-zinc-500'}`}
                  title={trans('subtitles.trTitle')}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{trans('subtitles.btnTr')}</span>
                </button>
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="text-zinc-600">{trans('subtitles.speed')}</span>
                <SegmentedControl
                  size="xs"
                  value={speed}
                  onChange={(sp) => { setSpeed(sp); wfNewSettings.setField('subtitlePlaybackSpeed', sp); if (audioRef.current) audioRef.current.playbackRate = sp; }}
                  options={SPEED_OPTIONS}
                />
              </div>
            </div>
          </div>
        </div>

        <WfNewSubtitleLineList
          sentences={sentences}
          activeLineIndex={activeLineIndex}
          showTranslation={showTranslation}
          loading={loadingDetail}
          listRef={subtitleListRef}
          activeTheme={activeTheme}
          trans={trans}
          onJump={jumpToLine}
        />
      </div>

      {/* ===== RIGHT: Lookup card + Word stats (Sidebar B) ===== */}
      <div className="lg:col-span-3 space-y-5">
        <WfNewSubtitleLookupCard
          word={selectedLookupWord}
          activeTheme={activeTheme}
          trans={trans}
          onSpeak={speakWord}
          onAddFavorite={handleAddLookupToFavorites}
        />

        <WfNewSubtitleWordStats
          words={words}
          total={wordTotal}
          start={wordStart}
          pageSize={wordPageSize}
          loading={wordLoading}
          activeTheme={activeTheme}
          trans={trans}
          onPage={loadWords}
          onPlayWord={playWordAudio}
        />
      </div>
    </div>
  );
};
