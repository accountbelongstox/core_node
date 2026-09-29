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
import PcPager from '../agent-history/PcPager';
import OrchManifestPanel from './OrchManifestPanel';
import OrchTaskRow from './OrchTaskRow';
import OrchTaskTabs from './OrchTaskTabs';
import { ORCH_L } from './orchShared';
import { ORCH_PANEL_CLASS } from './orchStyles';

const pagerTk = (key: string): string => String(ORCH_L[key as keyof typeof ORCH_L] || key);

const OrchTaskList: React.FC<{
  tasks: OrchTaskSummary[];
  source: OrchTaskSource;
  counts: Record<string, number>;
  total: number;
  page: number;
  pageSize: number;
  queryInput: string;
  presets: OrchVideoPreset[];
  activePresetId: string;
  selectedTaskId: string | null;
  onSourceChange: (source: OrchTaskSource) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onSelect: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onRegenerate: (taskId: string) => void;
  onChanged: () => void;
}> = ({
  tasks, source, counts, total, page, pageSize, queryInput, presets, activePresetId, selectedTaskId,
  onSourceChange, onPageChange, onQueryChange, onSelect, onEdit, onRegenerate, onChanged,
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
      <PcPager page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} onChange={onPageChange} tk={pagerTk} />
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
