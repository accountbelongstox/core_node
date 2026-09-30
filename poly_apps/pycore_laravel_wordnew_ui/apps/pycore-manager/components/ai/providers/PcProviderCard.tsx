/**
 * PcProviderCard — one AI provider: status, tier, key / models / latency,
 * and a collapsible drawer with limits, rate budget, key rotation and prompts.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, Image as ImageIcon, KeyRound,
  MinusCircle, Snowflake, Timer,
} from 'lucide-react';
import type { AiProvider } from '@/apps/pycore-manager/api';
import { modelsLabel } from '../../../hooks/usePcProviders';
import PcAiProviderPromptsEditor from '../../PcAiProviderPromptsEditor';
import { PcCollapse } from '../../PcAiShared';
import { PcKeySlots } from '../PcKeySlots';
import { PcChip, PcStatusPill, type PcTone } from '../PcStatusPill';
import { PcTierBadge } from '../PcTierBadge';
import { PcLimitChips, PcRateBudget } from './PcRateBudget';

const PROMPTS_PROVIDER = 'openrouter';

type ProviderBadgeKey = 'available' | 'unavailable' | 'unconfigured' | 'untested' | 'ratelimited';

const BADGE: Record<ProviderBadgeKey, { tone: PcTone; Icon: React.FC<{ className?: string }> }> = {
  available: { tone: 'ok', Icon: CheckCircle2 },
  unavailable: { tone: 'warn', Icon: AlertTriangle },
  unconfigured: { tone: 'idle', Icon: MinusCircle },
  untested: { tone: 'idle', Icon: MinusCircle },
  ratelimited: { tone: 'bad', Icon: Snowflake },
};

export function providerBadgeKey(provider: AiProvider): ProviderBadgeKey {
  if (!provider.configured) return 'unconfigured';
  if (provider.rate_limited) return 'ratelimited';
  if (!provider.tested) return 'untested';
  return provider.available ? 'available' : 'unavailable';
}

export interface PcProviderCardProps {
  provider: AiProvider;
  resetting?: Set<string>;
  onResetCooldown: (provider: string, image: boolean, index: number) => void;
  actions?: React.ReactNode;
}

export const PcProviderCard: React.FC<PcProviderCardProps> = ({ provider, resetting, onResetCooldown, actions }) => {
  const { t } = useTranslation('pc');
  const [open, setOpen] = useState(false);
  const badgeKey = providerBadgeKey(provider);
  const badge = BADGE[badgeKey];
  return (
    <div className={`rounded-2xl border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col ${
      !provider.configured ? 'opacity-60' : ''
    }`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-left p-4 flex flex-col gap-2 w-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{provider.name}</span>
            <PcTierBadge tier={provider.tier} />
            {provider.vision && <PcStatusPill tone="accent" label={t('aiHub.providers.vision')} />}
            {provider.image && (
              <PcChip
                tone={provider.image_ready ? 'ok' : 'idle'}
                dot={false}
                className="!px-2 !py-0.5 !text-[9px] font-bold max-w-[160px]"
                title={provider.image_ready ? t('aiHub.providers.imageReady') : t('aiHub.providers.imageNoKey')}>
                <ImageIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{provider.image_model || t('aiHub.providers.image')}</span>
              </PcChip>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PcStatusPill
              tone={badge.tone}
              Icon={badge.Icon}
              label={t(`aiStatus.badge.${badgeKey}`)}
              title={provider.error || undefined}
            />
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-mono truncate" title={t('aiHub.providers.keyMasked')}>
            <KeyRound className="w-3 h-3 shrink-0" />{provider.key_masked || t('aiStatus.noKey')}
          </span>
          <span className="inline-flex items-center gap-1 font-mono truncate" title={t('aiHub.providers.models')}>
            <BrainCircuit className="w-3 h-3 shrink-0" />{modelsLabel(provider)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono" title={t('aiHub.providers.latencyTitle')}>
            <Timer className="w-3 h-3 shrink-0" />
            {provider.tested && provider.latency_ms != null ? `${Math.round(provider.latency_ms)} ms` : t('aiStatus.notTested')}
          </span>
        </div>
      </button>

      <PcCollapse open={open}>
        <div className="px-4 pb-2 -mt-1 space-y-1">
          {provider.limits && <PcLimitChips limits={provider.limits} />}
          <PcRateBudget rate={provider.rate} />
          <PcKeySlots
            slots={provider.keys}
            label={t('aiStatus.keyRotation.textKeys')}
            resetting={resetting}
            onResetCooldown={(image, index) => onResetCooldown(provider.name, image, index)}
          />
          {provider.image && provider.image_keys && provider.image_keys.length > 0 && (
            <PcKeySlots
              slots={provider.image_keys}
              label={t('aiStatus.keyRotation.imageKeys')}
              image
              resetting={resetting}
              onResetCooldown={(image, index) => onResetCooldown(provider.name, image, index)}
            />
          )}
          {provider.tested && provider.configured && !provider.available && provider.error && (
            <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-snug flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="break-words">{provider.error}</span>
            </p>
          )}
          {provider.name === PROMPTS_PROVIDER && <PcAiProviderPromptsEditor />}
        </div>
      </PcCollapse>

      {actions && <div className="px-4 pb-4 pt-1 mt-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};
