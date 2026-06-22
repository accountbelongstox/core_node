import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BentoCard from '../BentoCard';
import { api } from '../../core/api';
import { getDefaultBaseURL } from '../../config/constants';
import { getSharedBaseURL } from '../../core/api/base/BaseAPI';
import type {
  MediaSourceListItem,
  MediaSegment,
  MediaSentence,
  MediaGrain,
} from '../../core/api/modules/MediaQueryAPI';
import { useTranslation } from 'react-i18next';
import {
  Film,
  BookOpen,
  Search,
  Loader2,
  RefreshCw,
  Play,
  Volume2,
  ChevronDown,
  ChevronRight,
  WifiOff,
  Clapperboard,
  Languages,
  ListVideo,
} from 'lucide-react';

type SourceKind = 'movies' | 'books';

/** Resolve a possibly-relative media/clip/audio URL against the live API base. */
function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getSharedBaseURL() || getDefaultBaseURL();
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

/** Format seconds as m:ss (or h:mm:ss). */
function formatTime(sec: number | undefined): string {
  if (sec === undefined || sec === null || isNaN(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  if (h > 0) return `${h}:${mm}:${String(ss).padStart(2, '0')}`;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ AI panel

const AI_FIELDS: Array<{ key: keyof MediaSentence; labelKey: string }> = [
  { key: 'explanation', labelKey: 'explanation' },
  { key: 'grammar', labelKey: 'grammar' },
  { key: 'ai_commentary', labelKey: 'aiCommentary' },
  { key: 'special_usage', labelKey: 'specialUsage' },
];

const SentenceAIPanel: React.FC<{ sentence: MediaSentence }> = ({ sentence }) => {
  const { t } = useTranslation();
  const fields = AI_FIELDS.filter((f) => {
    const v = sentence[f.key];
    return typeof v === 'string' && v.trim().length > 0;
  });

  if (fields.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
        {t('moviesBooksView.noAiFields')}
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-3">
      {fields.map((f) => (
        <div key={String(f.key)}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">
            {t(`moviesBooksView.${f.labelKey}`)}
          </div>
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_code]:text-pink-500">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {String(sentence[f.key])}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
};

// --------------------------------------------------------------- sentence row

interface SentenceRowData {
  sentences: MediaSentence[];
  activeSeq: number | null;
  expandedSeq: number | null;
  isMovie: boolean;
  onSelect: (s: MediaSentence) => void;
  onToggleExpand: (seq: number) => void;
  onPlayAudio: (s: MediaSentence) => void;
}

const SentenceRow = ({
  index,
  style,
  sentences,
  activeSeq,
  expandedSeq,
  isMovie,
  onSelect,
  onToggleExpand,
  onPlayAudio,
}: RowComponentProps<SentenceRowData>) => {
  const s = sentences[index];
  const isActive = activeSeq === s.seq;
  const isExpanded = expandedSeq === s.seq;
  const audioUrl = resolveMediaUrl(s.audio);

  return (
    <div style={style} className="px-1">
      <div
        className={`rounded-lg border transition-colors ${
          isActive
            ? 'bg-indigo-500/15 border-indigo-500/40 dark:bg-indigo-500/20'
            : 'bg-white/40 dark:bg-white/5 border-black/5 dark:border-white/10 hover:border-indigo-500/30'
        }`}
      >
        <div className="flex items-start gap-2 px-2.5 py-2">
          <span className="mt-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 w-7 shrink-0 text-right">
            {s.seq}
          </span>

          <button
            type="button"
            onClick={() => onSelect(s)}
            className="flex-1 text-left min-w-0"
            title={isMovie ? formatTime(s.start_sec) : undefined}
          >
            <p className="text-sm leading-snug text-slate-800 dark:text-slate-100 break-words">
              {s.text}
            </p>
            {isMovie && s.start_sec !== undefined && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                <Play size={9} /> {formatTime(s.start_sec)}
              </span>
            )}
          </button>

          {audioUrl && (
            <button
              type="button"
              onClick={() => onPlayAudio(s)}
              className="shrink-0 p-1.5 rounded-md text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              title="Play sentence audio"
            >
              <Volume2 size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleExpand(s.seq)}
            className="shrink-0 p-1.5 rounded-md text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="AI details"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {isExpanded && (
          <div className="border-t border-black/5 dark:border-white/10 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
            <SentenceAIPanel sentence={s} />
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------- source list item

const SourceListItem: React.FC<{
  item: MediaSourceListItem;
  isMovie: boolean;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isMovie, isActive, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isActive
          ? 'bg-indigo-500/15 border-indigo-500/40 dark:bg-indigo-500/20'
          : 'bg-white/40 dark:bg-white/5 border-black/5 dark:border-white/10 hover:border-indigo-500/30'
      }`}
    >
      <div className="flex items-center gap-2">
        {isMovie ? (
          <Film size={14} className="shrink-0 text-pink-500" />
        ) : (
          <BookOpen size={14} className="shrink-0 text-amber-500" />
        )}
        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {item.title || item.original_name || item.source_key}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
        {item.language && (
          <span className="inline-flex items-center gap-0.5">
            <Languages size={9} /> {item.language}
          </span>
        )}
        {item.sentence_count !== undefined && <span>{item.sentence_count} sent.</span>}
        {isMovie && item.segment_count !== undefined && <span>{item.segment_count} seg.</span>}
        {isMovie && item.duration_sec !== undefined && (
          <span>{formatTime(item.duration_sec)}</span>
        )}
      </div>
    </button>
  );
};

// ------------------------------------------------------------------- the view

const MoviesBooksBrowser: React.FC = () => {
  const { t } = useTranslation();

  const [kind, setKind] = useState<SourceKind>('movies');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sources, setSources] = useState<MediaSourceListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [segments, setSegments] = useState<MediaSegment[]>([]);
  const [sentences, setSentences] = useState<MediaSentence[]>([]);

  // Player state (movies)
  const [activeSegIndex, setActiveSegIndex] = useState<number | null>(null);
  const [activeSeq, setActiveSeq] = useState<number | null>(null);
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);
  const [videoFormat, setVideoFormat] = useState<'full' | 'tiny'>('full');
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);

  const isMovie = kind === 'movies';

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Load the source list whenever kind / search changes.
  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    setOffline(false);
    try {
      const res = isMovie
        ? await api.mediaQuery.listSubtitles({ per_page: 100, search: debouncedSearch })
        : await api.mediaQuery.listBooks({ per_page: 100, search: debouncedSearch });
      if (res.success && res.data) {
        setSources(Array.isArray(res.data.items) ? res.data.items : []);
      } else {
        setSources([]);
        if ((res as any).isNetworkError || (res as any).isTimeout) setOffline(true);
        else setListError(res.error || t('moviesBooksView.loadError'));
      }
    } catch (e: any) {
      setSources([]);
      setListError(e?.message || t('moviesBooksView.loadError'));
    } finally {
      setListLoading(false);
    }
  }, [isMovie, debouncedSearch, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Reset selection when switching movies/books.
  useEffect(() => {
    setSelectedKey(null);
    setSegments([]);
    setSentences([]);
    setActiveSegIndex(null);
    setActiveSeq(null);
    setExpandedSeq(null);
  }, [kind]);

  // Load detail for the selected source.
  const loadDetail = useCallback(
    async (key: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setSegments([]);
      setSentences([]);
      setActiveSegIndex(null);
      setActiveSeq(null);
      setExpandedSeq(null);
      try {
        if (isMovie) {
          const grain: MediaGrain = 'sentence';
          const res = await api.mediaQuery.getSubtitle(key, grain);
          if (res.success && res.data) {
            setSegments(Array.isArray(res.data.segments) ? res.data.segments : []);
            setSentences(Array.isArray(res.data.sentences) ? res.data.sentences : []);
          } else {
            setDetailError(res.error || t('moviesBooksView.loadError'));
          }
        } else {
          const res = await api.mediaQuery.getBook(key);
          if (res.success && res.data) {
            setSentences(Array.isArray(res.data.sentences) ? res.data.sentences : []);
          } else {
            setDetailError(res.error || t('moviesBooksView.loadError'));
          }
        }
      } catch (e: any) {
        setDetailError(e?.message || t('moviesBooksView.loadError'));
      } finally {
        setDetailLoading(false);
      }
    },
    [isMovie, t]
  );

  const handleSelectSource = (item: MediaSourceListItem) => {
    setSelectedKey(item.source_key);
    loadDetail(item.source_key);
  };

  const activeSegment = useMemo(
    () => segments.find((s) => s.seg_index === activeSegIndex) || null,
    [segments, activeSegIndex]
  );

  // Choose the clip URL for the active segment / format.
  const videoSrc = useMemo(() => {
    if (!activeSegment) return undefined;
    const preferred = videoFormat === 'tiny' ? activeSegment.mp4 : activeSegment.full_mp4;
    const fallback = videoFormat === 'tiny' ? activeSegment.full_mp4 : activeSegment.mp4;
    return resolveMediaUrl(preferred || fallback);
  }, [activeSegment, videoFormat]);

  const audioSrc = useMemo(
    () => resolveMediaUrl(activeSegment?.mp3),
    [activeSegment]
  );

  // When a sentence is clicked: load its segment, then seek to start.
  const handleSelectSentence = (s: MediaSentence) => {
    setActiveSeq(s.seq);
    if (!isMovie) return;
    if (s.seg_index === undefined || s.seg_index === null) return;

    if (s.seg_index !== activeSegIndex) {
      setActiveSegIndex(s.seg_index);
      setPendingSeek(s.start_sec ?? null);
    } else {
      // Same segment already loaded — seek immediately.
      const seg = segments.find((x) => x.seg_index === s.seg_index);
      const base = seg?.start_sec ?? 0;
      const target = (s.start_sec ?? base) - base;
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, target);
        void videoRef.current.play().catch(() => {});
      }
    }
  };

  // After the video element loads a new segment, apply the pending seek.
  const handleVideoLoaded = () => {
    if (pendingSeek === null || !videoRef.current) return;
    const base = activeSegment?.start_sec ?? 0;
    const target = pendingSeek - base;
    videoRef.current.currentTime = Math.max(0, target);
    void videoRef.current.play().catch(() => {});
    setPendingSeek(null);
  };

  // Highlight the active sentence as the video time advances (movies).
  const handleTimeUpdate = () => {
    if (!isMovie || !videoRef.current || !activeSegment) return;
    const absTime = (activeSegment.start_sec ?? 0) + videoRef.current.currentTime;
    // Find the sentence in this segment whose [start,end] contains absTime.
    let match: MediaSentence | null = null;
    for (const s of sentences) {
      if (s.seg_index !== activeSegment.seg_index) continue;
      const start = s.start_sec ?? -Infinity;
      const end = s.end_sec ?? Infinity;
      if (absTime >= start && absTime < end) {
        match = s;
        break;
      }
    }
    if (match && match.seq !== activeSeq) setActiveSeq(match.seq);
  };

  const handlePlaySentenceAudio = (s: MediaSentence) => {
    const url = resolveMediaUrl(s.audio);
    if (!url) return;
    if (!sentenceAudioRef.current) {
      sentenceAudioRef.current = new Audio();
    }
    const audio = sentenceAudioRef.current;
    audio.src = url;
    void audio.play().catch(() => {});
  };

  const handleToggleExpand = (seq: number) => {
    setExpandedSeq((prev) => (prev === seq ? null : seq));
  };

  // Clean up the shared sentence-audio element on unmount.
  useEffect(() => {
    return () => {
      if (sentenceAudioRef.current) {
        sentenceAudioRef.current.pause();
        sentenceAudioRef.current.src = '';
      }
    };
  }, []);

  const selectedSource = sources.find((s) => s.source_key === selectedKey) || null;
  const hasVideoFormats = Boolean(activeSegment && (activeSegment.mp4 || activeSegment.full_mp4));

  const rowProps: SentenceRowData = {
    sentences,
    activeSeq,
    expandedSeq,
    isMovie,
    onSelect: handleSelectSentence,
    onToggleExpand: handleToggleExpand,
    onPlayAudio: handlePlaySentenceAudio,
  };

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
        {/* ---------------- LEFT: source list ---------------- */}
        <div className="lg:w-80 shrink-0 flex flex-col min-h-0">
          <BentoCard
            className="flex-1 min-h-0"
            title={t('moviesBooksView.sourcesTitle')}
            headerControls={
              <button
                type="button"
                onClick={loadList}
                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title={t('moviesBooksView.refresh')}
              >
                <RefreshCw size={14} className={listLoading ? 'animate-spin' : ''} />
              </button>
            }
          >
            <div className="flex flex-col h-full min-h-0">
              {/* Movies / Books switch */}
              <div className="p-3 pb-2">
                <div className="flex p-1 rounded-lg bg-black/5 dark:bg-white/5 gap-1">
                  <button
                    type="button"
                    onClick={() => setKind('movies')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isMovie
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <Clapperboard size={14} /> {t('moviesBooksView.movies')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('books')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      !isMovie
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <BookOpen size={14} /> {t('moviesBooksView.books')}
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('moviesBooksView.searchPlaceholder')}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* List body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
                {offline ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                    <WifiOff size={28} />
                    <p className="text-xs">{t('moviesBooksView.offline')}</p>
                  </div>
                ) : listLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                ) : listError ? (
                  <div className="py-8 px-2 text-center text-xs text-rose-500">{listError}</div>
                ) : sources.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {t('moviesBooksView.emptyList')}
                  </div>
                ) : (
                  sources.map((item) => (
                    <SourceListItem
                      key={item.source_key}
                      item={item}
                      isMovie={isMovie}
                      isActive={item.source_key === selectedKey}
                      onClick={() => handleSelectSource(item)}
                    />
                  ))
                )}
              </div>
            </div>
          </BentoCard>
        </div>

        {/* ---------------- RIGHT: player + sentences ---------------- */}
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {!selectedKey ? (
            <BentoCard className="flex-1 min-h-0">
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-20">
                <ListVideo size={40} className="opacity-40" />
                <p className="text-sm">{t('moviesBooksView.selectPrompt')}</p>
              </div>
            </BentoCard>
          ) : detailLoading ? (
            <BentoCard className="flex-1 min-h-0">
              <div className="flex items-center justify-center h-full text-slate-400 py-20">
                <Loader2 size={26} className="animate-spin" />
              </div>
            </BentoCard>
          ) : detailError ? (
            <BentoCard className="flex-1 min-h-0">
              <div className="flex items-center justify-center h-full text-rose-500 text-sm py-20">
                {detailError}
              </div>
            </BentoCard>
          ) : (
            <>
              {/* Player (movies only) */}
              {isMovie && (
                <BentoCard
                  title={selectedSource?.title || selectedSource?.original_name || selectedKey}
                  headerControls={
                    hasVideoFormats ? (
                      <div className="flex p-0.5 rounded-md bg-black/5 dark:bg-white/5 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setVideoFormat('full')}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            videoFormat === 'full'
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {t('moviesBooksView.formatFull')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoFormat('tiny')}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            videoFormat === 'tiny'
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {t('moviesBooksView.formatTiny')}
                        </button>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="p-3">
                    {activeSegment && videoSrc ? (
                      <>
                        <video
                          ref={videoRef}
                          key={`${activeSegment.seg_index}-${videoFormat}`}
                          src={videoSrc}
                          controls
                          playsInline
                          onLoadedMetadata={handleVideoLoaded}
                          onTimeUpdate={handleTimeUpdate}
                          className="w-full max-h-[42vh] rounded-lg bg-black"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          <span>
                            {t('moviesBooksView.segment')} #{activeSegment.seg_index}
                          </span>
                          <span>
                            {formatTime(activeSegment.start_sec)} – {formatTime(activeSegment.end_sec)}
                          </span>
                          {audioSrc && (
                            <span className="inline-flex items-center gap-1.5">
                              <Volume2 size={12} className="text-cyan-500" />
                              <audio src={audioSrc} controls className="h-7 align-middle" />
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                        <Play size={32} className="opacity-40" />
                        <p className="text-xs">{t('moviesBooksView.pickSentence')}</p>
                      </div>
                    )}
                  </div>
                </BentoCard>
              )}

              {/* Sentence list */}
              <BentoCard
                className="flex-1 min-h-0"
                title={
                  isMovie
                    ? t('moviesBooksView.sentences')
                    : selectedSource?.title || selectedSource?.original_name || selectedKey
                }
                headerControls={
                  <span className="text-[11px] font-mono text-slate-400">
                    {sentences.length} {t('moviesBooksView.items')}
                  </span>
                }
              >
                <div className="h-full min-h-0 p-2">
                  {sentences.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-400 py-12">
                      {t('moviesBooksView.noSentences')}
                    </div>
                  ) : (
                    <List
                      rowComponent={SentenceRow}
                      rowCount={sentences.length}
                      rowHeight={(index, p) =>
                        p.sentences[index] && p.expandedSeq === p.sentences[index].seq ? 300 : 64
                      }
                      rowProps={rowProps}
                      style={{ height: '100%' }}
                      className="scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10"
                    />
                  )}
                </div>
              </BentoCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviesBooksBrowser;
