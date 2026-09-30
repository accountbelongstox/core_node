import React, { useEffect, useState } from 'react';
import { CloudOff, HardDrive, Layers, ListMusic, Plus, Play, Server, Clock } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchClipStore } from '../../services/orchestration/WordNewOrchClipStore';
import type { OrchComposeTask } from '../../services/orchestration/orchComposeTypes';
import { WordNewOrchAudioSourceBadge } from '../orch-audio/WordNewOrchAudioListPage';
import { WordNewOrchComposeEditor } from './WordNewOrchComposeEditor';
import { WordNewPycoreLinkPanel, useWordNewPycoreLink } from './WordNewPycoreLinkPanel';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpen: (taskId: string) => void;
}

const STATUS_CLASS: Record<OrchComposeTask['status'], string> = {
  draft: 'text-zinc-400 border-white/10',
  resolving: 'text-amber-300 border-amber-500/30',
  ready: 'text-emerald-300 border-emerald-500/30',
  partial: 'text-orange-300 border-orange-500/30',
};

/** The client compositions (device list, mirrored in Laravel) and the pycore link. */
export const WordNewOrchComposeList: React.FC<Props> = ({ theme, trans, onOpen }) => {
  const [tasks, setTasks] = useState<OrchComposeTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [storage, setStorage] = useState<{ clips: number; bytes: number } | null>(null);
  const link = useWordNewPycoreLink();

  useEffect(() => wordNewOrchTaskStore.subscribe(setTasks), []);
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
          onClick={() => setShowLink((value) => !value)}
          aria-expanded={showLink}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10"
        >
          {link.state === 'offline' ? <CloudOff className="h-3.5 w-3.5 text-rose-300" /> : <Server className="h-3.5 w-3.5 text-indigo-300" />}
          {trans(`orchCompose.link.summary.${link.state}`)}
        </button>
        {storage && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500">
            <HardDrive className="h-3.5 w-3.5" />
            {trans('orchCompose.storage', { clips: storage.clips, size: formatBytes(storage.bytes) })}
          </span>
        )}
      </div>

      {showLink && <WordNewPycoreLinkPanel theme={theme} trans={trans} />}

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
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <ListMusic className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
          <p className="text-xs font-mono text-zinc-500">{trans('orchCompose.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className={`group flex w-full items-start gap-3 rounded-2xl border border-white/5 p-4 text-left transition-all hover:border-indigo-500/30 hover:bg-white/[0.03] ${theme.cardClass}`}
              >
                <span className="mt-0.5 shrink-0 rounded-xl bg-indigo-500/10 p-2.5 text-indigo-300 group-hover:bg-indigo-500/20">
                  <Play className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">{task.name}</span>
                    <WordNewOrchAudioSourceBadge source={task.source} trans={trans} />
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[task.status]}`}>
                      {trans(`orchCompose.status.${task.status}`)}
                    </span>
                  </span>
                  {task.config.book && <span className="block truncate text-xs text-zinc-400">{task.config.book.title}</span>}
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" />{trans('orchAudio.segmentCount', { count: task.segmentCount })}
                    </span>
                    {task.durationMs > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />{formatClockTime(task.durationMs / 1000)}
                      </span>
                    )}
                    {!task.synced && <span>{trans('orchCompose.unsynced')}</span>}
                    <span>{new Date(task.updatedAt).toLocaleString()}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
