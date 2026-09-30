/**
 * PcLimitChips / PcRateBudget — a provider's registry limits and its local rate
 * budget bars (minute / day / month usage vs limit).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
import type { AiProviderRate } from '@/apps/pycore-manager/api';
import { formatDurationShort } from '../../../utils/pcFormat';
import { PcProgressBar } from '../PcMeter';

const PERCENT_MAX = 100;

/** Registry limits string split into chips (semicolon-separated). */
export const PcLimitChips: React.FC<{ limits: string }> = ({ limits }) => {
  const parts = limits.split(';').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {parts.map((part) => (
        <span
          key={part}
          title={part}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-indigo-500/8 border border-indigo-400/20 text-slate-500 dark:text-slate-400">
          <Gauge className="w-3 h-3 text-indigo-400/70 shrink-0" />
          <span className="leading-snug">{part}</span>
        </span>
      ))}
    </div>
  );
};

const BudgetCell: React.FC<{ label: string; used?: number; max?: number | null }> = ({ label, used, max }) => {
  if (max == null || used == null) return null;
  const percent = max > 0 ? Math.min(PERCENT_MAX, (used / max) * PERCENT_MAX) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
        <span className="uppercase tracking-wide">{label}</span><span>{used}/{max}</span>
      </div>
      <div className="mt-0.5"><PcProgressBar percent={percent} thin /></div>
    </div>
  );
};

export const PcRateBudget: React.FC<{ rate?: AiProviderRate | null }> = ({ rate }) => {
  const { t } = useTranslation('pc');
  if (!rate) return null;
  if (!rate.enforced) {
    return <p className="text-[10px] font-mono text-slate-400 mt-2">{t('aiHub.providers.rate.notEnforced')}</p>;
  }
  const limits = rate.limits;
  const usage = rate.usage;
  const resets = [rate.resets_in?.minute, rate.resets_in?.day, rate.resets_in?.month]
    .filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
  const soonest = resets.length ? Math.min(...resets) : null;
  const hasCells = [limits?.rpm, limits?.rpd, limits?.rpm_month].some((value) => value != null);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <Gauge className="w-3 h-3 text-indigo-400/70" /> {t('aiHub.providers.rate.title')}
        </span>
        {soonest != null && (
          <span className="text-[9px] font-mono text-slate-400" title={t('aiHub.providers.rate.resetTitle')}>
            {t('aiHub.providers.rate.resetsIn', { time: formatDurationShort(soonest) })}
          </span>
        )}
      </div>
      {hasCells ? (
        <div className="flex gap-2">
          <BudgetCell label={t('aiHub.providers.rate.minute')} used={usage?.minute} max={limits?.rpm} />
          <BudgetCell label={t('aiHub.providers.rate.day')} used={usage?.day} max={limits?.rpd} />
          <BudgetCell label={t('aiHub.providers.rate.month')} used={usage?.month} max={limits?.rpm_month} />
        </div>
      ) : (
        <p className="text-[10px] font-mono text-slate-400">{t('aiHub.providers.rate.enforced')}</p>
      )}
    </div>
  );
};
