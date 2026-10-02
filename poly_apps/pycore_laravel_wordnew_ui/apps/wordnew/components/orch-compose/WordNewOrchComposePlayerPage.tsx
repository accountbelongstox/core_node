/**
 * Player page of one composition (`#/orch-audio/<id>?mode=play`). It plays the
 * task's frozen edition (WordNewOrchEditionStore), never the live run: newer
 * resources are offered and replace the edition only when accepted. Resources
 * keep loading in the background (the mini widget shows it); the position is
 * resumed on open, kept while playing and can be saved to the play history.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BookmarkPlus, Clapperboard, History, Loader2, Play, Sparkles, X } from 'lucide-react';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { WordNewOrchAudioSourceBadge } from '../orch-audio/WordNewOrchAudioListPage';
import { wordNewOrchEditionStore } from '../../services/orchestration/WordNewOrchEditionStore';
import { wordNewOrchPlaybackStore } from '../../services/orchestration/WordNewOrchPlaybackStore';
import { capApp } from '../../platform/capabilities/CapAppStateCore';
import { useWordNewOrchComposeRun } from './useWordNewOrchComposeRun';
import { useEditionPlaybackSource, useWordNewOrchComposePlayback, type WordNewOrchComposePlayback } from './useWordNewOrchComposePlayback';
import { WordNewOrchComposePlayer } from './WordNewOrchComposePlayer';
import { WordNewOrchLoadWidget } from './WordNewOrchLoadWidget';
import { orchSourceTitle } from './orchTaskView';
import { OrchBackButton, OrchButton, OrchPanel, OrchPanelHeader, OrchTaskUnavailable } from './orchPanels';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
  onOpenResources: () => void;
}

const RESUME_SAVE_MS = 10_000;

/** Keeps the resume position: on open it jumps there, then saves while playing, on pause and on leaving. */
function useResumePosition(taskId: string, editionId: string | null, playback: WordNewOrchComposePlayback): void {
  const { sequencer, position, jumpTo, segment } = playback;
  const restoredRef = useRef<string | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  const save = useCallback((): void => {
    const now = positionRef.current();
    if (now) void wordNewOrchPlaybackStore.saveResume(taskId, now);
  }, [taskId]);

  useEffect(() => {
    if (!editionId || restoredRef.current !== null || playback.segmentCount === 0) return;
    restoredRef.current = editionId;
    void wordNewOrchPlaybackStore.ready(taskId).then((state) => {
      if (state?.resume) jumpTo(state.resume, false);
    });
  }, [taskId, editionId, playback.segmentCount, jumpTo]);

  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (wasPlayingRef.current && !sequencer.playing) save();
    wasPlayingRef.current = sequencer.playing;
    if (!sequencer.playing) return undefined;
    const timer = setInterval(save, RESUME_SAVE_MS);
    return () => clearInterval(timer);
  }, [sequencer.playing, save]);

  useEffect(() => {
    if (restoredRef.current && segment > 0) save();
  }, [segment, save]);

  useEffect(() => {
    const persist = (): void => {
      save();
      wordNewOrchPlaybackStore.flush();
    };
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') persist();
    };
    document.addEventListener('visibilitychange', onHide);
    // The app going to the background (native pause; a WebView may not report the page hidden).
    void capApp.init();
    const offPause = capApp.onPause(persist);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      offPause();
      if (restoredRef.current) save();
      wordNewOrchPlaybackStore.flush();
    };
  }, [save]);
}

const HistoryPanel: React.FC<{ taskId: string; playback: WordNewOrchComposePlayback; theme: ElementTheme; trans: Props['trans'] }> = ({ taskId, playback, theme, trans }) => {
  useSyncExternalStore(wordNewOrchPlaybackStore.subscribe, wordNewOrchPlaybackStore.getVersion, wordNewOrchPlaybackStore.getVersion);
  const history = wordNewOrchPlaybackStore.playback(taskId)?.history ?? [];
  const saveNow = (): void => {
    const now = playback.position();
    if (now) void wordNewOrchPlaybackStore.addHistory(taskId, now);
  };
  return (
    <OrchPanel theme={theme} label={trans('orchCompose.history.title')} className="space-y-2">
      <OrchPanelHeader icon={History} title={trans('orchCompose.history.title')} theme={theme}>
        <OrchButton icon={BookmarkPlus} className="ml-auto" disabled={playback.timeline.length === 0} onClick={saveNow}>
          {trans('orchCompose.history.save')}
        </OrchButton>
      </OrchPanelHeader>
      {history.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{trans('orchCompose.history.empty')}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-200 dark:divide-white/5 overflow-y-auto">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-1.5">
              <button
                type="button"
                onClick={() => playback.jumpTo(entry, true)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-200/70 dark:hover:bg-white/10"
              >
                <Play className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-zinc-700 dark:text-zinc-200">{entry.label || '—'}</span>
                  <span className="block font-mono text-[10px] text-zinc-500">
                    {trans('orchCompose.history.entry', { segment: entry.segment + 1, time: formatClockTime(entry.time) })} · {new Date(entry.at).toLocaleString()}
                  </span>
                </span>
              </button>
              <OrchButton icon={X} variant="ghost" label={trans('orchCompose.history.remove')} onClick={() => { void wordNewOrchPlaybackStore.removeHistory(taskId, entry.id); }} />
            </li>
          ))}
        </ul>
      )}
    </OrchPanel>
  );
};

export const WordNewOrchComposePlayerPage: React.FC<Props> = ({ taskId, theme, trans, onBack, onOpenResources }) => {
  const { task, session, settings } = useWordNewOrchComposeRun(taskId);
  const subscribeEdition = useCallback((listener: () => void) => wordNewOrchEditionStore.subscribe(taskId, listener), [taskId]);
  const readEdition = useCallback(() => wordNewOrchEditionStore.version(taskId), [taskId]);
  const editionVersion = useSyncExternalStore(subscribeEdition, readEdition, readEdition);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on a new edition version
  const [opened, setOpened] = useState<string | null>(null);
  // The edition is used once `open` brought it up to the live run (so the resume jump is not reset by that).
  const edition = useMemo(() => (opened === taskId ? wordNewOrchEditionStore.edition(taskId) : null), [taskId, editionVersion, opened]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on a new edition version
  const offer = useMemo(() => wordNewOrchEditionStore.pending(taskId), [taskId, editionVersion]);
  const source = useEditionPlaybackSource(edition);
  const playback = useWordNewOrchComposePlayback(task, source, settings);
  useResumePosition(taskId, edition?.id ?? null, playback);

  const planHash = task?.planHash;
  const taskRef = useRef(task);
  taskRef.current = task;
  useEffect(() => {
    const current = taskRef.current;
    if (!current) return undefined;
    let active = true;
    void wordNewOrchEditionStore.open(current).then(() => { if (active) setOpened(current.id); });
    return () => {
      active = false;
      wordNewOrchEditionStore.release(current.id);
    };
  }, [taskId, planHash]);

  const acceptOffer = async (): Promise<void> => {
    const now = playback.position();
    const playing = playback.sequencer.playing;
    playback.sequencer.pause();
    await wordNewOrchEditionStore.accept(taskId);
    if (now) playback.jumpTo(now, playing);
  };

  if (!task) return <OrchTaskUnavailable missing={task === null} trans={trans} onBack={onBack} />;

  const sourceTitle = orchSourceTitle(task.config);
  const playable = settings !== null && edition !== null && playback.segmentCount > 0;
  const widget = (overlay: boolean): React.ReactNode => (
    <WordNewOrchLoadWidget session={session} trans={trans} onOpen={onOpenResources} overlay={overlay} />
  );

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex items-center gap-1.5">
        <OrchBackButton trans={trans} onBack={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold text-zinc-800 dark:text-zinc-100" title={task.name}>{task.name}</h2>
          {sourceTitle && <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{sourceTitle}</p>}
        </div>
        <span className="hidden sm:inline-flex"><WordNewOrchAudioSourceBadge source={task.source} trans={trans} /></span>
        {widget(false)}
      </div>

      {offer && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px]" role="status">
          <Sparkles className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT.emerald}`} aria-hidden />
          <span className="min-w-0 flex-1 text-emerald-700 dark:text-emerald-200">
            {trans('orchCompose.edition.offer', { clips: Math.max(0, offer.addedClips), time: formatClockTime(Math.max(0, offer.addedMs) / 1000) })}
          </span>
          <button type="button" onClick={() => { void acceptOffer(); }} className={`rounded-lg border px-2.5 py-1 font-bold ${theme.accentBg}`}>
            {trans('orchCompose.edition.replace')}
          </button>
          <OrchButton variant="ghost" onClick={() => wordNewOrchEditionStore.dismiss(taskId)}>{trans('orchCompose.edition.later')}</OrchButton>
        </div>
      )}

      {playable && settings ? (
        <WordNewOrchComposePlayer variant="full" playback={playback} settings={settings} label={task.name} theme={theme} trans={trans} loadWidget={widget} />
      ) : (
        <OrchPanel as="div" theme={theme} className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
          {edition
            ? <Clapperboard className="h-8 w-8 text-zinc-400" aria-hidden />
            : <Loader2 className="h-8 w-8 animate-spin text-indigo-400" aria-hidden />}
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
            {trans(edition ? 'orchCompose.segmentEmpty' : 'orchCompose.playerPreparing')}
          </p>
          <OrchButton onClick={onOpenResources}>{trans('orchCompose.openResources')}</OrchButton>
        </OrchPanel>
      )}

      {playable && <HistoryPanel taskId={taskId} playback={playback} theme={theme} trans={trans} />}
    </div>
  );
};
