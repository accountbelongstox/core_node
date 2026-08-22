import React from 'react';
import { Activity, AudioLines, Clock3, Cpu, Layers3, RefreshCw, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PcAgentHistoryQueuePanelProps {
  articleConfig: Record<string, any> | null;
  articleSummary: Record<string, any> | null;
  operationSnapshot: Record<string, any> | null;
  loading: boolean;
}

const PcAgentHistoryQueuePanel: React.FC<PcAgentHistoryQueuePanelProps> = ({
  articleConfig,
  articleSummary,
  operationSnapshot,
  loading,
}) => {
  const { t } = useTranslation('pc');
  const summary = articleSummary || {};
  const operation = operationSnapshot?.operation || {};
  const currentItem = operationSnapshot?.current_item || {};
  const recentEvent = Array.isArray(operationSnapshot?.recent_events)
    ? operationSnapshot.recent_events[0]
    : null;
  const toolHistories = Array.isArray(summary.tool_histories)
    ? summary.tool_histories as Array<Record<string, any>>
    : [];
  const qwen = summary.qwen || {};
  const qwenGpu = qwen.gpu || {};
  const qwenQueue = qwen.queue || {};
  const capacityPlan = qwen.capacity_plan || {};
<<<<<<< HEAD
  const gpuIndex = Number(qwenGpu.physical_index ?? qwenGpu.index ?? capacityPlan.physical_gpu_index ?? 0);
  const nativeBatch = Number(qwen.max_parallel || capacityPlan.batch_size || 1);
  const gpuUtilization = Number(qwenGpu.util_percent || 0);
=======
  const synthesisRuntime = qwen.synthesis_runtime || {};
  const gpuIndex = Number(qwenGpu.physical_index ?? qwenGpu.index ?? capacityPlan.physical_gpu_index ?? 0);
  const nativeBatch = Number(qwen.max_parallel || capacityPlan.batch_size || 1);
  const gpuUtilization = Number(qwenGpu.util_percent || 0);
  const synthesisPhase = String(synthesisRuntime.phase || 'idle');
  const synthesisPhaseLabel = t(
    `queueCenter.agentHistoryQueue.phases.${synthesisPhase}`,
    { defaultValue: synthesisPhase },
  );
>>>>>>> ef6e5bbfdfd067df323eb3e43c7e1daa829d6319
  const currentProgress = Math.max(0, Math.min(1, Number(currentItem.progress || 0)));
  const cards = [
    {
      label: t('queueCenter.agentHistoryQueue.totalPending'),
      value: Number(summary.total_pending || 0),
      Icon: Layers3,
      tone: 'text-indigo-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.multiSentence'),
      value: Number(summary.multi_sentence || 0),
      Icon: AudioLines,
      tone: 'text-emerald-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.legacyPending'),
      value: Number(summary.legacy_audio || 0),
      Icon: Clock3,
      tone: 'text-amber-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.rebuilt'),
      value: Number(summary.rebuilt || 0),
      Icon: RefreshCw,
      tone: 'text-violet-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.historyPending'),
      value: Number(summary.history_pending || 0),
      Icon: Activity,
      tone: 'text-cyan-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.qwenPending'),
      value: Number(qwenQueue.pending || 0),
      Icon: Layers3,
      tone: 'text-blue-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.published'),
      value: Number(summary.uploaded || 0),
      Icon: UploadCloud,
      tone: 'text-emerald-500',
    },
    {
      label: t('queueCenter.agentHistoryQueue.gpuUtilization', { index: gpuIndex }),
      value: `${gpuUtilization.toFixed(0)}%`,
      Icon: Cpu,
      tone: gpuUtilization > 0 ? 'text-lime-500' : 'text-slate-400',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('queueCenter.agentHistoryQueue.priorityHint')}
      </p>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <Icon className={`h-3.5 w-3.5 ${tone}`} />
              {label}
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-800 dark:text-slate-100">
              {loading ? '…' : value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200/70 px-3 py-2 font-mono text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">
        {qwen.ok
          ? t('queueCenter.agentHistoryQueue.qwenRuntime', {
              index: gpuIndex,
              name: String(qwenGpu.name || capacityPlan.gpu_name || '-'),
              compute: String(qwenGpu.compute_capability || capacityPlan.compute_capability || '-'),
              used: Number(qwenGpu.mem_used_mb || 0),
              total: Number(qwenGpu.mem_total_mb || capacityPlan.memory_total_mb || 0),
              batch: nativeBatch,
<<<<<<< HEAD
=======
              active: Number(synthesisRuntime.active_native_batch || 0),
              attention: String(qwen.attention_implementation || '-'),
              phase: synthesisPhaseLabel,
              completed: Number(synthesisRuntime.chunks_completed || 0),
              chunks: Number(synthesisRuntime.chunks_total || 0),
>>>>>>> ef6e5bbfdfd067df323eb3e43c7e1daa829d6319
              running: Number(qwenQueue.running || 0),
              pending: Number(qwenQueue.pending || 0),
            })
          : t('queueCenter.agentHistoryQueue.qwenOffline')}
      </div>

      <div className="rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {t('queueCenter.agentHistoryQueue.currentStage')}
          </span>
          <span className="font-mono text-indigo-500">
            {articleConfig?.enabled
              ? String(currentItem.stage || operation.stage || t('queueCenter.agentHistoryQueue.waiting'))
              : t('queueCenter.agentHistoryQueue.paused')}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
            style={{ width: `${Math.round(currentProgress * 100)}%` }}
          />
        </div>
        {recentEvent?.message && (
          <p className="mt-2 break-words font-mono text-[10px] text-slate-500">
            {String(recentEvent.message)}
          </p>
        )}
      </div>

      {toolHistories.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {toolHistories
            .slice()
            .sort((left, right) => Number(right.pending || 0) - Number(left.pending || 0))
            .map((item) => (
              <div key={String(item.tool)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100/70 px-3 py-2 text-xs dark:bg-white/[0.04]">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  {String(item.tool)}
                </span>
                <span className="font-mono text-slate-500">
                  {Number(item.processed || 0)}/{Number(item.content_records || (Number(item.prompts || 0) + Number(item.replies || 0)))} · {Number(item.pending || 0)} {t('agentHistory.pending')}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default PcAgentHistoryQueuePanel;
