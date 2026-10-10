import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { OrchVideoSettings } from '../../../../core/integrations/pycore';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchComposer } from '../../services/orchestration/WordNewOrchComposer';
// Runs reaching `ready` publish playback editions whichever page is open.
import '../../services/orchestration/WordNewOrchEditionStore';
import { wordNewOrchPresetStore, type OrchPresetDocument } from '../../services/orchestration/WordNewOrchPresetStore';

export interface WordNewOrchComposeRun {
  /** undefined while loading, null when the task does not exist. */
  task: OrchComposeTask | null | undefined;
  /** The live run of the task's current plan (null before it starts). */
  session: OrchComposeSession | null;
  settings: OrchVideoSettings | null;
  /** Start / resume the run; `force` resolves again from scratch. */
  compose: (task: OrchComposeTask, force: boolean) => void;
}

/**
 * One composition and its run. The run belongs to the composer service: a page
 * only watches it, and opening the task (or a plan-shaping edit) resumes it, so
 * resources keep loading in the background whichever page is open.
 */
export function useWordNewOrchComposeRun(taskId: string): WordNewOrchComposeRun {
  const [task, setTask] = useState<OrchComposeTask | null | undefined>(undefined);
  const [baseSettings, setBaseSettings] = useState<OrchVideoSettings | null>(null);
  const taskRef = useRef<OrchComposeTask | null | undefined>(undefined);

  useEffect(() => wordNewOrchTaskStore.subscribe((tasks) => setTask(tasks.find((entry) => entry.id === taskId) ?? null)), [taskId]);
  taskRef.current = task;

  const subscribeSession = useCallback((listener: () => void) => wordNewOrchComposer.subscribe(taskId, listener), [taskId]);
  const readSession = useCallback(() => wordNewOrchComposer.session(taskId), [taskId]);
  const liveSession = useSyncExternalStore(subscribeSession, readSession, readSession);
  const session = liveSession && task && liveSession.planHash === task.planHash ? liveSession : null;

  const planHash = task?.planHash;
  const presetId = task?.config.presetId ?? '';
  useEffect(() => {
    const apply = (document: OrchPresetDocument): void => setBaseSettings(wordNewOrchPresetStore.settingsFor(document, presetId));
    const off = wordNewOrchPresetStore.subscribe(apply);
    void wordNewOrchPresetStore.load().then(apply);
    return off;
  }, [presetId]);

  const compose = useCallback((current: OrchComposeTask, force: boolean): void => {
    wordNewOrchComposer.ensure(current, { force });
  }, []);

  useEffect(() => {
    if (taskRef.current) compose(taskRef.current, false);
  }, [taskId, planHash, compose]);

  const settings = useMemo<OrchVideoSettings | null>(
    () => (baseSettings && task ? { ...baseSettings, languages: task.config.languages } : null),
    [baseSettings, task],
  );

  return { task, session, settings, compose };
}
