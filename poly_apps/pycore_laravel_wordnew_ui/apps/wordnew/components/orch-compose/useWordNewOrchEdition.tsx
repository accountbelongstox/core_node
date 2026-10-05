import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { wordNewOrchEditionStore, type OrchEditionOffer, type OrchPlaybackEdition } from '../../services/orchestration/WordNewOrchEditionStore';
import type { WordNewOrchComposePlayback } from './useWordNewOrchComposePlayback';
import { OrchButton } from './orchPanels';

export interface WordNewOrchEdition {
  /** The stored pre-compiled edition (null until opened, or when none exists yet). */
  edition: OrchPlaybackEdition | null;
  /** A newer compilation waiting for confirmation. */
  offer: OrchEditionOffer | null;
}

/** The task's static edition as the preview and the player page play it; opening never recompiles it. */
export function useWordNewOrchEdition(taskId: string, task: OrchComposeTask | null | undefined): WordNewOrchEdition {
  const subscribe = useCallback((listener: () => void) => wordNewOrchEditionStore.subscribe(taskId, listener), [taskId]);
  const read = useCallback(() => wordNewOrchEditionStore.version(taskId), [taskId]);
  const version = useSyncExternalStore(subscribe, read, read);
  const [opened, setOpened] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on a new edition version
  const edition = useMemo(() => (opened === taskId ? wordNewOrchEditionStore.edition(taskId) : null), [taskId, version, opened]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on a new edition version
  const offer = useMemo(() => wordNewOrchEditionStore.pending(taskId), [taskId, version]);

  const planHash = task?.planHash;
  const taskRef = useRef(task);
  taskRef.current = task;
  useEffect(() => {
    const current = taskRef.current;
    if (!current) return undefined;
    let active = true;
    void wordNewOrchEditionStore.open(current).then(() => { if (active) setOpened(current.id); });
    return () => { active = false; };
  }, [taskId, planHash]);

  return { edition, offer };
}

interface OfferProps {
  taskId: string;
  offer: OrchEditionOffer | null;
  playback: WordNewOrchComposePlayback;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

/** Asks whether the newer compilation replaces the playing edition (keeps the position). */
export const WordNewOrchEditionOffer: React.FC<OfferProps> = ({ taskId, offer, playback, theme, trans }) => {
  if (!offer) return null;
  const accept = async (): Promise<void> => {
    const now = playback.position();
    const playing = playback.sequencer.playing;
    playback.sequencer.pause();
    await wordNewOrchEditionStore.accept(taskId);
    if (now) playback.jumpTo(now, playing);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px]" role="status">
      <Sparkles className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT.emerald}`} aria-hidden />
      <span className="min-w-0 flex-1 text-emerald-700 dark:text-emerald-200">
        {offer.replan
          ? trans('orchCompose.edition.offerReplan', { clips: offer.clips, time: formatClockTime(offer.durationMs / 1000) })
          : trans('orchCompose.edition.offer', { clips: Math.max(0, offer.addedClips), time: formatClockTime(Math.max(0, offer.addedMs) / 1000) })}
      </span>
      <button type="button" onClick={() => { void accept(); }} className={`rounded-lg border px-2.5 py-1 font-bold ${theme.accentBg}`}>
        {trans('orchCompose.edition.replace')}
      </button>
      <OrchButton variant="ghost" onClick={() => wordNewOrchEditionStore.dismiss(taskId)}>{trans('orchCompose.edition.later')}</OrchButton>
    </div>
  );
};
