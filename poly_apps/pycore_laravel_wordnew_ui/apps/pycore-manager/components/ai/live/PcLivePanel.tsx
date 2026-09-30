/**
 * PcLivePanel — the shared live model panel. Reads the model_live snapshot
 * store (and keeps its watch keep-alive while mounted) and renders the variant
 * the manifest names for the model: `qwen_queue` (qwen3tts load / queue / job
 * progress) or `word_batch` (kokoro load / queue / batch progress).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import type { AiHubLiveKind } from '@/apps/pycore-manager/api';
import { isModelLiveStale, usePcModelLive } from '@/apps/pycore-manager/api';
import { pcErrorCodeText } from '../../../utils/pcErrorCodes';
import { PcStatusPill, type PcTone } from '../PcStatusPill';
import { PcKokoroLive } from './PcKokoroLive';
import { PcLiveSystemMeters } from './PcLiveSystemMeters';
import { PcQwenLive } from './PcQwenLive';

const STALE_CHECK_MS = 2_000;

export interface PcLivePanelProps {
  variant: AiHubLiveKind;
  /** Render the CPU / memory / GPU meters above the variant body. */
  showSystem?: boolean;
  /** Bare body without the framed header (embedded in another card). */
  embedded?: boolean;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const PcLivePanel: React.FC<PcLivePanelProps> = ({ variant, showSystem = true, embedded = false }) => {
  const { t } = useTranslation('pc');
  const live = usePcModelLive(true);
  const now = useNow(STALE_CHECK_MS);
  const snapshot = live.snapshot;
  const stale = isModelLiveStale(live, now);

  let tone: PcTone = 'ok';
  let statusLabel = t('aiHub.live.status.live');
  if (!snapshot) {
    tone = live.error ? 'bad' : 'idle';
    statusLabel = live.error ? t('aiHub.live.status.offline') : t('aiHub.live.status.connecting');
  } else if (stale) {
    tone = 'warn';
    statusLabel = t('aiHub.live.status.stale');
  }

  const body = (
    <div className="space-y-4">
      {showSystem && <PcLiveSystemMeters system={snapshot?.system} />}
      {!snapshot && live.error && (
        <p className="text-[11px] text-amber-500">{pcErrorCodeText(live.error)}</p>
      )}
      {variant === 'qwen_queue'
        ? <PcQwenLive live={snapshot?.qwen3tts} />
        : <PcKokoroLive live={snapshot?.kokoro} />}
    </div>
  );

  if (embedded) return body;
  return (
    <section className="pc-glass p-4 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Activity className="w-4 h-4 text-indigo-500" />
          {variant === 'qwen_queue' ? t('aiHub.live.qwen.title') : t('aiHub.live.kokoro.title')}
        </h3>
        <PcStatusPill tone={tone} label={statusLabel} busy={!snapshot && !live.error} />
      </div>
      {body}
    </section>
  );
};

export default PcLivePanel;
