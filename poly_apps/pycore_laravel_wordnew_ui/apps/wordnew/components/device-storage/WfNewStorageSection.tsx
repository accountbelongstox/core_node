/**
 * Cache page: the device's storage volumes, the all-files access state and where orchestration audio clips are kept
 * (changing the root moves every clip and rolls back on failure).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Loader2, MemoryStick, RefreshCw, ShieldCheck } from 'lucide-react';
import { notify } from '@/shared/notify/notify';
import { formatBytes } from '../../../../core/utils/formatBytes';
import type { ElementTheme } from '../../WfNewThemes';
import { capDeviceStorage, type CapAllFilesAccess, type CapStorageVolume } from '../../platform/capabilities/CapDeviceStorage';
import { wordNewOrchClipStore, type OrchClipRoot, type OrchClipRootOption } from '../../services/orchestration/WordNewOrchClipStore';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Changes whenever another section changed the clips: the section reloads. */
  revision: number;
  onRootChanged: () => void;
}

type Trans = Props['trans'];

const FULL_SHARE_PERCENT = 90;

const sameRoot = (current: OrchClipRoot | null, option: OrchClipRoot): boolean => current?.path === option.path && current?.kind === option.kind;

const VolumeRow: React.FC<{ volume: CapStorageVolume; trans: Trans }> = ({ volume, trans }) => {
  const used = Math.max(0, volume.totalBytes - volume.freeBytes);
  const share = volume.totalBytes > 0 ? (used / volume.totalBytes) * 100 : 0;
  const Icon = volume.removable ? MemoryStick : HardDrive;
  return (
    <li className="space-y-1.5 rounded-xl border border-slate-200 dark:border-white/5 p-3">
      <div className="flex items-center gap-2 text-xs">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="flex-1 min-w-0 truncate font-bold text-zinc-700 dark:text-zinc-100">{volume.label || trans(`cachePage.volume.${volume.kind}`)}</span>
        <span className="font-mono text-[10px] text-zinc-500">{trans('cachePage.volumeFree', { free: formatBytes(volume.freeBytes), total: formatBytes(volume.totalBytes) })}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-slate-500/15 overflow-hidden"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share)}
        aria-label={trans('cachePage.volumeUsed', { used: formatBytes(used) })}
      >
        <div className={`h-full ${share > FULL_SHARE_PERCENT ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${share}%` }} />
      </div>
      {volume.rootPath && <p className="font-mono text-[10px] text-zinc-400 truncate">{volume.rootPath}</p>}
    </li>
  );
};

export const WfNewStorageSection: React.FC<Props> = ({ activeTheme, trans, revision, onRootChanged }) => {
  const [volumes, setVolumes] = useState<CapStorageVolume[]>([]);
  const [access, setAccess] = useState<CapAllFilesAccess | null>(null);
  const [options, setOptions] = useState<OrchClipRootOption[]>([]);
  const [root, setRoot] = useState<OrchClipRoot | null>(null);
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [moving, setMoving] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [answer, files, rootOptions, current, stats] = await Promise.all([
        capDeviceStorage.volumes(),
        capDeviceStorage.checkAllFilesAccess(),
        wordNewOrchClipStore.rootOptions(),
        wordNewOrchClipStore.root(),
        wordNewOrchClipStore.stats(),
      ]);
      setVolumes(answer.volumes);
      setAccess(files);
      setOptions(rootOptions);
      setRoot(current);
      setUsedBytes(stats.bytes);
    } catch {
      notify.error(trans('cachePage.storageFailed'));
    } finally {
      setLoading(false);
    }
  }, [trans]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const requestAccess = async (): Promise<boolean> => {
    const answer = await capDeviceStorage.requestAllFilesAccess();
    setAccess(answer);
    if (answer.granted) {
      const adopted = await wordNewOrchClipStore.adoptPublicRoots().catch(() => 0);
      if (adopted > 0) {
        notify.success(trans('cachePage.adopted', { count: adopted }));
        onRootChanged();
      }
    }
    return answer.granted;
  };

  const grant = async (): Promise<void> => {
    await requestAccess();
    await load();
  };

  const choose = async (option: OrchClipRootOption): Promise<void> => {
    if (moving || sameRoot(root, option)) return;
    let allowed = true;
    if (option.access === 'all-files') allowed = (access?.granted || await requestAccess()) && await capDeviceStorage.ensureFilesystemAccess();
    else if (option.access === 'storage') allowed = await capDeviceStorage.ensureFilesystemAccess();
    if (!allowed) {
      notify.warning(trans('cachePage.accessNeeded'));
      return;
    }
    setMoving({ done: 0, total: 0 });
    const moved = await wordNewOrchClipStore.relocate(option, (done, total) => setMoving({ done, total })).then(() => true, () => false);
    setMoving(null);
    if (moved) notify.success(trans('cachePage.rootChanged'));
    else notify.error(trans('cachePage.rootFailed'));
    await load();
    onRootChanged();
  };

  return (
    <section className={`p-6 rounded-3xl ${activeTheme.cardClass} shadow-sm space-y-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <HardDrive className="w-4 h-4 text-indigo-500" /> {trans('cachePage.storageTitle')}
        </h3>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading}
          aria-label={trans('cache.refresh')}
          title={trans('cache.refresh')}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <ul className="space-y-2">
        {volumes.map((volume) => <VolumeRow key={volume.id} volume={volume} trans={trans} />)}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
        <span className="flex-1 min-w-0 text-zinc-500 dark:text-zinc-400">
          {trans(access?.granted ? 'cachePage.accessGranted' : capDeviceStorage.isNative() ? 'cachePage.accessMissing' : 'cachePage.accessWebMissing')}
        </span>
        {!access?.granted && (
          <button type="button" onClick={() => { void grant(); }} className={`rounded-xl border px-3 py-1.5 font-bold ${activeTheme.accentBg}`}>
            {trans('cachePage.accessRequest')}
          </button>
        )}
      </div>
      <fieldset className="space-y-2" disabled={moving !== null}>
        <legend className="text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {trans('cachePage.rootTitle')}
          {usedBytes !== null && <span className="ml-2 normal-case font-normal">{trans('cachePage.rootUsage', { size: formatBytes(usedBytes) })}</span>}
        </legend>
        {options.map((option) => {
          const active = sameRoot(root, option);
          return (
            <label
              key={`${option.kind}:${option.path}`}
              className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer ${active ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5'}`}
            >
              <input type="radio" name="orch-clip-root" checked={active} onChange={() => { void choose(option); }} className="mt-0.5 accent-indigo-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-100">
                  {trans(`cachePage.root.${option.kind}`, { volume: option.volume?.label || trans(`cachePage.volume.${option.volume?.kind ?? 'internal'}`) })}
                </span>
                <span className="block text-[10px] text-zinc-500">{trans(`cachePage.rootHint.${option.kind}`)}</span>
                {option.path && <span className="block font-mono text-[10px] text-zinc-400 truncate">{option.path}</span>}
              </span>
            </label>
          );
        })}
        {moving && (
          <p className="flex items-center gap-2 text-[11px] text-amber-500" role="status">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {trans('cachePage.moving', { done: moving.done, total: moving.total })}
          </p>
        )}
      </fieldset>
    </section>
  );
};
