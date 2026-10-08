/**
 * Task Center — orchestration monitor: every wordnew device (active page,
 * channels, per-task clip counts), wordnew online scheduling (R12 windows),
 * Laravel scheduling (plans, pool) and the pycore nodes with their load.
 * One `GET work/monitor` answer feeds all sections; it is refetched when the
 * `orch_clients.changed` or `work_nodes.changed` revision moves, on reconnect,
 * and by a slow poll while the realtime stream is down. Missing fields from an
 * older server or client are tolerated everywhere.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, RefreshCw } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '@/core/integrations/laravel';
import type {
  OrchClientReport,
  WorkMonitorResponse,
} from '../../../../../core/contracts/QueueCenterTypes';
import { commonClasses } from '@/shared/styles/theme';
import { useTaskCenterState } from './TaskCenterState';
import { formatLastRunAgo } from './shared';
import { OrchClientsSection, OrchSchedulingSection } from './OrchestrationClientsSection';
import { OrchNodesSection } from './OrchestrationNodesSection';
import { ageSeconds, nowMs, ORCH_CLIENT_TTL_SECONDS } from './orchestrationFormat';

interface OrchestrationMonitorPanelProps {
  lang: string;
}

const TICK_MS = 5000;
const POLL_DOWN_SECONDS = 10;
const POLL_LIVE_SECONDS = 60;

const OrchestrationMonitorPanel: React.FC<OrchestrationMonitorPanelProps> = () => {
  const { t: tr } = useTranslation();
  const { refreshToken } = useTaskCenterState();
  const [data, setData] = useState<WorkMonitorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState<number>(nowMs());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const rerun = useRef(false);
  const loadedAtRef = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) {
      rerun.current = true;
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await api.serverManager.getWorkMonitor();
      if (!mounted.current) return;
      setFailed(!response.success || !response.data);
      if (response.success && response.data) {
        setData(response.data);
        loadedAtRef.current = nowMs();
        setLoadedAt(loadedAtRef.current);
      }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
      if (rerun.current && mounted.current) {
        rerun.current = false;
        void load();
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  useEffect(() => {
    let clientsRevision = -1;
    let nodesRevision = -1;
    const offClients = laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.orchClientsChanged, (event) => {
      if (event.revision <= clientsRevision) return;
      clientsRevision = event.revision;
      void load();
    });
    const offNodes = laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workNodesChanged, (event) => {
      if (event.revision <= nodesRevision) return;
      nodesRevision = event.revision;
      void load();
    });
    const offConnected = laravelRealtime.onConnected(() => {
      setLive(true);
      void load();
    });
    laravelRealtime.start();
    const timer = setInterval(() => {
      const connected = laravelRealtime.isConnected();
      const current = nowMs();
      setLive(connected);
      setNow(current);
      const idle = (current - loadedAtRef.current) / 1000;
      if (idle >= (connected ? POLL_LIVE_SECONDS : POLL_DOWN_SECONDS)) void load();
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      offClients();
      offNodes();
      offConnected();
      laravelRealtime.stop();
    };
  }, [load]);

  const clients: OrchClientReport[] = useMemo(() => data?.clients ?? [], [data]);
  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const plans = useMemo(() => data?.plans ?? [], [data]);
  const pool = useMemo(() => data?.pool ?? [], [data]);
  const onlineClients = clients.filter((client) => client.online ?? ageSeconds(client.last_seen_at, now) <= ORCH_CLIENT_TTL_SECONDS).length;
  const onlineNodes = nodes.filter((node) => node.online).length;
  const ledPlans = plans.filter((plan) => plan.mode === 'app_led').length;

  return (
    <div className="space-y-4">
      <section className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{tr('uiTask.orch.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tr('uiTask.orch.hint')}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] ${live
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}
            title={tr(live ? 'uiTask.orch.live_hint' : 'uiTask.orch.polling_hint')}
          >
            <Radio className="w-3 h-3" />
            {tr(live ? 'uiTask.orch.live' : 'uiTask.orch.polling')}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            title={tr('taskCenter.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {failed && <p className="text-xs text-rose-500">{tr('uiTask.orch.load_failed')}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{tr('uiTask.orch.summary_devices')} <b className="font-mono">{onlineClients}</b> / {clients.length}</span>
          <span>{tr('uiTask.orch.summary_nodes')} <b className="font-mono">{onlineNodes}</b> / {nodes.length}</span>
          <span>{tr('uiTask.orch.summary_plans')} <b className="font-mono">{plans.length}</b></span>
          <span>{tr('uiTask.orch.mode_app_led')} <b className="font-mono">{ledPlans}</b></span>
          <span>{tr('uiTask.orch.mode_laravel_fallback')} <b className="font-mono">{plans.length - ledPlans}</b></span>
          {loadedAt !== null && (
            <span className="ml-auto">{tr('uiTask.orch.updated')} {formatLastRunAgo(ageSeconds(new Date(loadedAt).toISOString(), now))}</span>
          )}
        </div>
      </section>

      <OrchClientsSection clients={clients} now={now} loaded={data !== null} />
      <OrchSchedulingSection clients={clients} plans={plans} pool={pool} nodes={nodes} now={now} />
      <OrchNodesSection nodes={nodes} now={now} loaded={data !== null} />
    </div>
  );
};

export default OrchestrationMonitorPanel;
