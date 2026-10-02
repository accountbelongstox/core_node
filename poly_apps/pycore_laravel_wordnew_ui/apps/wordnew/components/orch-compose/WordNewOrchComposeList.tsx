import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioLines, CloudOff, HardDrive, ListMusic, Plus, Play } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { TONE_TEXT, type StatusTone } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import { subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchClipStore } from '../../services/orchestration/WordNewOrchClipStore';
import { wordNewOrchComposer } from '../../services/orchestration/WordNewOrchComposer';
// Runs reaching `ready` publish playback editions whichever page is open.
import '../../services/orchestration/WordNewOrchEditionStore';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { WordNewOrchAudioSourceBadge } from '../orch-audio/WordNewOrchAudioListPage';
import { WordNewOrchComposeEditor } from './WordNewOrchComposeEditor';
import { useWordNewApiService } from '../../api/center/WordNewApiCenter';
import { wordNewPycoreApiService } from '../../api/center/WordNewPycoreApiService';
import { WfNewApiCenterDialog } from '../api-center/WfNewApiCenterDialog';
import { ORCH_BACKEND_VIEW } from './orchBackends';
import { OrchEmptyBox } from './orchPanels';
import { OrchListRow, OrchSegmentMeta } from './OrchListRow';
import { orchShare } from './orchRunProgress';
import { orchSourceTitle } from './orchTaskView';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** The task's resources page. */
  onOpen: (taskId: string) => void;
  /** The task's player page. */
  onPlay: (taskId: string) => void;
}

const STATUS_TONE: Record<OrchComposeTask['status'] | 'paused', StatusTone> = {
  paused: 'sky',
  draft: 'neutral',
  resolving: 'amber',
  ready: 'emerald',
  partial: 'rose',
};

const PYCORE_VIEW = ORCH_BACKEND_VIEW.pycore;

let composerTicks = 0;
wordNewOrchComposer.subscribeAll(() => { composerTicks += 1; });
const composerVersion = (): number => composerTicks;

/**
 * Status + progress of one task: the live run's percent while it runs (in the
 * background too), the kept summary otherwise; a run the app left unfinished is
 * "paused" and resumes when the task is opened.
 */
const TaskProgressBadge: React.FC<{ task: OrchComposeTask; trans: Props['trans'] }> = ({ task, trans }) => {
  const running = wordNewOrchComposer.isRunning(task.id);
  const session = wordNewOrchComposer.session(task.id);
  const live = running && session && session.planHash === task.planHash ? session.counts : null;
  const kept = task.progress?.planHash === task.planHash ? task.progress : null;
  const done = live ? live.total - live.pending : kept?.done ?? 0;
  const total = live ? live.total : kept?.total ?? 0;
  const status = task.status === 'resolving' && !running ? 'paused' : task.status;
  return (
    <Pill tone={STATUS_TONE[status]} className="gap-1.5 font-bold">
      {trans(`orchCompose.status.${status}`)}
      {total > 0 && status !== 'ready' && <span className="font-mono">{orchShare(done, total)}%</span>}
    </Pill>
  );
};

/** The client compositions (device list, mirrored in Laravel) and the pycore link. */
export const WordNewOrchComposeList: React.FC<Props> = ({ theme, trans, onOpen, onPlay }) => {
  const [tasks, setTasks] = useState<OrchComposeTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [storage, setStorage] = useState<{ clips: number; bytes: number } | null>(null);
  const pycore = useWordNewApiService(wordNewPycoreApiService);

  useEffect(() => wordNewOrchTaskStore.subscribe(setTasks), []);
  // Re-render when any task's background run reports progress.
  useSyncExternalStore(wordNewOrchComposer.subscribeAll, composerVersion, composerVersion);
  useEffect(() => { wordNewPycoreApiService.start(); }, []);
  useEffect(() => {
    void wordNewOrchTaskStore.sync();
    return subscribeAuthLoginSuccess(() => { void wordNewOrchTaskStore.sync(); });
  }, []);
  useEffect(() => {
    void wordNewOrchClipStore.stats().then(setStorage);
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold ${theme.accentBg}`}
        >
          <Plus className="h-3.5 w-3.5" />{trans('orchCompose.new')}
        </button>
        <button
          type="button"
          onClick={() => setShowLink(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
        >
          {pycore.state === 'offline'
            ? <CloudOff className={`h-3.5 w-3.5 ${TONE_TEXT.rose}`} />
            : <PYCORE_VIEW.icon className={`h-3.5 w-3.5 ${TONE_TEXT[PYCORE_VIEW.tone]}`} />}
          {trans('apiCenter.pycore.title')} · {trans(`apiCenter.service.${pycore.state}`)}
        </button>
        {storage && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500">
            <HardDrive className="h-3.5 w-3.5" />
            {trans('orchCompose.storage', { clips: storage.clips, size: formatBytes(storage.bytes) })}
          </span>
        )}
      </div>

      <WfNewApiCenterDialog open={showLink} initialService="pycore" onClose={() => setShowLink(false)} activeTheme={theme} trans={trans} />

      {creating && (
        <WordNewOrchComposeEditor
          theme={theme}
          trans={trans}
          task={null}
          onClose={() => setCreating(false)}
          onSaved={(task) => {
            setCreating(false);
            onOpen(task.id);
          }}
        />
      )}

      {tasks.length === 0 ? (
        <OrchEmptyBox icon={ListMusic}>{trans('orchCompose.empty')}</OrchEmptyBox>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <OrchListRow
              key={task.id}
              theme={theme}
              icon={AudioLines}
              title={task.name}
              badges={(
                <>
                  <WordNewOrchAudioSourceBadge source={task.source} trans={trans} />
                  <TaskProgressBadge task={task} trans={trans} />
                </>
              )}
              subtitle={orchSourceTitle(task.config)}
              meta={(
                <>
                  <OrchSegmentMeta segmentCount={task.segmentCount} durationSec={task.durationMs / 1000} trans={trans} />
                  {!task.synced && <span>{trans('orchCompose.unsynced')}</span>}
                  <span>{new Date(task.updatedAt).toLocaleString()}</span>
                </>
              )}
              onOpen={() => onOpen(task.id)}
              trailing={(
                <button
                  type="button"
                  onClick={() => onPlay(task.id)}
                  aria-label={trans('orchAudio.play')}
                  title={trans('orchAudio.play')}
                  className={`shrink-0 rounded-full border p-3 shadow-md transition-transform hover:scale-105 active:scale-95 ${theme.accentBg}`}
                >
                  <Play className="h-4 w-4 translate-x-px" />
                </button>
              )}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
