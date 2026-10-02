/**
 * The one way an API endpoint is shown: state dot, state badge / icon, URL line with copy, and the compact
 * chip of a service's live endpoint. Used by the API center, its settings summary and the orchestration page.
 */
import React, { useEffect } from 'react';
import { Loader2, Wifi, WifiOff, type LucideIcon } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { TONE_BAR, TONE_TEXT, TONE_TINT } from '@/shared/ui/statusTone';
import {
  useWordNewApiService,
  type WordNewApiEntryState,
  type WordNewApiService,
  type WordNewApiServiceSnapshot,
  type WordNewApiServiceState,
} from '../../api/center/WordNewApiCenter';
import { WfNewCopyButton } from '../WfNewCopyButton';
import { API_ENTRY_TONE, API_PENDING_STATES, API_SERVICE_TONE } from './apiCenterStyles';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

/** Live state of a service; starts it (probing / reconnecting) while a view of it is mounted. */
export function useApiServiceStatus(service: WordNewApiService): WordNewApiServiceSnapshot {
  const snapshot = useWordNewApiService(service);
  useEffect(() => { service.start(); }, [service]);
  return snapshot;
}

/** Host and path of a base URL (the scheme adds nothing on a chip). */
function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

export const ApiStateDot: React.FC<{ state: WordNewApiServiceState; className?: string }> = ({ state, className = 'h-1.5 w-1.5' }) => (
  <span className={`shrink-0 rounded-full ${TONE_BAR[API_SERVICE_TONE[state]]} ${API_PENDING_STATES.has(state) ? 'animate-pulse' : ''} ${className}`} aria-hidden />
);

/** Round icon box of one entry's probe state. */
export const ApiEntryStateIcon: React.FC<{ state: WordNewApiEntryState; title: string }> = ({ state, title }) => {
  const tone = API_ENTRY_TONE[state];
  const Icon = state === 'offline' || state === 'refused' ? WifiOff : Wifi;
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_TINT[tone]} ${TONE_TEXT[tone]}`} title={title}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
};

/** State badge of a whole service: icon, state label or the selected entry's latency. */
export const ApiServiceStatusBadge: React.FC<{ snapshot: WordNewApiServiceSnapshot; trans: Trans }> = ({ snapshot, trans }) => {
  const selected = snapshot.entries.find((entry) => entry.selected);
  const spinning = API_PENDING_STATES.has(snapshot.state);
  const Icon: LucideIcon = spinning ? Loader2 : snapshot.state === 'online' ? Wifi : WifiOff;
  return (
    <Pill tint tone={API_SERVICE_TONE[snapshot.state]} className="gap-1.5 font-mono uppercase tracking-wider">
      <Icon className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
      {snapshot.state === 'online' && selected?.latencyMs != null
        ? trans('api.statusOnline', { ms: selected.latencyMs })
        : trans(`apiCenter.service.${snapshot.state}`)}
    </Pill>
  );
};

/** A URL (wrapping, selectable) with its copy button. */
export const ApiUrlLine: React.FC<{ url: string; trans: Trans; className?: string }> = ({ url, trans, className = '' }) => (
  <div className="flex items-start gap-1">
    <p className={`min-w-0 flex-1 break-all font-mono text-zinc-500 dark:text-zinc-400 ${className}`}>{url}</p>
    <WfNewCopyButton value={url} trans={trans} className="-mt-0.5" />
  </div>
);

interface ChipProps {
  service: WordNewApiService;
  icon: LucideIcon;
  /** Service name in the tooltip. */
  name: string;
  /** The base URL the last response came from; absent until the service was accessed. */
  url: string | undefined;
  onOpen: () => void;
  trans: Trans;
}

/** Compact endpoint chip: service state dot, icon and the live host; a click opens the API center. */
export const ApiEndpointChip: React.FC<ChipProps> = ({ service, icon: Icon, name, url, onOpen, trans }) => {
  const snapshot = useApiServiceStatus(service);
  const switchLabel = trans('orchCompose.api.switch', { service: name });
  return (
    <Pill
      stat
      fluid
      onClick={onOpen}
      title={`${switchLabel}\n${trans('orchCompose.api.selected', { url: snapshot.selectedUrl || '-' })}`}
    >
      <ApiStateDot state={snapshot.state} />
      <Icon className="h-3 w-3 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden />
      <span className={`min-w-0 truncate font-mono ${url ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400'}`}>
        {url ? shortUrl(url) : trans('orchCompose.api.idle')}
      </span>
    </Pill>
  );
};
