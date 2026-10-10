/**
 * WordNewPycoreLink - wordnew's connection to its selected pycore.
 *
 * Candidates come from the shared endpoint list (this machine, the tailnet
 * machines - static in a build, live in dev -, user entries, the relay entry);
 * a native dev shell also asks its Laravel endpoints' tailnet origins for the
 * live peers document.
 *
 * Detection shows which candidates answer; it never switches. The selection is
 * the persisted pycore target (shared with pycore-manager in this browser): the
 * first run selects a reachable GPU work node (then a CPU work node, then the
 * fastest reachable candidate), later only the user
 * changes it. While the selected pycore is down the shared link reconnects to
 * it and requests wait; they continue once it answers again.
 *
 * LAN route: a machine with its LAN bind on reports its LAN URLs in Laravel's
 * work-node roster. While such a URL of the selected machine answers (K3-signed),
 * requests use it; a failure on it falls back to the selection's own URL at once
 * and detection tries the LAN again later. The selection and its availability
 * (`pycoreLink`) stay the same machine.
 *
 * A session-only entry (e.g. a LAN scan result) is used until it is cleared or
 * the next start. Every user action starts a new generation, so a detection
 * that ran under an older one never applies a first-run choice over it.
 *
 * Store pattern: `subscribe` / `getSnapshot` for `useSyncExternalStore`.
 */
import { ChangeSignal } from '../../../core/events/ChangeSignal';
import {
  addTailnetDiscoveryOrigins,
  forgetPycoreTargetRecent,
  getPycoreLanRoute,
  getPycoreProbe,
  getPycoreSelectedTarget,
  listPycoreEndpoints,
  normalizePycoreBackendUrl,
  probePycoreEndpoints,
  pycoreLink,
  refreshTailnetPeers,
  rememberPycoreTarget,
  setPycoreLanEndpoints,
  setPycoreLanRoute,
  setPycoreSessionTarget,
  subscribePycoreProbes,
  switchPycoreTarget,
  type PycoreEndpoint,
  type PycoreProbeResult,
} from '../../../core/integrations/pycore';
import {
  choosePycoreFirstRunTarget,
  orderPycoreEndpoints,
  pycoreHostKey,
  readPycoreWorkNodeRoster,
  type PycoreWorkNodeRoster,
} from '../../../core/integrations/pycore/PycoreFirstRun';
import { wfNewEndpoints } from '../api/WfNewEndpoints';

/**
 * idle: not started · probing: detecting · online: the selection answers ·
 * reconnecting: the selection is down, requests wait · offline: no selection
 * yet and nothing answers (detection keeps going).
 */
export type WordNewPycoreLinkState = 'idle' | 'probing' | 'online' | 'reconnecting' | 'offline';

export interface WordNewPycoreCandidate extends PycoreEndpoint {
  probe: PycoreProbeResult | null;
}

export interface WordNewPycoreLinkSnapshot {
  state: WordNewPycoreLinkState;
  /** The entry requests go to: the session entry, else the persisted selection ('' until the first one). */
  selectedUrl: string;
  /** A session-only choice (e.g. a LAN scan result): used until cleared or the next start. */
  temporaryUrl: string;
  /** LAN URL of the selected machine requests currently use ('' when they use the selection's own URL). */
  lanRouteUrl: string;
  /** Reachable entries first (by latency), then the preference order. */
  candidates: WordNewPycoreCandidate[];
  checkedAt: number;
}

const PROBE_TIMEOUT_MS = 4_000;
const RECHECK_INTERVAL_MS = 5 * 60_000;
/** Without a selection, detection runs again at this pace until something answers. */
const FIRST_RUN_RETRY_MS = 15_000;
/** After the LAN route was left, or while the selection is unreachable, detection tries the LAN again after this long. */
const LAN_RETRY_MS = 60_000;

/** LAN label suffix of a roster entry in the candidate list. */
const LAN_LABEL_SUFFIX = ' · LAN';

/** First DNS label of an entry's host, lower case ('' when not a URL). */
export const hostKey = pycoreHostKey;

/** The persisted selection URL ('' when none). */
function readSelection(): string {
  return getPycoreSelectedTarget()?.url ?? '';
}

/** Reachable first (fastest first); otherwise the list's own preference order. */
function ordered(endpoints: PycoreEndpoint[]): WordNewPycoreCandidate[] {
  return orderPycoreEndpoints(endpoints);
}

class WordNewPycoreLinkService {
  private snapshot: WordNewPycoreLinkSnapshot = {
    state: 'idle', selectedUrl: readSelection(), temporaryUrl: '', lanRouteUrl: '', candidates: [], checkedAt: 0,
  };
  private readonly changes = new ChangeSignal();
  private running: Promise<WordNewPycoreLinkSnapshot> | null = null;
  private runningGeneration = -1;
  /** Bumped by every user choice; a first-run choice of an older generation is discarded. */
  private generation = 0;
  private wired = false;
  private firstRunTimer: ReturnType<typeof setTimeout> | null = null;
  private lanRetryTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    const unsubscribe = this.changes.subscribe(listener);
    this.wire();
    return unsubscribe;
  };

  getSnapshot = (): WordNewPycoreLinkSnapshot => this.snapshot;

  isOnline(): boolean {
    return this.snapshot.state === 'online';
  }

  /** Ensure a link exists: the last result while fresh, else a new detection. */
  ensure(): Promise<WordNewPycoreLinkSnapshot> {
    this.wire();
    const fresh = Date.now() - this.snapshot.checkedAt < RECHECK_INTERVAL_MS;
    if (fresh && this.snapshot.state !== 'idle' && this.snapshot.state !== 'offline') return Promise.resolve(this.snapshot);
    return this.refresh();
  }

  /** Detect every candidate (shared pass per generation); selects only on the first run. */
  refresh(): Promise<WordNewPycoreLinkSnapshot> {
    if (this.running && this.runningGeneration === this.generation) return this.running;
    const generation = this.generation;
    const run = (this.running ?? Promise.resolve(this.snapshot))
      .catch(() => this.snapshot)
      .then(() => this.detect(generation));
    this.running = run;
    this.runningGeneration = generation;
    void run.finally(() => { if (this.running === run) this.running = null; });
    return run;
  }

  /**
   * A request failed on the selected entry: over the LAN route, requests fall back to the
   * selection's own URL at once; otherwise the link reconnects to it (never another entry).
   */
  reportFailure(): void {
    if (this.dropLanRoute()) return;
    if (this.snapshot.selectedUrl) pycoreLink.markDown();
  }

  /** Select an entry (persisted) after it answers; false when unusable here or unreachable. */
  async choose(input: string): Promise<boolean> {
    const url = normalizePycoreBackendUrl(input);
    if (!url) return false;
    const generation = ++this.generation;
    const endpoint = listPycoreEndpoints().find((entry) => entry.url === url);
    // A later choice made while this one was probing wins.
    const switched = await switchPycoreTarget(
      { kind: endpoint?.kind ?? 'proxy', url },
      { timeoutMs: PROBE_TIMEOUT_MS, reload: false, isCurrent: () => generation === this.generation },
    );
    if (!switched.ok) return false;
    setPycoreSessionTarget(null);
    setPycoreLanRoute(null);
    pycoreLink.retarget();
    pycoreLink.markOnline();
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, temporaryUrl: '', lanRouteUrl: '', candidates: this.candidates(), checkedAt: Date.now() });
    void this.refresh();
    return true;
  }

  /**
   * Use an entry for this session only: every request switches at once, nothing
   * is stored - the next start uses the persisted selection again.
   */
  useTemporary(url: string): boolean {
    if (!setPycoreSessionTarget(url)) return false;
    this.generation += 1;
    pycoreLink.retarget();
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, temporaryUrl: url, candidates: this.candidates(), checkedAt: Date.now() });
    return true;
  }

  /** Leave the session-only entry: back to the persisted selection. */
  clearTemporary(): void {
    setPycoreSessionTarget(null);
    this.generation += 1;
    pycoreLink.retarget();
    this.publish({ ...this.snapshot, selectedUrl: readSelection(), temporaryUrl: '' });
    this.publish({ ...this.snapshot, state: this.linkState() });
    if (!this.snapshot.selectedUrl) void this.refresh();
  }

  /** Add a user entry (tailnet machine name or https URL) to the candidates. */
  add(input: string): boolean {
    const url = rememberPycoreTarget(input);
    if (!url) return false;
    this.publish({ ...this.snapshot, candidates: this.candidates() });
    void probePycoreEndpoints(this.snapshot.candidates.filter((entry) => entry.url === url), PROBE_TIMEOUT_MS);
    return true;
  }

  /** Remove a user-added entry; removing the selected one starts a new first-run detection. */
  remove(url: string): void {
    forgetPycoreTargetRecent(url);
    this.generation += 1;
    if (!readSelection()) setPycoreLanRoute(null);
    const selectedUrl = this.snapshot.temporaryUrl || readSelection();
    this.publish({ ...this.snapshot, selectedUrl, candidates: this.candidates() });
    if (!selectedUrl) void this.refresh();
  }

  private activeUrl(): string {
    return this.snapshot.selectedUrl;
  }

  /** Leave the LAN route (requests use the selection's own URL); false when none was active. */
  private dropLanRoute(): boolean {
    if (!getPycoreLanRoute()) return false;
    setPycoreLanRoute(null);
    pycoreLink.retarget();
    this.publish({ ...this.snapshot, lanRouteUrl: '' });
    this.scheduleLanRetry();
    return true;
  }

  private scheduleLanRetry(): void {
    if (this.lanRetryTimer) return;
    this.lanRetryTimer = setTimeout(() => {
      this.lanRetryTimer = null;
      void this.refresh();
    }, LAN_RETRY_MS);
  }

  /**
   * The LAN URLs of the roster become candidates; the fastest answering one of the selected
   * machine (never under a session entry) becomes the route.
   */
  private async applyLanRoute(roster: PycoreWorkNodeRoster, active: string, generation: number): Promise<void> {
    const entries = [...roster.lanUrls].flatMap(([host, urls]) => urls.map((url) => ({ url, label: `${host}${LAN_LABEL_SUFFIX}` })));
    setPycoreLanEndpoints(entries);
    const own = this.snapshot.temporaryUrl || !active ? [] : (roster.lanUrls.get(hostKey(active)) ?? []).filter((url) => url !== active);
    const lan = listPycoreEndpoints().filter((endpoint) => endpoint.source === 'lan' && own.includes(endpoint.url));
    if (lan.length > 0) await probePycoreEndpoints(lan, PROBE_TIMEOUT_MS);
    if (generation !== this.generation) return;
    const route = ordered(lan).find((endpoint) => endpoint.probe?.state === 'up')?.url ?? '';
    if ((getPycoreLanRoute()?.url ?? '') === route) return;
    setPycoreLanRoute(route || null);
    pycoreLink.retarget();
  }

  private wire(): void {
    if (this.wired || typeof window === 'undefined') return;
    this.wired = true;
    window.addEventListener('online', () => { void this.refresh(); });
    subscribePycoreProbes(() => {
      this.publish({ ...this.snapshot, candidates: this.candidates() });
    });
    pycoreLink.subscribe(() => {
      // The LAN went away (e.g. the phone left the Wi-Fi): continue on the selection's own URL;
      // the selection itself unreachable (e.g. no tailnet): look for its LAN URL again.
      if (pycoreLink.isReconnecting()) {
        if (this.dropLanRoute()) return;
        this.scheduleLanRetry();
      }
      if (this.snapshot.state === 'idle' || this.snapshot.state === 'probing' || !this.activeUrl()) return;
      this.publish({ ...this.snapshot, state: this.linkState() });
    });
    // Availability starts with the first subscriber (R7): the first detection also applies the LAN route.
    void this.refresh();
  }

  private linkState(): WordNewPycoreLinkState {
    if (!this.activeUrl()) return 'offline';
    return pycoreLink.isReconnecting() ? 'reconnecting' : 'online';
  }

  private candidates(): WordNewPycoreCandidate[] {
    const endpoints = listPycoreEndpoints();
    const temporary = this.snapshot.temporaryUrl;
    if (temporary && !endpoints.some((endpoint) => endpoint.url === temporary)) {
      endpoints.unshift({ kind: 'direct', url: temporary, label: new URL(temporary).hostname, source: 'lan_scan' });
    }
    return ordered(endpoints);
  }

  private scheduleFirstRun(): void {
    if (this.firstRunTimer) return;
    this.firstRunTimer = setTimeout(() => {
      this.firstRunTimer = null;
      if (!this.snapshot.selectedUrl) void this.refresh();
    }, FIRST_RUN_RETRY_MS);
  }

  private async detect(generation: number): Promise<WordNewPycoreLinkSnapshot> {
    addTailnetDiscoveryOrigins(wfNewEndpoints.getAllEndpoints().map((endpoint) => endpoint.url));
    const known = this.snapshot.state === 'online' || this.snapshot.state === 'reconnecting';
    this.publish({ ...this.snapshot, state: known ? this.snapshot.state : 'probing', candidates: this.candidates() });
    const [roster] = await Promise.all([readPycoreWorkNodeRoster(), refreshTailnetPeers()]);
    const endpoints = listPycoreEndpoints().filter((endpoint) => endpoint.source !== 'lan');
    await probePycoreEndpoints(endpoints.filter((endpoint) => endpoint.kind !== 'relay'), PROBE_TIMEOUT_MS);
    // First run only (shared rule): the persisted selection, else a reachable entry chosen and stored now.
    const selectedUrl = await choosePycoreFirstRunTarget({
      roster, probe: false, isCurrent: () => generation === this.generation,
    });
    const active = this.snapshot.temporaryUrl || selectedUrl;
    await this.applyLanRoute(roster, active, generation);
    const selected = listPycoreEndpoints().find((endpoint) => endpoint.url === active);
    if (active && selected?.kind !== 'relay') {
      // The address requests use: the LAN route when one answered, else the selection itself.
      if (getPycoreProbe(getPycoreLanRoute()?.url ?? active)?.state === 'down') pycoreLink.markDown();
      else pycoreLink.markOnline();
    }
    if (!active) this.scheduleFirstRun();
    return this.publish({
      ...this.snapshot,
      state: active ? (pycoreLink.isReconnecting() ? 'reconnecting' : 'online') : 'offline',
      selectedUrl: active,
      lanRouteUrl: getPycoreLanRoute()?.url ?? '',
      candidates: this.candidates(),
      checkedAt: Date.now(),
    });
  }

  private publish(snapshot: WordNewPycoreLinkSnapshot): WordNewPycoreLinkSnapshot {
    this.snapshot = snapshot;
    this.changes.emit();
    return snapshot;
  }
}

export const wordNewPycoreLink = new WordNewPycoreLinkService();
