import React, { useState } from 'react';
import { ArrowLeft, Pencil, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { WordNewOrchComposeEditor } from './WordNewOrchComposeEditor';
import { WordNewOrchResolveProgress } from './WordNewOrchResolveProgress';
import { WordNewOrchNewWords } from './WordNewOrchNewWords';
import { WordNewOrchReadStateField } from './WordNewOrchReadStateField';
import { WfNewOrchSection } from './WfNewOrchSection';
import { orchTaskVirtualBatch } from '../../../../shared/orchestration/orchPlanner';
import { navigateToWordNewTab } from '../../routing/WordNewHashRoutes';
import { useWordNewOrchComposeRun } from './useWordNewOrchComposeRun';
import { useLiveOrchPlaybackSource, useWordNewOrchComposePlayback } from './useWordNewOrchComposePlayback';
import { WordNewOrchComposePlayer } from './WordNewOrchComposePlayer';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
  onOpenPlayer: () => void;
}

/** One composition's resources page: resolves its clips (device -> pycore -> Laravel) and previews it on the stage. */
export const WordNewOrchComposeDetail: React.FC<Props> = ({ taskId, theme, trans, onBack, onOpenPlayer }) => {
  const [editing, setEditing] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const { task, session, settings, compose } = useWordNewOrchComposeRun(taskId);
  const source = useLiveOrchPlaybackSource(task, session);
  const playback = useWordNewOrchComposePlayback(task, source, settings);
  const { newWords, segmentCount, timeline } = playback;

  if (task === undefined) return <WfNewLoadingDots className="text-indigo-600 dark:text-indigo-300" label={trans('content.loading')} />;
  if (task === null) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
          <ArrowLeft className="h-3.5 w-3.5" />{trans('orchAudio.backToList')}
        </button>
        <p className="text-xs font-mono text-zinc-500">{trans('orchCompose.notFound')}</p>
      </div>
    );
  }

  const busy = session !== null && session.phase !== 'ready' && session.phase !== 'failed';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onBack} aria-label={trans('orchAudio.backToList')} title={trans('orchAudio.backToList')} className="rounded-lg p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-zinc-800 dark:text-zinc-100" title={task.name}>{task.name}</h2>
        <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10" aria-label={trans('orchCompose.edit')} title={trans('orchCompose.edit')}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={busy} onClick={() => compose(task, true)} className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10 disabled:opacity-40" aria-label={trans('orchCompose.reresolve')} title={trans('orchCompose.reresolve')}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(trans('orchCompose.deleteConfirm', { name: task.name }))) return;
            void wordNewOrchTaskStore.remove(task.id).then(onBack);
          }}
          className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-rose-600 dark:text-rose-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
          aria-label={trans('orchCompose.delete')}
          title={trans('orchCompose.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing && (
        <WordNewOrchComposeEditor theme={theme} trans={trans} task={task} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}

      <WordNewOrchResolveProgress session={session} theme={theme} trans={trans} onOpenStorage={() => navigateToWordNewTab('cache')} />

      <WfNewOrchSection
        icon={Sparkles}
        title={trans('orchCompose.field.newWords')}
        summary={trans('orchCompose.newWords.summary', { count: newWords.size, mode: trans(`orchCompose.readState.${task.config.readState}`) })}
        open={wordsOpen}
        onToggle={() => setWordsOpen((value) => !value)}
        theme={theme}
      >
        <WordNewOrchReadStateField
          value={{ groupId: task.config.wordGroupId, readState: task.config.readState, virtualBatch: task.config.virtualBatch }}
          taskBatch={orchTaskVirtualBatch(task.id)}
          onChange={({ groupId, readState, virtualBatch }) => {
            void wordNewOrchTaskStore.update(task.id, { config: { ...task.config, wordGroupId: groupId, readState, virtualBatch } });
          }}
          theme={theme}
          trans={trans}
        />
        {session?.plan && (
          <WordNewOrchNewWords task={task} plan={session.plan} wordStates={session.wordStates} theme={theme} trans={trans} />
        )}
      </WfNewOrchSection>

      {settings && session?.phase === 'ready' && (
        timeline.length === 0 && segmentCount <= 1 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-center text-xs font-mono text-zinc-500">{trans('orchCompose.segmentEmpty')}</p>
        ) : (
          <WordNewOrchComposePlayer variant="preview" playback={playback} settings={settings} label={task.name} theme={theme} trans={trans} onOpenPlayer={onOpenPlayer} />
        )
      )}
    </div>
  );
};
