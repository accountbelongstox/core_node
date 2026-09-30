/**
 * PcModelRow — one manifest entry: boot + runtime pills, tier, Test, History,
 * power controls, the live panel (when the manifest names one) and, for a
 * blocked (masked) model, the localized reason with a Retry action.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Loader2, Lock, RefreshCw } from 'lucide-react';
import { retryAiHubBoot } from '@/apps/pycore-manager/api';
import type { AiHubEntry } from '@/apps/pycore-manager/api';
import { aiHubReasonOf } from '../../../utils/pcAiHubText';
import { PC_ENGINE_LOAD_CATEGORIES } from '../../../utils/pcAiHubMeta';
import { PcEngineLoadBadge } from '../PcEngineLoadBadge';
import { PcBootPill, PcRuntimePill } from '../PcModelPills';
import { PcChip } from '../PcStatusPill';
import { PcTierBadge } from '../PcTierBadge';
import PcLivePanel from '../live/PcLivePanel';
import { PcTestChip } from '../probe/PcTestChip';
import { PcModelPower, pcModelSupportsPower } from './PcModelPower';

export interface PcModelRowProps {
  entry: AiHubEntry;
  onHistory: (entry: AiHubEntry) => void;
}

export const PcModelRow: React.FC<PcModelRowProps> = ({ entry, onHistory }) => {
  const { t } = useTranslation('pc');
  const [retrying, setRetrying] = useState(false);
  const blocked = entry.boot.state === 'blocked';
  const bootReason = aiHubReasonOf(entry.boot);
  const runtimeReason = aiHubReasonOf(entry.runtime_state);
  const reason = bootReason || (entry.boot.state === 'deferred' ? runtimeReason : '');
  const aliases = (entry.aliases ?? []).join(', ');

  const retry = async () => {
    setRetrying(true);
    try {
      await retryAiHubBoot(entry);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`rounded-2xl border bg-white/40 dark:bg-white/5 ${
      blocked ? 'border-rose-400/30' : 'border-slate-300/35 dark:border-white/5'
    }`}>
      <div className={`p-3 flex flex-col gap-2 ${blocked ? 'opacity-90' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-sm font-bold truncate ${blocked ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
              title={aliases || undefined}>
              {entry.id}
            </span>
            <PcChip tone="idle" dot={false} className="!px-1.5 !py-0.5 !text-[9px] uppercase font-bold">
              {t(`aiHub.runtimeKind.${entry.runtime}`, { defaultValue: entry.runtime })}
            </PcChip>
            <PcBootPill boot={entry.boot} />
            {!blocked && <PcRuntimePill state={entry.runtime_state} />}
            {!blocked && PC_ENGINE_LOAD_CATEGORIES.includes(entry.category) && <PcEngineLoadBadge engine={entry.id} />}
            <PcTierBadge tier={entry.tier} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {pcModelSupportsPower(entry) && !blocked && <PcModelPower entry={entry} />}
            {entry.capabilities.history && (
              <button
                type="button"
                onClick={() => onHistory(entry)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold pc-glass hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 transition">
                <History className="w-3 h-3" /> {t('aiHub.history.open')}
              </button>
            )}
            <PcTestChip entry={entry} />
          </div>
        </div>

        {entry.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{entry.note}</p>}

        {(blocked || reason) && (
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] border ${
            blocked
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
          }`}>
            {blocked && <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <span className="min-w-0 flex-1 break-words">
              {blocked && <span className="font-bold mr-1">{t('aiHub.boot.blockedPrefix')}</span>}
              {reason || t('aiHub.boot.noReason')}
            </span>
            {blocked && (
              <button
                type="button"
                onClick={() => { void retry(); }}
                disabled={retrying}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500/25 transition disabled:opacity-50">
                {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {t('common.retry')}
              </button>
            )}
          </div>
        )}
      </div>

      {entry.capabilities.live && !blocked && (
        <div className="border-t border-slate-200/60 dark:border-white/5 p-3">
          <PcLivePanel variant={entry.capabilities.live} showSystem={false} embedded />
        </div>
      )}
    </div>
  );
};
