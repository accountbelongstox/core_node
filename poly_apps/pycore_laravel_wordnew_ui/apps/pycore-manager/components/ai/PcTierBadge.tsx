/**
 * PcTierBadge — the ONE tier vocabulary: a provider cost tier (free / balance /
 * paid) or a local model tier ({gpu, cpu, active, env}).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';
import type { AiHubModelTier } from '@/apps/pycore-manager/api';
import { PcStatusPill, type PcTone } from './PcStatusPill';

const COST_TIER_TONE: Record<string, PcTone> = {
  free: 'ok',
  balance: 'info',
  paid: 'warn',
};

export type PcTierValue = string | AiHubModelTier | null | undefined;

export const PcTierBadge: React.FC<{ tier: PcTierValue }> = ({ tier }) => {
  const { t } = useTranslation('pc');
  if (!tier) return null;
  if (typeof tier === 'string') {
    return <PcStatusPill tone={COST_TIER_TONE[tier] ?? 'idle'} label={tier} />;
  }
  const active = tier.active || tier.gpu || tier.cpu;
  if (!active) return null;
  const title = [
    `${t('aiHub.tier.gpu')}: ${tier.gpu || '-'}`,
    `${t('aiHub.tier.cpu')}: ${tier.cpu || '-'}`,
    tier.env ? `${t('aiHub.tier.env')}: ${tier.env}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <PcStatusPill
      tone="accent"
      Icon={Cpu}
      label={<span className="normal-case font-mono">{active}</span>}
      title={title}
    />
  );
};
