/**
 * WfNewApiServerPanel — compact Settings summary for the backend API.
 *
 * Shows ONLY the current endpoint URL + status. Clicking opens
 * WfNewApiServerDialog, where the full endpoint list, add/remove, auto-select
 * and the test page live. Reactive via the endpoint store (useWfNewEndpoints);
 * persistence + selection logic live in WfNewEndpoints.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Server, ChevronRight, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewEndpoints, useWfNewEndpoints } from '../api';
import { WfNewApiServerDialog } from './WfNewApiServerDialog';

interface WfNewApiServerPanelProps {
  activeTheme: ElementTheme;
}

export const WfNewApiServerPanel: React.FC<WfNewApiServerPanelProps> = ({ activeTheme }) => {
  const { endpoints, health, currentId, ready, testing } = useWfNewEndpoints();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Kick off detection so the summary shows a real status.
  useEffect(() => { void wfNewEndpoints.initialize(); }, []);

  const current = useMemo(() => endpoints.find((e) => e.id === currentId) ?? null, [endpoints, currentId]);
  const currentHealth = currentId ? health[currentId] : undefined;
  const baseUrl = current ? `${current.protocol}://${current.url}${current.port ? `:${current.port}` : ''}` : '—';

  const status: 'healthy' | 'offline' | 'pending' =
    testing || !ready ? 'pending' : currentHealth?.isHealthy ? 'healthy' : 'offline';

  const statusStyle = {
    healthy: { chip: 'bg-emerald-500/10 text-emerald-500', Icon: Wifi, label: `Online · ${currentHealth?.responseTime ?? 0}ms` },
    offline: { chip: 'bg-rose-500/10 text-rose-500', Icon: WifiOff, label: 'Offline · retrying' },
    pending: { chip: 'bg-zinc-400/10 text-zinc-400', Icon: Loader2, label: 'Checking…' },
  }[status];
  const StatusIcon = statusStyle.Icon;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={`w-full text-left p-6 rounded-3xl ${activeTheme.cardClass} shadow-sm transition-all hover:scale-[1.005] cursor-pointer group`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                API Server (后端接口)
              </h3>
              <p className="text-xs font-mono text-zinc-700 dark:text-zinc-200 truncate mt-1">{baseUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full ${statusStyle.chip}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${status === 'pending' ? 'animate-spin' : ''}`} />
              {statusStyle.label}
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-3">
          Tap to view, add, select endpoints and run the connection test.
        </p>
      </button>

      <WfNewApiServerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} activeTheme={activeTheme} />
    </>
  );
};
