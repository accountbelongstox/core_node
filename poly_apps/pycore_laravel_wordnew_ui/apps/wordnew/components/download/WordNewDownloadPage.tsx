import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Browser } from '@capacitor/browser';
import {
  Download, MonitorSmartphone, Monitor, PackageOpen, RefreshCw, Smartphone, Terminal, WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { useWfNewEndpoints } from '../../api/useWfNewEndpoints';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { ActionButton } from '@/shared/ui/ActionButton';
import { StateMessage } from '@/shared/ui/StateMessage';
import {
  downloadOrigins, fetchDownloads, fileUrl, groupByPlatform, isAndroidAppShell, type WordNewDownloadFile, type WordNewDownloadResult,
} from '../../services/download/WordNewDownloads';
import { wordNewAppUpdater } from '../../services/update/WordNewAppUpdater';
import { useWordNewAppUpdate } from '../../services/update/useWordNewAppUpdate';
import { WordNewUpdateStatus } from '../update/WordNewUpdateStatus';
import { WordNewDownloadQr } from './WordNewDownloadQr';

const SHA_SHORT_LENGTH = 12;
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  android: Smartphone,
  windows: Monitor,
  linux: Terminal,
};

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

interface WordNewDownloadPageProps {
  activeTheme: ElementTheme;
  trans: Trans;
}

interface PackageRowProps {
  entry: WordNewDownloadFile;
  url: string;
  trans: Trans;
  primary: boolean;
}

function openDownload(url: string): void {
  if (isNativeAppShell()) void Browser.open({ url });
}

const PackageRow: React.FC<PackageRowProps> = ({ entry, url, trans, primary }) => {
  const native = isNativeAppShell();
  const buttonClass = `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-black uppercase transition-all active:scale-[0.98] ${
    primary ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:opacity-90' : 'border border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 dark:text-zinc-300'
  }`;
  const content = (<><Download className="h-3.5 w-3.5" />{trans('download.button')}</>);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-extrabold tracking-tight text-indigo-950 dark:text-white">
          {trans(`download.build.${entry.build_type}`)}
          <span className="ml-2 font-mono text-[11px] font-bold text-zinc-400">v{entry.version}</span>
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {formatBytes(entry.size)} · {new Date(entry.built_at).toLocaleString()} · {trans('download.sha')} {entry.sha256.slice(0, SHA_SHORT_LENGTH)}
        </p>
      </div>
      {native ? (
        <button type="button" onClick={() => openDownload(url)} className={buttonClass}>{content}</button>
      ) : (
        <a href={url} download={entry.file} className={buttonClass}>{content}</a>
      )}
    </div>
  );
};

export const WordNewDownloadPage: React.FC<WordNewDownloadPageProps> = ({ activeTheme, trans }) => {
  const snapshot = useWfNewEndpoints();
  const origins = useMemo(() => downloadOrigins(snapshot), [snapshot]);
  const originsKey = origins.join('|');
  const [result, setResult] = useState<WordNewDownloadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void fetchDownloads(originsKey ? originsKey.split('|') : []).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => { cancelled = true; };
  }, [originsKey, attempt]);

  const groups = useMemo(() => (result?.state === 'ready' ? groupByPlatform(result.manifest) : []), [result]);
  const androidShell = isAndroidAppShell();
  const appUpdate = useWordNewAppUpdate();

  useEffect(() => {
    if (androidShell && wordNewAppUpdater.getSnapshot().status === 'idle') void wordNewAppUpdater.check(false);
  }, [androidShell]);

  return (
    <div className="space-y-6">
      {result === null && <StateMessage kind="loading" size="page">{trans('download.loading')}</StateMessage>}

      {result?.state === 'notPublished' && (
        <div className={`flex flex-col items-center gap-3 rounded-3xl p-8 text-center shadow-md ${activeTheme.cardClass}`}>
          <PackageOpen className="h-10 w-10 text-indigo-400" />
          <p className="text-sm font-extrabold text-indigo-950 dark:text-white">{trans('download.notPublished')}</p>
          <p className="max-w-prose text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{trans('download.notPublishedHint')}</p>
          <ActionButton variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}>{trans('download.retry')}</ActionButton>
        </div>
      )}

      {result?.state === 'unreachable' && (
        <div className={`flex flex-col items-center gap-3 rounded-3xl p-8 text-center shadow-md ${activeTheme.cardClass}`}>
          <WifiOff className="h-10 w-10 text-rose-400" />
          <p className="text-sm font-extrabold text-indigo-950 dark:text-white">{trans('download.unreachable')}</p>
          <p className="max-w-prose text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{trans('download.unreachableHint')}</p>
          <ActionButton variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}>{trans('download.retry')}</ActionButton>
        </div>
      )}

      {result?.state === 'ready' && (
        <>
          <div className={`flex items-center gap-3 rounded-3xl p-5 shadow-md ${activeTheme.cardClass}`}>
            <MonitorSmartphone className="h-8 w-8 shrink-0 text-indigo-500" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black tracking-tight text-indigo-950 dark:text-white">{result.manifest.name}</h2>
              <p className="truncate font-mono text-[10px] text-zinc-500">{trans('download.source', { host: new URL(result.origin).host })}</p>
            </div>
            <ActionButton variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload} aria-label={trans('download.retry')} />
          </div>

          {androidShell && appUpdate.supported && (
            <div className={`rounded-3xl border border-indigo-500/25 p-4 shadow-sm ${activeTheme.cardClass}`}>
              <WordNewUpdateStatus update={appUpdate} trans={trans} variant="page" />
            </div>
          )}

          {groups.map((group) => {
            const Icon = PLATFORM_ICONS[group.platform] ?? Monitor;
            const primaryEntry = group.latest[0];
            const qrUrl = !isNativeAppShell() && group.platform === 'android' && primaryEntry
              ? fileUrl(result.origin, primaryEntry.file)
              : '';
            return (
              <div key={group.platform} className={`space-y-4 rounded-3xl p-6 shadow-md ${activeTheme.cardClass}`}>
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-white/5">
                  <Icon className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">{trans(`download.platform.${group.platform}`)}</h3>
                </div>
                <div className="flex flex-wrap items-start gap-5">
                  <div className="min-w-0 flex-1 basis-64 space-y-4">
                    {group.latest.map((entry, index) => (
                      <PackageRow key={entry.file} entry={entry} url={fileUrl(result.origin, entry.file)} trans={trans} primary={index === 0} />
                    ))}
                    {group.older.length > 0 && (
                      <details className="space-y-3">
                        <summary className="cursor-pointer font-mono text-[11px] font-bold text-zinc-500">{trans('download.older', { count: group.older.length })}</summary>
                        <div className="space-y-3 pt-2">
                          {group.older.map((entry) => (
                            <PackageRow key={entry.file} entry={entry} url={fileUrl(result.origin, entry.file)} trans={trans} primary={false} />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  {qrUrl && (
                    <div className="mx-auto flex flex-col items-center gap-1.5">
                      <WordNewDownloadQr value={qrUrl} label={trans('download.qr')} />
                      <p className="font-mono text-[10px] text-zinc-500">{trans('download.qr')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default WordNewDownloadPage;
