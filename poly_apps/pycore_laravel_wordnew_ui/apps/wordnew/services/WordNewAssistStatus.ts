import { ChangeSignal } from '../../../core/events/ChangeSignal';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import queueCenterContract from '../../../../../config/queue_center_contract.json';
import { AUDIO_ORCH_PHRASE_PIPELINE } from '../../../core/contracts/AudioOrchestrationContract';
import { laravelApi, LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel';
import type { WorkNode, WorkPoolEntry } from '../../../core/contracts/QueueCenterContract';
import type { QueueProgress } from '../../../core/contracts/QueueProgress';
import { readSentenceAudioGap } from '../api/methods/queueGap';
import { serverSchemaGate, type ServerSchemaSnapshot } from '../../../core/integrations/laravel/ServerSchemaGate';

const SENTENCE_LANE = queueCenterContract.work_leases.lanes[1];
const WORD_LANE = queueCenterContract.work_leases.lanes[0];
const PHRASE_LANE = AUDIO_ORCH_PHRASE_PIPELINE.audioLane;
const GPU_CLASS = 'gpu';
const FALLBACK_REFRESH_MS = 60_000;
const MIN_REFRESH_GAP_MS = queueCenterContract.work_leases.nodes_event.view_refresh_seconds * 1000;
const HTTP_FORBIDDEN = 403;
const HTTP_UNAUTHORIZED = 401;

export type WordNewAssistDevice = 'gpu' | 'cpu';

export interface WordNewAssistLane {
  lane: string;
  /** Online nodes that declared this lane, by device. */
  online: Record<WordNewAssistDevice, number>;
  /** Of them, nodes that hold leases of the lane right now. */
  assisting: Record<WordNewAssistDevice, number>;
  itemsLeased: number;
  donePerHour: number;
  /** Gap rows of the lane (pool: leased + free) and the codes that keep some of them pooled. */
  gap: number;
  free: number;
  poolReasons: string[];
}

export interface WordNewAssistSnapshot {
  gate: ServerSchemaSnapshot;
  /** `denied`: the signed-in account may not read the node roster (progress is still shown). */
  nodes: 'idle' | 'ready' | 'denied' | 'failed';
  lanes: Record<string, WordNewAssistLane>;
  /** Sentence audio gap per language (contract progress_template). */
  sentenceProgress: Record<string, QueueProgress>;
  updatedAt: number;
}

const deviceOf = (node: WorkNode): WordNewAssistDevice => (node.compute_class === GPU_CLASS ? 'gpu' : 'cpu');

function laneView(lane: string, nodes: WorkNode[], pool: WorkPoolEntry[], languages: readonly string[]): WordNewAssistLane {
  const view: WordNewAssistLane = {
    lane, online: { gpu: 0, cpu: 0 }, assisting: { gpu: 0, cpu: 0 }, itemsLeased: 0, donePerHour: 0, gap: 0, free: 0, poolReasons: [],
  };
  for (const node of nodes) {
    if (!node.online || !Array.isArray(node.lanes?.[lane])) continue;
    const device = deviceOf(node);
    view.online[device] += 1;
    if (node.leases > 0) {
      view.assisting[device] += 1;
      view.itemsLeased += node.items_leased;
    }
    view.donePerHour += node.done_per_hour;
  }
  const reasons = new Set<string>();
  for (const entry of pool) {
    if (entry.lane !== lane || (languages.length > 0 && !languages.includes(entry.language))) continue;
    view.gap += entry.gap ?? entry.count ?? 0;
    view.free += entry.free ?? entry.count ?? 0;
    if (entry.reason_code) reasons.add(entry.reason_code);
  }
  view.poolReasons = [...reasons];
  return view;
}

/**
 * Assist state of the server-side generation lanes for the phone: which pycore nodes are online and
 * assisting (GPU / CPU, from Laravel's work roster), the gap lanes' contract progress, and the server
 * schema gate. Loaded only while a view uses it; refetched when Laravel pushes `work_nodes.changed`
 * (at most every `view_refresh_seconds`) and on a slow fallback; nothing is requested while the gate is pending.
 */
class WordNewAssistStatusStore {
  private readonly changes = new ChangeSignal();
  private snapshot: WordNewAssistSnapshot = {
    gate: serverSchemaGate.getSnapshot(), nodes: 'idle', lanes: {}, sentenceProgress: {}, updatedAt: 0,
  };
  private consumers = 0;
  private languages: string[] = [];
  private loading: Promise<void> | null = null;
  private queued = false;
  private lastLoadAt = 0;
  private revision = -1;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private stops: Array<() => void> = [];

  readonly subscribe = this.changes.subscribe;

  readonly getSnapshot = (): WordNewAssistSnapshot => this.snapshot;

  /** One view starts using the store (returns the release). */
  start(languages: string[]): () => void {
    this.languages = [...new Set(languages)].sort();
    this.consumers += 1;
    if (this.consumers === 1) this.attach();
    else void this.refresh();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.consumers -= 1;
      if (this.consumers === 0) this.detach();
    };
  }

  setLanguages(languages: string[]): void {
    const next = [...new Set(languages)].sort();
    if (next.join() === this.languages.join()) return;
    this.languages = next;
    if (this.consumers > 0) void this.refresh();
  }

  private attach(): void {
    this.stops = [
      serverSchemaGate.subscribe(() => {
        this.snapshot = { ...this.snapshot, gate: serverSchemaGate.getSnapshot() };
        this.emit();
        if (serverSchemaGate.getSnapshot().schema !== 'pending') void this.refresh();
      }),
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workNodesChanged, (event) => {
        if (event.revision <= this.revision) return;
        this.revision = event.revision;
        void this.refresh();
      }),
      laravelRealtime.onConnected(() => { void this.refresh(); }),
    ];
    laravelRealtime.start();
    if (serverSchemaGate.getSnapshot().schema === 'unknown') void serverSchemaGate.probe();
    this.fallbackTimer = setInterval(() => { void this.refresh(); }, FALLBACK_REFRESH_MS);
    void this.refresh();
  }

  private detach(): void {
    this.stops.forEach((stop) => stop());
    this.stops = [];
    laravelRealtime.stop();
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  /** Single-flight; a request during a load, or sooner than the push throttle, becomes one trailing load. */
  refresh(): Promise<void> {
    if (this.loading) {
      this.queued = true;
      return this.loading;
    }
    const wait = Math.max(0, this.lastLoadAt + MIN_REFRESH_GAP_MS - Date.now());
    this.loading = new Promise<void>((resolve) => setTimeout(resolve, wait))
      .then(() => this.load())
      .finally(() => {
        this.loading = null;
        if (this.queued) {
          this.queued = false;
          void this.refresh();
        }
      });
    return this.loading;
  }

  private async load(): Promise<void> {
    this.lastLoadAt = Date.now();
    if (serverSchemaGate.getSnapshot().schema === 'pending') {
      this.snapshot = { ...this.snapshot, gate: serverSchemaGate.getSnapshot(), nodes: 'idle' };
      this.emit();
      return;
    }
    const [roster, progress] = await Promise.all([this.loadRoster(), this.loadProgress()]);
    this.snapshot = {
      gate: serverSchemaGate.getSnapshot(),
      nodes: roster.state,
      lanes: roster.lanes,
      sentenceProgress: progress,
      updatedAt: Date.now(),
    };
    this.emit();
  }

  private async loadRoster(): Promise<{ state: WordNewAssistSnapshot['nodes']; lanes: Record<string, WordNewAssistLane> }> {
    try {
      const { nodes, pool } = await laravelApi.getWorkNodes();
      const lanes = Object.fromEntries([WORD_LANE, SENTENCE_LANE, PHRASE_LANE].map((lane) => [lane, laneView(lane, nodes ?? [], pool ?? [], this.languages)]));
      return { state: 'ready', lanes };
    } catch (error) {
      if (serverSchemaGate.observeError(error)) return { state: 'idle', lanes: {} };
      const status = Number((error as { status?: unknown } | null)?.status);
      return { state: status === HTTP_FORBIDDEN || status === HTTP_UNAUTHORIZED ? 'denied' : 'failed', lanes: this.snapshot.lanes };
    }
  }

  private async loadProgress(): Promise<Record<string, QueueProgress>> {
    const result: Record<string, QueueProgress> = {};
    for (const language of this.languages) {
      try {
        const progress = await readSentenceAudioGap(language);
        if (progress) result[language] = progress;
      } catch (error) {
        if (serverSchemaGate.observeError(error) || serverSchemaGate.getSnapshot().schema === 'pending') return {};
        if (this.snapshot.sentenceProgress[language]) result[language] = this.snapshot.sentenceProgress[language];
      }
    }
    return result;
  }

  private emit(): void {
    this.changes.emit();
  }
}

export const wordNewAssistStatus = new WordNewAssistStatusStore();

export function useWordNewAssistStatus(languages: string[]): WordNewAssistSnapshot {
  const key = useMemo(() => [...new Set(languages)].sort().join(','), [languages]);
  useEffect(() => wordNewAssistStatus.start(key ? key.split(',') : []), []);
  useEffect(() => { wordNewAssistStatus.setLanguages(key ? key.split(',') : []); }, [key]);
  return useSyncExternalStore(wordNewAssistStatus.subscribe, wordNewAssistStatus.getSnapshot, wordNewAssistStatus.getSnapshot);
}
