/**
 * Cache page: the orchestration audio clips kept on this device - words / sentences, search, play, meaning, origin,
 * size and duration, where each clip lives (device / pycore / Laravel), open / share, delete.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Pause, Play, Search, Share2, Trash2 } from 'lucide-react';
import { notify } from '@/shared/notify/notify';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { pycoreApi } from '../../../../core/integrations/pycore';
import type { OrchClipIdentity } from '../../../../shared/orchestration/orchClipIdentity';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { capDeviceStorage } from '../../platform/capabilities/CapDeviceStorage';
import {
  wordNewOrchClipStore,
  type OrchClipIndexEntry,
  type OrchClipStats,
} from '../../services/orchestration/WordNewOrchClipStore';
import { WfNewCopyButton } from '../WfNewCopyButton';
import { WfNewPager } from '../WfNewPager';
import { OrchEmptyBox } from '../orch-compose/orchPanels';
import { OrchTabs } from '../orch-compose/OrchTabs';
import { WfNewCacheSection } from './WfNewCacheSection';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Changes whenever another section changed the clips: the list reloads. */
  revision: number;
  onChanged: () => void;
}

type Trans = Props['trans'];
type ClipKind = OrchClipIdentity['kind'];

interface ClipPaths {
  device: { path: string };
  laravelUrl: string;
  pycorePath: string;
}

const PAGE_SIZE = 40;
const CLIP_MIME = 'audio/mpeg';
const CLIP_KINDS: readonly ClipKind[] = ['word', 'sentence'];
const MS_PER_SECOND = 1000;

const PathRow: React.FC<{ label: string; value: string; trans: Trans }> = ({ label, value, trans }) => (
  <div className="flex items-start gap-2">
    <span className="w-16 shrink-0 text-[10px] font-bold uppercase text-zinc-500">{label}</span>
    <span className="min-w-0 flex-1 break-all font-mono text-[10px] text-zinc-600 dark:text-zinc-300">{value || trans('cachePage.pathNone')}</span>
    {value && <WfNewCopyButton value={value} trans={trans} />}
  </div>
);

export const WfNewOrchClipLibrary: React.FC<Props> = ({ activeTheme, trans, revision, onChanged }) => {
  const [kind, setKind] = useState<ClipKind>('word');
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OrchClipIndexEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OrchClipStats | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [paths, setPaths] = useState<ClipPaths | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const openRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [found, overall] = await Promise.all([
      wordNewOrchClipStore.query({ kind, text, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
      wordNewOrchClipStore.stats(),
    ]);
    setItems(found.items);
    setTotal(found.total);
    setStats(overall);
    const measured = await Promise.all(found.items.map(async (item) => [item.resourceId, await wordNewOrchClipStore.get(item.resourceId)] as const));
    setDurations(Object.fromEntries(measured));
  }, [kind, text, page]);

  useEffect(() => {
    void load();
  }, [load, revision]);
  useEffect(() => { setPage(1); }, [kind, text]);
  useEffect(() => () => { player.current?.pause(); }, []);

  const play = async (item: OrchClipIndexEntry): Promise<void> => {
    player.current?.pause();
    if (playingKey === item.resourceId) {
      setPlayingKey(null);
      return;
    }
    const url = await wordNewOrchClipStore.url(item.resourceId);
    if (!url) {
      notify.warning(trans('cachePage.fileMissing'));
      return;
    }
    const audio = new Audio(url);
    player.current = audio;
    audio.onended = () => setPlayingKey(null);
    setPlayingKey(item.resourceId);
    audio.play().catch(() => setPlayingKey(null));
  };

  const togglePaths = async (item: OrchClipIndexEntry): Promise<void> => {
    if (openKey === item.resourceId) {
      openRef.current = null;
      setOpenKey(null);
      return;
    }
    openRef.current = item.resourceId;
    setOpenKey(item.resourceId);
    setPaths(null);
    const locations = await wordNewOrchClipStore.locations(item);
    const pycoreSelected = (await wordNewPycoreLink.ensure()).selectedUrl !== '';
    const lookup = pycoreSelected
      ? await pycoreApi.orchResourceLookup([{ kind: item.kind, language: item.language, text: item.text }]).catch(() => null)
      : null;
    if (openRef.current !== item.resourceId) return;
    setPaths({
      device: locations.device,
      laravelUrl: wfNewEndpoints.buildUrl(locations.laravel.path),
      pycorePath: lookup?.items?.[0]?.path ?? '',
    });
  };

  const remove = async (item: OrchClipIndexEntry): Promise<void> => {
    await wordNewOrchClipStore.remove([item.resourceId]);
    await load();
    onChanged();
  };

  const handOff = (action: 'open' | 'share'): void => {
    if (!paths) return;
    const done = action === 'open'
      ? capDeviceStorage.openFile(paths.device.path, CLIP_MIME)
      : capDeviceStorage.shareFile(paths.device.path, CLIP_MIME);
    done.catch(() => notify.warning(trans('cachePage.handOffFailed')));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <WfNewCacheSection
      theme={activeTheme}
      title={trans('cachePage.clipsTitle')}
      summary={stats && (
        <p className="text-[11px] font-mono text-zinc-500">
          {trans('cachePage.clipsSummary', { words: stats.words, sentences: stats.sentences, size: formatBytes(stats.bytes) })}
        </p>
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <OrchTabs<ClipKind>
          value={kind}
          options={CLIP_KINDS.map((entry) => ({ value: entry, label: trans(`cachePage.kind.${entry}`) }))}
          onChange={setKind}
          theme={activeTheme}
        />
        <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={trans('cachePage.search')}
            aria-label={trans('cachePage.search')}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none text-zinc-700 dark:text-zinc-200"
          />
        </label>
      </div>
      {items.length === 0 ? (
        <OrchEmptyBox className="p-6">{trans('cachePage.clipsEmpty')}</OrchEmptyBox>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const expanded = openKey === item.resourceId;
            const durationMs = durations[item.resourceId];
            const playing = playingKey === item.resourceId;
            return (
              <li key={item.resourceId} className="rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => { void play(item); }}
                    className="shrink-0 rounded-full bg-indigo-500/10 p-1.5 text-indigo-500"
                    aria-label={trans(playing ? 'orchAudio.pause' : 'orchAudio.play')}
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs text-zinc-700 dark:text-zinc-100 ${item.kind === 'word' ? 'font-bold' : 'line-clamp-2'}`}>{item.text}</span>
                    {item.meaning && <span className="block truncate text-[11px] text-zinc-500">{item.meaning}</span>}
                  </span>
                  <span className="shrink-0 text-right font-mono text-[10px] text-zinc-500">
                    <span className="block">{trans(`cachePage.origin.${item.origin}`)} · {item.language}</span>
                    <span className="block">{formatBytes(item.bytes)}{durationMs ? ` · ${(durationMs / MS_PER_SECOND).toFixed(1)}s` : ''}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { void togglePaths(item); }}
                    aria-expanded={expanded}
                    aria-label={trans('cachePage.paths')}
                    title={trans('cachePage.paths')}
                    className="shrink-0 p-1 text-zinc-400 hover:text-zinc-200"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { void remove(item); }}
                    aria-label={trans('cachePage.delete')}
                    title={trans('cachePage.delete')}
                    className="shrink-0 p-1 text-zinc-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {expanded && (
                  <div className="space-y-1.5 border-t border-slate-200 dark:border-white/5 px-3 py-2">
                    {paths ? (
                      <>
                        <PathRow label={trans('cachePage.path.device')} value={paths.device.path} trans={trans} />
                        <PathRow label={trans('cachePage.path.pycore')} value={paths.pycorePath} trans={trans} />
                        <PathRow label={trans('cachePage.path.laravel')} value={paths.laravelUrl} trans={trans} />
                        <PathRow label={trans('cachePage.path.id')} value={item.resourceId} trans={trans} />
                        {capDeviceStorage.isNative() && (
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => handOff('open')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
                              <ExternalLink className="w-3 h-3" />
                              {trans('cachePage.open')}
                            </button>
                            <button type="button" onClick={() => handOff('share')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
                              <Share2 className="w-3 h-3" />
                              {trans('cachePage.share')}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-zinc-500">{trans('cachePage.pathsLoading')}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <WfNewPager page={page} totalPages={totalPages} atLastPage={page >= totalPages} loading={false} onGoTo={(next) => setPage(Math.max(1, Math.min(next, totalPages)))} trans={trans} />
    </WfNewCacheSection>
  );
};
