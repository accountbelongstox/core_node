/**
 * WfNewAdminLibraries — super-admin "libraries" panel: the vocabulary library
 * catalog manager. Mounted by WfNewAdminPage (loopback super mode only).
 *
 * All data flows through the pinned admin gateway (wfNewAdminApi — page-origin
 * base, never the failover pool):
 *   - getLibraries({language, page, perPage, search})  → paginated card grid
 *   - getLanguageBreakdown()                           → language <select> options
 *   - retryCovers([id])                                → re-queue one AI cover
 *   - deleteLibrary(id)                                → sanctum-gated destroy
 *
 * Card grid (not a table): each library renders its AI cover (absUrl-resolved,
 * gradient fallback on missing/broken image) with cover_status overlay chips,
 * meta rows and an action strip: "view words" (delegates to the app's existing
 * #/library word-browser via onOpenLibrary), "retry cover" (only while the
 * cover isn't completed) and delete (confirm + spinner).
 *
 * The chosen language is persisted in a localStorage key SHARED with the words
 * panel ('wfnew_admin_lang'); the empty 'all' choice is panel-local and never
 * overwrites the stored concrete language. Loads are guarded against
 * out-of-order responses (reqId) and unmount (alive ref); per-card action busy
 * flags swallow double-clicks.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, LibraryBig,
  Loader2, RotateCw, Search, Star, Trash2,
} from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';
import type { WfNewAdminLibrariesPage, WfNewAdminLibraryRow } from '../../api';
import { wfNewAdminApi } from '../../api';
import { pycoreApi } from '../../../../core/api-libs/pycore';

/** Language selection shared with the words panel (concrete languages only). */
const ADMIN_LANG_KEY = 'wfnew_admin_lang';

/** Shown while the breakdown is loading or when the endpoint fails. */
const FALLBACK_LANGUAGES = ['english', 'chinese', 'japanese', 'korean', 'french', 'german', 'spanish'];

const PER_PAGE = 24;
const SEARCH_DEBOUNCE_MS = 400;

function readStoredLanguage(): string {
  try { return localStorage.getItem(ADMIN_LANG_KEY) ?? ''; } catch { return ''; }
}

function writeStoredLanguage(lang: string): void {
  try { localStorage.setItem(ADMIN_LANG_KEY, lang); } catch { /* ignore */ }
}

const CHIP_CLS = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 disabled:opacity-40 transition';

interface WfNewAdminLibrariesProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;
  /** Open a library in the app's existing #/library word-browser page. */
  onOpenLibrary: (id: string, title?: string, language?: string) => void;
}

export const WfNewAdminLibraries: React.FC<WfNewAdminLibrariesProps> = ({
  activeTheme,
  trans,
  addToast,
  onOpenLibrary,
}) => {
  const [languages, setLanguages] = useState<string[]>(FALLBACK_LANGUAGES);
  const [language, setLanguage] = useState<string>(() => readStoredLanguage());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WfNewAdminLibrariesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** In-flight per-card actions, keyed `retry-<id>` / `delete-<id>`. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  /** Library ids whose cover <img> failed to load (gradient fallback). */
  const [brokenCovers, setBrokenCovers] = useState<Set<number>>(new Set());

  // Out-of-order + unmount guards for every list load.
  const reqIdRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // ---- language options (source of truth: the dictionary breakdown) -------- //
  useEffect(() => {
    let alive = true;
    wfNewAdminApi.getLanguageBreakdown()
      .then((res) => {
        if (!alive) return;
        const langs = (res?.languages ?? []).map((r) => r.language).filter(Boolean);
        if (langs.length > 0) setLanguages(langs);
      })
      .catch(() => { /* keep the fallback list */ });
    return () => { alive = false; };
  }, []);

  // Keep a persisted language visible in the <select> even if the breakdown
  // no longer reports it (e.g. its words were deleted but libraries remain).
  const langOptions = useMemo(
    () => (language && !languages.includes(language) ? [...languages, language] : languages),
    [languages, language],
  );

  // ---- debounced search ----------------------------------------------------- //
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // ---- list load ------------------------------------------------------------ //
  const load = useCallback(() => {
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    wfNewAdminApi.getLibraries({
      language: language || undefined,
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        if (!aliveRef.current || id !== reqIdRef.current) return;
        setData(res);
        setBrokenCovers(new Set());
      })
      .catch((e: any) => {
        if (!aliveRef.current || id !== reqIdRef.current) return;
        setError(String(e?.message || 'Request failed'));
        setData(null);
      })
      .finally(() => {
        if (aliveRef.current && id === reqIdRef.current) setLoading(false);
      });
  }, [language, page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const libraries = data?.libraries ?? [];
  const pg = data?.pagination;
  const lastPage = pg?.last_page ?? 1;
  const total = pg?.total ?? 0;

  const changeLanguage = (value: string): void => {
    setLanguage(value);
    // The 'all' choice is panel-local — never clobber the shared stored language.
    if (value) writeStoredLanguage(value);
    setPage(1);
  };

  const goTo = (p: number): void => {
    setPage(Math.max(1, Math.min(p, lastPage)));
  };

  // ---- per-card actions ------------------------------------------------------ //
  const withBusy = (key: string, on: boolean): void => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  const toastActionError = (e: any): void => {
    if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
    else addToast(String(e?.message || 'Request failed'), 'warning');
  };

  const retryCover = async (lib: WfNewAdminLibraryRow): Promise<void> => {
    const key = `retry-${lib.id}`;
    if (busy.has(key)) return;
    withBusy(key, true);
    try {
      await pycoreApi.prioritizeCovers([Number(lib.id)]);
      if (!aliveRef.current) return;
      addToast(trans('admin.lib.coverQueued'), 'success');
      load();
    } catch (e: any) {
      if (aliveRef.current) toastActionError(e);
    } finally {
      if (aliveRef.current) withBusy(key, false);
    }
  };

  const deleteLib = async (lib: WfNewAdminLibraryRow): Promise<void> => {
    const key = `delete-${lib.id}`;
    if (busy.has(key)) return;
    if (!window.confirm(trans('admin.lib.deleteAsk', { name: lib.name }))) return;
    withBusy(key, true);
    try {
      await wfNewAdminApi.deleteLibrary(lib.id);
      if (!aliveRef.current) return;
      addToast(trans('admin.lib.deleted'), 'success');
      // Step back a page when the page's last card was deleted (setPage reloads).
      if (libraries.length <= 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e: any) {
      if (aliveRef.current) toastActionError(e);
    } finally {
      if (aliveRef.current) withBusy(key, false);
    }
  };

  return (
    <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
      {/* Toolbar: language filter + debounced search + total + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value)}
          className={`py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none capitalize ${activeTheme.inputClass}`}
        >
          <option value="">{trans('admin.w.f.all')}</option>
          {langOptions.map((l) => (
            <option key={l} value={l} className="capitalize">{l}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={trans('admin.lib.search')}
            className={`w-full py-2.5 pl-9 pr-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
          />
        </div>
        <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
          {trans('admin.lib.total', { n: total })}
        </span>
        <button type="button" onClick={load} disabled={loading} className={CHIP_CLS}>
          <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
        </button>
      </div>

      {/* Card grid / states */}
      {loading ? (
        <div className="p-8 text-center">
          <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-2">
          <p className="text-[12px] font-mono text-rose-400">{error}</p>
          <button type="button" onClick={load} className={CHIP_CLS}>
            {trans('admin.retry')}
          </button>
        </div>
      ) : libraries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraries.map((lib, i) => {
            const coverUrl = wfNewAdminApi.absUrl(lib.image_url);
            const showImg = !!coverUrl && !brokenCovers.has(lib.id);
            const coverFailed = lib.cover_status === 'failed';
            const coverPending = lib.cover_status === 'pending' || lib.cover_status === 'generating';
            const retrying = busy.has(`retry-${lib.id}`);
            const deleting = busy.has(`delete-${lib.id}`);
            return (
              <motion.div
                key={lib.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.3) }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:bg-white/[0.05] transition flex flex-col"
              >
                {/* Cover + status overlay */}
                <div className="relative">
                  {showImg ? (
                    <img
                      src={coverUrl as string}
                      alt={lib.name}
                      loading="lazy"
                      onError={() => setBrokenCovers((prev) => new Set(prev).add(lib.id))}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="h-28 w-full bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      <LibraryBig className="w-8 h-8 text-white/25" />
                    </div>
                  )}
                  {coverFailed && (
                    <span className="absolute top-2 right-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/20 text-rose-300">
                      {trans('admin.lib.cover.failed')}
                    </span>
                  )}
                  {coverPending && (
                    <span className="absolute top-2 right-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 text-amber-300">
                      {trans('admin.lib.cover.pending')}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="px-3.5 py-3 space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-extrabold tracking-tight truncate">{lib.name}</h4>
                    {lib.is_recommended && (
                      <span className="shrink-0 p-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <Star className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 truncate capitalize">
                    {lib.language} · {lib.category}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500">
                    {trans('admin.lib.words', { n: lib.word_count })}
                  </p>
                </div>

                {/* Actions */}
                <div className="border-t border-white/5 px-3 py-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenLibrary(String(lib.id), lib.name, lib.language)}
                    className={CHIP_CLS}
                  >
                    <BookOpen className="w-3 h-3" /> {trans('admin.lib.view')}
                  </button>
                  {lib.cover_status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => retryCover(lib)}
                      disabled={retrying}
                      className={CHIP_CLS}
                    >
                      {retrying
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <ImageIcon className="w-3 h-3" />}
                      {trans('admin.lib.retryCover')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteLib(lib)}
                    disabled={deleting}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-40 transition"
                  >
                    {deleting
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />}
                    {trans('admin.lib.delete')}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && lastPage > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
          </button>
          <span className="px-3 text-[11px] font-mono text-zinc-400">
            {trans('content.pageOf', { page, total: lastPage })}
          </span>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= lastPage}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
          >
            {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
