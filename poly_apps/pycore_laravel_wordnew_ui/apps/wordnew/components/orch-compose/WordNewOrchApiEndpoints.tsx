/**
 * The APIs a composition run actually talks to: per network origin the base URL
 * of the last response this run received (never the configured value - an
 * origin not accessed yet says so), with the live service state. A chip opens
 * the API center on that service to switch it (the switch applies to every
 * request at once); the pycore tab carries the LAN scan.
 */
import React, { useEffect, useState } from 'react';
import { Radar, Server, Waypoints, type LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchApiEndpoints, OrchApiOrigin } from '../../../../shared/orchestration/orchClipResolver';
import {
  useWordNewApiService,
  wordNewApiService,
  type WordNewApiServiceId,
} from '../../api/center/WordNewApiCenter';
import { API_STATE_DOT } from '../api-center/apiCenterStyles';
import { WfNewApiCenterDialog } from '../api-center/WfNewApiCenterDialog';

interface Props {
  endpoints: OrchApiEndpoints;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ORIGINS: readonly OrchApiOrigin[] = ['laravel', 'pycore'];
const ORIGIN_ICON: Record<OrchApiOrigin, LucideIcon> = { laravel: Server, pycore: Waypoints };

/** Host and path of a base URL (the scheme adds nothing on a chip). */
function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

const EndpointChip: React.FC<{
  origin: OrchApiOrigin;
  url: string | undefined;
  onOpen: () => void;
  trans: Props['trans'];
}> = ({ origin, url, onOpen, trans }) => {
  const service = wordNewApiService(origin as WordNewApiServiceId);
  const snapshot = useWordNewApiService(service);
  const name = trans(`orchCompose.api.${origin}`);
  const Icon = ORIGIN_ICON[origin];
  useEffect(() => { service.start(); }, [service]);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${trans('orchCompose.api.switch', { service: name })}\n${trans('orchCompose.api.selected', { url: snapshot.selectedUrl || '-' })}`}
      aria-label={trans('orchCompose.api.switch', { service: name })}
      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-1.5 py-1 text-[10px] leading-none hover:bg-slate-200/70 dark:hover:bg-white/10"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${API_STATE_DOT[snapshot.state]}`} aria-hidden />
      <Icon className="h-3 w-3 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden />
      <span className={`min-w-0 truncate font-mono ${url ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400'}`}>
        {url ? shortUrl(url) : trans('orchCompose.api.idle')}
      </span>
    </button>
  );
};

export const WordNewOrchApiEndpoints: React.FC<Props> = ({ endpoints, theme, trans }) => {
  const [dialog, setDialog] = useState<WordNewApiServiceId | null>(null);
  return (
    <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5" role="group" aria-label={trans('orchCompose.api.title')}>
      {ORIGINS.map((origin) => (
        <EndpointChip key={origin} origin={origin} url={endpoints[origin]} onOpen={() => setDialog(origin)} trans={trans} />
      ))}
      <button
        type="button"
        onClick={() => setDialog('pycore')}
        aria-label={trans('orchCompose.api.scanLan')}
        title={trans('orchCompose.api.scanLan')}
        className="inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 p-1 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10"
      >
        <Radar className="h-3 w-3" aria-hidden />
      </button>
      <WfNewApiCenterDialog
        open={dialog !== null}
        initialService={dialog ?? 'laravel'}
        onClose={() => setDialog(null)}
        activeTheme={theme}
        trans={trans}
      />
    </div>
  );
};
