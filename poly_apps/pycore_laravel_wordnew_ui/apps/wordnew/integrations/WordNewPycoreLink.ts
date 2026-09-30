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
const RECHECK_INTERVAL_MS = 5 * 60_000;
const FAILURE_RECHECK_DELAY_MS = 1_500;

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
  private wired = false;
  private failureTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Discover, probe every candidate and select (the pin when it answers). */
  refresh(): Promise<WordNewPycoreLinkSnapshot> {
    this.running ??= this.select().finally(() => { this.running = null; });
    return this.running;
  }

  /** A request failed on the selected entry: re-select shortly (coalesced). */
  reportFailure(): void {
    if (this.failureTimer) return;
    this.failureTimer = setTimeout(() => {
      this.failureTimer = null;
      void this.refresh();
    }, FAILURE_RECHECK_DELAY_MS);
  }

  /** Pin an entry (persisted) after it answers; false when unusable here or unreachable. */
  async choose(input: string): Promise<boolean> {
    const url = normalizePycoreBackendUrl(input);
    if (!url) return false;
    const endpoint = listPycoreEndpoints().find((entry) => entry.url === url);
    const probe = endpoint?.kind === 'relay' ? null : await probePycoreEndpoint({ kind: endpoint?.kind ?? 'proxy', url }, PROBE_TIMEOUT_MS);
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
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: url, temporaryUrl: url, candidates: this.candidates(), checkedAt: Date.now() });
    return true;
  }

  /** Leave the session-only entry: back to the persisted / automatic choice. */
  clearTemporary(): void {
    setPycoreSessionTarget(null);
    this.publish({ ...this.snapshot, temporaryUrl: '' });
    void this.refresh();
  }

  /** Back to automatic selection (the fastest reachable entry). */
  unpin(): void {
    StorageManager.remove(StorageKeys.WORDNEW_PYCORE_PINNED);
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

  private async select(): Promise<WordNewPycoreLinkSnapshot> {
    addTailnetDiscoveryOrigins(wfNewEndpoints.getAllEndpoints().map((endpoint) => endpoint.url));
    const pinnedUrl = readPin();
    this.publish({ ...this.snapshot, state: 'probing', pinnedUrl, candidates: this.candidates() });
    await refreshTailnetPeers();
    const endpoints = listPycoreEndpoints();
    const results = await probePycoreEndpoints(endpoints.filter((endpoint) => endpoint.kind !== 'relay'), PROBE_TIMEOUT_MS);
    const reachable = results.filter((result) => result.state === 'up').length > 0
      ? ordered(endpoints).filter((endpoint) => endpoint.probe?.state === 'up')
      : [];
    const relay = laravelRelayDeviceId() !== null ? endpoints.find((endpoint) => endpoint.kind === 'relay') : undefined;
    const pinned = endpoints.find((endpoint) => endpoint.url === pinnedUrl);
    const pinnedUsable = pinned && (pinned.kind === 'relay' ? relay?.url === pinned.url : reachable.some((entry) => entry.url === pinned.url));
    // A session-only entry stays in use until it is cleared.
    if (this.snapshot.temporaryUrl) {
      return this.publish({ ...this.snapshot, state: 'online', selectedUrl: this.snapshot.temporaryUrl, pinnedUrl, candidates: this.candidates(), checkedAt: Date.now() });
    }
    // No pin: a still reachable current entry is kept (stable; a browser shares it with pycore-manager).
    const current = reachable.find((entry) => entry.url === getPycoreTarget().url);
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
