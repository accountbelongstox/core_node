/**
 * PcLiveSystemMeters — CPU, memory and per-GPU (utilization + VRAM) meters of
 * the model-live snapshot. One component for the Models view and every live panel.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, HardDrive, MemoryStick, Zap } from 'lucide-react';
import type { ModelLiveGpu, ModelLiveSystem } from '@/apps/pycore-manager/api';
import { megabytesToGb } from '../../../utils/pcFormat';
import { PcMeter } from '../PcMeter';

const PERCENT_MAX = 100;

export function vramPercent(gpu?: ModelLiveGpu | null): number {
  const total = Number(gpu?.mem_total_mb) || 0;
  return total > 0 ? ((Number(gpu?.mem_used_mb) || 0) / total) * PERCENT_MAX : 0;
}

export const PcGpuMeters: React.FC<{ gpu: ModelLiveGpu; label?: string }> = ({ gpu, label }) => {
  const { t } = useTranslation('pc');
  const name = label || gpu.name || t('aiHub.live.gpu');
  const temperature = gpu.temperature_c != null ? ` · ${Math.round(gpu.temperature_c)}C` : '';
  return (
    <>
      <PcMeter
        label={`${name} ${t('aiHub.live.util')}`}
        percent={Number(gpu.util_percent) || 0}
        Icon={Zap}
        sub={`${gpu.name || ''}${temperature}`}
      />
      <PcMeter
        label={`${name} ${t('aiHub.live.vram')}`}
        percent={vramPercent(gpu)}
        Icon={HardDrive}
        sub={`${megabytesToGb(gpu.mem_used_mb)} / ${megabytesToGb(gpu.mem_total_mb)} GB`}
      />
    </>
  );
};

export const PcLiveSystemMeters: React.FC<{ system?: ModelLiveSystem | null }> = ({ system }) => {
  const { t } = useTranslation('pc');
  const gpus = system?.gpus ?? [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <PcMeter
        label={t('aiHub.live.cpu')}
        percent={Number(system?.cpu_percent) || 0}
        Icon={Cpu}
        sub={system ? t('common.live') : t('common.noData')}
      />
      <PcMeter
        label={t('aiHub.live.memory')}
        percent={Number(system?.mem_percent) || 0}
        Icon={MemoryStick}
        sub={system?.mem_total_mb
          ? `${megabytesToGb(system.mem_used_mb)} / ${megabytesToGb(system.mem_total_mb)} GB`
          : t('common.noData')}
      />
      {gpus.map((gpu, position) => (
        <PcGpuMeters key={gpu.index ?? position} gpu={gpu} label={gpus.length > 1 ? `GPU${gpu.index ?? position}` : undefined} />
      ))}
    </div>
  );
};
