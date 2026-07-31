/**
 * WfNewAdminWords — dictionary word management panel of the SUPER-ADMIN console
 * (mounted by WfNewAdminPage under the "words" sub-tab). Mirrors the Words tab
 * of laravel-manager's vocabulary console, rebuilt in the wordnew design
 * language (theme tokens, trans() i18n, toast notifications).
 *
 * Everything flows through the pinned page-origin admin gateway (wfNewAdminApi
 * — never the wfNewEndpoints failover pool, see WfNewAdminApi header):
 *   - paginated word listing with language / coverage-filter / search / sort,
 *   - single-word CRUD (create / edit modal, delete with confirm),
 *   - batch actions over the checkbox selection (mark valid/invalid,
 *     requeue TTS, delete),
 *   - lazy per-row example sentences + audio playback on expand.
 *
 * The chosen dictionary language persists in localStorage under
 * 'wfnew_admin_lang' and is SHARED with the libraries panel, so switching
 * between the two admin tabs keeps the same language context.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Play, Pause, Pencil, Trash2, X, Loader2, BarChart2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Volume2, Languages,
} from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';
import { wfNewAdminApi } from '../../api';
import type {
  WfNewAdminWordRow, WfNewAdminWordsPage, WfNewAdminWordFilter,
  WfNewAdminWordSort, WfNewAdminWordEditable, WfNewAdminBatchAction,
  WfNewAdminSentence,
} from '../../api';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { WfNewAdminWordEditor } from './WfNewAdminWordEditor';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

// --- shared language persistence (same key as the libraries panel) ----------- #

/** Fallback options while the language breakdown loads (or when it fails). */
const FALLBACK_LANGS = ['english', 'chinese', 'japanese', 'korean', 'french', 'german', 'spanish'];

function readStoredLang(): string {
  try {
    return StorageManager.get(StorageKeys.WORDNEW_ADMIN_LANGUAGE, FALLBACK_LANGS[0]);
  } catch {
    return FALLBACK_LANGS[0];
  }
}

function storeLang(lang: string): void {
  StorageManager.set(StorageKeys.WORDNEW_ADMIN_LANGUAGE, lang);
}

// --- constants / small helpers ------------------------------------------------ #

const PAGE_SIZE = 50;

const FILTERS: Array<{ value: WfNewAdminWordFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'admin.w.f.all' },
  { value: 'with_translation', labelKey: 'admin.w.f.withTrans' },
  { value: 'without_translation', labelKey: 'admin.w.f.noTrans' },
  { value: 'with_audio', labelKey: 'admin.w.f.withAudio' },
  { value: 'without_audio', labelKey: 'admin.w.f.noAudio' },
  { value: 'invalid', labelKey: 'admin.w.f.invalid' },
];

const CHIP_CLS = 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40';
const CHIP_ACTIVE_CLS = 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 transition disabled:opacity-40';
const INPUT_BASE_CLS = 'py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none';

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

type Trans = (key: string, replacements?: Record<string, string | number>) => string;
type AddToast = (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;

/** Lazy example-sentence cache slot (per word md5). */
interface SentenceSlot {
  loading: boolean;
  error: string | null;
  sentences: WfNewAdminSentence[];
}

// --- main panel ----------------------------------------------------------------- #

interface WfNewAdminWordsProps {
  activeTheme: ElementTheme;
  trans: Trans;
  addToast: AddToast;
}

export const WfNewAdminWords: React.FC<WfNewAdminWordsProps> = ({ activeTheme, trans, addToast }) => {
  // ---- query state ---- //
  const [langs, setLangs] = useState<string[]>(FALLBACK_LANGS);
  const [language, setLanguage] = useState<string>(readStoredLang);
  const [filter, setFilter] = useState<WfNewAdminWordFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<WfNewAdminWordSort | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [start, setStart] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  // ---- data state ---- //
  const [data, setData] = useState<WfNewAdminWordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- per-row UI state ---- //
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sentencesByMd5, setSentencesByMd5] = useState<Record<string, SentenceSlot>>({});
  const sentenceRequested = useRef<Set<string>>(new Set());

  // ---- mutation state ---- //
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; row: WfNewAdminWordRow | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchBusy, setBatchBusy] = useState<WfNewAdminBatchAction | null>(null);

  // Single shared <audio> element so row clips never overlap.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingMd5, setPlayingMd5] = useState<string | null>(null);

  // Out-of-order + unmount guards for async work.
  const reqIdRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toastError = useCallback((e: any): void => {
    if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
    else addToast(String(e?.message || 'Request failed'), 'warning');
  }, [addToast, trans]);

  const bumpReload = useCallback((): void => setReloadTick((t) => t + 1), []);

  // ---- language options (breakdown is the source of truth) ---- //
  useEffect(() => {
    let alive = true;
    wfNewAdminApi.getLanguageBreakdown()
      .then((r) => {
        if (!alive) return;
        const list = (r?.languages ?? []).map((row) => row.language).filter(Boolean);
        if (list.length > 0) setLangs(list);
      })
      .catch(() => { /* keep the fallback list */ });
    return () => { alive = false; };
  }, []);

  // Keep a stored/legacy language selectable even when the breakdown lacks it.
  const langOptions = useMemo(
    () => (langs.includes(language) ? langs : [...langs, language]),
    [langs, language],
  );

  // ---- debounced search ---- //
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setStart(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ---- page load (reqId-guarded against out-of-order responses) ---- //
  useEffect(() => {
    let alive = true;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    wfNewAdminApi.getWords({
      language,
      filter,
      q: q || undefined,
      sort: sort ?? undefined,
      order: sort ? order : undefined,
      start,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (!alive || reqId !== reqIdRef.current) return;
        setData(res);
        setExpanded(new Set());
      })
      .catch((e: any) => {
        if (!alive || reqId !== reqIdRef.current) return;
        setError(String(e?.message || 'Failed to load words.'));
        setData(null);
      })
      .finally(() => {
        if (alive && reqId === reqIdRef.current) setLoading(false);
      });
    return () => { alive = false; };
  }, [language, filter, q, sort, order, start, reloadTick]);

  // Language change invalidates the md5 selection and the sentence cache.
  useEffect(() => {
    setSelected(new Set());
    sentenceRequested.current = new Set();
    setSentencesByMd5({});
  }, [language]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(start / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ---- handlers ---- //

  const changeLanguage = (lang: string): void => {
    setLanguage(lang);
    storeLang(lang);
    setStart(0);
  };

  const changeFilter = (f: WfNewAdminWordFilter): void => {
    setFilter(f);
    setStart(0);
  };

  const goTo = useCallback((p: number): void => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (clamped !== page) {
      setStart((clamped - 1) * PAGE_SIZE);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, totalPages]);

  /** Header sort cycle: none → asc → desc → none. Queries chip starts at desc. */
  const cycleSort = (key: WfNewAdminWordSort, firstOrder: 'asc' | 'desc' = 'asc'): void => {
    if (sort !== key) {
      setSort(key);
      setOrder(firstOrder);
    } else if (order === firstOrder) {
      setOrder(firstOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(null);
    }
  };

  const togglePlay = useCallback((row: WfNewAdminWordRow): void => {
    const url = wfNewAdminApi.absUrl(row.audio_url);
    if (!url) return;
    const el = audioRef.current;
    if (playingMd5 === row.md5 && el) {
      el.pause();
      setPlayingMd5(null);
      return;
    }
    if (el) el.pause();
    const next = new Audio(url);
    audioRef.current = next;
    next.onended = () => setPlayingMd5((p) => (p === row.md5 ? null : p));
    next.onerror = () => setPlayingMd5((p) => (p === row.md5 ? null : p));
    next.play().then(() => setPlayingMd5(row.md5)).catch(() => setPlayingMd5(null));
  }, [playingMd5]);

  /** Fetch example sentences once per md5 (re-expand never re-fires unless it failed). */
  const loadSentences = useCallback((row: WfNewAdminWordRow): void => {
    if (sentenceRequested.current.has(row.md5)) return;
    sentenceRequested.current.add(row.md5);
    setSentencesByMd5((prev) => ({ ...prev, [row.md5]: { loading: true, error: null, sentences: [] } }));
    wfNewAdminApi.getWordSentences(row.content, language)
      .then((r) => {
        if (!aliveRef.current) return;
        setSentencesByMd5((prev) => ({
          ...prev,
          [row.md5]: { loading: false, error: null, sentences: r?.sentences ?? [] },
        }));
      })
      .catch((e: any) => {
        if (!aliveRef.current) return;
        sentenceRequested.current.delete(row.md5); // allow a retry on re-expand
        setSentencesByMd5((prev) => ({
          ...prev,
          [row.md5]: { loading: false, error: String(e?.message || 'Failed to load sentences.'), sentences: [] },
        }));
      });
  }, [language]);

  const toggleExpand = useCallback((row: WfNewAdminWordRow): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(row.md5)) {
        next.delete(row.md5);
      } else {
        next.add(row.md5);
        loadSentences(row);
      }
      return next;
    });
  }, [loadSentences]);

  const toggleSelect = (md5: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(md5)) next.delete(md5);
      else next.add(md5);
      return next;
    });
  };

  const pageAllSelected = items.length > 0 && items.every((r) => selected.has(r.md5));
  const toggleSelectPage = (): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) items.forEach((r) => next.delete(r.md5));
      else items.forEach((r) => next.add(r.md5));
      return next;
    });
  };

  const runBatch = async (action: WfNewAdminBatchAction): Promise<void> => {
    const md5s = Array.from(selected);
    if (md5s.length === 0 || batchBusy) return;
    if (action === 'delete' && !window.confirm(trans('admin.w.batchAsk', { n: md5s.length }))) return;
    setBatchBusy(action);
    try {
      const res = await wfNewAdminApi.batchWords({ language, md5s, action });
      if (!aliveRef.current) return;
      addToast(trans('admin.w.batchOk', { n: res?.affected ?? md5s.length }), 'success');
      setSelected(new Set());
      bumpReload();
    } catch (e: any) {
      toastError(e);
    } finally {
      if (aliveRef.current) setBatchBusy(null);
    }
  };

  const deleteRow = async (row: WfNewAdminWordRow): Promise<void> => {
    if (!window.confirm(trans('admin.w.deleteAsk', { word: row.content }))) return;
    try {
      await wfNewAdminApi.deleteWord(row.md5, language);
      if (!aliveRef.current) return;
      addToast(trans('admin.w.deleted'), 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.md5);
        return next;
      });
      bumpReload();
    } catch (e: any) {
      toastError(e);
    }
  };

  const handleEditorSave = async (payload: { content: string } & WfNewAdminWordEditable): Promise<void> => {
    if (!editor) return;
    setSaving(true);
    try {
      const { content, ...editable } = payload;
      if (editor.mode === 'create') {
        await wfNewAdminApi.createWord({ language, content, ...editable });
        if (!aliveRef.current) return;
        addToast(trans('admin.w.created'), 'success');
      } else if (editor.row) {
        await wfNewAdminApi.updateWord(editor.row.md5, { language, ...editable });
        if (!aliveRef.current) return;
        addToast(trans('admin.w.updated'), 'success');
      }
      setEditor(null);
      bumpReload();
    } catch (e: any) {
      toastError(e);
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  // ---- small render helpers ---- //

  const sortIndicator = (key: WfNewAdminWordSort): React.ReactNode => {
    if (sort !== key) return null;
    return order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const headerBtnCls = 'flex items-center gap-1 uppercase tracking-wider text-left hover:text-zinc-300 transition';

  // ---- render ---- //
  return (
    <div className="space-y-4">
      {/* Toolbar: language / coverage filter / search / add / total */}
      <div className={`p-4 sm:p-6 rounded-3xl ${activeTheme.cardClass}`}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            title={trans('admin.w.language')}
            className={`${INPUT_BASE_CLS} ${activeTheme.inputClass}`}
          >
            {langOptions.map((lang) => (
              <option key={lang} value={lang}>{capitalize(lang)}</option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => changeFilter(e.target.value as WfNewAdminWordFilter)}
            title={trans('admin.w.filter')}
            className={`${INPUT_BASE_CLS} ${activeTheme.inputClass}`}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{trans(f.labelKey)}</option>
            ))}
          </select>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={trans('admin.w.search')}
            className={`flex-1 min-w-[10rem] ${INPUT_BASE_CLS} ${activeTheme.inputClass}`}
          />
          <button
            type="button"
            onClick={() => setEditor({ mode: 'create', row: null })}
            className={`inline-flex items-center gap-1.5 ${CHIP_ACTIVE_CLS} hover:bg-indigo-500/25`}
          >
            <Plus className="w-3.5 h-3.5" /> {trans('admin.w.add')}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500">
              {trans('admin.w.total', { n: total })}
            </span>
            {/* query-count sort toggle (none → desc → asc) */}
            <button
              type="button"
              onClick={() => cycleSort('queries', 'desc')}
              title={trans('admin.w.queries', { n: total })}
              className={`inline-flex items-center gap-1 ${sort === 'queries' ? CHIP_ACTIVE_CLS : CHIP_CLS}`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {sortIndicator('queries')}
            </button>
          </div>
        </div>
      </div>

      {/* Batch action bar (appears with a non-empty selection) */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] px-4 py-2.5 flex flex-wrap gap-2 items-center"
          >
            <span className="text-[11px] font-mono font-bold text-indigo-300">
              {trans('admin.w.selected', { n: selected.size })}
            </span>
            <button type="button" onClick={() => runBatch('mark_valid')} disabled={batchBusy !== null} className={`inline-flex items-center gap-1 ${CHIP_CLS}`}>
              {batchBusy === 'mark_valid' && <Loader2 className="w-3 h-3 animate-spin" />}
              {trans('admin.w.act.valid')}
            </button>
            <button type="button" onClick={() => runBatch('mark_invalid')} disabled={batchBusy !== null} className={`inline-flex items-center gap-1 ${CHIP_CLS}`}>
              {batchBusy === 'mark_invalid' && <Loader2 className="w-3 h-3 animate-spin" />}
              {trans('admin.w.act.invalid')}
            </button>
            <button type="button" onClick={() => runBatch('requeue_tts')} disabled={batchBusy !== null} className={`inline-flex items-center gap-1 ${CHIP_CLS}`}>
              {batchBusy === 'requeue_tts' && <Loader2 className="w-3 h-3 animate-spin" />}
              {trans('admin.w.act.requeue')}
            </button>
            <button
              type="button"
              onClick={() => runBatch('delete')}
              disabled={batchBusy !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition disabled:opacity-40"
            >
              {batchBusy === 'delete' && <Loader2 className="w-3 h-3 animate-spin" />}
              {trans('admin.w.act.delete')}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={batchBusy !== null}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 transition disabled:opacity-40"
              title={trans('admin.cancel')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-[12px] font-mono text-rose-400">{error}</p>
            <button type="button" onClick={bumpReload} className={CHIP_CLS}>
              {trans('admin.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* column header (sm+; word/status headers cycle the server sort) */}
            <div className="hidden sm:grid grid-cols-[2rem_2rem_1fr_2fr_7rem_7rem] gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 items-center">
              <span>
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleSelectPage}
                  className="accent-indigo-500 w-3.5 h-3.5 align-middle"
                />
              </span>
              <span>#</span>
              <button type="button" onClick={() => cycleSort('word')} className={headerBtnCls}>
                {trans('admin.w.col.word')} {sortIndicator('word')}
              </button>
              <span>{trans('admin.w.col.translation')}</span>
              <button type="button" onClick={() => cycleSort('status')} className={headerBtnCls}>
                {trans('admin.w.col.status')} {sortIndicator('status')}
              </button>
              <span className="text-right">{trans('admin.w.col.actions')}</span>
            </div>

            {items.map((row, i) => {
              const isOpen = expanded.has(row.md5);
              const isPlaying = playingMd5 === row.md5;
              const rowPhonetic = row.us_phonetic || row.uk_phonetic || row.phonetic;
              const sen = sentencesByMd5[row.md5];
              return (
                <div key={row.md5} className="px-4 py-2.5 hover:bg-white/[0.03] transition">
                  <div className="grid grid-cols-[2rem_2rem_1fr_auto] sm:grid-cols-[2rem_2rem_1fr_2fr_7rem_7rem] gap-3 items-center">
                    <span>
                      <input
                        type="checkbox"
                        checked={selected.has(row.md5)}
                        onChange={() => toggleSelect(row.md5)}
                        className="accent-indigo-500 w-3.5 h-3.5 align-middle"
                      />
                    </span>
                    <span className="text-[11px] font-mono text-zinc-600">{start + i + 1}</span>
                    {/* word + phonetic */}
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-100 truncate block">{row.content}</span>
                      {rowPhonetic && (
                        <span className="text-[10px] font-mono text-zinc-500">/{rowPhonetic}/</span>
                      )}
                    </div>
                    {/* translations (truncated until expanded) */}
                    <div className="hidden sm:block min-w-0">
                      <p className={`text-[12px] text-zinc-300 ${isOpen ? '' : 'truncate'}`}>
                        {row.translations.length > 0 ? row.translations.join('；') : '—'}
                      </p>
                    </div>
                    {/* status chips */}
                    <div className="hidden sm:flex items-center gap-1">
                      {row.is_valid ? (
                        <span className="text-[9px] font-mono text-emerald-400/90 border border-emerald-500/30 rounded px-1">
                          {trans('admin.w.valid')}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-amber-500/80 border border-amber-500/30 rounded px-1">
                          {trans('admin.w.invalid')}
                        </span>
                      )}
                      {row.has_audio && (
                        <span className="p-1 rounded border border-sky-500/20 bg-sky-500/10 text-sky-300" title={trans('admin.w.f.withAudio')}>
                          <Volume2 className="w-3 h-3" />
                        </span>
                      )}
                      {row.has_translation && (
                        <span className="p-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" title={trans('admin.w.f.withTrans')}>
                          <Languages className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {/* actions */}
                    <div className="flex items-center justify-end gap-1">
                      {row.audio_url && (
                        <button
                          type="button"
                          onClick={() => togglePlay(row)}
                          className={`p-1.5 rounded-lg border transition ${
                            isPlaying
                              ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400'
                          }`}
                          title={trans('library.play')}
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditor({ mode: 'edit', row })}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 transition"
                        title={trans('admin.w.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 transition"
                        title={trans('admin.w.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(row)}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 transition"
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* expanded detail: full data + lazy example sentences */}
                  {isOpen && (
                    <div className="mt-2.5 ml-8 border-l border-white/10 pl-3 space-y-2.5">
                      {row.translations.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Languages className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-[12px] text-zinc-200">{row.translations.join('；')}</p>
                        </div>
                      )}
                      {(row.us_phonetic || row.uk_phonetic) && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                          {row.us_phonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />US /{row.us_phonetic}/</span>}
                          {row.uk_phonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />UK /{row.uk_phonetic}/</span>}
                        </div>
                      )}
                      {row.audio_path && (
                        <p className="text-[10px] font-mono text-zinc-500 truncate">
                          {row.audio_path}{row.audio_size ? ` · ${formatBytes(row.audio_size)}` : ''}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-zinc-500">
                        {trans('admin.w.queries', { n: row.query_count })}
                      </p>
                      {(row.validity_note || row.validity_source) && (
                        <p className="text-[10px] font-mono text-amber-400/90">
                          {row.validity_note}{row.validity_source ? ` · ${row.validity_source}` : ''}
                        </p>
                      )}
                      {/* lazy example sentences (cached per md5) */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                          {trans('admin.w.sentences')}
                        </p>
                        {!sen || sen.loading ? (
                          <p className="text-[11px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
                        ) : sen.error ? (
                          <p className="text-[11px] font-mono text-rose-400">{sen.error}</p>
                        ) : sen.sentences.length === 0 ? (
                          <p className="text-[11px] font-mono text-zinc-500">{trans('admin.w.noSentences')}</p>
                        ) : (
                          sen.sentences.map((s) => (
                            <div key={s.id} className="flex items-start gap-2">
                              <p className="text-[12px] text-zinc-300 flex-1 min-w-0">{s.text}</p>
                              <span className="text-[10px] font-mono text-zinc-500 shrink-0">×{s.occurrence_count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-1 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
            </button>
            <span className="px-3 text-[11px] font-mono text-zinc-400">
              {trans('content.pageOf', { page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add / edit modal (fresh mount per open — keyed by mode + row) */}
      {editor && (
        <WfNewAdminWordEditor
          key={`${editor.mode}-${editor.row?.md5 ?? 'new'}`}
          mode={editor.mode}
          row={editor.row}
          saving={saving}
          activeTheme={activeTheme}
          trans={trans}
          onCancel={() => { if (!saving) setEditor(null); }}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
};
