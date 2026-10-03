/** Voice Subtitle Player: now-playing card that plays the current queue item paragraph by paragraph and steps the queue. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { Switch } from '@/shared/ui/Switch';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Chips, EmptyBlock, Notice, OpsPage, OpsStatusBar, Panel } from './opsKit';
import { describeError, useRemote } from './opsHooks';
import { audioUrlForVoiceFile } from './opsLogic';
import type { VoiceCurrentData, VoiceQueueData, VoiceQueueItem } from './opsTypes';

interface Snapshot {
  item: VoiceQueueItem | null;
  index: number;
  total: number;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

const VsPlayerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantPlay = useRef(false);
  const [override, setOverride] = useState<Snapshot | null>(null);
  const [track, setTrack] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [autoNext, setAutoNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const loaded = useRemote(async (): Promise<Snapshot> => {
    const [current, queue] = await Promise.all([
      callToolApi<VoiceCurrentData>(tool.apiMethod),
      callToolApi<VoiceQueueData>('mcpV1.vsGetQueue'),
    ]);
    return { item: current?.current ?? null, index: queue?.current_index ?? 0, total: queue?.total_length ?? 0 };
  }, []);

  useEffect(() => { setOverride(null); }, [loaded.data]);
  const snapshot = override ?? loaded.data;
  const item = snapshot?.item ?? null;
  const files = (item?.tts_files ?? []).filter((file) => file.file_path);
  const url = files[track]?.file_path ? laravelMediaUrl(audioUrlForVoiceFile(files[track].file_path as string)) : '';

  useEffect(() => { setTrack(0); }, [item?.id]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    if (url && wantPlay.current) void audio.play().catch(() => { wantPlay.current = false; setPlaying(false); });
  }, [url, rate]);

  const step = async (direction: 'next' | 'previous', keepPlaying: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const moved = await callToolApi<{ current: VoiceQueueItem | null; current_index: number }>(direction === 'next' ? 'mcpV1.vsNext' : 'mcpV1.vsPrevious');
      const same = moved.current_index === snapshot?.index;
      wantPlay.current = keepPlaying && !same;
      if (same && keepPlaying) setPlaying(false);
      setOverride({ item: moved.current, index: moved.current_index, total: snapshot?.total ?? 0 });
    } catch (err) {
      setFailure(describeError(t, err));
      wantPlay.current = false;
    } finally {
      setBusy(false);
    }
  };

  const toggle = (): void => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      wantPlay.current = true;
      void audio.play().catch(() => undefined);
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  };

  const ended = (): void => {
    if (track < files.length - 1) {
      wantPlay.current = true;
      setTrack(track + 1);
      return;
    }
    void callToolApi('mcpV1.vsIncrementPlayCountAt', snapshot?.index).catch(() => undefined);
    if (autoNext) void step('next', true);
    else { wantPlay.current = false; setPlaying(false); }
  };

  const text = item?.translated_text || item?.original_text || '';

  return (
    <OpsPage>
      <OpsStatusBar accent="lime" mode="server" updatedAt={loaded.updatedAt} loading={loaded.loading} onRefresh={() => void loaded.reload()}>
        {snapshot && item ? t('toolsOps.player.status', { index: snapshot.index + 1, total: snapshot.total }) : t('toolsOps.player.idle')}
      </OpsStatusBar>
      {loaded.error && <Notice tone="error">{loaded.error}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}

      {!item ? (
        <Panel bodyClassName="p-0"><EmptyBlock icon={Music2}>{loaded.loading ? t('toolsOps.common.loading') : t('toolsOps.player.empty')}</EmptyBlock></Panel>
      ) : (
        <>
          <Panel accent="lime" bodyClassName="p-0">
            <div className="flex flex-col gap-5 p-5 sm:flex-row">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center self-center rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-600 text-white shadow-lg sm:self-start">
                <Music2 className={`h-14 w-14 ${playing ? 'animate-pulse' : ''}`} />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-lime-700 dark:text-lime-300">{playing ? t('toolsOps.player.now_playing') : t('toolsOps.player.current')}</p>
                <p className="line-clamp-5 break-words text-lg font-semibold leading-snug text-slate-900 dark:text-white">{text || '-'}</p>
                {item.original_text && item.translated_text && item.original_text !== item.translated_text && (
                  <p className="line-clamp-2 break-words text-sm text-slate-500 dark:text-slate-400">{item.original_text}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="sky" tint>{item.type}</Pill>
                  <Pill>{item.group ?? 'default'}</Pill>
                  {item.language && <Pill>{item.language}</Pill>}
                  {item.voice && <Pill>{item.voice}</Pill>}
                  <Pill stat>{t('toolsOps.queue.plays', { count: item.play_count ?? 0 })}</Pill>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-100 p-5 dark:border-slate-700/50">
              {url ? (
                <audio ref={audioRef} src={url} controls className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={ended} />
              ) : (
                <Notice tone="warn">{t('toolsOps.player.no_audio')}</Notice>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => void step('previous', playing)} disabled={busy || (snapshot?.index ?? 0) <= 0} aria-label={t('toolsOps.player.previous')} className="rounded-full border border-slate-200 p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><SkipBack className="h-5 w-5" /></button>
                <button type="button" onClick={toggle} disabled={!url} aria-label={playing ? t('uiTools.common.pause') : t('uiTools.common.play')} className="rounded-full bg-lime-600 p-4 text-white shadow hover:bg-lime-700 disabled:opacity-40">{playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</button>
                <button type="button" onClick={() => void step('next', playing)} disabled={busy || !snapshot || snapshot.index >= snapshot.total - 1} aria-label={t('toolsOps.player.next')} className="rounded-full border border-slate-200 p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><SkipForward className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Chips accent="lime" value={rate} onChange={setRate} options={RATES.map((value) => ({ value, label: `${value}x` }))} />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Switch on={autoNext} onChange={setAutoNext} tone="emerald" label={t('toolsOps.player.auto_next')} />
                  {t('toolsOps.player.auto_next')}
                </label>
              </div>
            </div>
          </Panel>

          {files.length > 1 && (
            <Panel title={t('toolsOps.player.paragraphs', { current: track + 1, total: files.length })} icon={Music2} accent="lime" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {files.map((file, index) => (
                  <li key={`${file.file_path}-${index}`}>
                    <button type="button" onClick={() => { wantPlay.current = true; setTrack(index); }} className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm ${index === track ? 'bg-lime-50 dark:bg-lime-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-400">{index + 1}</span>
                      <span className="line-clamp-2 min-w-0 flex-1 break-words text-slate-700 dark:text-slate-200">{file.text ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </OpsPage>
  );
};

export default VsPlayerWorkbench;
