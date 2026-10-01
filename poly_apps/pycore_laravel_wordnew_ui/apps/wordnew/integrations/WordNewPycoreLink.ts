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
 * first run selects the fastest reachable candidate, later only the user
 * changes it. While the selected pycore is down the shared link reconnects to
 * it and requests wait; they continue once it answers again.
 *
 * A session-only entry (e.g. a LAN scan result) is used until it is cleared or
 * the next start. Every user action starts a new generation, so a detection
 * that ran under an older one never applies a first-run choice over it.
 *
 * Store pattern: `subscribe` / `getSnapshot` for `useSyncExternalStore`.
 */
import {
  addTailnetDiscoveryOrigins,
  forgetPycoreTargetRecent,
  getPycoreProbe,
  getPycoreSelectedTarget,
  laravelRelayDeviceId,
  listPycoreEndpoints,
  normalizePycoreBackendUrl,
  probePycoreEndpoint,
  probePycoreEndpoints,
  pycoreLink,
  refreshTailnetPeers,
  rememberPycoreTarget,
  setPycoreSessionTarget,
  setPycoreTarget,
  subscribePycoreProbes,
  type PycoreEndpoint,
  type PycoreProbeResult,
} from '../../../core/integrations/pycore';
import { StorageManager } from '../../../core/persistence';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';

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
  /** Reachable entries first (by latency), then the preference order. */
  candidates: WordNewPycoreCandidate[];
  checkedAt: number;
}

const PROBE_TIMEOUT_MS = 4_000;
const RECHECK_INTERVAL_MS = 5 * 60_000;
/** Without a selection, detection runs again at this pace until something answers. */
const FIRST_RUN_RETRY_MS = 15_000;

/** The persisted selection URL ('' when none). A former wordnew pin becomes the selection once. */
function readSelection(): string {
  const legacyPin = StorageManager.get<string>(StorageKeys.WORDNEW_PYCORE_PINNED, '') || '';
  if (legacyPin) {
    StorageManager.remove(StorageKeys.WORDNEW_PYCORE_PINNED);
    const url = normalizePycoreBackendUrl(legacyPin);
    if (url) setPycoreTarget(url, { reload: false });
  }
  return getPycoreSelectedTarget()?.url ?? '';
}

/** Reachable first (fastest first); otherwise the list's own preference order. */
function ordered(endpoints: PycoreEndpoint[]): WordNewPycoreCandidate[] {
  return endpoints
    .map((endpoint, index) => ({ endpoint: { ...endpoint, probe: getPycoreProbe(endpoint.url) }, index }))
    .sort((left, right) => {
      const leftUp = left.endpoint.probe?.state === 'up';
      const rightUp = right.endpoint.probe?.state === 'up';
      if (leftUp !== rightUp) return leftUp ? -1 : 1;
      if (leftUp && rightUp) return (left.endpoint.probe?.ms ?? Infinity) - (right.endpoint.probe?.ms ?? Infinity);
      return left.index - right.index;
    })
    .map(({ endpoint }) => endpoint);
}

class WordNewPycoreLinkService {
  private snapshot: WordNewPycoreLinkSnapshot = {
    state: 'idle', selectedUrl: readSelection(), temporaryUrl: '', candidates: [], checkedAt: 0,
  };
  private readonly listeners = new Set<() => void>();
  private running: Promise<WordNewPycoreLinkSnapshot> | null = null;
  private runningGeneration = -1;
  /** Bumped by every user choice; a first-run choice of an older generation is discarded. */
  private generation = 0;
  private wired = false;
  private firstRunTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.wire();
    return () => { this.listeners.delete(listener); };
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

  /** A request failed on the selected entry: the link reconnects to it (never another entry). */
  reportFailure(): void {
    if (this.snapshot.selectedUrl) pycoreLink.markDown();
  }

  /** Select an entry (persisted) after it answers; false when unusable here or unreachable. */
  async choose(input: string): Promise<boolean> {
    const url = normalizePycoreBackendUrl(input);
    if (!url) return false;
    const generation = ++this.generation;
    const endpoint = listPycoreEndpoints().find((entry) => entry.url === url);
    const probe = endpoint?.kind === 'relay' ? null : await probePycoreEndpoint({ kind: endpoint?.kind ?? 'proxy', url }, PROBE_TIMEOUT_MS);
    // A later choice made while this one was probing wins.
    if (generation !== this.generation) return false;
    if (probe && probe.state !== 'up') return false;
    if (!setPycoreTarget(url, { reload: false })) return false;
    setPycoreSessionTarget(null);
    pycoreLink.retarget();
    pycoreLink.markOnline();
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, temporaryUrl: '', candidates: this.candidates(), checkedAt: Date.now() });
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
    const selectedUrl = this.snapshot.temporaryUrl || readSelection();
    this.publish({ ...this.snapshot, selectedUrl, candidates: this.candidates() });
    if (!selectedUrl) void this.refresh();
  }

  private activeUrl(): string {
    return this.snapshot.selectedUrl;
  }

  private wire(): void {
    if (this.wired || typeof window === 'undefined') return;
    this.wired = true;
    window.addEventListener('online', () => { void this.refresh(); });
    subscribePycoreProbes(() => {
      this.publish({ ...this.snapshot, candidates: this.candidates() });
    });
    pycoreLink.subscribe(() => {
      if (this.snapshot.state === 'idle' || this.snapshot.state === 'probing' || !this.activeUrl()) return;
      this.publish({ ...this.snapshot, state: this.linkState() });
    });
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
    await refreshTailnetPeers();
    const endpoints = listPycoreEndpoints();
    await probePycoreEndpoints(endpoints.filter((endpoint) => endpoint.kind !== 'relay'), PROBE_TIMEOUT_MS);
    let selectedUrl = readSelection();
    // First run only: the fastest reachable entry (the paired relay when nothing answers) becomes the selection.
    if (!selectedUrl && generation === this.generation) {
      const reachable = ordered(endpoints).find((endpoint) => endpoint.probe?.state === 'up');
      const relay = laravelRelayDeviceId() !== null ? endpoints.find((endpoint) => endpoint.kind === 'relay') : undefined;
      const first = reachable ?? relay;
      if (first && setPycoreTarget(first.url, { reload: false })) {
        selectedUrl = first.url;
        pycoreLink.retarget();
      }
    }
    const active = this.snapshot.temporaryUrl || selectedUrl;
    const selected = endpoints.find((endpoint) => endpoint.url === active);
    if (active && selected?.kind !== 'relay') {
      if (getPycoreProbe(active)?.state === 'down') pycoreLink.markDown();
      else pycoreLink.markOnline();
    }
    if (!active) this.scheduleFirstRun();
    return this.publish({
      ...this.snapshot,
      state: active ? (pycoreLink.isReconnecting() ? 'reconnecting' : 'online') : 'offline',
      selectedUrl: active,
      candidates: this.candidates(),
      checkedAt: Date.now(),
    });
  }

  private publish(snapshot: WordNewPycoreLinkSnapshot): WordNewPycoreLinkSnapshot {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
    return snapshot;
  }
}

export const wordNewPycoreLink = new WordNewPycoreLinkService();
