/**
 * Cache page: the device's storage volumes, the all-files access state and where orchestration audio clips are kept
 * (changing the root moves every clip and rolls back on failure).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, FolderCog, FolderOpen, Globe, HardDrive, Loader2, Lock, MemoryStick, ShieldCheck, type LucideIcon } from 'lucide-react';
import { notify } from '@/shared/notify/notify';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { formatBytes } from '../../../../core/utils/formatBytes';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewCacheSection } from './WfNewCacheSection';
import { volumeUsage } from './storageUsage';
import { capDeviceStorage, type CapAllFilesAccess, type CapStorageVolume } from '../../platform/capabilities/CapDeviceStorage';
import { wordNewOrchClipStore, type OrchClipRoot, type OrchClipRootKind, type OrchClipRootOption } from '../../services/orchestration/WordNewOrchClipStore';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Changes whenever another section changed the clips: the section reloads. */
  revision: number;
  onRootChanged: () => void;
}

type Trans = Props['trans'];

const ROOT_ICON: Record<OrchClipRootKind, LucideIcon> = {
  internal: Lock,
  'app-volume': FolderCog,
  'public-volume': FolderOpen,
  browser: Globe,
};

const sameRoot = (current: OrchClipRoot | null, option: OrchClipRoot): boolean => current?.path === option.path && current?.kind === option.kind;

const VolumeRow: React.FC<{ volume: CapStorageVolume; trans: Trans }> = ({ volume, trans }) => {
  const { used, total, full } = volumeUsage(volume);
  const Icon = volume.removable ? MemoryStick : HardDrive;
  return (
    <li className="min-w-0 space-y-1 rounded-xl border border-slate-200 dark:border-white/5 px-2.5 py-2">
      <div className="flex items-center gap-2 text-xs">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="flex-1 min-w-0 truncate font-bold text-zinc-700 dark:text-zinc-100">{volume.label || trans(`cachePage.volume.${volume.kind}`)}</span>
        <span className="shrink-0 font-mono text-[10px] text-zinc-500">{trans('cachePage.volumeFree', { free: formatBytes(volume.freeBytes), total: formatBytes(total) })}</span>
      </div>
      <ProgressBar done={used} total={total} tone={full ? 'rose' : 'indigo'} label={trans('cachePage.volumeUsed', { used: formatBytes(used) })} className="h-1" />
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
  const [rootsOpen, setRootsOpen] = useState(false);

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

  const rootLabel = (option: OrchClipRootOption): string => trans(`cachePage.root.${option.kind}`, {
    volume: option.volume?.label || trans(`cachePage.volume.${option.volume?.kind ?? 'internal'}`),
  });
  const currentOption = options.find((option) => sameRoot(root, option)) ?? null;
  const CurrentRootIcon = ROOT_ICON[currentOption?.kind ?? root?.kind ?? 'internal'];

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
    <WfNewCacheSection
      theme={activeTheme}
      title={trans('cachePage.storageTitle')}
      icon={HardDrive}
      spacing="space-y-3"
      onRefresh={() => { void load(); }}
      refreshDisabled={loading}
      refreshing={loading}
      refreshLabel={trans('cache.refresh')}
    >
      <ul className="space-y-1.5">
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
      <fieldset className="min-w-0 space-y-1.5" disabled={moving !== null}>
        <legend className="sr-only">{trans('cachePage.rootTitle')}</legend>
        <button
          type="button"
          onClick={() => setRootsOpen((value) => !value)}
          aria-expanded={rootsOpen}
          aria-label={trans('cachePage.rootTitle')}
          title={currentOption ? `${trans('cachePage.rootTitle')}: ${rootLabel(currentOption)}` : trans('cachePage.rootTitle')}
          className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-2.5 py-2 text-left hover:bg-slate-500/5"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <CurrentRootIcon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {rootsOpen && trans('cachePage.rootTitle')}
          </span>
          {usedBytes !== null && <span className="shrink-0 font-mono text-[10px] text-zinc-500">{trans('cachePage.rootUsage', { size: formatBytes(usedBytes) })}</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${rootsOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {rootsOpen && options.map((option) => {
          const active = sameRoot(root, option);
          const Icon = ROOT_ICON[option.kind];
          return (
            <label
              key={`${option.kind}:${option.path}`}
              className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 cursor-pointer ${active ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5'}`}
            >
              <input type="radio" name="orch-clip-root" checked={active} onChange={() => { void choose(option); }} className="sr-only" />
              <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-indigo-500 text-white' : 'bg-slate-500/10 text-zinc-500'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-100">{rootLabel(option)}</span>
                <span className="block break-words text-[10px] text-zinc-500">{trans(`cachePage.rootHint.${option.kind}`)}</span>
                {option.path && <span className="block font-mono text-[10px] text-zinc-400 truncate">{option.path}</span>}
              </span>
              {active && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />}
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
    </WfNewCacheSection>
  );
};
