/**
 * WordsManagerPanel — the enhanced "Words" tab for the Vocabulary page.
 *
 * Replaces the old read-only inline list with a full management surface:
 *   - a merged STATISTICS strip (per-language words / translated / audio /
 *     invalid, from /vocabulary/language-breakdown) so the separate Statistics
 *     tab is no longer needed;
 *   - a toolbar: language + coverage filter + search, an "Add word" button and
 *     Refresh;
 *   - a SORTABLE, selectable table (click Word / Translation / Phonetic / Queries /
 *     Status headers to sort asc/desc) with image thumbnails (or an explicit
 *     "no image" marker), translation, a dedicated Audio column (inline play/pause
 *     player + the file's server PATH and SIZE), phonetics, query count, validity +
 *     TTS badges and per-row Edit / Delete;
 *   - a batch action bar (delete / mark valid|invalid / requeue TTS) over the
 *     checked rows;
 *   - pagination (load page by page);
 *   - a view/EDIT/create modal (WordDetailModal) on row click / Add.
 *
 * All data goes through api.books.* (dictionary) + api.appQyV1; mutations hit
 * the new /dictionary/words[/batch] endpoints. Sorting is SERVER-SIDE over the
 * full filtered dataset (the sort key is sent to the backend, which orders all
 * rows before paginating) — not just the loaded page.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, RefreshCw, Volume2, CheckCircle2, XCircle, Pencil, Trash2,
  ChevronLeft, ChevronRight, Pause,
  Image as ImageIcon, Loader2, ListChecks,
  AudioLines, Languages as LanguagesIcon, BarChart3, Eye,
} from 'lucide-react';
import {
  api,
  type DictionaryWordRow,
  type DictionaryWordFilter,
  type DictionaryWordSort,
  type LanguageBreakdownRow,
} from '@/apps/laravel-manager/api';
import { laravelMediaUrl as mediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '@/core/logstore/logStore';
import WordDetailModal from './WordDetailModal';
import VocabularyStorageSummary from './VocabularyStorageSummary';
import { VocabularyWordsModel } from './words/VocabularyWordsModel';
import {
  PaginatedTableModel,
  type PaginatedTableSort,
} from './PaginatedTableModel';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import PaginatedSortHead from './PaginatedSortHead';
const PAGE_SIZE = 50;

// Resolve the first image to a loadable URL. The backend stores bare relative
// paths (e.g. 'en/word/<md5>.png'); prefix them with the word-image serve route
// and rebase onto the API origin so the <img> doesn't 404 against the page origin.
// Absolute / data: / blob: / root-relative values are passed straight through.
const firstImage = (row: DictionaryWordRow): string | null => {
  const imgs = row.image_files;
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const it: any = imgs[0];
  const raw: string | null = typeof it === 'string' ? it : (it?.url || it?.src || it?.path || null);
  if (!raw) return null;
  const abs = (/^(https?:)?\/\//i.test(raw) || /^(data|blob):/i.test(raw) || raw.startsWith('/'))
    ? raw
    : '/static/app_qy_v1/word_images/' + raw;
  return mediaUrl(abs);
};

// Human-readable file size for the audio metadata line.
const fmtBytes = (n?: number | null): string => {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const phonOf = (r: DictionaryWordRow): string => r.us_phonetic || r.uk_phonetic || r.phonetic || '';
const trOf = (r: DictionaryWordRow): string => (Array.isArray(r.translations) ? r.translations.join(', ') : '');

// Best-effort: the static audio file's basename (for display next to the player).
const audioName = (u: string): string => {
  try { return decodeURIComponent(u.split('?')[0].split('/').pop() || u); } catch { return u; }
};

// Fallback one-shot play when the shared <audio> element is unavailable.
const playAudio = (url?: string | null) => {
  if (!url) return;
  try { void new Audio(url).play(); } catch { /* ignore */ }
};

const WordsManagerPanel: React.FC = () => {
  const toast = useToast();
  const { lang } = useUnifiedApp();
  const text = TRANSLATIONS[lang].vocabulary.words_manager;

  // --- query state -------------------------------------------------------- #
  const [language, setLanguage] = useState('english');
  const [filter, setFilter] = useState<DictionaryWordFilter>('all');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [start, setStart] = useState(0);
  const [sort, setSort] = useState<PaginatedTableSort<DictionaryWordSort> | null>(null);

  // --- data --------------------------------------------------------------- #
  const [rows, setRows] = useState<DictionaryWordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<LanguageBreakdownRow | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Single shared <audio> element so only ONE row plays at a time.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const wordsRequestIdRef = useRef(0);
  const [playingMd5, setPlayingMd5] = useState<string | null>(null);

  // --- selection ---------------------------------------------------------- #
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);

  // --- modals ------------------------------------------------------------- #
  const [editWord, setEditWord] = useState<DictionaryWordRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'delete-one' | 'delete-batch'; word?: DictionaryWordRow } | null>(null);

  // Reset paging + selection whenever a query dimension (incl. sort) changes, so
  // the user lands on page 1 of the newly-ordered full dataset.
  useEffect(() => { setStart(0); setSelected(new Set()); }, [language, filter, query, sort]);

  const loadWords = useCallback(async () => {
    const requestId = ++wordsRequestIdRef.current;
    setLoading(true);
    try {
      const r = await api.books.getDictionaryWords({
        language, filter, q: query, start, limit: PAGE_SIZE,
        sort: sort?.key, order: sort?.order,
      });
      if (requestId !== wordsRequestIdRef.current) return;
      const d: any = r.success ? r.data : null;
      setRows(Array.isArray(d?.items) ? d.items : []);
      setTotal(Number(d?.total ?? 0));
    } catch (e: any) {
      if (requestId !== wordsRequestIdRef.current) return;
      logError('vocab', VocabularyWordsModel.format(text.load_words_failed, { error: e?.message || e }));
      setRows([]);
      setTotal(0);
    } finally {
      if (requestId === wordsRequestIdRef.current) setLoading(false);
    }
  }, [filter, language, query, reloadTick, sort, start, text.load_words_failed]);

  useEffect(() => { void loadWords(); }, [loadWords]);

  // Stats strip: one breakdown call per language change (cheap, cached server-side).
  const loadBreakdown = useCallback(async () => {
    try {
      const r = await api.books.getLanguageBreakdown();
      const items = r.success && Array.isArray(r.data?.languages) ? r.data.languages : [];
      const code = VocabularyWordsModel.languageCode(language);
      const match = items.find((x) => (x.language_code || '').toLowerCase() === code)
        || items.find((x) => (x.language || '').toLowerCase() === language);
      setBreakdown(match || null);
    } catch { setBreakdown(null); }
  }, [language]);

  useEffect(() => { void loadBreakdown(); }, [loadBreakdown, reloadTick]);

  const refresh = () => setReloadTick((t) => t + 1);

  // --- selection helpers -------------------------------------------------- #
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.md5));
  const toggleAll = () => setSelected((prev) => {
    if (rows.every((r) => prev.has(r.md5))) {
      const n = new Set(prev); rows.forEach((r) => n.delete(r.md5)); return n;
    }
    const n = new Set(prev); rows.forEach((r) => n.add(r.md5)); return n;
  });
  const toggleOne = (md5: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(md5) ? n.delete(md5) : n.add(md5); return n;
  });

  // --- batch actions ------------------------------------------------------ #
  const runBatch = useCallback(async (action: 'delete' | 'mark_valid' | 'mark_invalid' | 'requeue_tts') => {
    const md5s = Array.from(selected) as string[];
    if (md5s.length === 0) return;
    setBatching(true);
    const actionText = {
      delete: text.delete,
      mark_valid: text.mark_valid,
      mark_invalid: text.mark_invalid,
      requeue_tts: text.requeue_tts,
    }[action];
    const label = VocabularyWordsModel.format(text.batch_action, { action: actionText, count: md5s.length });
    logInfo('vocab', label);
    try {
      const r = await api.books.batchDictionaryWords({ language, md5s, action });
      if (r.success) {
        const affected = ((r.data as any)?.affected ?? (r as any).affected ?? 0);
        const message = VocabularyWordsModel.format(text.affected, { label, count: affected });
        toast.success(message);
        logSuccess('vocab', message);
        setSelected(new Set());
        refresh();
      } else {
        const message = VocabularyWordsModel.format(text.action_failed, {
          label,
          error: r.error || text.unknown_error,
        });
        toast.error(message);
        logError('vocab', message);
      }
    } catch (e: any) {
      const message = VocabularyWordsModel.format(text.action_failed, {
        label,
        error: e?.message || e,
      });
      toast.error(message);
      logError('vocab', message);
    } finally {
      setBatching(false);
      setConfirm(null);
    }
  }, [language, selected, text, toast]);

  const deleteOne = useCallback(async (word: DictionaryWordRow) => {
    try {
      const r = await api.books.deleteDictionaryWord(word.md5, language);
      if (r.success) {
        const message = VocabularyWordsModel.format(text.delete_success, { word: word.content });
        toast.success(message);
        logSuccess('vocab', message);
        setSelected((prev) => { const n = new Set(prev); n.delete(word.md5); return n; });
        refresh();
      } else {
        toast.error(r.error || text.delete_failed);
      }
    } catch (e: any) {
      toast.error(e?.message || text.delete_failed);
    } finally {
      setConfirm(null);
    }
  }, [language, text, toast]);

  const onSaved = useCallback(() => { refresh(); }, []);

  // --- derived ------------------------------------------------------------ #
  const pageNo = Math.floor(start / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const withTranslation = breakdown?.with_translation ?? 0;
  const words = breakdown?.words ?? 0;
  const invalid = breakdown?.invalid ?? 0;
  const stats = useMemo(() => ([
    { filter: 'all' as const, label: text.stats.words, value: words, Icon: BarChart3, accent: 'text-slate-700 dark:text-slate-200' },
    { filter: 'with_translation' as const, label: text.stats.translated, value: withTranslation, Icon: LanguagesIcon, accent: 'text-emerald-500' },
    { filter: 'without_translation' as const, label: text.stats.without_translation, value: breakdown?.without_translation ?? Math.max(0, words - withTranslation), Icon: LanguagesIcon, accent: 'text-amber-500' },
    { filter: 'with_audio' as const, label: text.stats.with_audio, value: breakdown?.with_audio ?? 0, Icon: AudioLines, accent: 'text-indigo-500' },
    { filter: 'without_audio' as const, label: text.stats.without_audio, value: breakdown?.without_audio ?? Math.max(0, words - (breakdown?.with_audio ?? 0)), Icon: AudioLines, accent: 'text-orange-500' },
    { filter: 'valid' as const, label: text.stats.valid, value: breakdown?.valid ?? Math.max(0, words - invalid), Icon: CheckCircle2, accent: 'text-teal-500' },
    { filter: 'invalid' as const, label: text.stats.invalid, value: invalid, Icon: XCircle, accent: 'text-rose-500' },
  ]), [breakdown, invalid, text, withTranslation, words]);

  const applyStatsFilter = useCallback((nextFilter: DictionaryWordFilter) => {
    setFilter(nextFilter);
    window.requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const selectCls = 'text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 focus:outline-none';

  // Click a header to cycle: asc -> desc -> unsorted. Sort is server-driven:
  // changing it reloads page 1 of the FULL ordered dataset (see loadWords).
  const toggleSort = useCallback((key: string) => {
    setSort((current) => PaginatedTableModel.nextSort(current, key as DictionaryWordSort));
  }, []);

  // Toggle play/pause for a row's static audio file (one shared element = no
  // overlap). audio_url is a root-relative serve path, so rebase onto the API
  // origin (mediaUrl is a no-op for already-absolute URLs).
  const togglePlay = useCallback((r: DictionaryWordRow) => {
    if (!r.audio_url) return;
    const src = mediaUrl(r.audio_url);
    const el = audioRef.current;
    if (!el) { playAudio(src); return; }
    if (playingMd5 === r.md5) { el.pause(); setPlayingMd5(null); return; }
    el.src = src;
    void el.play().then(() => setPlayingMd5(r.md5)).catch(() => setPlayingMd5(null));
  }, [playingMd5]);

  return (
    <div className="space-y-4">
      {/* shared audio element for the per-row players (one plays at a time) */}
      <audio ref={audioRef} onEnded={() => setPlayingMd5(null)} className="hidden" />

      <VocabularyStorageSummary>
      {/* merged statistics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        {stats.map(({ filter: statFilter, label, value, Icon, accent }) => (
          <button
            type="button"
            key={statFilter}
            onClick={() => applyStatsFilter(statFilter)}
            aria-pressed={filter === statFilter}
            className={`text-left rounded-xl border bg-white dark:bg-slate-800 p-3 transition hover:ring-2 hover:ring-indigo-400/40 ${
              filter === statFilter
                ? 'border-indigo-400 ring-2 ring-indigo-400/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
              <Icon className="w-3 h-3" /> {label}
              <Eye className="ml-auto w-3 h-3 opacity-50" />
            </div>
            <div className={`text-lg font-bold ${accent}`}>{value.toLocaleString()}</div>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
          {VocabularyWordsModel.languages.map((item) => (
            <option key={item.key} value={item.key}>{text.languages[item.key]}</option>
          ))}
        </select>
        <select className={selectCls} value={filter} onChange={(e) => setFilter(e.target.value as DictionaryWordFilter)}>
          {VocabularyWordsModel.filters.map((item) => (
            <option key={item} value={item}>{text.filters[item]}</option>
          ))}
        </select>
        <form
          className="flex items-center gap-1.5 flex-1 min-w-[180px]"
          onSubmit={(e) => { e.preventDefault(); setQuery(queryInput.trim()); }}
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${selectCls} w-full pl-8`} value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)} placeholder={text.search_placeholder} />
          </div>
          <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">{text.search}</button>
          {(query || queryInput) && (
            <button type="button" onClick={() => { setQueryInput(''); setQuery(''); }}
              className="px-2 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500">{text.clear}</button>
          )}
        </form>
        <button onClick={() => setCreateOpen(true)}
          className="px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {text.add_word}
        </button>
        <button onClick={refresh} disabled={loading}
          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50" title={text.refresh}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      </VocabularyStorageSummary>

      {/* batch action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5">
          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4" /> {VocabularyWordsModel.format(text.selected, { count: selected.size })}
          </span>
          <div className="flex-1" />
          <button disabled={batching} onClick={() => runBatch('mark_valid')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {text.mark_valid}
          </button>
          <button disabled={batching} onClick={() => runBatch('mark_invalid')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> {text.mark_invalid}
          </button>
          <button disabled={batching} onClick={() => runBatch('requeue_tts')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 flex items-center gap-1">
            <AudioLines className="w-3.5 h-3.5" /> {text.requeue_tts}
          </button>
          <button disabled={batching} onClick={() => setConfirm({ kind: 'delete-batch' })}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 flex items-center gap-1">
            {batching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {text.delete}
          </button>
        </div>
      )}

      {/* table */}
      <div ref={tableRef} className="scroll-mt-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500">
              <tr>
                <th className="w-9 px-2 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="w-12 px-2 py-2 text-left font-medium"> </th>
                <PaginatedSortHead label={text.columns.word} sortKey="word" sort={sort} onSort={toggleSort} className="px-2 py-2 font-medium text-left" />
                <PaginatedSortHead label={text.columns.translation} sortKey="translation" sort={sort} onSort={toggleSort} className="px-2 py-2 font-medium text-left" />
                <PaginatedSortHead label={text.columns.phonetic} sortKey="phonetic" sort={sort} onSort={toggleSort} className="px-2 py-2 font-medium text-left" />
                <PaginatedSortHead label={text.columns.audio} sortKey="audio" sort={sort} onSort={toggleSort} className="px-2 py-2 font-medium text-left" />
                <PaginatedSortHead label={text.columns.queries} sortKey="queries" sort={sort} onSort={toggleSort} className="w-20 px-2 py-2 font-medium text-center" />
                <PaginatedSortHead label={text.validity_field} sortKey="is_valid" sort={sort} onSort={toggleSort} className="w-32 px-2 py-2 font-medium text-center" />
                <th className="w-20 px-2 py-2 text-right font-medium">{text.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400 text-sm">{text.no_matching_words}</td></tr>
              ) : rows.map((r) => {
                const img = firstImage(r);
                const tr = trOf(r);
                const ph = phonOf(r);
                const validityValue = VocabularyWordsModel.rawValidityValue(r);
                return (
                  <tr key={r.md5}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => { setEditWord(r); setEditorOpen(true); }}>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.md5)} onChange={() => toggleOne(r.md5)} />
                    </td>
                    {/* Image: thumbnail when present (click to open full size);
                        an explicit "no image" placeholder otherwise — and the same
                        placeholder is revealed if the file 404s / fails to load. */}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      {img ? (
                        <a href={img} target="_blank" rel="noreferrer" title={text.open_image}>
                          <img src={img} alt="" loading="lazy" className="w-9 h-9 rounded object-cover border border-slate-200 dark:border-slate-700"
                            onError={(e) => {
                              const el = e.currentTarget;
                              el.style.display = 'none';
                              const ph = el.parentElement?.nextElementSibling as HTMLElement | null;
                              if (ph) ph.style.display = 'flex';
                            }} />
                        </a>
                      ) : null}
                      <div
                        className="w-9 h-9 rounded bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-300"
                        style={{ display: img ? 'none' : 'flex' }}
                        title={text.no_image}>
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{r.content}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-300 max-w-[16rem] truncate" title={tr}>{tr || <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-2 text-xs text-slate-500 font-mono">{ph || <span className="text-slate-300">—</span>}</td>
                    {/* Audio: inline play/pause player + the file basename link,
                        with the server PATH (/wwwroot/…) and SIZE underneath. */}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.audio_url ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => togglePlay(r)}
                              className="shrink-0 text-indigo-500 hover:text-indigo-400"
                              title={playingMd5 === r.md5 ? text.pause : text.play_audio}>
                              {playingMd5 === r.md5 ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <a href={mediaUrl(r.audio_url)} target="_blank" rel="noreferrer"
                              className="text-[11px] text-slate-500 dark:text-slate-300 hover:text-indigo-500 truncate max-w-[10rem]"
                              title={r.audio_url}>
                              {audioName(r.audio_url)}
                            </a>
                          </div>
                          {r.audio_path ? (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[15rem]"
                              title={`${r.audio_path}${r.audio_size != null ? `  (${fmtBytes(r.audio_size)})` : ''}`}>
                              {r.audio_path}{r.audio_size != null ? ` · ${fmtBytes(r.audio_size)}` : ''}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                          <AudioLines className="w-3.5 h-3.5 text-slate-300" />
                          {r.tts_status && r.tts_status !== 'done' ? r.tts_status : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-500 tabular-nums">{r.query_count ?? 0}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.is_valid
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-rose-500" />}
                        <code className="text-[11px] text-slate-600 dark:text-slate-300">
                          {text.validity_field}: {validityValue}
                        </code>
                      </div>
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditWord(r); setEditorOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10" title={text.edit}><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirm({ kind: 'delete-one', word: r })} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10" title={text.delete}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <span>{total > 0
            ? VocabularyWordsModel.format(text.result_count, {
              from: (start + 1).toLocaleString(),
              to: Math.min(start + PAGE_SIZE, total).toLocaleString(),
              total: total.toLocaleString(),
            })
            : text.no_results}</span>
          <div className="flex items-center gap-2">
            <button disabled={start === 0 || loading} onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> {text.previous}</button>
            <span>{VocabularyWordsModel.format(text.page_count, { page: pageNo, pages })}</span>
            <button disabled={start + PAGE_SIZE >= total || loading} onClick={() => setStart((s) => s + PAGE_SIZE)}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1">{text.next} <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* view / edit modal */}
      <WordDetailModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        language={language}
        word={editWord}
        onSaved={onSaved}
      />

      {/* create modal */}
      <WordDetailModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        language={language}
        word={null}
        onSaved={onSaved}
      />

      {/* destructive confirm */}
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => { if (!batching) setConfirm(null); }}
        onConfirm={() => {
          if (confirm?.kind === 'delete-one' && confirm.word) void deleteOne(confirm.word);
          else if (confirm?.kind === 'delete-batch') void runBatch('delete');
        }}
        title={confirm?.kind === 'delete-batch' ? text.delete_selected_title : text.delete_word_title}
        message={confirm?.kind === 'delete-batch'
          ? VocabularyWordsModel.format(text.delete_selected_message, {
            count: selected.size,
            language: VocabularyWordsModel.languageLabel(language, text.languages),
          })
          : VocabularyWordsModel.format(text.delete_word_message, {
            word: confirm?.word?.content ?? '',
            language: VocabularyWordsModel.languageLabel(language, text.languages),
          })}
        confirmText={text.delete}
        cancelText={TRANSLATIONS[lang].vocabulary.cancel}
        variant="danger"
        loading={batching}
      />
    </div>
  );
};

export default WordsManagerPanel;
