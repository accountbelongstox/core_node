/**
 * WordNewPycoreLink - wordnew's connection to an online pycore.
 *
 * Candidates come from the shared endpoint list (the contract tailnet machines -
 * the GPU machine first -, every tailnet machine discovered at run time, user
 * entries, the relay entry); a native shell also asks its Laravel endpoints'
 * tailnet origins for the live peers document.
 *
 * Selection: the user's choice is PINNED (persisted, restored on every start,
 * never overwritten by automatic selection). Without a pin, or while the pinned
 * entry is down, the fastest reachable entry is used - the pin comes back as
 * soon as its entry answers again. Every request goes through the shared
 * pycore transport; switching never reloads the page.
 *
 * Stable link: the entry in use is kept until it is confirmed down (a second,
 * longer probe of that entry also fails) - one missed probe or one failed
 * request never switches; a failed request first re-checks only the entry in
 * use. Background re-checks keep the `online` state (no reconnect flicker).
 *
 * Repeated switching: every user action (pin, temporary entry, unpin, remove)
 * starts a new generation; a selection that ran under an older generation is
 * discarded and re-run, so a background re-check never overwrites a newer
 * choice and the last click wins.
 *
 * Store pattern of the Laravel endpoint manager: `subscribe` / `getSnapshot`
 * for `useSyncExternalStore`, one immutable snapshot per change.
 */
import {
  addTailnetDiscoveryOrigins,
  forgetPycoreTargetRecent,
  getPycoreProbe,
  getPycoreTarget,
  laravelRelayDeviceId,
  listPycoreEndpoints,
  normalizePycoreBackendUrl,
  probePycoreEndpoint,
  probePycoreEndpoints,
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

export type WordNewPycoreLinkState = 'idle' | 'probing' | 'online' | 'offline';

export interface WordNewPycoreCandidate extends PycoreEndpoint {
  probe: PycoreProbeResult | null;
}

export interface WordNewPycoreLinkSnapshot {
  state: WordNewPycoreLinkState;
  /** The entry requests go to now. */
  selectedUrl: string;
  /** The user's persisted choice ('' = automatic). */
  pinnedUrl: string;
  /** A session-only choice (e.g. a LAN scan result): used until cleared or the next start. */
  temporaryUrl: string;
  /** Reachable entries first (by latency), then the preference order. */
  candidates: WordNewPycoreCandidate[];
  checkedAt: number;
}

const PROBE_TIMEOUT_MS = 4_000;
/** Second chance for the entry in use before it is given up. */
const CONFIRM_TIMEOUT_MS = 8_000;
const RECHECK_INTERVAL_MS = 5 * 60_000;
const FAILURE_RECHECK_DELAY_MS = 1_500;
/** Failures reported within this window after a check are the same outage. */
const FAILURE_COOLDOWN_MS = 15_000;

function readPin(): string {
  const stored = StorageManager.get<string>(StorageKeys.WORDNEW_PYCORE_PINNED, '') || '';
  return stored ? normalizePycoreBackendUrl(stored) ?? stored : '';
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
    state: 'idle', selectedUrl: '', pinnedUrl: readPin(), temporaryUrl: '', candidates: [], checkedAt: 0,
  };
  private readonly listeners = new Set<() => void>();
  private running: Promise<WordNewPycoreLinkSnapshot> | null = null;
  private runningGeneration = -1;
  /** Bumped by every user choice; selections of an older generation are discarded. */
  private generation = 0;
  private wired = false;
  private failureTimer: ReturnType<typeof setTimeout> | null = null;
  private verifiedAt = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.wire();
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): WordNewPycoreLinkSnapshot => this.snapshot;

  isOnline(): boolean {
    return this.snapshot.state === 'online';
  }

  /** Ensure a link exists: the last result while fresh, else a new selection. */
  ensure(): Promise<WordNewPycoreLinkSnapshot> {
    this.wire();
    const fresh = Date.now() - this.snapshot.checkedAt < RECHECK_INTERVAL_MS;
    if (fresh && this.snapshot.state !== 'idle') return Promise.resolve(this.snapshot);
    return this.refresh();
  }

  /**
   * Discover, probe every candidate and select (the pin when it answers).
   * Joins a selection of the current generation; after a user choice a new
   * selection runs once the older one is done.
   */
  refresh(): Promise<WordNewPycoreLinkSnapshot> {
    if (this.running && this.runningGeneration === this.generation) return this.running;
    const generation = this.generation;
    const run = (this.running ?? Promise.resolve(this.snapshot))
      .catch(() => this.snapshot)
      .then(() => this.select(generation));
    this.running = run;
    this.runningGeneration = generation;
    void run.finally(() => { if (this.running === run) this.running = null; });
    return run;
  }

  /**
   * A request failed on the selected entry: re-check that entry shortly
   * (coalesced, at most once per FAILURE_COOLDOWN_MS); only when it is
   * confirmed down is a new entry selected.
   */
  reportFailure(): void {
    if (this.failureTimer || Date.now() - this.verifiedAt < FAILURE_COOLDOWN_MS) return;
    this.failureTimer = setTimeout(() => {
      this.failureTimer = null;
      void this.verifySelected();
    }, FAILURE_RECHECK_DELAY_MS);
  }

  private async verifySelected(): Promise<void> {
    const url = this.snapshot.selectedUrl;
    const endpoint = this.candidates().find((entry) => entry.url === url);
    if (endpoint && endpoint.kind !== 'relay' && await this.confirmUp(endpoint)) return;
    await this.refresh();
  }

  /** The entry answers `up`, allowing a longer second probe. */
  private async confirmUp(endpoint: PycoreEndpoint): Promise<boolean> {
    const first = getPycoreProbe(endpoint.url);
    const up = first?.state === 'up' && Date.now() - first.checkedAt < FAILURE_RECHECK_DELAY_MS
      ? first
      : await probePycoreEndpoint(endpoint, CONFIRM_TIMEOUT_MS);
    this.verifiedAt = Date.now();
    return up.state === 'up';
  }

  /** Pin an entry (persisted) after it answers; false when unusable here or unreachable. */
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
    StorageManager.set(StorageKeys.WORDNEW_PYCORE_PINNED, url);
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, pinnedUrl: url, temporaryUrl: '', candidates: this.candidates(), checkedAt: Date.now() });
    return true;
  }

  /**
   * Use an entry for this session only: every request switches at once, nothing
   * is stored - the next start uses the persisted / automatic choice again.
   */
  useTemporary(url: string): boolean {
    if (!setPycoreSessionTarget(url)) return false;
    this.generation += 1;
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, temporaryUrl: url, candidates: this.candidates(), checkedAt: Date.now() });
    return true;
  }

  /** Leave the session-only entry: back to the persisted / automatic choice. */
  clearTemporary(): void {
    setPycoreSessionTarget(null);
    this.generation += 1;
    this.publish({ ...this.snapshot, temporaryUrl: '' });
    void this.refresh();
  }

  /** Back to automatic selection (the fastest reachable entry). */
  unpin(): void {
    StorageManager.remove(StorageKeys.WORDNEW_PYCORE_PINNED);
    this.generation += 1;
    this.publish({ ...this.snapshot, pinnedUrl: '' });
    void this.refresh();
  }

  /** Add a user entry (tailnet machine name or https URL) to the candidates. */
  add(input: string): boolean {
    const url = rememberPycoreTarget(input);
    if (!url) return false;
    this.publish({ ...this.snapshot, candidates: this.candidates() });
    void probePycoreEndpoints(this.snapshot.candidates.filter((entry) => entry.url === url), PROBE_TIMEOUT_MS);
    return true;
  }

  /** Remove a user-added entry; a removed pin returns to automatic selection. */
  remove(url: string): void {
    forgetPycoreTargetRecent(url);
    if (readPin() === url) StorageManager.remove(StorageKeys.WORDNEW_PYCORE_PINNED);
    this.generation += 1;
    this.publish({ ...this.snapshot, pinnedUrl: readPin(), candidates: this.candidates() });
    if (this.snapshot.selectedUrl === url) void this.refresh();
  }

  private wire(): void {
    if (this.wired || typeof window === 'undefined') return;
    this.wired = true;
    window.addEventListener('online', () => { void this.refresh(); });
    subscribePycoreProbes(() => {
      this.publish({ ...this.snapshot, candidates: this.candidates() });
    });
  }

  private candidates(): WordNewPycoreCandidate[] {
    const endpoints = listPycoreEndpoints();
    const temporary = this.snapshot.temporaryUrl;
    if (temporary && !endpoints.some((endpoint) => endpoint.url === temporary)) {
      endpoints.unshift({ kind: 'direct', url: temporary, label: new URL(temporary).hostname, source: 'lan_scan' });
    }
    return ordered(endpoints);
  }

  private async select(generation: number): Promise<WordNewPycoreLinkSnapshot> {
    addTailnetDiscoveryOrigins(wfNewEndpoints.getAllEndpoints().map((endpoint) => endpoint.url));
    const pinnedUrl = readPin();
    // Re-checking a working link keeps it `online` (no reconnect flicker).
    const state = this.snapshot.state === 'online' ? 'online' : 'probing';
    this.publish({ ...this.snapshot, state, pinnedUrl, candidates: this.candidates() });
    await refreshTailnetPeers();
    const endpoints = listPycoreEndpoints();
    const results = await probePycoreEndpoints(endpoints.filter((endpoint) => endpoint.kind !== 'relay'), PROBE_TIMEOUT_MS);
    const reachable = results.filter((result) => result.state === 'up').length > 0
      ? ordered(endpoints).filter((endpoint) => endpoint.probe?.state === 'up')
      : [];
    const relay = laravelRelayDeviceId() !== null ? endpoints.find((endpoint) => endpoint.kind === 'relay') : undefined;
    const pinned = endpoints.find((endpoint) => endpoint.url === pinnedUrl);
    const pinnedUsable = pinned && (pinned.kind === 'relay' ? relay?.url === pinned.url : reachable.some((entry) => entry.url === pinned.url));
    // A user choice made while this selection probed wins: nothing here is applied.
    if (generation !== this.generation) return this.snapshot;
    // A session-only entry stays in use until it is cleared.
    if (this.snapshot.temporaryUrl) {
      return this.publish({ ...this.snapshot, state: 'online', selectedUrl: this.snapshot.temporaryUrl, pinnedUrl, candidates: this.candidates(), checkedAt: Date.now() });
    }
    // No pin: the current entry is kept while it answers - a missed probe gets a
    // second, longer one before the link switches (stable; a browser shares it with pycore-manager).
    const currentUrl = this.snapshot.selectedUrl || getPycoreTarget().url;
    let current: PycoreEndpoint | undefined = reachable.find((entry) => entry.url === currentUrl);
    const currentEndpoint = endpoints.find((entry) => entry.url === currentUrl);
    if (!current && !pinnedUsable && currentEndpoint && currentEndpoint.kind !== 'relay' && await this.confirmUp(currentEndpoint)) {
      current = currentEndpoint;
    }
    if (generation !== this.generation) return this.snapshot;
    const best = pinnedUsable ? pinned : current ?? reachable[0] ?? relay;
    // The stored target follows the entry in use; the pin itself is never overwritten.
    if (best && best.url !== getPycoreTarget().url) setPycoreTarget(best.url, { reload: false });
    return this.publish({
      state: best ? 'online' : 'offline',
      selectedUrl: best?.url ?? '',
      pinnedUrl,
      temporaryUrl: '',
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
