/** Voice Subtitle Queue: paginated queue list with group filter, now-playing marker, row actions and live background tasks. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListMusic, Loader2, Play, Search, Trash2 } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { GLOBAL_TASK_TERMINAL_STATUSES } from '@/core/contracts/QueueCenterContract';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, controlClass, EmptyBlock, IconBtn, Metric, Notice, OpsPage, OpsStatusBar, Pager, Panel } from './opsKit';
import { describeError, useInterval, useRemote } from './opsHooks';
import { pageCount, pageSlice } from './opsLogic';
import type { VoiceGroupsData, VoiceQueueData, VoiceQueueItem, VoiceTask, VoiceTasksData } from './opsTypes';

const PAGE_SIZE = 15;
const AUTO_MS = 10000;
const ACTIVE_MS = 4000;
const PREVIEW_CHARS = 140;
const ALL = '';

const VsQueueWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState(ALL);
  const [page, setPage] = useState(1);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const queue = useRemote(() => callToolApi<VoiceQueueData>(tool.apiMethod), []);
  const groups = useRemote(async () => (await callToolApi<VoiceGroupsData>('mcpV1.vsGetAllGroups'))?.groups ?? [], []);
  const tasks = useRemote(async () => (await callToolApi<VoiceTasksData>('mcpV1.vsListTasks'))?.tasks ?? [], []);
  const active = (tasks.data ?? []).filter((task) => !(GLOBAL_TASK_TERMINAL_STATUSES as string[]).includes(task.status));
  const refreshAll = (silent: boolean): void => { void queue.reload(silent); void tasks.reload(silent); };
  useInterval(() => refreshAll(true), active.length > 0 ? ACTIVE_MS : auto ? AUTO_MS : null);

  const items = useMemo(() => queue.data?.all_queue ?? [], [queue.data]);
  const indexed = useMemo(() => items.map((item, index) => ({ item, index })), [items]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return indexed.filter(({ item }) => (!group || (item.group ?? 'default') === group)
      && (!query || `${item.translated_text ?? ''} ${item.original_text ?? ''}`.toLowerCase().includes(query)));
  }, [indexed, group, search]);
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const current = Math.min(page, pages);
  const rows = pageSlice(filtered, current, PAGE_SIZE);
  const currentIndex = queue.data?.current_index ?? -1;

  const act = async (key: string, task: () => Promise<unknown>): Promise<void> => {
    setBusy(key);
    setFailure(null);
    try {
      await task();
      await queue.reload(true);
      void groups.reload(true);
    } catch (err) {
      setFailure(describeError(t, err));
    } finally {
      setBusy(null);
    }
  };

  const clearQueue = (): Promise<void> => (window.confirm(t('toolsOps.queue.confirm_clear')) ? act('clear', () => callToolApi('mcpV1.vsClearQueue')) : Promise.resolve());
  const remove = (index: number): Promise<void> => (window.confirm(t('toolsOps.queue.confirm_remove', { index: index + 1 })) ? act(`rm-${index}`, () => callToolApi('mcpV1.vsRemoveAt', index)) : Promise.resolve());
  const textOf = (item: VoiceQueueItem): string => (item.translated_text || item.original_text || '').slice(0, PREVIEW_CHARS);
  const stepLine = (task: VoiceTask): string => Object.values(task.steps ?? {}).find((step) => step.status === 'running')?.label ?? task.status;

  return (
    <OpsPage>
      <OpsStatusBar
        accent="lime"
        mode="server"
        updatedAt={queue.updatedAt}
        loading={queue.loading}
        onRefresh={() => refreshAll(false)}
        auto={{ on: auto, onChange: setAuto }}
        trailing={<Btn size="sm" variant="dangerSoft" icon={Trash2} loading={busy === 'clear'} onClick={() => void clearQueue()} disabled={busy !== null || items.length === 0}>{t('toolsOps.queue.clear')}</Btn>}
      >
        {queue.data ? t('toolsOps.queue.status', { total: queue.data.total_length, mode: queue.data.play_mode ?? '-' }) : t('toolsOps.common.loading')}
      </OpsStatusBar>
      {queue.error && <Notice tone="error">{queue.error}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}

      <div className="grid grid-cols-3 gap-3">
        <Metric label={t('toolsOps.queue.total')} value={queue.data?.total_length ?? 0} icon={ListMusic} />
        <Metric label={t('toolsOps.queue.playing_position')} value={items.length ? `${currentIndex + 1} / ${items.length}` : '-'} />
        <Metric label={t('toolsOps.queue.processing')} value={active.length} valueClassName={active.length ? 'text-amber-600 dark:text-amber-400' : undefined} />
      </div>

      {active.length > 0 && (
        <Panel title={t('toolsOps.queue.background_tasks')} icon={Loader2} accent="lime" bodyClassName="space-y-3 p-4">
          {active.map((task) => (
            <div key={task.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-700 dark:text-slate-200">{task.payload?.input_reference ?? task.id}</span>
                <span className="shrink-0 text-slate-400">{stepLine(task)} · {Math.round(task.progress ?? 0)}%</span>
              </div>
              <ProgressBar done={task.progress ?? 0} total={100} tone="emerald" label={task.id} />
            </div>
          ))}
        </Panel>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('toolsOps.common.search')} className={`${controlClass('lime')} pl-9`} />
        </div>
        {(groups.data ?? []).length > 0 && (
          <Chips accent="lime" value={group} onChange={(value) => { setGroup(value); setPage(1); }} nowrap options={[{ value: ALL, label: t('toolsOps.library.all') }, ...(groups.data ?? []).map((value) => ({ value, label: value }))]} />
        )}
      </div>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyBlock icon={ListMusic}>{queue.loading ? t('toolsOps.common.loading') : t('toolsOps.queue.empty')}</EmptyBlock>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rows.map(({ item, index }) => (
              <li key={item.id} className={`flex items-start gap-3 px-4 py-3 ${index === currentIndex ? 'bg-lime-50 dark:bg-lime-500/10' : ''}`}>
                <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm text-slate-800 dark:text-slate-100">{textOf(item) || '-'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone="sky" tint>{item.type}</Pill>
                    <Pill>{item.group ?? 'default'}</Pill>
                    {item.language && <Pill>{item.language}</Pill>}
                    <Pill stat>{t('toolsOps.queue.plays', { count: item.play_count ?? 0 })}</Pill>
                    {index === currentIndex && <Pill tone="emerald" tint icon={Play}>{t('toolsOps.queue.now')}</Pill>}
                    <span className="text-[11px] text-slate-400">{item.added_at ?? item.created_at ?? ''}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconBtn icon={Play} title={t('toolsOps.queue.set_current')} accent="lime" onClick={() => void act(`cur-${index}`, () => callToolApi('mcpV1.vsSetIndex', index))} disabled={busy !== null || index === currentIndex} />
                  <IconBtn icon={Trash2} title={t('uiTools.common.delete')} onClick={() => void remove(index)} disabled={busy !== null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Pager page={current} pages={pages} onChange={setPage} accent="lime" summary={t('toolsOps.queue.showing', { count: filtered.length })} />
    </OpsPage>
  );
};

export default VsQueueWorkbench;
