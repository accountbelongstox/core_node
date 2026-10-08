/**
 * Latest-state telemetry of this open wordnew client for the laravel-manager orchestration monitor
 * (contract `client_monitor`, `POST app_qy_v1/orch_audio/clients/report`).
 *
 * Each report states what the client is doing now: its route, its channels (direct pycore, relay, Laravel,
 * LAN route, the selected pycore and Laravel endpoint), the clip counts and stages of its orchestration
 * tasks, and the app-led assignments it posted. Reports are never queued or retried: a failed or skipped
 * one is replaced by the next, `seq` only grows within one app run (`instance_id`), and the server keeps
 * the newest per (device, instance) for `client_monitor.ttl_seconds`.
 *
 * Triggers: a route change (debounced), a change of the clip tables (throttled to `min_interval_seconds`),
 * a channel / selection change (debounced) and every `report_seconds`. The monitor only reads this: it is
 * never an availability source (R7) and nothing in the client waits for it.
 */
import { AUDIO_ORCH_CLIENT_MONITOR } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { serverSchemaGate } from '../../../../core/integrations/laravel/ServerSchemaGate';
import { wfNewApi } from '../../api';
import type {
  WfNewOrchClientAssignmentReport,
  WfNewOrchClientReport,
  WfNewOrchClientTaskReport,
} from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { hostKey, wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { translateActive } from '../../WfNewLocales';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewBookAudioPlan } from '../orchestration/WordNewBookAudioPlan';
import { laneOfKind } from '../orchestration/WordNewBookPlanAssigner';
import { wordNewLaneCapability } from '../orchestration/WordNewLaneCapability';
import { wordNewOrchComposer, type OrchComposeSession } from '../orchestration/WordNewOrchComposer';
import { newOrchRandomId, orchClientDeviceId } from '../orchestration/WordNewOrchDeviceId';
import { wordNewOrchTaskStore } from '../orchestration/WordNewOrchTaskStore';

const ROUTE_DEBOUNCE_MS = 800;
const CHANGE_DEBOUNCE_MS = 1_000;
const ROUTE_POLL_MS = 1_000;
const HOME_TAB = 'home';
const RUNNING_STATE = 'running';
const RESOURCE_KINDS = ['word', 'sentence', 'phrase'] as const;

function hashParts(hash: string): { tab: string; item: string } {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const [tab, ...rest] = path.split('/');
  let item = rest.join('/');
  try {
    item = decodeURIComponent(item);
  } catch {
    // An undecodable item is reported as written.
  }
  return { tab: tab || HOME_TAB, item };
}

/** Sum of the table versions of the sessions: moves whenever any clip state changed. */
function tablesVersion(): number {
  return wordNewOrchComposer.sessionEntries().reduce((total, [, session]) => total + (session.table?.version ?? 0) + 1, 0);
}

/** A task's session as the report carries it: counts per clip kind (with the lane that generates it) and stage states. */
function taskReport(taskId: string, session: OrchComposeSession): WfNewOrchClientTaskReport {
  const counts: WfNewOrchClientTaskReport['counts'] = {};
  const resources = session.plan?.resources;
  if (session.table && resources) {
    const tallies = session.table.tally((index) => RESOURCE_KINDS.indexOf(resources[index]?.kind ?? 'word'), RESOURCE_KINDS.length);
    RESOURCE_KINDS.forEach((kind, position) => {
      if (tallies[position].total > 0) counts[kind] = { lane: laneOfKind(kind), ...tallies[position] };
    });
  }
  const stages: Record<string, string> = {};
  Object.entries(session.stages).forEach(([stage, progress]) => { stages[stage] = progress.state; });
  return {
    task_id: taskId,
    plan_id: wordNewBookAudioPlan.snapshot(taskId)?.planId || null,
    state: wordNewOrchComposer.isRunning(taskId) ? RUNNING_STATE : session.phase,
    counts,
    stages,
  };
}

/** Tasks that matter most first: the one on screen, running ones, then those with clips still outstanding. */
function taskPriority(taskId: string, session: OrchComposeSession, routeItem: string): number {
  const outstanding = session.counts.pending + session.counts.missing > 0 ? 1 : 0;
  return (taskId === routeItem ? 4 : 0) + (wordNewOrchComposer.isRunning(taskId) ? 2 : 0) + outstanding;
}

class WordNewMonitorReporterService {
  private readonly instanceId = newOrchRandomId('i-');
  private seq = 0;
  private started = false;
  private sending = false;
  private route = { hash: '', changedAt: new Date().toISOString() };
  private routeTimer: ReturnType<typeof setTimeout> | null = null;
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  private sentAt = 0;
  private sentVersion = -1;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Ids of the tasks that exist (not deleted here or on another device); null until the store answered. */
  private liveTasks: ReadonlySet<string> | null = null;

  /** Idempotent: starts the triggers once. */
  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.route = { hash: window.location.hash, changedAt: new Date().toISOString() };
    const watchRoute = (): void => {
      if (window.location.hash === this.route.hash) return;
      this.route = { hash: window.location.hash, changedAt: new Date().toISOString() };
      this.schedule('route');
    };
    window.addEventListener('hashchange', watchRoute);
    window.addEventListener('popstate', watchRoute);
    // The app keeps the hash in step with its tab through `replaceState`, which fires no event.
    setInterval(watchRoute, ROUTE_POLL_MS);
    document.addEventListener('visibilitychange', () => this.schedule('change'));
    wordNewChannels.subscribe(() => this.schedule('change'));
    wordNewPycoreLink.subscribe(() => this.schedule('change'));
    wordNewLaneCapability.subscribe(() => this.schedule('change'));
    wfNewEndpoints.subscribe(() => this.schedule('change'));
    wordNewOrchComposer.subscribeAll(() => this.throttle());
    wordNewOrchTaskStore.subscribe((tasks) => {
      this.liveTasks = new Set(tasks.map((task) => task.id));
      this.schedule('change');
    });
    setInterval(() => { void this.send(); }, AUDIO_ORCH_CLIENT_MONITOR.reportMs);
    this.schedule('change');
  }

  /** A route change is debounced on its own timer; other changes (channels, selection) coalesce on theirs. */
  private schedule(reason: 'route' | 'change'): void {
    if (reason === 'route') {
      if (this.routeTimer) clearTimeout(this.routeTimer);
      this.routeTimer = setTimeout(() => { this.routeTimer = null; void this.send(); }, ROUTE_DEBOUNCE_MS);
      return;
    }
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => { this.changeTimer = null; void this.send(); }, CHANGE_DEBOUNCE_MS);
  }

  /** Clip table changes: a report at most every `min_interval_seconds`, the last change always follows. */
  private throttle(): void {
    if (tablesVersion() === this.sentVersion || this.throttleTimer) return;
    const wait = Math.max(0, this.sentAt + AUDIO_ORCH_CLIENT_MONITOR.minIntervalMs - Date.now());
    this.throttleTimer = setTimeout(() => { this.throttleTimer = null; void this.send(); }, wait);
  }

  private assignmentReports(): WfNewOrchClientAssignmentReport[] {
    return wordNewBookAudioPlan.assignmentReports().slice(0, AUDIO_ORCH_CLIENT_MONITOR.maxAssignments).map((assignment) => ({
      plan_id: assignment.planId,
      fresh: assignment.fresh,
      expires_in: assignment.expiresIn,
      direct_share: assignment.directShare,
      windows: assignment.windows.slice(0, AUDIO_ORCH_CLIENT_MONITOR.maxWindows),
    }));
  }

  private build(): WfNewOrchClientReport {
    const link = wordNewPycoreLink.getSnapshot();
    const route = hashParts(this.route.hash);
    const tasks = [...wordNewOrchComposer.sessionEntries()]
      .filter(([taskId]) => this.liveTasks === null || this.liveTasks.has(taskId))
      .sort(([leftId, left], [rightId, right]) => taskPriority(rightId, right, route.item) - taskPriority(leftId, left, route.item))
      .slice(0, AUDIO_ORCH_CLIENT_MONITOR.maxTasks)
      .map(([taskId, session]) => taskReport(taskId, session));
    this.seq += 1;
    return {
      device_id: orchClientDeviceId(),
      instance_id: this.instanceId,
      seq: this.seq,
      sent_at: new Date().toISOString(),
      platform: isNativeAppShell() ? 'native' : 'web',
      app_version: translateActive('about.version'),
      foreground: document.visibilityState === 'visible',
      route: { tab: route.tab, item: route.item, changed_at: this.route.changedAt },
      channels: {
        direct: wordNewChannels.direct(),
        relay: wordNewChannels.relay(),
        laravel: wordNewChannels.laravel(),
        lan: link.lanRouteUrl !== '',
        selected_pycore: { host: hostKey(link.selectedUrl), node_sid: wordNewLaneCapability.directNodeSid() },
        laravel_endpoint_id: wfNewEndpoints.getSnapshot().currentId ?? '',
      },
      tasks,
      assignments: this.assignmentReports(),
    };
  }

  /** One report of the latest state; single-flight, skipped while Laravel is away (the next trigger sends the then-latest state). */
  private async send(): Promise<void> {
    if (this.sending || !wordNewChannels.laravel() || !wfNewApi.isAuthenticated() || serverSchemaGate.getSnapshot().schema === 'pending') return;
    this.sending = true;
    this.sentAt = Date.now();
    this.sentVersion = tablesVersion();
    try {
      await wfNewApi.postOrchClientReport(this.build());
    } catch {
      // Telemetry only: the next report replaces this one.
    } finally {
      this.sending = false;
    }
  }
}

export const wordNewMonitorReporter = new WordNewMonitorReporterService();
wordNewMonitorReporter.start();
