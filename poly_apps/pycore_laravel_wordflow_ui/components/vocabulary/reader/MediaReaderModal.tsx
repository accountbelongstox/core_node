import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen, FileText, List as ListIcon, Rows, Volume2, VolumeX, Pause,
  Play, Square, ChevronLeft, ChevronRight, X as CloseIcon,
} from 'lucide-react';
import { api } from '../../../core/api';
import type { ReaderSentence, ReaderChapter, ReaderDetailParams } from '../../../core/api/modules/MediaQueryAPI';
import { WF_SUPPORTED_LANGUAGES } from '../../../core/api-libs/wordflow/wordflowLanguages';
import { commonClasses } from '../../../styles/theme';
import { Modal } from '../../common';
import { LoadingBlock, EmptyState } from '../../common';
import { useToast } from '../../admin';
import { readerAudioUrl, resolveCell, sentenceKey, sentenceLangs, chapterTitle } from './mediaReader';

/**
 * MediaReaderModal — full-screen reader for an ingested book OR uploaded
 * document. Two modes:
 *   - Chapters: pick a chapter, read its verses (books only, when chaptered).
 *   - Sentences: read the whole source, paginated (multi-page).
 * Every sentence shows an audio icon top-right (has_audio-gated; missing → a
 * prompt). Clicking it starts CONTINUOUS playback from that sentence and keeps
 * reading — across pages and chapters — until the user pauses/stops.
 */

interface MediaReaderModalProps {
  open: boolean;
  onClose: () => void;
  kind: 'book' | 'document';
  /** book */
  sourceKey?: string;
  /** document */
  documentId?: number | string;
  title: string;
}

type ReaderMode = 'chapters' | 'sentences';

const SENTENCE_PER_PAGE = 50;   // multi-page sentence mode
const CHAPTER_PER_PAGE = 500;   // a chapter is a natural unit (rarely paged)

const langName = (code: string): string =>
  WF_SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();

const pickDefaultLang = (langs: string[]): string => (langs.length ? langs[0] : '');

const MediaReaderModal: React.FC<MediaReaderModalProps> = ({ open, onClose, kind, sourceKey, documentId, title }) => {
  const toast = useToast();

  const [mode, setMode] = useState<ReaderMode>('sentences');
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [readLang, setReadLang] = useState<string>('');
  const [activeChapter, setActiveChapter] = useState<number | null>(null);

  const [sentences, setSentences] = useState<ReaderSentence[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // --- live refs (read synchronously by the stable playback callbacks) ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const readLangRef = useRef('');
  const modeRef = useRef<ReaderMode>('sentences');
  const pageRef = useRef(1);
  const lastPageRef = useRef(1);
  const activeChapterRef = useRef<number | null>(null);
  const chaptersRef = useRef<ReaderChapter[]>([]);
  const advanceRef = useRef<(list: ReaderSentence[], index: number) => void>(() => {});
  const continueRef = useRef<(list: ReaderSentence[]) => void>(() => {});
  readLangRef.current = readLang;
  modeRef.current = mode;
  pageRef.current = page;
  lastPageRef.current = lastPage;
  activeChapterRef.current = activeChapter;
  chaptersRef.current = chapters;

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  };

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } }
    setPlayingKey(null);
  }, []);

  // --- data loading (one loader; per_page depends on chapter vs sentence mode) ---
  const load = useCallback(
    async (opts: { page: number; chapterIndex: number | null }): Promise<ReaderSentence[] | null> => {
      setLoading(true);
      setError(null);
      const params: ReaderDetailParams = {
        page: opts.page,
        per_page: opts.chapterIndex != null ? CHAPTER_PER_PAGE : SENTENCE_PER_PAGE,
      };
      if (opts.chapterIndex != null) params.chapter_index = opts.chapterIndex;
      try {
        const res = kind === 'book'
          ? await api.mediaQuery.getBookDetail(sourceKey as string, params)
          : await api.mediaQuery.getDocumentDetail(documentId as string | number, params);
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to load content');
        const s = res.data.sentences;
        const items = Array.isArray(s?.items) ? s.items : [];
        setSentences(items);
        setPage(s?.current_page ?? opts.page);
        setLastPage(s?.last_page ?? 1);
        setTotal(s?.total ?? 0);
        return items;
      } catch (e: any) {
        setSentences([]);
        setError(e?.message || 'Failed to load content');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [kind, sourceKey, documentId]
  );

  // --- playback (stable callbacks; all moving state read from refs) ---
  const playAt = useCallback((list: ReaderSentence[], index: number) => {
    const s = list[index];
    if (!s) { stopPlayback(); return; }
    const cell = resolveCell(s, readLangRef.current);
    const url = cell.hasAudio ? readerAudioUrl(cell.audioBare) : undefined;
    if (!url) { advanceRef.current(list, index); return; }  // skip un-playable
    const audio = ensureAudio();
    try { audio.pause(); } catch { /* ignore */ }
    audio.src = url;
    audio.onended = () => advanceRef.current(list, index);
    audio.onerror = () => advanceRef.current(list, index);   // skip a broken file
    setPlayingKey(sentenceKey(s));
    audio.play().catch(() => { toast.error('Could not play audio'); });
  }, [stopPlayback, toast]);

  const playFromStart = useCallback((list: ReaderSentence[]) => {
    for (let i = 0; i < list.length; i += 1) {
      const c = resolveCell(list[i], readLangRef.current);
      if (c.hasAudio && c.audioBare) { playAt(list, i); return; }
    }
    stopPlayback();
  }, [playAt, stopPlayback]);
  continueRef.current = playFromStart;

  const advance = useCallback((list: ReaderSentence[], index: number) => {
    if (!playingRef.current) return;
    for (let i = index + 1; i < list.length; i += 1) {
      const c = resolveCell(list[i], readLangRef.current);
      if (c.hasAudio && c.audioBare) { playAt(list, i); return; }
    }
    // Exhausted the current page — keep reading into the next page / chapter.
    if (pageRef.current < lastPageRef.current) {
      const ch = modeRef.current === 'chapters' ? activeChapterRef.current : null;
      load({ page: pageRef.current + 1, chapterIndex: ch }).then((items) => {
        if (items && playingRef.current) continueRef.current(items);
      });
      return;
    }
    if (modeRef.current === 'chapters') {
      const chs = chaptersRef.current;
      const pos = chs.findIndex((c) => c.chapter_index === activeChapterRef.current);
      const next = pos >= 0 ? chs[pos + 1] : undefined;
      if (next) {
        setActiveChapter(next.chapter_index);
        load({ page: 1, chapterIndex: next.chapter_index }).then((items) => {
          if (items && playingRef.current) continueRef.current(items);
        });
        return;
      }
    }
    stopPlayback();
  }, [playAt, load, stopPlayback]);
  advanceRef.current = advance;

  /** Click a sentence's audio icon: toggle pause if it's the one playing, else read from here. */
  const onSentenceAudio = (index: number) => {
    const s = sentences[index];
    if (!s) return;
    const cell = resolveCell(s, readLang);
    if (!cell.hasAudio) { toast.error('No audio available for this sentence'); return; }
    if (playingKey === sentenceKey(s) && playingRef.current) { stopPlayback(); return; }
    playingRef.current = true;
    playAt(sentences, index);
  };

  const toggleReadAll = () => {
    if (playingRef.current) { stopPlayback(); return; }
    playingRef.current = true;
    playFromStart(sentences);
  };

  // --- open / source change: init chapters + first page ---
  useEffect(() => {
    if (!open) return;
    stopPlayback();
    setError(null);
    setSentences([]);
    setChapters([]);
    setActiveChapter(null);
    let cancelled = false;

    (async () => {
      if (kind === 'book' && sourceKey) {
        let chs: ReaderChapter[] = [];
        let ls: string[] = [];
        try {
          const chRes = await api.mediaQuery.getBookChapters(sourceKey);
          if (chRes.success && chRes.data) {
            chs = Array.isArray(chRes.data.chapters) ? chRes.data.chapters : [];
            ls = Array.isArray(chRes.data.languages) ? chRes.data.languages : [];
          }
        } catch { /* chapterless / offline — fall through to flat sentences */ }
        if (cancelled) return;
        setChapters(chs);
        setLangs(ls);
        setReadLang(pickDefaultLang(ls));
        if (chs.length > 0) {
          setMode('chapters');
          setActiveChapter(chs[0].chapter_index);
          await load({ page: 1, chapterIndex: chs[0].chapter_index });
        } else {
          setMode('sentences');
          await load({ page: 1, chapterIndex: null });
        }
      } else if (kind === 'document' && documentId != null) {
        setMode('sentences');
        const items = await load({ page: 1, chapterIndex: null });
        if (cancelled) return;
        const dl = items && items[0] ? sentenceLangs(items[0]) : [];
        setLangs(dl);
        setReadLang(pickDefaultLang(dl));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, sourceKey, documentId]);

  // Stop audio when the modal closes / unmounts.
  useEffect(() => {
    if (!open) stopPlayback();
    return () => stopPlayback();
  }, [open, stopPlayback]);

  // --- mode + chapter + page controls ---
  const switchMode = (next: ReaderMode) => {
    if (next === mode) return;
    stopPlayback();
    setMode(next);
    if (next === 'chapters') {
      const ch = activeChapter ?? (chapters[0]?.chapter_index ?? 0);
      setActiveChapter(ch);
      void load({ page: 1, chapterIndex: ch });
    } else {
      setActiveChapter(null);
      void load({ page: 1, chapterIndex: null });
    }
  };

  const selectChapter = (chIndex: number) => {
    stopPlayback();
    setActiveChapter(chIndex);
    void load({ page: 1, chapterIndex: chIndex });
  };

  const goToPage = (p: number) => {
    stopPlayback();
    const clamped = Math.max(1, Math.min(lastPage, p));
    void load({ page: clamped, chapterIndex: mode === 'chapters' ? activeChapter : null });
  };

  const hasChapters = kind === 'book' && chapters.length > 0;
  const showLangSelect = langs.length > 1;
  const Icon = kind === 'book' ? BookOpen : FileText;
  const emptyMsg = kind === 'document'
    ? 'No readable content yet — extract sentences for this document first.'
    : 'No readable content in this source.';

  return (
    <Modal isOpen={open} onClose={onClose} size="full" showCloseButton={false} className="h-[90vh]">
      <div className="flex flex-col h-full -my-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-lg flex items-center gap-2 min-w-0">
            <Icon className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span className="truncate" title={title}>{title}</span>
          </h2>

          {/* Mode toggle */}
          {hasChapters && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => switchMode('chapters')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === 'chapters' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
              >
                <ListIcon className="w-4 h-4" /> Chapters
              </button>
              <button
                type="button"
                onClick={() => switchMode('sentences')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === 'sentences' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
              >
                <Rows className="w-4 h-4" /> Sentences
              </button>
            </div>
          )}

          {showLangSelect && (
            <select
              value={readLang}
              onChange={(e) => setReadLang(e.target.value)}
              className={`${commonClasses.input} text-sm py-1.5`}
              title="Reading / audio language"
            >
              {langs.map((l) => (
                <option key={l} value={l}>{langName(l)}</option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {/* Read-all / stop */}
          <button
            type="button"
            onClick={toggleReadAll}
            disabled={sentences.length === 0}
            className={`${commonClasses.button} ${playingKey ? 'bg-rose-600 hover:bg-rose-700 text-white' : commonClasses.buttonPrimary} flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50`}
          >
            {playingKey ? <><Square className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Read</>}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Chapter rail */}
          {mode === 'chapters' && hasChapters && (
            <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-700 py-2 pr-2">
              {chapters.map((ch) => (
                <button
                  key={ch.chapter_index}
                  type="button"
                  onClick={() => selectChapter(ch.chapter_index)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 truncate ${
                    activeChapter === ch.chapter_index
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                  title={chapterTitle(ch.titles, readLang, ch.chapter_index)}
                >
                  {chapterTitle(ch.titles, readLang, ch.chapter_index)}
                  {ch.sentence_count > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">({ch.sentence_count})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Sentence list */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto py-3 pl-1 pr-2">
              {loading && sentences.length === 0 ? (
                <LoadingBlock />
              ) : error ? (
                <EmptyState icon={Icon} message={error} />
              ) : sentences.length === 0 ? (
                <EmptyState icon={Icon} message={emptyMsg} />
              ) : (
                <div className="space-y-1.5">
                  {sentences.map((s, index) => {
                    const cell = resolveCell(s, readLang);
                    const key = sentenceKey(s);
                    const isPlaying = playingKey === key;
                    const label = s.ref || String(s.seq + 1);
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border px-3 py-2 flex items-start gap-3 transition-colors ${
                          isPlaying
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <span className="text-[11px] font-mono text-slate-400 w-10 flex-shrink-0 text-right pt-0.5">
                          {label}
                        </span>
                        <p className={`flex-1 text-sm leading-relaxed break-words ${isPlaying ? 'text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-200'}`}>
                          {cell.text || <span className="italic text-slate-400">— (no text)</span>}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSentenceAudio(index)}
                          className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                            !cell.hasAudio
                              ? 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                              : isPlaying
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40'
                              : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                          }`}
                          title={cell.hasAudio ? (isPlaying ? 'Pause' : 'Play from here') : 'No audio available'}
                        >
                          {!cell.hasAudio ? <VolumeX className="w-4 h-4" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between gap-2 py-2.5 px-1 border-t border-slate-200 dark:border-slate-700 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {total > 0 ? `${total.toLocaleString()} sentences` : ''}{lastPage > 1 ? ` · Page ${page} of ${lastPage}` : ''}
              </span>
              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= lastPage || loading}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MediaReaderModal;
