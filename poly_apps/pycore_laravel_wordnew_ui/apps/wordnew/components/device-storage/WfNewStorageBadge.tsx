/**
 * Live device-storage widget of the orchestration page: audio kept on this device (orchestration clips plus the
 * word-audio cache), how many words / sentences they are, and the used share of the clip root's volume.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, MemoryStick, MessageSquare, Type } from 'lucide-react';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { capDeviceStorage, type CapStorageVolume } from '../../platform/capabilities/CapDeviceStorage';
import { audioCacheStats } from '../../runtime-store/WfNewAudioCache';
import { wordNewOrchClipStore, type OrchClipStats } from '../../services/orchestration/WordNewOrchClipStore';

interface Props {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpen?: () => void;
}

const FULL_SHARE_PERCENT = 90;

export const WfNewStorageBadge: React.FC<Props> = ({ trans, onOpen }) => {
  const [stats, setStats] = useState<OrchClipStats | null>(null);
  const [volume, setVolume] = useState<CapStorageVolume | null>(null);
  const [audioBytes, setAudioBytes] = useState(0);

  const load = useCallback(async () => {
    const [clips, root, volumes, audio] = await Promise.all([
      wordNewOrchClipStore.stats(),
      wordNewOrchClipStore.root(),
      capDeviceStorage.volumes().then((answer) => answer.volumes).catch(() => [] as CapStorageVolume[]),
      audioCacheStats().catch(() => ({ bytes: 0 })),
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
  const used = volume ? Math.max(0, volume.totalBytes - volume.freeBytes) : 0;
  const usedShare = volume && volume.totalBytes > 0 ? Math.min(100, (used / volume.totalBytes) * 100) : 0;
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
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      title={detail}
      aria-label={detail}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-1.5 py-1 font-mono text-[10px] leading-none text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10 disabled:cursor-default"
    >
      <span className="inline-flex items-center gap-0.5">
        <VolumeIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-300" aria-hidden />
        {formatBytes(total)}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <Type className="h-3 w-3 text-emerald-600 dark:text-emerald-300" aria-hidden />
        {stats.words}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <MessageSquare className="h-3 w-3 text-sky-600 dark:text-sky-300" aria-hidden />
        {stats.sentences}
      </span>
      {volume && (
        <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 sm:block" aria-hidden>
          <span className={`block h-full ${usedShare > FULL_SHARE_PERCENT ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${usedShare}%` }} />
        </span>
      )}
    </button>
  );
};
