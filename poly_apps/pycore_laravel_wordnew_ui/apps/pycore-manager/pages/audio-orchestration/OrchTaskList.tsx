/**
 * Orchestration task list: one tab per source (Books / Prompts), each with its
 * own server-side paginated, name-searchable list. Rows (OrchTaskRow) carry the
 * live progress, the output-mode badge and the automatic-generation state; the
 * expanded detail lists files and logs. Task refresh is owned by
 * useOrchTaskListing (AudioOrchWorkspace).
 */
import React, { useState } from 'react';
import type {
  OrchManifestCategory,
  OrchTaskSource,
  OrchTaskSummary,
  OrchVideoPreset,
} from '@/apps/pycore-manager/api';
import { humanInt, VocabBanner } from '../vocabulary/vocabShared';
import { PcCursorPager } from '../../components/PcCursorPager';
import OrchManifestPanel from './OrchManifestPanel';
import OrchTaskRow from './OrchTaskRow';
import OrchTaskTabs from './OrchTaskTabs';
import { ORCH_L } from './orchShared';
import { ORCH_PANEL_CLASS } from './orchStyles';

const OrchTaskList: React.FC<{
  tasks: OrchTaskSummary[];
  source: OrchTaskSource;
  counts: Record<string, number>;
  total: number;
  active: OrchTaskSummary[];
  pageIndex: number;
  hasMore: boolean;
  loading: boolean;
  queryInput: string;
  presets: OrchVideoPreset[];
  activePresetId: string;
  selectedTaskId: string | null;
  onSourceChange: (source: OrchTaskSource) => void;
  onPrevious: () => void;
  onNext: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onRegenerate: (taskId: string) => void;
  onChanged: () => void;
}> = ({
  tasks, source, counts, total, active, pageIndex, hasMore, loading, queryInput, presets, activePresetId, selectedTaskId,
  onSourceChange, onPrevious, onNext, onQueryChange, onSelect, onEdit, onRegenerate, onChanged,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [manifestView, setManifestView] = useState<{
    taskId: string;
    name: string;
    category: OrchManifestCategory;
  } | null>(null);

  return (
    <section className={ORCH_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.tasksTitle}</h3>
        <span className="text-[11px] font-mono text-slate-500">{humanInt(total)} {ORCH_L.tasksTotal}</span>
      </div>
      <OrchTaskTabs
        source={source}
        counts={counts}
        queryInput={queryInput}
        onSourceChange={onSourceChange}
        onQueryChange={onQueryChange}
      />
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-500">{ORCH_L.tasksActive}</span>
          {active.map((task) => (
            <button
              key={task.task_id}
              type="button"
              onClick={() => onSelect(task.task_id)}
              className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300"
            >
              {task.name} · {task.segments_done ?? 0}/{task.segments_total ?? 0}
            </button>
          ))}
        </div>
      )}
      {error && <VocabBanner kind="error" message={error} />}
      {tasks.length === 0 && <p className="text-xs text-slate-500">{ORCH_L.noTasks}</p>}
      <div className="space-y-2">
        {tasks.map((task) => (
          <OrchTaskRow
            key={task.task_id}
            task={task}
            expanded={selectedTaskId === task.task_id}
            presets={presets}
            activePresetId={activePresetId}
            onSelect={onSelect}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onChanged={onChanged}
            onError={setError}
            onShowManifest={(target, category) => setManifestView({ taskId: target.task_id, name: target.name, category })}
          />
        ))}
      </div>
      <PcCursorPager pageIndex={pageIndex} hasMore={hasMore} loading={loading} onPrevious={onPrevious} onNext={onNext} />
      {manifestView && (
        <OrchManifestPanel
          open
          taskId={manifestView.taskId}
          taskName={manifestView.name}
          initialCategory={manifestView.category}
          onClose={() => setManifestView(null)}
        />
      )}
    </section>
  );
};

export default OrchTaskList;
