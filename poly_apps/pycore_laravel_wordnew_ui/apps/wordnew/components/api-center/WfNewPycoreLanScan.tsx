/**
 * LAN pycore scan (API center, pycore tab): the phone's address is detected (or
 * a gateway / any address of the subnet is typed, e.g. 192.168.1.1), the /24 is
 * scanned on port 59000, and a found pycore is used for this session - every
 * request switches at once; the next start uses the persisted choice again.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Radar, ShieldAlert, Square, Wifi } from 'lucide-react';
import { lanScanHosts, scanLanPycore, type LanScanResult } from '../../../../core/integrations/pycore';
import { notify } from '@/shared/notify/notify';
import type { ElementTheme } from '../../WfNewThemes';
import { currentLanInfo, type CapLanInfo } from '../../platform/capabilities';
import { useWordNewApiService } from '../../api/center/WordNewApiCenter';
import { wordNewPycoreApiService } from '../../api/center/WordNewPycoreApiService';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { WfNewCopyButton } from '../WfNewCopyButton';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const STATE_ICON = { up: Wifi, refused: ShieldAlert, no_route: Square } as const;
const STATE_TONE = {
  up: 'text-emerald-600 dark:text-emerald-400',
  refused: 'text-amber-600 dark:text-amber-400',
  no_route: 'text-zinc-500',
} as const;

export const WfNewPycoreLanScan: React.FC<Props> = ({ activeTheme, trans }) => {
  const snapshot = useWordNewApiService(wordNewPycoreApiService);
  const [info, setInfo] = useState<CapLanInfo | null>(null);
  const [subnet, setSubnet] = useState('');
  const [results, setResults] = useState<LanScanResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const scanRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void currentLanInfo().then((next) => {
      setInfo(next);
      setSubnet((current) => current || next.gateway || next.addresses[0]?.address || '');
    }).catch(() => setInfo({ addresses: [], gateway: '', lan: false }));
    return () => scanRef.current?.abort();
  }, []);

  const hosts = lanScanHosts(subnet);
  const scanning = progress !== null && progress.done < progress.total;

  const scan = async (): Promise<void> => {
    if (hosts.length === 0) {
      notify.warning(trans('apiCenter.lan.invalidSubnet'));
      return;
    }
    scanRef.current?.abort();
    const controller = new AbortController();
    scanRef.current = controller;
    setResults([]);
    setProgress({ done: 0, total: hosts.length });
    const found = await scanLanPycore(hosts, {
      signal: controller.signal,
      onProgress: (done, total) => setProgress({ done, total }),
      onResult: (result) => setResults((current) => [...current, result]),
    });
    if (controller.signal.aborted) return;
    setResults(found);
    setProgress({ done: hosts.length, total: hosts.length });
    if (found.length === 0) notify.info(trans('apiCenter.lan.noneFound'));
  };

  const stop = (): void => {
    scanRef.current?.abort();
    setProgress(null);
  };

  const use = (result: LanScanResult): void => {
    if (wordNewPycoreLink.useTemporary(result.url)) notify.success(trans('apiCenter.lan.using', { host: result.host }));
    else notify.warning(trans('apiCenter.toast.addInvalid'));
  };

  const detected = info?.addresses[0]?.address;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 p-3" aria-label={trans('apiCenter.lan.title')}>
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-indigo-500" aria-hidden />
        <h4 className="flex-1 text-xs font-extrabold">{trans('apiCenter.lan.title')}</h4>
        {snapshot.temporary && (
          <button type="button" onClick={() => wordNewPycoreLink.clearTemporary()} className="rounded-lg border border-amber-500/30 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            {trans('apiCenter.lan.stopTemporary')}
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {detected
          ? trans('apiCenter.lan.detected', { address: detected, gateway: info?.gateway || '-' })
          : trans('apiCenter.lan.notDetected')}
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (scanning) stop();
          else void scan();
        }}
      >
        <input
          value={subnet}
          onChange={(event) => setSubnet(event.target.value)}
          inputMode="decimal"
          placeholder="192.168.1.1"
          aria-label={trans('apiCenter.lan.subnet')}
          className={`flex-1 rounded-xl px-3.5 py-2.5 font-mono text-xs outline-none ${activeTheme.inputClass}`}
        />
        <button type="submit" className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500">
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
          {trans(scanning ? 'apiCenter.lan.stop' : 'apiCenter.lan.scan')}
        </button>
      </form>
      {hosts.length > 0 && !progress && (
        <p className="font-mono text-[10px] text-zinc-500">{trans('apiCenter.lan.range', { from: hosts[0], to: hosts[hosts.length - 1] })}</p>
      )}
      {progress && (
        <div className="space-y-1" aria-live="polite">
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>{trans('apiCenter.lan.progress', { done: progress.done, total: progress.total })}</span>
            <span>{trans('apiCenter.lan.found', { count: results.filter((result) => result.state !== 'no_route').length })}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((result) => {
            const Icon = STATE_ICON[result.state];
            const inUse = snapshot.selectedUrl === result.url;
            return (
              <li key={result.url} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/5 px-2.5 py-2 text-[11px]">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${STATE_TONE[result.state]}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-1">
                    <span className="min-w-0 flex-1 break-all font-mono font-bold">{result.url}{result.hostname ? ` · ${result.hostname}` : ''}</span>
                    <WfNewCopyButton value={result.url} trans={trans} />
                  </span>
                  <span className={`block text-[10px] ${STATE_TONE[result.state]}`}>
                    {trans(`apiCenter.lan.state.${result.state}`, { ms: result.ms })}
                  </span>
                </span>
                {inUse ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500"><Check className="h-3 w-3" />{trans('api.inUse')}</span>
                ) : result.state === 'up' ? (
                  <button type="button" onClick={() => use(result)} className="rounded-lg border border-indigo-500/30 px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10">
                    {trans('apiCenter.lan.useTemporary')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {results.some((result) => result.state === 'refused') && (
        <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">{trans('apiCenter.lan.refusedHint')}</p>
      )}
    </section>
  );
};
