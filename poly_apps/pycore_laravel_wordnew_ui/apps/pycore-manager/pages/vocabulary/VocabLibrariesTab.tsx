/**
 * Libraries tab - vocabulary libraries by language, with cover tasks, delete,
 * and a paginated library-words detail modal. Loaded directly from Laravel.
 *
 * Params mirror AppQyV1.getLibraries (language/page/per_page) and
 * getLibraryWords (page/per_page).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, BookOpen, X, ChevronLeft, ChevronRight, Wand2, ScanSearch } from 'lucide-react';
import {
  laravelApi,
  libraryCoverView,
  pcLibraryCoverTaskModel,
  useLibraryCoverTasks,
} from '@/apps/pycore-manager/api';
import type {
  LibraryCoverMode,
  LibraryCoverView,
  VocabLibrary,
  VocabLibraryWordRow,
  VocabLibraryWordsResponse,
} from '@/apps/pycore-manager/api';
import { VL, VocabBanner, VocabLoading, PresenceBadge, humanInt, vp, toArray } from './vocabShared';

const L = {
  languagePh: 'english',
  openLib: 'Open',
  words: 'words',
  noCover: 'No cover',
  detailTitle: 'Library words',
  empty: 'No libraries.',
};

function VocabCoverImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const target = targetRef.current;
    if (!target || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '120px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (visible) setSrc(laravelApi.getVocabResourceUrl(url));
  }, [url, visible]);
  return src
    ? <img src={src} alt={alt} className="w-full h-full object-cover" />
    : <span ref={targetRef} className="w-full h-full flex items-center justify-center text-slate-600"><BookOpen className="w-8 h-8" /></span>;
}

function CoverTaskChip({ cover }: { cover: LibraryCoverView }) {
  const { t } = useTranslation('pc');
  if (cover.phase === 'queued' || cover.phase === 'processing' || cover.phase === 'failed') {
    const label = cover.phase === 'processing' && cover.handler
      ? t('vocabularyPage.libraries.coverStatus.processingBy', {
        handler: t(`vocabularyPage.libraries.coverHandler.${cover.handler}`),
      })
      : t(`vocabularyPage.libraries.coverStatus.${cover.phase}`);
    const tone = cover.phase === 'failed' ? 'bg-rose-500/80' : cover.phase === 'queued' ? 'bg-amber-500/80' : 'bg-sky-500/80';
    return (
      <span title={cover.taskError ?? undefined}
        className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded text-white ${tone}`}>
        {label}
      </span>
    );
  }
  if (cover.coverStatus && cover.coverStatus !== 'ready') {
    return (
      <span title={cover.errorMessage ?? undefined}
        className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/80 text-white">
        {cover.coverStatus}
      </span>
    );
  }
  return null;
}

export default function VocabLibrariesTab() {
  const { t } = useTranslation('pc');
  const coverTasks = useLibraryCoverTasks(pcLibraryCoverTaskModel);
  const [language, setLanguage] = useState('english');
  const [libs, setLibs] = useState<VocabLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VocabLibrary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await laravelApi.getVocabLibraries({ language, page: 1, per_page: 100 });
      const list = toArray<VocabLibrary>(vp(r));
      setLibs(list);
      pcLibraryCoverTaskModel.track(list);
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : VL.error;
      if (/offline|unavailable|Failed to fetch|timed out/i.test(msg)) setOffline(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => { void load(); }, [load]);

  const enqueueCover = async (lib: VocabLibrary, mode: LibraryCoverMode) => {
    try {
      await pcLibraryCoverTaskModel.enqueue([lib.id], mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  const deleteLib = async (lib: VocabLibrary) => {
    if (!confirm(VL.confirmDelete)) return;
    try {
      await laravelApi.deleteVocabLibrary(lib.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  if (loading && libs.length === 0) return <VocabLoading />;
  if (offline && libs.length === 0) return <VocabBanner kind="offline" message={VL.offline} />;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{VL.language}</span>
          <input value={language} onChange={(e) => setLanguage(e.target.value)}
            placeholder={L.languagePh}
            className="w-32 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400" />
        </label>
        <button onClick={load}
          className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-400">{VL.refresh}</button>
      </div>

      {error && <VocabBanner kind="error" message={error} />}

      {libs.length === 0 ? (
        <p className="py-8 text-center text-slate-500">{L.empty}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {libs.map((lib) => {
            const cover = libraryCoverView(lib, coverTasks.entries[lib.id]);
            return (
              <div key={lib.id} className="rounded-lg border border-slate-700 bg-slate-800/40 overflow-hidden">
                <button onClick={() => setDetail(lib)} className="block w-full aspect-[3/4] bg-slate-900 relative">
                  {cover.imageUrl ? (
                    <VocabCoverImage url={cover.imageUrl} alt={lib.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <CoverTaskChip cover={cover} />
                </button>
                <div className="p-2 space-y-1">
                  <div className="text-sm font-medium text-slate-100 truncate">{lib.name}</div>
                  <div className="text-xs text-slate-400">{humanInt(lib.word_count)} {L.words}</div>
                  <div className="flex items-center gap-1 pt-1">
                    <button onClick={() => setDetail(lib)} title={L.openLib}
                      className="flex-1 px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-200 hover:bg-slate-700">{L.openLib}</button>
                    <IconBtn title={t('vocabularyPage.libraries.regenerateCover')}
                      onClick={() => void enqueueCover(lib, 'generate')} disabled={cover.active}>
                      {cover.active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    </IconBtn>
                    <IconBtn title={t('vocabularyPage.libraries.researchCover')}
                      onClick={() => void enqueueCover(lib, 'search')} disabled={cover.active}>
                      <ScanSearch className="w-3.5 h-3.5" />
                    </IconBtn>
                    <IconBtn title={VL.delete} onClick={() => deleteLib(lib)} danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <LibraryDetailModal lib={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function LibraryDetailModal({ lib, onClose }: { lib: VocabLibrary; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [words, setWords] = useState<VocabLibraryWordRow[]>([]);
  const [stats, setStats] = useState<VocabLibraryWordsResponse['stats'] | null>(null);
  const [pagination, setPagination] = useState<{ total?: number; last_page?: number; has_more?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const perPage = 50;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    laravelApi.getVocabLibraryWords(lib.id, { page, per_page: perPage })
      .then((r) => {
        if (cancelled) return;
        const p = vp<any>(r);
        setWords(toArray<VocabLibraryWordRow>(p));
        setStats(p?.stats || null);
        setPagination(p?.pagination || null);
      })
      .catch(() => { if (!cancelled) setWords([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lib.id, page]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{lib.name}</h3>
            <div className="text-xs text-slate-400">{lib.language} · {humanInt(lib.word_count)} {L.words}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-2 px-4 py-2 text-xs text-slate-300 border-b border-slate-800">
            <Stat label="Total" v={stats.total} />
            <Stat label="Translated" v={stats.translated} />
            <Stat label="Audio" v={stats.with_audio} />
            <Stat label="Image" v={stats.with_image} />
            <Stat label="Invalid" v={stats.invalid} />
          </div>
        )}

        <div className="overflow-auto flex-1">
          {loading ? <VocabLoading /> : words.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{VL.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-400 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Word</th>
                  <th className="px-3 py-2 text-left">Translations</th>
                  <th className="px-3 py-2 text-center">T</th>
                  <th className="px-3 py-2 text-center">A</th>
                </tr>
              </thead>
              <tbody>
                {words.map((w, i) => (
                  <tr key={w.md5 || w.word || i} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-100">{w.word}</td>
                    <td className="px-3 py-2 text-slate-300"><div className="truncate max-w-xs">{(w.translations || []).join('; ')}</div></td>
                    <td className="px-3 py-2 text-center"><PresenceBadge ok={!!w.has_translation} yesLabel="T" noLabel="-" /></td>
                    <td className="px-3 py-2 text-center"><PresenceBadge ok={!!w.has_audio} yesLabel="A" noLabel="-" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between p-3 border-t border-slate-700 text-sm text-slate-400">
          <span>{pagination?.total != null ? `${humanInt(pagination.total)} ${VL.total}` : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50"><ChevronLeft className="w-4 h-4" /></button>
            <span>{page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!pagination?.has_more}
              className="p-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v?: number }) {
  return <span className="px-2 py-0.5 rounded bg-slate-800/60">{label}: <b className="text-slate-100">{humanInt(v)}</b></span>;
}

function IconBtn({ title, onClick, children, disabled, danger }: {
  title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`p-1 rounded hover:bg-slate-700/50 disabled:opacity-40 ${danger ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}>
      {children}
    </button>
  );
}
