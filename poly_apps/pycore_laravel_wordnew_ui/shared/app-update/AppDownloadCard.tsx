import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, PackageOpen, RefreshCw, WifiOff } from 'lucide-react';
import { formatBytes } from '../../core/utils/formatBytes';
import { fetchAppDownloads, fileUrl, groupByPlatform, type AppDownloadResult } from './AppDownloads';
import { AppDownloadQr } from './AppDownloadQr';
import type { AppUpdateTrans } from './AppUpdateStatus';

const SHA_SHORT_LENGTH = 12;
const ANDROID_PLATFORM = 'android';

interface AppDownloadCardProps {
  app: string;
  /** Origins to probe in priority order (read on every load). */
  origins: () => string[];
  trans: AppUpdateTrans;
}

/** Published packages of one app: the newest build per platform and type, with a QR code for the Android app. */
export const AppDownloadCard: React.FC<AppDownloadCardProps> = ({ app, origins, trans }) => {
  const [result, setResult] = useState<AppDownloadResult | null>(null);

  const load = useCallback(() => {
    setResult(null);
    void fetchAppDownloads(origins(), app).then(setResult);
  }, [app, origins]);

  useEffect(() => { load(); }, [load]);

  if (!result) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {trans('download.loading')}
      </p>
    );
  }

  if (result.state !== 'ready') {
    const unreachable = result.state === 'unreachable';
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {unreachable ? <WifiOff className="h-4 w-4 text-rose-500" /> : <PackageOpen className="h-4 w-4 text-amber-500" />}
        <span className="min-w-0 flex-1">{trans(unreachable ? 'download.unreachable' : 'download.notPublished')}</span>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 font-semibold hover:bg-slate-500/20">
          <RefreshCw className="h-3.5 w-3.5" /> {trans('download.retry')}
        </button>
      </div>
    );
  }

  const groups = groupByPlatform(result.manifest);
  const android = groups.find((group) => group.platform === ANDROID_PLATFORM)?.latest[0];
  const host = new URL(result.origin).host;

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="min-w-0 flex-1 space-y-3">
        {groups.flatMap((group) => group.latest.map((entry) => {
          const url = fileUrl(result.origin, app, entry.file);
          return (
            <div key={`${group.platform}-${entry.build_type}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-500/15 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {trans(`download.platform.${group.platform}`)} · {trans(`download.build.${entry.build_type}`)}
                  <span className="ml-2 font-mono text-[11px] text-slate-400">v{entry.version}</span>
                </p>
                <p className="font-mono text-[10px] text-slate-500 break-all">
                  {formatBytes(entry.size)} · {new Date(entry.built_at).toLocaleString()} · SHA-256 {entry.sha256.slice(0, SHA_SHORT_LENGTH)}
                </p>
                <a href={url} className="font-mono text-[10px] text-indigo-500 break-all hover:underline">{url}</a>
              </div>
              <a
                href={url}
                download={entry.file}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Download className="h-3.5 w-3.5" /> {trans('download.button')}
              </a>
            </div>
          );
        }))}
        <p className="text-[10px] text-slate-500">{trans('download.source', { host })}</p>
      </div>
      {android && (
        <div className="self-center sm:self-start">
          <AppDownloadQr value={fileUrl(result.origin, app, android.file)} label={trans('download.qr')} size={144} />
        </div>
      )}
    </div>
  );
};

export default AppDownloadCard;
