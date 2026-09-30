/**
 * WordNewPycoreLink - wordnew's connection to an online pycore.
 *
 * Candidates come from the shared endpoint list (discovered tailnet machines,
 * the relay entry, user-added entries); a native shell also asks its Laravel
 * endpoints' tailnet origins for the live peers document. The link probes them,
 * keeps the fastest reachable one selected (in place, no page reload) and
 * re-selects on network changes and after failures. Every request then goes
 * through the shared pycore transport.
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
  setPycoreTarget,
  subscribePycoreProbes,
  type PycoreEndpoint,
  type PycoreProbeResult,
} from '../../../core/integrations/pycore';
import { isNativeAppShell } from '../../../core/network/NativeShell';
import { wfNewEndpoints } from '../api/WfNewEndpoints';

export type WordNewPycoreLinkState = 'idle' | 'probing' | 'online' | 'offline';

export interface WordNewPycoreCandidate extends PycoreEndpoint {
  probe: PycoreProbeResult | null;
}

export interface WordNewPycoreLinkSnapshot {
  state: WordNewPycoreLinkState;
  selectedUrl: string;
  candidates: WordNewPycoreCandidate[];
  checkedAt: number;
}

const PROBE_TIMEOUT_MS = 4_000;
const RECHECK_INTERVAL_MS = 5 * 60_000;
const FAILURE_RECHECK_DELAY_MS = 1_500;

class WordNewPycoreLinkService {
  private snapshot: WordNewPycoreLinkSnapshot = { state: 'idle', selectedUrl: '', candidates: [], checkedAt: 0 };
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

  /** Discover, probe every candidate and select the fastest reachable one. */
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

  /** Pin an entry after probing it; false when it is unusable here or unreachable. */
  async choose(input: string): Promise<boolean> {
    const url = normalizePycoreBackendUrl(input);
    if (!url) return false;
    const endpoint = listPycoreEndpoints().find((entry) => entry.url === url);
    const probe = endpoint?.kind === 'relay' ? null : await probePycoreEndpoint({ kind: endpoint?.kind ?? 'proxy', url }, PROBE_TIMEOUT_MS);
    if (probe && probe.state !== 'up') return false;
    if (!setPycoreTarget(url, { reload: false })) return false;
    this.publish({ ...this.snapshot, state: 'online', selectedUrl: getPycoreTarget().url, candidates: this.candidates(), checkedAt: Date.now() });
    return true;
  }

  /** Add a user entry (tailnet machine name or https URL) to the candidates. */
  add(input: string): boolean {
    const url = rememberPycoreTarget(input);
    if (!url) return false;
    this.publish({ ...this.snapshot, candidates: this.candidates() });
    void probePycoreEndpoints(this.snapshot.candidates.filter((entry) => entry.url === url), PROBE_TIMEOUT_MS);
    return true;
  }

  /** Remove a user-added entry; re-selects when it was the active one. */
  remove(url: string): void {
    const wasSelected = this.snapshot.selectedUrl === url;
    forgetPycoreTargetRecent(url);
    this.publish({ ...this.snapshot, candidates: this.candidates() });
    if (wasSelected) void this.refresh();
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
    return listPycoreEndpoints().map((endpoint) => ({ ...endpoint, probe: getPycoreProbe(endpoint.url) }));
  }

  private async select(): Promise<WordNewPycoreLinkSnapshot> {
    addTailnetDiscoveryOrigins(wfNewEndpoints.getAllEndpoints().map((endpoint) => endpoint.url));
    this.publish({ ...this.snapshot, state: 'probing', candidates: this.candidates() });
    await refreshTailnetPeers();
    const endpoints = listPycoreEndpoints();
    const results = await probePycoreEndpoints(endpoints, PROBE_TIMEOUT_MS);
    const reachable = endpoints
      .map((endpoint, index) => ({ endpoint, result: results[index] }))
      .filter(({ result }) => result.state === 'up')
      .sort((left, right) => (left.result.ms ?? Infinity) - (right.result.ms ?? Infinity));
    const relay = laravelRelayDeviceId() !== null ? endpoints.find((endpoint) => endpoint.kind === 'relay') : undefined;
    // A browser shares the stored target with the other pycore pages of this
    // origin: a reachable current choice is kept. The native shell owns its
    // target and always takes the fastest entry.
    const current = isNativeAppShell() ? undefined : reachable.find(({ endpoint }) => endpoint.url === getPycoreTarget().url);
    const best = current?.endpoint ?? reachable[0]?.endpoint ?? relay;
    if (best && best.url !== getPycoreTarget().url) setPycoreTarget(best.url, { reload: false });
    return this.publish({
      state: best ? 'online' : 'offline',
      selectedUrl: best?.url ?? '',
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
