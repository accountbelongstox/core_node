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
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Pause,
  Image as ImageIcon, Loader2, ListChecks,
  AudioLines, Languages as LanguagesIcon, BarChart3,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { mediaUrl } from '../../config/constants';
import type { DictionaryWordRow, DictionaryWordFilter } from '@/apps/laravel-manager/api';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logstore/logStore';
import WordDetailModal from './WordDetailModal';

const LANGUAGES = ['english', 'chinese', 'japanese', 'korean', 'french', 'german', 'spanish'];
const FILTERS: { key: DictionaryWordFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'with_translation', label: 'Translated' },
  { key: 'without_translation', label: 'No translation' },
  { key: 'with_audio', label: 'With audio' },
  { key: 'without_audio', label: 'No audio' },
  { key: 'invalid', label: 'Invalid' },
];
const PAGE_SIZE = 50;

interface BreakdownRow {
  language_code?: string;
  language?: string;
  words: number;
  with_translation: number;
  with_audio: number;
  invalid: number;
}

// Which column to sort by. These keys are sent verbatim to the backend, which
// orders the FULL filtered dataset (not just the loaded page) — see loadWords.
type SortKey = 'word' | 'translation' | 'phonetic' | 'queries' | 'status';

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

const langCodeOf = (lang: string): string => ({
  english: 'en', chinese: 'zh', japanese: 'ja', korean: 'ko',
  french: 'fr', german: 'de', spanish: 'es',
} as Record<string, string>)[lang] || lang.slice(0, 2);

const WordsManagerPanel: React.FC = () => {
  const toast = useToast();

  // --- query state -------------------------------------------------------- #
  const [language, setLanguage] = useState('english');
  const [filter, setFilter] = useState<DictionaryWordFilter>('all');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [start, setStart] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  // --- data --------------------------------------------------------------- #
  const [rows, setRows] = useState<DictionaryWordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownRow | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Single shared <audio> element so only ONE row plays at a time.
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    setLoading(true);
    try {
      const r = await api.books.getDictionaryWords({
        language, filter, q: query, start, limit: PAGE_SIZE,
        sort: sort?.key, order: sort?.dir,
      });
      const d: any = r.success ? r.data : null;
      setRows(Array.isArray(d?.items) ? d.items : []);
      setTotal(Number(d?.total ?? 0));
    } catch (e: any) {
      logError('vocab', `Load words failed: ${e?.message || e}`);
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [language, filter, query, start, reloadTick, sort]);

  useEffect(() => { void loadWords(); }, [loadWords]);

  // Stats strip: one breakdown call per language change (cheap, cached server-side).
  const loadBreakdown = useCallback(async () => {
    try {
      const r = await api.books.getLanguageBreakdown();
      const items: BreakdownRow[] = (r.success && (r.data as any)?.languages) ? (r.data as any).languages : [];
      const code = langCodeOf(language);
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
    const label = `Batch ${action} (${md5s.length})`;
    logInfo('vocab', `${label}…`);
    try {
      const r = await api.books.batchDictionaryWords({ language, md5s, action });
      if (r.success) {
        const affected = ((r.data as any)?.affected ?? (r as any).affected ?? 0);
        toast.success(`${label}: ${affected} affected.`);
        logSuccess('vocab', `${label}: ${affected} affected`);
        setSelected(new Set());
        refresh();
      } else {
        toast.error(r.error || `${label} failed`);
        logError('vocab', `${label} failed: ${r.error || 'unknown'}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
      logError('vocab', `${label} failed: ${e?.message || e}`);
    } finally {
      setBatching(false);
      setConfirm(null);
    }
  }, [selected, language, toast]);

  const deleteOne = useCallback(async (word: DictionaryWordRow) => {
    try {
      const r = await api.books.deleteDictionaryWord(word.md5, language);
      if (r.success) {
        toast.success(`Deleted "${word.content}".`);
        logSuccess('vocab', `Deleted word ${word.content}`);
        setSelected((prev) => { const n = new Set(prev); n.delete(word.md5); return n; });
        refresh();
      } else {
        toast.error(r.error || 'Delete failed');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setConfirm(null);
    }
  }, [language, toast]);

  const onSaved = useCallback(() => { refresh(); }, []);

  // --- derived ------------------------------------------------------------ #
  const pageNo = Math.floor(start / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const withTranslation = breakdown?.with_translation ?? 0;
  const words = breakdown?.words ?? 0;
  const stats = useMemo(() => ([
    { label: 'Words', value: words, Icon: BarChart3, accent: 'text-slate-700 dark:text-slate-200' },
    { label: 'Translated', value: withTranslation, Icon: LanguagesIcon, accent: 'text-emerald-500' },
    { label: 'No translation', value: Math.max(0, words - withTranslation), Icon: LanguagesIcon, accent: 'text-amber-500' },
    { label: 'With audio', value: breakdown?.with_audio ?? 0, Icon: AudioLines, accent: 'text-indigo-500' },
    { label: 'Invalid', value: breakdown?.invalid ?? 0, Icon: XCircle, accent: 'text-rose-500' },
  ]), [words, withTranslation, breakdown]);

  const selectCls = 'text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 focus:outline-none';

  // Click a header to cycle: asc -> desc -> unsorted. Sort is server-driven:
  // changing it reloads page 1 of the FULL ordered dataset (see loadWords).
  const toggleSort = useCallback((key: SortKey) => {
    setSort((s) => (s && s.key === key
      ? (s.dir === 'asc' ? { key, dir: 'desc' } : null)
      : { key, dir: 'asc' }));
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

  // Sortable header cell.
  const SortHead: React.FC<{ k: SortKey; label: string; align?: 'left' | 'center' | 'right'; extra?: string }> =
    ({ k, label, align = 'left', extra = '' }) => (
      <th
        className={`px-2 py-2 font-medium select-none cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400 text-${align} ${extra}`}
        onClick={() => toggleSort(k)}
        title="Click to sort"
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
          {label}
          {sort?.key === k
            ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
            : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
        </span>
      </th>
    );

  return (
    <div className="space-y-4">
      {/* shared audio element for the per-row players (one plays at a time) */}
      <audio ref={audioRef} onEnded={() => setPlayingMd5(null)} className="hidden" />

      {/* merged statistics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {stats.map(({ label, value, Icon, accent }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
              <Icon className="w-3 h-3" /> {label}
            </div>
            <div className={`text-lg font-bold ${accent}`}>{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
        </select>
        <select className={selectCls} value={filter} onChange={(e) => setFilter(e.target.value as DictionaryWordFilter)}>
          {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <form
          className="flex items-center gap-1.5 flex-1 min-w-[180px]"
          onSubmit={(e) => { e.preventDefault(); setQuery(queryInput.trim()); }}
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${selectCls} w-full pl-8`} value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)} placeholder="Search words…" />
          </div>
          <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Search</button>
          {(query || queryInput) && (
            <button type="button" onClick={() => { setQueryInput(''); setQuery(''); }}
              className="px-2 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500">Clear</button>
          )}
        </form>
        <button onClick={() => setCreateOpen(true)}
          className="px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add word
        </button>
        <button onClick={refresh} disabled={loading}
          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* batch action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5">
          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4" /> {selected.size} selected
          </span>
          <div className="flex-1" />
          <button disabled={batching} onClick={() => runBatch('mark_valid')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark valid
          </button>
          <button disabled={batching} onClick={() => runBatch('mark_invalid')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Mark invalid
          </button>
          <button disabled={batching} onClick={() => runBatch('requeue_tts')}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 flex items-center gap-1">
            <AudioLines className="w-3.5 h-3.5" /> Requeue TTS
          </button>
          <button disabled={batching} onClick={() => setConfirm({ kind: 'delete-batch' })}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 flex items-center gap-1">
            {batching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
          </button>
        </div>
      )}

      {/* table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500">
              <tr>
                <th className="w-9 px-2 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="w-12 px-2 py-2 text-left font-medium"> </th>
                <SortHead k="word" label="Word" />
                <SortHead k="translation" label="Translation" />
                <SortHead k="phonetic" label="Phonetic" />
                <th className="px-2 py-2 text-left font-medium">Audio</th>
                <SortHead k="queries" label="Queries" align="center" extra="w-20" />
                <SortHead k="status" label="Status" align="center" extra="w-16" />
                <th className="w-20 px-2 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400 text-sm">No words match this filter.</td></tr>
              ) : rows.map((r) => {
                const img = firstImage(r);
                const tr = trOf(r);
                const ph = phonOf(r);
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
                        <a href={img} target="_blank" rel="noreferrer" title="Open image">
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
                        title="No image">
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
                              title={playingMd5 === r.md5 ? 'Pause' : 'Play audio'}>
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
                      <div className="flex items-center justify-center">
                        {r.is_valid
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-rose-500" />}
                      </div>
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditWord(r); setEditorOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirm({ kind: 'delete-one', word: r })} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <span>{total > 0 ? `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total.toLocaleString()}` : '0 results'}</span>
          <div className="flex items-center gap-2">
            <button disabled={start === 0 || loading} onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
            <span>{pageNo} / {pages}</span>
            <button disabled={start + PAGE_SIZE >= total || loading} onClick={() => setStart((s) => s + PAGE_SIZE)}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1">Next <ChevronRight className="w-3.5 h-3.5" /></button>
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
        title={confirm?.kind === 'delete-batch' ? 'Delete selected words' : 'Delete word'}
        message={confirm?.kind === 'delete-batch'
          ? `Permanently delete ${selected.size} selected word(s) from the ${language} dictionary? This cannot be undone.`
          : `Permanently delete "${confirm?.word?.content}" from the ${language} dictionary? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={batching}
      />
    </div>
  );
};

export default WordsManagerPanel;
