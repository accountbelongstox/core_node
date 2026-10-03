/** Word Library: filterable catalog of vocabulary libraries as cover cards, each opening its word list. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Search, Star } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import type { StatusTone } from '@/shared/ui/statusTone';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Chips, controlClass, EmptyBlock, Notice, OpsPage, OpsStatusBar, Pager } from './opsKit';
import { useDebounced, useRemote } from './opsHooks';
import LibraryWordsSheet from './LibraryWordsSheet';
import type { LibrariesData, LibraryRow } from './opsTypes';

const PAGE_SIZE = 12;
const ALL = '';
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const DIFFICULTY_TONE: Record<string, StatusTone> = { beginner: 'emerald', intermediate: 'amber', advanced: 'rose' };

const WordLibraryWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [page, setPage] = useState(1);
  const [seenLanguages, setSeenLanguages] = useState<string[]>([]);
  const [open, setOpen] = useState<LibraryRow | null>(null);
  const query = useDebounced(search.trim(), 350);
  const libraries = useRemote(() => callToolApi<LibrariesData>(tool.apiMethod, {
    page,
    per_page: PAGE_SIZE,
    ...(query ? { search: query } : {}),
    ...(language ? { language } : {}),
    ...(difficulty ? { difficulty } : {}),
  }), [query, language, difficulty, page]);
  const rows = libraries.data?.libraries ?? [];
  const pagination = libraries.data?.pagination;

  useEffect(() => { setPage(1); }, [query, language, difficulty]);
  useEffect(() => {
    const found = rows.map((row) => row.language).filter((value): value is string => Boolean(value));
    if (found.length) setSeenLanguages((current) => Array.from(new Set([...current, ...found])).sort());
  }, [rows]);

  const languageOptions = useMemo(() => [{ value: ALL, label: t('toolsOps.library.all') }, ...seenLanguages.map((value) => ({ value, label: value }))], [seenLanguages, t]);

  return (
    <OpsPage>
      <OpsStatusBar accent="rose" mode="server" updatedAt={libraries.updatedAt} loading={libraries.loading} onRefresh={() => void libraries.reload()}>
        {pagination ? t('toolsOps.library.status', { total: pagination.total }) : t('toolsOps.common.loading')}
      </OpsStatusBar>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolsOps.library.search')} className={`${controlClass('rose')} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Chips accent="rose" value={language} onChange={setLanguage} options={languageOptions} nowrap className="max-w-full" />
          <Chips accent="rose" value={difficulty} onChange={setDifficulty} options={[{ value: ALL, label: t('toolsOps.library.any_level') }, ...DIFFICULTIES.map((value) => ({ value, label: t(`toolsOps.library.level_${value}`) }))]} />
        </div>
      </div>

      {libraries.error && <Notice tone="error">{libraries.error}</Notice>}

      {rows.length === 0 && !libraries.loading && !libraries.error ? (
        <EmptyBlock icon={BookOpen}>{t('toolsOps.library.empty')}</EmptyBlock>
      ) : (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${libraries.loading ? 'opacity-60' : ''}`}>
          {rows.map((row) => {
            const cover = row.image_url || row.cover_url;
            return (
              <button key={row.id} type="button" onClick={() => setOpen(row)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/40">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-500/20 dark:to-fuchsia-500/20">
                  {cover ? (
                    <img src={laravelMediaUrl(cover)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-4xl font-black text-rose-300 dark:text-rose-500/50">{row.name.slice(0, 1).toUpperCase()}</span>
                  )}
                  {row.is_recommended && <Star className="absolute right-2 top-2 h-5 w-5 fill-amber-400 text-amber-400 drop-shadow" />}
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.name}</p>
                  <p className="line-clamp-2 min-h-[2rem] text-xs text-slate-500 dark:text-slate-400">{row.description || row.category}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone="rose" tint>{t('toolsOps.library.words', { count: row.word_count })}</Pill>
                    {row.language && <Pill>{row.language}</Pill>}
                    {row.difficulty && <Pill tone={DIFFICULTY_TONE[row.difficulty] ?? 'neutral'} tint>{t(`toolsOps.library.level_${row.difficulty}`, { defaultValue: row.difficulty })}</Pill>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {pagination && pagination.last_page > 1 && (
        <Pager page={page} pages={pagination.last_page} onChange={setPage} accent="rose" summary={t('toolsOps.library.status', { total: pagination.total })} />
      )}
      <LibraryWordsSheet library={open} onClose={() => setOpen(null)} />
    </OpsPage>
  );
};

export default WordLibraryWorkbench;
