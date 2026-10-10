/**
 * Live device-storage widget of the orchestration page: audio kept on this device (orchestration clips plus the
 * word-audio cache), how many words / sentences they are, and the used share of the clip root's volume.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, MemoryStick, MessageSquare, Type } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { capDeviceStorage, type CapStorageVolume } from '../../platform/capabilities/CapDeviceStorage';
import { staticCacheStats } from '../../runtime-store/WfNewStaticCache';
import { wordNewOrchClipStore, type OrchClipStats } from '../../services/orchestration/WordNewOrchClipStore';
import { volumeUsage } from './storageUsage';

interface Props {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpen?: () => void;
}

export const WfNewStorageBadge: React.FC<Props> = ({ trans, onOpen }) => {
  const [stats, setStats] = useState<OrchClipStats | null>(null);
  const [volume, setVolume] = useState<CapStorageVolume | null>(null);
  const [audioBytes, setAudioBytes] = useState(0);

  const load = useCallback(async () => {
    const [clips, root, volumes, audio] = await Promise.all([
      wordNewOrchClipStore.stats(),
      wordNewOrchClipStore.root(),
      capDeviceStorage.volumes().then((answer) => answer.volumes).catch(() => [] as CapStorageVolume[]),
      staticCacheStats().catch(() => ({ bytes: 0 })),
    ]);
    setStats(clips);
    setAudioBytes(audio.bytes);
    setVolume(
      volumes.find((entry) => entry.id === root.volumeId)
        ?? volumes.find((entry) => entry.kind === 'internal' || entry.kind === 'browser')
        ?? null,
    );
  }, []);

  useEffect(() => {
    void load();
    return wordNewOrchClipStore.onChange(() => { void load(); });
  }, [load]);

  if (!stats) return null;
  const { used, total: volumeTotal, full } = volumeUsage(volume);
  const VolumeIcon = volume?.removable ? MemoryStick : HardDrive;
  const total = stats.bytes + audioBytes;
  const detail = trans('orchCompose.storage.detail', {
    total: formatBytes(total),
    clips: formatBytes(stats.bytes),
    audio: formatBytes(audioBytes),
    words: stats.words,
    sentences: stats.sentences,
    free: volume ? formatBytes(volume.freeBytes) : '—',
  });

  return (
    <Pill stat title={detail} onClick={onOpen} className="gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        <VolumeIcon className={`h-3 w-3 ${TONE_TEXT.indigo}`} aria-hidden />
        {formatBytes(total)}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <Type className={`h-3 w-3 ${TONE_TEXT.emerald}`} aria-hidden />
        {stats.words}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <MessageSquare className={`h-3 w-3 ${TONE_TEXT.sky}`} aria-hidden />
        {stats.sentences}
      </span>
      {volume && (
        <span className="hidden w-8 sm:flex" aria-hidden>
          <ProgressBar done={used} total={volumeTotal} tone={full ? 'rose' : 'indigo'} className="h-1" />
        </span>
      )}
    </Pill>
  );
};
