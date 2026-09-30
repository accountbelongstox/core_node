/**
 * WordNewPycoreLink - wordnew's connection to an online pycore.
 *
 * Candidates come from the shared endpoint list (discovered tailnet machines,
 * the relay entry, user-added entries); a native shell also asks its Laravel
 * endpoints' tailnet origins for the live peers document. The link probes them,
 * keeps the fastest reachable one selected (in place, no page reload) and
 * re-selects on network changes and after failures. Every request then goes
 * through the shared pycore transport.
 */
import {
  addTailnetDiscoveryOrigins,
  getPycoreProbe,
  getPycoreTarget,
  laravelRelayDeviceId,
  listPycoreEndpoints,
  normalizePycoreBackendUrl,
  probePycoreEndpoints,
  refreshTailnetPeers,
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

type LinkListener = (snapshot: WordNewPycoreLinkSnapshot) => void;

const PROBE_TIMEOUT_MS = 4_000;
const RECHECK_INTERVAL_MS = 5 * 60_000;
const FAILURE_RECHECK_DELAY_MS = 1_500;

class WordNewPycoreLinkService {
  private snapshot: WordNewPycoreLinkSnapshot = { state: 'idle', selectedUrl: '', candidates: [], checkedAt: 0 };
  private readonly listeners = new Set<LinkListener>();
  private running: Promise<WordNewPycoreLinkSnapshot> | null = null;
  private wired = false;
  private failureTimer: ReturnType<typeof setTimeout> | null = null;

  getSnapshot(): WordNewPycoreLinkSnapshot {
    return this.snapshot;
  }

  subscribe(listener: LinkListener): () => void {
    this.listeners.add(listener);
    this.wire();
    return () => { this.listeners.delete(listener); };
  }

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

  /** Pin a user-chosen entry; false when this page may not use it. */
  choose(input: string): boolean {
    const url = normalizePycoreBackendUrl(input);
    if (!url || !setPycoreTarget(url, { reload: false })) return false;
    this.publish({ ...this.snapshot, selectedUrl: getPycoreTarget().url, candidates: this.candidates() });
    void this.refresh();
    return true;
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
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }
}

export const wordNewPycoreLink = new WordNewPycoreLinkService();
