/**
 * PcBootPill / PcRuntimePill — the boot verdict and the cheap runtime state of one
 * hub entry, as status pills. Reasons localize by reason_code with the English fallback.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Hourglass, Lock, Power } from 'lucide-react';
import type { AiHubBoot, AiHubRuntimeState } from '@/apps/pycore-manager/api';
import { aiHubReasonOf } from '../../utils/pcAiHubText';
import { formatDurationShort } from '../../utils/pcFormat';
import { PcStatusPill, type PcTone } from './PcStatusPill';

const BOOT_TONE: Record<string, PcTone> = { ready: 'ok', deferred: 'info', blocked: 'bad', pending: 'idle' };
const BOOT_ICON: Record<string, React.FC<{ className?: string }>> = {
  ready: CheckCircle2, deferred: Hourglass, blocked: Lock, pending: Hourglass,
};

export const PcBootPill: React.FC<{ boot?: AiHubBoot | null }> = ({ boot }) => {
  const { t } = useTranslation('pc');
  const state = boot?.state ?? 'pending';
  return (
    <PcStatusPill
      tone={BOOT_TONE[state] ?? 'idle'}
      Icon={BOOT_ICON[state] ?? Hourglass}
      label={t(`aiHub.boot.${state}`)}
      title={boot ? aiHubReasonOf(boot) || undefined : undefined}
    />
  );
};

interface RuntimeView {
  tone: PcTone;
  key: string;
  count?: number;
  busy?: boolean;
}

function runtimeView(state: AiHubRuntimeState): RuntimeView {
  if (state.pending) return { tone: 'idle', key: 'pending' };
  if ((state.in_flight ?? 0) > 0) return { tone: 'info', key: 'busy', count: state.in_flight, busy: true };
  if (state.paused) return { tone: 'warn', key: 'paused' };
  if (state.running) return { tone: 'ok', key: 'running' };
  if (state.model_loaded) return { tone: 'ok', key: 'loaded' };
  if (state.installed === false) return { tone: 'idle', key: 'notInstalled' };
  if (state.available === false) return { tone: 'warn', key: 'unavailable' };
  return { tone: 'idle', key: 'idle' };
}

export const PcRuntimePill: React.FC<{ state?: AiHubRuntimeState | null }> = ({ state }) => {
  const { t } = useTranslation('pc');
  const view = runtimeView(state ?? { pending: true });
  const idle = state?.idle_remaining_s;
  return (
    <span className="inline-flex items-center gap-1.5">
      <PcStatusPill
        tone={view.tone}
        Icon={Power}
        busy={view.busy}
        label={t(`aiHub.runtime.${view.key}`, { count: view.count ?? 0 })}
        title={state ? aiHubReasonOf(state) || undefined : undefined}
      />
      {typeof idle === 'number' && idle > 0 && (
        <span className="text-[10px] font-mono text-amber-600" title={t('aiHub.runtime.idleStop')}>
          {formatDurationShort(idle)}
        </span>
      )}
    </span>
  );
};
