import React, { useCallback, useEffect, useState } from 'react';
import { RotateCw, Search } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import type { WfNewAdminLibrariesPage, WfNewAdminLibraryRow } from '../../api';
import { wfNewAdminApi, wfNewAdminCoverTaskModel, adminErrorText } from '../../api';
import type { LibraryCoverMode } from '@/core/integrations/laravel';
import { libraryCoverView, useLibraryCoverTasks } from '../../../../shared/library-cover/LibraryCoverTaskModel';
import { ADMIN_SEARCH_DEBOUNCE_MS } from '../../constants/uiTiming';
import { WfNewPager } from '../WfNewPager';
import { WfNewAdminLibraryCard } from './WfNewAdminLibraryCard';
import {
  AdminAsync, AdminPanel, adminInputClass, useAdminConfirm, useAdminLanguage, useDebouncedValue, useRequestGuard,
  type AdminPanelProps,
} from './adminKit';
import { clamp } from '../../../../core/utils/mathUtils';

const PER_PAGE = 24;

interface WfNewAdminLibrariesProps extends AdminPanelProps {
  onOpenLibrary: (id: string, title?: string, language?: string) => void;
}

export const WfNewAdminLibraries: React.FC<WfNewAdminLibrariesProps> = ({ activeTheme, trans, addToast, onOpenLibrary }) => {
  const { language, setLanguage, options: langOptions } = useAdminLanguage('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), ADMIN_SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WfNewAdminLibrariesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [brokenCovers, setBrokenCovers] = useState<Set<string>>(new Set());
  const coverTasks = useLibraryCoverTasks(wfNewAdminCoverTaskModel);
  const guard = useRequestGuard();
  const { confirm, dialog } = useAdminConfirm(trans);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const load = useCallback(() => {
    const id = guard.begin();
    setLoading(true);
    setError(null);
    wfNewAdminApi.getLibraries({
      language: language || undefined,
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        if (!guard.isCurrent(id)) return;
        setData(res);
        wfNewAdminCoverTaskModel.track(res?.libraries ?? []);
        setBrokenCovers(new Set());
      })
      .catch((e: any) => {
        if (!guard.isCurrent(id)) return;
        setError(adminErrorText(e));
        setData(null);
      })
      .finally(() => {
        if (guard.isCurrent(id)) setLoading(false);
      });
  }, [language, page, debouncedSearch, guard]);

  useEffect(() => { load(); }, [load]);

  const libraries = data?.libraries ?? [];
  const lastPage = data?.pagination?.last_page ?? 1;
  const total = data?.pagination?.total ?? 0;

  const changeLanguage = (value: string): void => {
    setLanguage(value);
    setPage(1);
  };

  const setBusyKey = (key: string, on: boolean): void => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  const enqueueCover = async (lib: WfNewAdminLibraryRow, mode: LibraryCoverMode): Promise<void> => {
    if (wfNewAdminCoverTaskModel.isActive(lib.id)) return;
    try {
      await wfNewAdminCoverTaskModel.enqueue([lib.id], mode);
      if (guard.isAlive()) addToast(trans('admin.lib.coverQueued'), 'success');
    } catch (e: any) {
      if (guard.isAlive()) addToast(adminErrorText(e), 'warning');
    }
  };

  const deleteLib = async (lib: WfNewAdminLibraryRow): Promise<void> => {
    const key = `delete-${lib.id}`;
    if (busy.has(key)) return;
    if (!(await confirm(trans('admin.lib.deleteAsk', { name: lib.name })))) return;
    setBusyKey(key, true);
    try {
      await wfNewAdminApi.deleteLibrary(lib.id);
      if (!guard.isAlive()) return;
      addToast(trans('admin.lib.deleted'), 'success');
      if (libraries.length <= 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e: any) {
      if (guard.isAlive()) addToast(adminErrorText(e), 'warning');
    } finally {
      if (guard.isAlive()) setBusyKey(key, false);
    }
  };

  return (
    <AdminPanel theme={activeTheme}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={language} onChange={(e) => changeLanguage(e.target.value)} className={adminInputClass(activeTheme, 'capitalize')}>
          <option value="">{trans('admin.w.f.all')}</option>
          {langOptions.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={trans('admin.lib.search')}
            className={`w-full pl-9 ${adminInputClass(activeTheme)}`}
          />
        </div>
        <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">{trans('admin.lib.total', { n: total })}</span>
        <ChipButton onClick={load} disabled={loading}>
          <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
        </ChipButton>
      </div>

      <AdminAsync trans={trans} loading={loading} error={error} empty={libraries.length === 0} onRetry={load}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraries.map((lib, i) => {
            const coverEntry = coverTasks.entries[lib.id];
            const cover = libraryCoverView(lib, coverEntry);
            const url = wfNewAdminApi.absUrl(cover.imageUrl);
            return (
              <WfNewAdminLibraryCard
                key={lib.id}
                lib={lib}
                index={i}
                cover={cover}
                coverMode={coverEntry?.mode}
                coverUrl={url && !brokenCovers.has(url) ? url : null}
                deleting={busy.has(`delete-${lib.id}`)}
                trans={trans}
                onCoverError={(broken) => setBrokenCovers((prev) => new Set(prev).add(broken))}
                onOpen={() => onOpenLibrary(String(lib.id), lib.name, lib.language)}
                onEnqueueCover={(mode) => { void enqueueCover(lib, mode); }}
                onDelete={() => { void deleteLib(lib); }}
              />
            );
          })}
        </div>
      </AdminAsync>

      {!loading && !error && (
        <WfNewPager variant="compact" page={page} totalPages={lastPage} onGoTo={(p) => setPage(clamp(p, 1, lastPage))} trans={trans} />
      )}
      {dialog}
    </AdminPanel>
  );
};
