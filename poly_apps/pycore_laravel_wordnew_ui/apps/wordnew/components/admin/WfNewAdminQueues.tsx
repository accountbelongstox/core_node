import React, { useCallback, useEffect, useState } from 'react';
import { ListTodo, Languages, RefreshCw, Activity, Send } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { wfNewAdminApi, adminErrorText } from '../../api';
import type {
  WfNewAdminTtsQueueStats, WfNewAdminQueueItem, WfNewAdminTransTask,
} from '../../api';
import { formatNumber } from '../../../../core/utils/formatters';
import { WfNewPager } from '../WfNewPager';
import {
  AdminAsync, AdminLabel, AdminPanel, AdminReveal, AdminTable, AdminTableRow, AdminTableShell, useRequestGuard,
  type AdminPanelProps,
} from './adminKit';
import { clamp } from '../../../../core/utils/mathUtils';

const PAGE_SIZE = 20;
const POLL_MS = 5000;
const TRANS_REVEAL_DELAY_SECONDS = 0.05;
const ITEM_GRID = 'grid-cols-[1fr_5rem_6rem_5rem]';
const TRANS_GRID = 'grid-cols-[1fr_5rem_6rem_3rem]';

const STATUS_KEYS = ['pending', 'processing', 'completed', 'failed'] as const;

const STATUS_TONES: Record<string, { chip: string; active: string; label: string }> = {
  pending: {
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    active: 'border-amber-400/60 bg-amber-500/20 text-amber-200',
    label: 'admin.q.pending',
  },
  processing: {
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    active: 'border-sky-400/60 bg-sky-500/20 text-sky-200',
    label: 'admin.q.processing',
  },
  completed: {
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    active: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200',
    label: 'admin.q.completed',
  },
  failed: {
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    active: 'border-rose-400/60 bg-rose-500/20 text-rose-200',
    label: 'admin.q.failed',
  },
};

const NEUTRAL_CHIP = 'border-white/10 bg-white/5 text-zinc-400';
const STATUS_CHIP_CLS = 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border';

const statusTone = (status?: string): string =>
  (status && STATUS_TONES[status]?.chip) || NEUTRAL_CHIP;

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => (
  <span>
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${statusTone(status)}`}>{status ?? '—'}</span>
  </span>
);

const QueueHeader: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-center gap-2 flex-wrap">
    {icon}
    <AdminLabel as="h3">{title}</AdminLabel>
    <div className="min-w-0 flex-1" />
    {children}
  </div>
);

export const WfNewAdminQueues: React.FC<AdminPanelProps> = ({ activeTheme, trans, addToast }) => {
  const [stats, setStats] = useState<WfNewAdminTtsQueueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [items, setItems] = useState<WfNewAdminQueueItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [transPending, setTransPending] = useState(0);
  const [transTasks, setTransTasks] = useState<WfNewAdminTransTask[]>([]);
  const [transLoading, setTransLoading] = useState(true);
  const [transError, setTransError] = useState<string | null>(null);
  const [enqueueBusy, setEnqueueBusy] = useState(false);

  const statsGuard = useRequestGuard();
  const itemsGuard = useRequestGuard();
  const transGuard = useRequestGuard();

  const totalPages = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE));

  const loadStats = useCallback(async (): Promise<boolean> => {
    const id = statsGuard.begin();
    setStatsLoading(true);
    try {
      const s = await wfNewAdminApi.getTtsQueueStats();
      if (!statsGuard.isCurrent(id)) return false;
      setStats(s);
      setStatsError(null);
      return true;
    } catch (e: any) {
      if (!statsGuard.isCurrent(id)) return false;
      setStatsError(adminErrorText(e));
      return false;
    } finally {
      if (statsGuard.isCurrent(id)) setStatsLoading(false);
    }
  }, [statsGuard]);

  const loadItems = useCallback(async (pageArg: number, statusArg: string | null): Promise<boolean> => {
    const id = itemsGuard.begin();
    setItemsLoading(true);
    try {
      const res = await wfNewAdminApi.getTtsQueueItems({
        ...(statusArg ? { status: statusArg } : {}),
        start: (pageArg - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (!itemsGuard.isCurrent(id)) return false;
      setItems(Array.isArray(res?.items) ? res.items : []);
      setItemsTotal(Number(res?.total ?? 0));
      setItemsError(null);
      return true;
    } catch (e: any) {
      if (!itemsGuard.isCurrent(id)) return false;
      setItemsError(adminErrorText(e));
      return false;
    } finally {
      if (itemsGuard.isCurrent(id)) setItemsLoading(false);
    }
  }, [itemsGuard]);

  const loadTranslation = useCallback(async (): Promise<void> => {
    const id = transGuard.begin();
    setTransLoading(true);
    try {
      const [pend, list] = await Promise.all([
        wfNewAdminApi.getTranslationPendingWords(),
        wfNewAdminApi.getTranslationQueueList(),
      ]);
      if (!transGuard.isCurrent(id)) return;
      setTransPending(Number(pend?.total ?? 0));
      const raw: any = list;
      const arr: WfNewAdminTransTask[] = Array.isArray(raw?.tasks) ? raw.tasks
        : Array.isArray(raw?.items) ? raw.items
          : Array.isArray(raw?.list) ? raw.list
            : Array.isArray(raw) ? raw : [];
      setTransTasks(arr.slice(0, PAGE_SIZE));
      setTransError(null);
    } catch (e: any) {
      if (!transGuard.isCurrent(id)) return;
      setTransError(adminErrorText(e));
    } finally {
      if (transGuard.isCurrent(id)) setTransLoading(false);
    }
  }, [transGuard]);

  useEffect(() => {
    loadStats();
    loadItems(1, null);
    loadTranslation();
  }, [loadStats, loadItems, loadTranslation]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => { loadStats(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, loadStats]);

  const refreshTts = useCallback(async () => {
    const [okStats, okItems] = await Promise.all([
      loadStats(),
      loadItems(page, statusFilter),
    ]);
    if (okStats && okItems) addToast(trans('admin.q.updated'), 'success');
  }, [loadStats, loadItems, page, statusFilter, addToast, trans]);

  const toggleStatusFilter = useCallback((status: string) => {
    const next = statusFilter === status ? null : status;
    setStatusFilter(next);
    setPage(1);
    loadItems(1, next);
  }, [statusFilter, loadItems]);

  const goToPage = useCallback((p: number) => {
    const clamped = clamp(p, 1, totalPages);
    if (clamped === page) return;
    setPage(clamped);
    loadItems(clamped, statusFilter);
  }, [page, totalPages, statusFilter, loadItems]);

  const enqueuePending = useCallback(async () => {
    setEnqueueBusy(true);
    try {
      const res = await wfNewAdminApi.enqueuePendingTranslations();
      addToast(trans('admin.q.enqueued', { n: Number(res?.enqueued ?? 0) }), 'success');
      await loadTranslation();
    } catch (e: any) {
      addToast(adminErrorText(e), 'warning');
    } finally {
      if (transGuard.isAlive()) setEnqueueBusy(false);
    }
  }, [addToast, trans, loadTranslation, transGuard]);

  const byStatus = stats?.by_status ?? {};

  return (
    <div className="space-y-5">
      <AdminReveal>
        <AdminPanel theme={activeTheme}>
          <QueueHeader icon={<ListTodo className="w-4 h-4 text-indigo-400" />} title={trans('admin.q.tts')}>
            <ChipButton variant={autoRefresh ? 'active' : 'default'} onClick={() => setAutoRefresh((v) => !v)}>
              <Activity className="w-3.5 h-3.5" /> {trans('admin.q.auto')}
            </ChipButton>
            <ChipButton onClick={refreshTts} disabled={statsLoading || itemsLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
            </ChipButton>
          </QueueHeader>

          <AdminAsync trans={trans} loading={!stats && statsLoading} error={stats ? null : statsError} empty={false} onRetry={() => { void loadStats(); }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${STATUS_CHIP_CLS} ${NEUTRAL_CHIP}`}>
                {trans('admin.q.total')}: <span className="text-zinc-200">{formatNumber(Number(stats?.total ?? 0), 0)}</span>
              </span>
              {STATUS_KEYS.map((key) => {
                const tone = STATUS_TONES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStatusFilter(key)}
                    className={`${STATUS_CHIP_CLS} transition ${statusFilter === key ? tone.active : tone.chip}`}
                  >
                    {trans(tone.label)}: {formatNumber(Number(byStatus[key] ?? 0), 0)}
                  </button>
                );
              })}
            </div>
          </AdminAsync>

          <div className="space-y-2">
            <AdminLabel>{trans('admin.q.items')}</AdminLabel>
            <AdminTableShell>
              <AdminAsync trans={trans} loading={itemsLoading} error={itemsError} empty={items.length === 0} onRetry={() => { void loadItems(page, statusFilter); }}>
                <AdminTable
                  grid={ITEM_GRID}
                  head={(
                    <>
                      <span>{trans('admin.q.col.content')}</span>
                      <span>{trans('admin.q.col.type')}</span>
                      <span>{trans('admin.q.col.status')}</span>
                      <span>{trans('admin.q.col.lang')}</span>
                    </>
                  )}
                >
                  {items.map((item, i) => (
                    <AdminTableRow key={`${item.content ?? item.text ?? 'row'}-${i}`} grid={ITEM_GRID}>
                      <span className="text-[12px] text-zinc-300 truncate">{item.content ?? item.text ?? '—'}</span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate">{item.type ?? '—'}</span>
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] font-mono text-zinc-500 truncate">{item.language ?? '—'}</span>
                    </AdminTableRow>
                  ))}
                </AdminTable>
              </AdminAsync>
            </AdminTableShell>
            {!itemsLoading && !itemsError && (
              <WfNewPager variant="compact" page={page} totalPages={totalPages} onGoTo={goToPage} trans={trans} />
            )}
          </div>
        </AdminPanel>
      </AdminReveal>

      <AdminReveal delay={TRANS_REVEAL_DELAY_SECONDS}>
        <AdminPanel theme={activeTheme}>
          <QueueHeader icon={<Languages className="w-4 h-4 text-indigo-400" />} title={trans('admin.q.trans')}>
            <ChipButton onClick={loadTranslation} disabled={transLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${transLoading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
            </ChipButton>
          </QueueHeader>

          <AdminAsync
            trans={trans}
            loading={transLoading && transTasks.length === 0 && !transError}
            error={transError}
            empty={false}
            onRetry={() => { void loadTranslation(); }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${STATUS_CHIP_CLS} ${STATUS_TONES.pending.chip}`}>
                {trans('admin.q.transPending', { n: transPending })}
              </span>
              <ChipButton onClick={enqueuePending} disabled={enqueueBusy}>
                <Send className="w-3.5 h-3.5" /> {trans('admin.q.enqueue')}
              </ChipButton>
            </div>

            <AdminTableShell>
              <AdminAsync trans={trans} loading={false} error={null} empty={transTasks.length === 0} onRetry={loadTranslation}>
                <AdminTable
                  grid={TRANS_GRID}
                  head={(
                    <>
                      <span>{trans('admin.q.col.content')}</span>
                      <span>{trans('admin.q.col.lang')}</span>
                      <span>{trans('admin.q.col.status')}</span>
                      <span aria-hidden="true" />
                    </>
                  )}
                >
                  {transTasks.map((task, i) => (
                    <AdminTableRow key={`${task.id ?? task.word ?? task.content ?? 'task'}-${i}`} grid={TRANS_GRID}>
                      <span className="text-[12px] text-zinc-300 truncate">{task.word ?? task.content ?? '—'}</span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate">{task.language ?? '—'}</span>
                      <StatusBadge status={task.status} />
                      <span className="text-[10px] font-mono text-zinc-500 text-right">
                        {typeof task.priority === 'number' ? task.priority : ''}
                      </span>
                    </AdminTableRow>
                  ))}
                </AdminTable>
              </AdminAsync>
            </AdminTableShell>
          </AdminAsync>
        </AdminPanel>
      </AdminReveal>
    </div>
  );
};
