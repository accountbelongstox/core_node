import React, { useState } from 'react';
import { Pencil, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { WordNewOrchComposeEditor } from './WordNewOrchComposeEditor';
import { WordNewOrchBookPlanProgress } from './WordNewOrchBookPlanProgress';
import { WordNewPanelBoundary } from './WordNewPanelBoundary';
import { WordNewOrchResolveProgress } from './WordNewOrchResolveProgress';
import { WordNewOrchNewWords } from './WordNewOrchNewWords';
import { WordNewOrchMissingLanguageNotice } from './WordNewOrchMissingLanguageNotice';
import { WordNewOrchPhrasePendingNotice } from './WordNewOrchPhrasePendingNotice';
import { WordNewOrchReadStateField } from './WordNewOrchReadStateField';
import { WfNewOrchSection } from './WfNewOrchSection';
import { orchTaskVirtualBatch } from '../../../../shared/orchestration/orchPlanner';
import { navigateToWordNewTab } from '../../routing/WordNewHashRoutes';
import { useWordNewOrchComposeRun } from './useWordNewOrchComposeRun';
import { useEditionPlaybackSource, useWordNewOrchComposePlayback } from './useWordNewOrchComposePlayback';
import { useWordNewOrchEdition, WordNewOrchEditionOffer } from './useWordNewOrchEdition';
import { WordNewOrchComposePlayer } from './WordNewOrchComposePlayer';
import { OrchBackButton, OrchButton, OrchEmptyBox, OrchTaskUnavailable } from './orchPanels';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
  onOpenPlayer: () => void;
}

/** One composition's resources page: resolves its clips (device -> pycore -> Laravel) and previews its static edition on the stage. */
export const WordNewOrchComposeDetail: React.FC<Props> = ({ taskId, theme, trans, onBack, onOpenPlayer }) => {
  const [editing, setEditing] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const { task, session, settings, compose } = useWordNewOrchComposeRun(taskId);
  const { edition, offer } = useWordNewOrchEdition(taskId, task);
  const source = useEditionPlaybackSource(edition);
  const playback = useWordNewOrchComposePlayback(task, source, settings);
  const { newWords, segmentCount, timeline } = playback;

  if (!task) return <OrchTaskUnavailable missing={task === null} trans={trans} onBack={onBack} />;

  const busy = session !== null && session.phase !== 'ready' && session.phase !== 'failed';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <OrchBackButton trans={trans} onBack={onBack} />
        <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-zinc-800 dark:text-zinc-100" title={task.name}>{task.name}</h2>
        <OrchButton icon={Pencil} label={trans('orchCompose.edit')} onClick={() => setEditing((value) => !value)} />
        <OrchButton icon={RefreshCw} label={trans('orchCompose.reresolve')} spin={busy} disabled={busy} onClick={() => compose(task, true)} />
        <OrchButton
          icon={Trash2}
          label={trans('orchCompose.delete')}
          tone="rose"
          onClick={() => {
            if (!window.confirm(trans('orchCompose.deleteConfirm', { name: task.name }))) return;
            void wordNewOrchTaskStore.remove(task.id).then(onBack);
          }}
        />
      </div>

      {editing && (
        <WordNewOrchComposeEditor theme={theme} trans={trans} task={task} sentences={session?.plan?.sentences} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}

      {!editing && <WordNewOrchMissingLanguageNotice skipped={session?.plan?.skippedLanguages} trans={trans} />}
      {!editing && <WordNewOrchPhrasePendingNotice taskId={task.id} trans={trans} />}

      <WordNewPanelBoundary key={task.id} name="WordNewOrchBookPlanProgress"><WordNewOrchBookPlanProgress taskId={task.id} theme={theme} trans={trans} /></WordNewPanelBoundary>
      <WordNewOrchResolveProgress session={session} theme={theme} trans={trans} bookPlanned={Boolean(task?.config.book)} onOpenStorage={() => navigateToWordNewTab('cache')} />

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

      {settings && edition && (
        timeline.length === 0 && segmentCount <= 1 ? (
          <OrchEmptyBox className="p-6">{trans('orchCompose.segmentEmpty')}</OrchEmptyBox>
        ) : (
          <>
            <WordNewOrchEditionOffer taskId={task.id} offer={offer} playback={playback} theme={theme} trans={trans} />
            <WordNewOrchComposePlayer variant="preview" playback={playback} settings={settings} label={task.name} theme={theme} trans={trans} onOpenPlayer={onOpenPlayer} />
          </>
        )
      )}
    </div>
  );
};
