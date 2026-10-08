import { ChangeSignal } from '../../../core/events/ChangeSignal';
import { useEffect, useSyncExternalStore } from 'react';
import queueCenterContract from '../../../../../config/queue_center_contract.json';
import { laravelApi, LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel';
import type { WorkNode } from '../../../core/contracts/QueueCenterContract';
import { serverSchemaGate } from '../../../core/integrations/laravel/ServerSchemaGate';
import { wordNewClipReady } from './WordNewClipReady';
import type { OrchResourceKind } from '../../../core/integrations/pycore';

/** compute_class of a GPU work node (Laravel PycoreComputeRoster). */
export const WORK_NODE_GPU_CLASS = 'gpu';
const GPU_CLASS = WORK_NODE_GPU_CLASS;
const LEASE_TTL_MS = queueCenterContract.work_leases.lease_ttl_seconds * 1000;
const MIN_REFRESH_GAP_MS = queueCenterContract.work_leases.nodes_event.min_interval_seconds * 1000;
const LABEL_HOST_CHARS = 10;
const UNKNOWN_PLATFORM = 'pc';
const RETRY_MS = 10_000;
const FALLBACK_REFRESH_MS = 60_000;

export interface WordNewPycoreNodesSnapshot {
  /** Bumps on every roster or lease change (a render key). */
  version: number;
  online: number;
  gpu: number;
  cpu: number;
  /** Compact labels of the online nodes (`<platform|host>·gpu|cpu·<sid>`). */
  labels: readonly string[];
  /** The online roster itself (lanes, class, throughput): what the app-led assignment is computed from. */
  nodes: readonly WorkNode[];
  /** The node label generating this clip (a resource id), or null when unknown. */
  labelOf: (kind: OrchResourceKind, language: string, text: string) => string | null;
}

export { workNodeHost } from './orchestration/WordNewBookPlanAssigner';

/** `<platform or host>·gpu|cpu·<sid>`: short, stable, language-free. */
export function workNodeLabel(node: WorkNode): string {
  const origin = (node.platform || node.label || UNKNOWN_PLATFORM).slice(0, LABEL_HOST_CHARS);
  return `${origin}·${node.compute_class === GPU_CLASS ? 'gpu' : 'cpu'}·${node.sid ?? ''}`;
}

/**
 * The online pycore nodes Laravel schedules, as short labels, plus which node is generating which clip.
 * The roster (online nodes only) is fetched once and again only when `work_nodes.changed` moves its
 * revision; the per-clip owner arrives as `clip.leased` deltas ({node sid, resource ids}) and is dropped
 * by `clip.ready`, by the node leaving the roster, or after the lease TTL without a new delta. Nothing
 * else is transferred: no lists, no text. Loaded only while a view uses it.
 */
class WordNewPycoreNodesStore {
  private readonly changes = new ChangeSignal();
  private readonly labelsBySid = new Map<string, string>();
  private readonly leased = new Map<string, { sid: string; at: number }>();
  private snapshot: WordNewPycoreNodesSnapshot = this.build(0, []);
  private consumers = 0;
  private revision = -1;
  private loading: Promise<void> | null = null;
  private queued = false;
  private lastLoadAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private stops: Array<() => void> = [];

  readonly subscribe = this.changes.subscribe;

  readonly getSnapshot = (): WordNewPycoreNodesSnapshot => this.snapshot;

  start(): () => void {
    this.consumers += 1;
    if (this.consumers === 1) this.attach();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.consumers -= 1;
      if (this.consumers === 0) this.detach();
    };
  }

  private build(version: number, nodes: WorkNode[]): WordNewPycoreNodesSnapshot {
    const gpu = nodes.filter((node) => node.compute_class === GPU_CLASS).length;
    return {
      version,
      online: nodes.length,
      gpu,
      cpu: nodes.length - gpu,
      labels: nodes.map(workNodeLabel),
      nodes,
      labelOf: (kind, language, text) => this.ownerLabel(wordNewClipReady.idOf(kind, language, text)),
    };
  }

  private ownerLabel(id: string): string | null {
    const entry = this.leased.get(id);
    if (!entry) return null;
    if (Date.now() - entry.at > LEASE_TTL_MS) {
      this.leased.delete(id);
      return null;
    }
    return this.labelsBySid.get(entry.sid) ?? null;
  }

  private attach(): void {
    this.stops = [
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workNodesChanged, (event) => {
        if (event.revision <= this.revision) return;
        void this.refresh();
      }),
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.clipLeased, (event) => {
        const at = Date.now();
        for (const id of Array.isArray(event?.ids) ? event.ids : []) this.leased.set(id, { sid: String(event.node), at });
        this.emit();
      }),
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.clipReady, (event) => {
        let changed = false;
        for (const id of Array.isArray(event?.ids) ? event.ids : []) changed = this.leased.delete(id) || changed;
        if (changed) this.emit();
      }),
      laravelRealtime.onConnected(() => { void this.refresh(); }),
      serverSchemaGate.subscribe(() => {
        if (serverSchemaGate.getSnapshot().schema !== 'pending') void this.refresh();
      }),
    ];
    laravelRealtime.start();
    this.fallbackTimer = setInterval(() => { void this.refresh(); }, FALLBACK_REFRESH_MS);
    void this.refresh();
  }

  private detach(): void {
    this.stops.forEach((stop) => stop());
    this.stops = [];
    laravelRealtime.stop();
    this.leased.clear();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private refresh(): Promise<void> {
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
    if (serverSchemaGate.getSnapshot().schema === 'pending') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    try {
      const { nodes, revision } = await laravelApi.getWorkNodes(true);
      const online = (nodes ?? []).filter((node) => node.online && node.sid);
      if (typeof revision === 'number') this.revision = revision;
      this.labelsBySid.clear();
      for (const node of online) this.labelsBySid.set(node.sid as string, workNodeLabel(node));
      for (const [id, entry] of this.leased) if (!this.labelsBySid.has(entry.sid)) this.leased.delete(id);
      this.snapshot = this.build(this.snapshot.version + 1, online);
      this.emit();
    } catch (error) {
      serverSchemaGate.observeError(error);
      if (this.consumers > 0) this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.refresh(); }, RETRY_MS);
    }
  }

  private emit(): void {
    this.snapshot = { ...this.snapshot, version: this.snapshot.version + 1 };
    this.changes.emit();
  }
}

export const wordNewPycoreNodes = new WordNewPycoreNodesStore();

/** Online pycore nodes and per-clip owners while the calling view is mounted. */
export function useWordNewPycoreNodes(): WordNewPycoreNodesSnapshot {
  useEffect(() => wordNewPycoreNodes.start(), []);
  return useSyncExternalStore(wordNewPycoreNodes.subscribe, wordNewPycoreNodes.getSnapshot, wordNewPycoreNodes.getSnapshot);
}
