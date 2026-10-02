import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { wfNewAdminApi, adminErrorText } from '../../api';
import type { WfNewAdminLangRow, WfNewAdminStatistics } from '../../api';
import { formatNumber } from '../../../../core/utils/formatters';
import {
  AdminAsync, AdminLabel, AdminReveal, loadLanguageBreakdown, AdminTable, AdminTableRow, AdminTableShell, StatCard, useRequestGuard,
  type AdminPanelProps,
} from './adminKit';

const TABLE_GRID = 'grid-cols-[1fr_6rem_6rem_6rem_6rem]';

const fmt = (n: unknown): string => formatNumber(Number(n ?? 0), 0);

const pct = (part: number, words: number): string =>
  words > 0 ? `${Math.round((part / words) * 100)}%` : '';

const NumCell: React.FC<{ value: number; tone: string; share?: string }> = ({ value, tone, share }) => (
  <span className={`text-right text-[12px] font-mono ${value > 0 ? tone : 'text-zinc-600'}`}>
    {fmt(value)}
    {share && value > 0 ? <span className="ml-1 text-[9px] text-zinc-500">{share}</span> : null}
  </span>
);

export const WfNewAdminOverview: React.FC<AdminPanelProps> = ({ trans, addToast }) => {
  const [stats, setStats] = useState<WfNewAdminStatistics | null>(null);
  const [langs, setLangs] = useState<WfNewAdminLangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const guard = useRequestGuard();

  const load = useCallback(async () => {
    const id = guard.begin();
    setLoading(true);
    setError(null);
    try {
      const [s, breakdown] = await Promise.all([
        wfNewAdminApi.getStatistics(),
        loadLanguageBreakdown(true),
      ]);
      if (!guard.isCurrent(id)) return;
      setStats(s);
      setLangs(breakdown?.languages ?? []);
    } catch (e: any) {
      if (!guard.isCurrent(id)) return;
      if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
      setError(adminErrorText(e));
    } finally {
      if (guard.isCurrent(id)) setLoading(false);
    }
  }, [addToast, trans, guard]);

  useEffect(() => { load(); }, [load]);

  const summary = stats?.summary;
  const statCards = useMemo(() => ([
    { key: 'langs', label: trans('admin.ov.totalLangs'), value: fmt(summary?.total_languages), tone: 'text-slate-100' },
    { key: 'libs', label: trans('admin.ov.totalLibs'), value: fmt(summary?.total_libraries), tone: 'text-emerald-300' },
    { key: 'words', label: trans('admin.ov.totalWords'), value: fmt(summary?.total_words), tone: 'text-sky-300' },
    {
      key: 'tts',
      label: trans('admin.ov.ttsCoverage'),
      value: summary?.tts_percentage !== undefined ? `${summary.tts_percentage}%` : '—',
      tone: 'text-violet-300',
    },
  ]), [summary, trans]);

  return (
    <AdminReveal className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1" />
        <ChipButton onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {trans('admin.refresh')}
        </ChipButton>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statCards.map((c) => <StatCard key={c.key} label={c.label} value={c.value} tone={c.tone} />)}
      </div>

      <AdminTableShell>
        <div className="px-4 py-2.5 border-b border-white/5">
          <AdminLabel as="span">{trans('admin.ov.langTable')}</AdminLabel>
        </div>
        <AdminAsync trans={trans} loading={loading} error={error} empty={langs.length === 0} onRetry={load}>
          <AdminTable
            grid={TABLE_GRID}
            headClassName="hidden sm:grid"
            className="overflow-x-auto"
            head={(
              <>
                <span>{trans('admin.ov.col.language')}</span>
                <span className="text-right">{trans('admin.ov.col.words')}</span>
                <span className="text-right">{trans('admin.ov.col.translated')}</span>
                <span className="text-right">{trans('admin.ov.col.audio')}</span>
                <span className="text-right">{trans('admin.ov.col.invalid')}</span>
              </>
            )}
          >
            {langs.map((row) => (
              <AdminTableRow key={row.language} grid={TABLE_GRID}>
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-100 truncate">{row.language}</span>
                  {row.language_code && <span className="text-[10px] font-mono text-zinc-500">{row.language_code}</span>}
                </div>
                <NumCell value={row.words} tone="text-zinc-200" />
                <NumCell value={row.with_translation} tone="text-emerald-300" share={pct(row.with_translation, row.words)} />
                <NumCell value={row.with_audio} tone="text-sky-300" share={pct(row.with_audio, row.words)} />
                <NumCell value={row.invalid} tone="text-rose-400" />
              </AdminTableRow>
            ))}
          </AdminTable>
        </AdminAsync>
      </AdminTableShell>
    </AdminReveal>
  );
};
