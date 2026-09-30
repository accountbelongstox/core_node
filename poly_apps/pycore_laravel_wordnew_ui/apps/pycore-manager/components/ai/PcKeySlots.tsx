/**
 * PcKeySlots — per-key rotation chips of one provider (KEY1/KEY2 ...): green =
 * ready / active, amber = cooling. One component for the read-only rotation view,
 * the per-key "reset cooldown" action and the per-key delete action.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, RefreshCcw, Snowflake, Trash2 } from 'lucide-react';
import type { AiKeySlot } from '@/apps/pycore-manager/api';
import { formatDurationShort } from '../../utils/pcFormat';
import { PC_TONE_CHIP, PcDot, type PcTone } from './PcStatusPill';

const SLOT_KIND_TEXT = 'text';
const SLOT_KIND_IMAGE = 'image';

export interface PcKeySlotsProps {
  slots?: AiKeySlot[];
  label: string;
  image?: boolean;
  resetting?: Set<string>;
  onResetCooldown?: (image: boolean, index: number) => void;
  resolveName?: (slot: AiKeySlot) => string | null;
  onDelete?: (keyName: string) => void;
  deleting?: Set<string>;
}

function slotTone(cooling: boolean, active: boolean): PcTone {
  if (cooling) return 'warn';
  return active ? 'ok' : 'idle';
}

export const PcKeySlots: React.FC<PcKeySlotsProps> = ({
  slots, label, image = false, resetting, onResetCooldown, resolveName, onDelete, deleting,
}) => {
  const { t } = useTranslation('pc');
  if (!slots || slots.length === 0) return null;
  const activeIndex = slots.findIndex((slot) => slot.cooldown_s <= 0);
  const kind = image ? SLOT_KIND_IMAGE : SLOT_KIND_TEXT;
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 mb-1">
        <KeyRound className="w-3 h-3 text-indigo-400/70" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[9px] font-mono text-slate-400">x{slots.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {slots.map((slot) => {
          const cooling = slot.cooldown_s > 0;
          const active = !cooling && slot.index === activeIndex;
          const keyName = resolveName ? resolveName(slot) : null;
          const resetBusy = resetting?.has(`${kind}:${slot.index}`) ?? false;
          const deleteBusy = keyName ? (deleting?.has(keyName) ?? false) : false;
          const cooldownText = formatDurationShort(slot.cooldown_s);
          return (
            <span
              key={`${label}-${slot.index}`}
              title={[
                `${slot.label} · ${slot.masked || t('aiHub.keySlots.noKey')}`,
                cooling ? t('aiHub.keySlots.cooling', { time: cooldownText }) : t('aiHub.keySlots.ready'),
                t('aiHub.keySlots.stats', { ok: slot.ok, failed: slot.failed }),
                slot.last_error ? t('aiHub.keySlots.lastError', { error: slot.last_error }) : '',
                keyName ? t('aiHub.keySlots.env', { name: keyName }) : '',
              ].filter(Boolean).join('\n')}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono border ${PC_TONE_CHIP[slotTone(cooling, active)]}`}>
              <PcDot tone={cooling ? 'warn' : 'ok'} />
              <span className="font-bold normal-case">{slot.label}</span>
              <span className="opacity-80">{slot.masked || '—'}</span>
              {cooling
                ? <span className="inline-flex items-center gap-0.5"><Snowflake className="w-2.5 h-2.5" />{cooldownText}</span>
                : (slot.ok + slot.failed > 0 && <span className="opacity-70">{slot.ok}/{slot.ok + slot.failed}</span>)}
              {(!!slot.minute_used || !!slot.day_used) && (
                <span className="opacity-60 border-l border-current/20 pl-1">
                  {t('aiHub.keySlots.usage', { minute: slot.minute_used ?? 0, day: slot.day_used ?? 0 })}
                </span>
              )}
              {cooling && onResetCooldown && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResetCooldown(image, slot.index); }}
                  disabled={resetBusy}
                  title={t('aiHub.keySlots.resetTitle')}
                  className="ml-0.5 -mr-0.5 px-1 py-0.5 rounded hover:bg-amber-500/20 transition disabled:opacity-40 normal-case font-bold">
                  {resetBusy ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : t('aiHub.keySlots.reset')}
                </button>
              )}
              {keyName && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(keyName)}
                  disabled={deleteBusy}
                  title={t('aiHub.keySlots.delete', { name: keyName })}
                  className="ml-0.5 -mr-0.5 p-0.5 rounded text-rose-500 hover:bg-rose-500/15 transition disabled:opacity-40">
                  {deleteBusy ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};
