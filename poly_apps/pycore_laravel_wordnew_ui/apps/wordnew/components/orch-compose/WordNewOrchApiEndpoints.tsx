/**
 * The APIs a composition run actually talks to: per network origin the base URL
 * of the last response this run received (never the configured value - an
 * origin not accessed yet says so), with the live service state. A chip opens
 * the API center on that service to switch it (the switch applies to every
 * request at once); the pycore tab carries the LAN scan.
 */
import React, { useState } from 'react';
import { Radar } from 'lucide-react';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchApiEndpoints, OrchApiOrigin } from '../../../../shared/orchestration/orchClipResolver';
import { wordNewApiService, type WordNewApiServiceId } from '../../api/center/WordNewApiCenter';
import { ApiEndpointChip } from '../api-center/ApiEndpoint';
import { WfNewApiCenterDialog } from '../api-center/WfNewApiCenterDialog';
import { ORCH_BACKEND_VIEW } from './orchBackends';

interface Props {
  endpoints: OrchApiEndpoints;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ORIGINS: readonly OrchApiOrigin[] = ['laravel', 'pycore'];

export const WordNewOrchApiEndpoints: React.FC<Props> = ({ endpoints, theme, trans }) => {
  const [dialog, setDialog] = useState<WordNewApiServiceId | null>(null);
  return (
    <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5" role="group" aria-label={trans('orchCompose.api.title')}>
      {ORIGINS.map((origin) => (
        <ApiEndpointChip
          key={origin}
          service={wordNewApiService(origin as WordNewApiServiceId)}
          icon={ORCH_BACKEND_VIEW[origin].icon}
          name={trans(`orchCompose.api.${origin}`)}
          url={endpoints[origin]}
          onOpen={() => setDialog(origin)}
          trans={trans}
        />
      ))}
      <button
        type="button"
        onClick={() => setDialog('pycore')}
        aria-label={trans('orchCompose.api.scanLan')}
        title={trans('orchCompose.api.scanLan')}
        className={`inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 p-1 ${TONE_TEXT.indigo} hover:bg-indigo-500/10`}
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
