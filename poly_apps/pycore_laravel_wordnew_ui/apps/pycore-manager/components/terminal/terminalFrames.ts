/**
 * Terminal frame policy and store of one node view.
 *
 * Frames are expensive, so the UI asks for as few as possible:
 *  - a window with no image yet gets ONE frame as its preview (bootstrap);
 *  - afterwards only windows scrolled into view (plus the one about to enter) are fetched, and only
 *    their newest frame - older digests are dropped, never fetched;
 *  - while one terminal is operated, every other window is paused and that one is polled once a second;
 *  - a terminal whose agent finished is static until a new prompt: no frames, except the last one
 *    when it is opened.
 * The server mirrors this through the viewer demand lease (visible / focus / force ids).
 */
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
import type {
  PycoreHttpBinaryResult,
  TerminalScreenshotResourceMeta,
  TerminalWindowInfo,
} from '@/apps/pycore-manager/api';

const FETCH_TIMEOUT_MS = 20_000;
const FAILURE_COOLDOWN_MS = 10_000;
const FETCH_CONCURRENCY = 2;
const BOOTSTRAP_GIVE_UP_MS = 20_000;
const GRACE_MS = 30_000;

export const TERMINAL_FOCUS_POLL_MS = 1_000;

export interface TerminalFrame {
  url: string;
  mime: string;
  width: number;
  height: number;
  captured_at: number;
  digest: string;
}

export interface TerminalFramePolicyInput {
  windows: readonly TerminalWindowInfo[];
  visible: ReadonlySet<string>;
  /** The terminal being operated (preview dialog, or the explicitly selected one on a desktop layout). */
  focusId: string | null;
  /** Agent finished and no new prompt since: its screen is static. */
  frozen: ReadonlySet<string>;
  /** Window ids that still have no frame. */
  missing: ReadonlySet<string>;
  /** Tab hidden: nothing is transferred. */
  hidden: boolean;
}

export interface TerminalFramePolicy {
  /** Windows whose newest frame may be fetched now. */
  wanted: ReadonlySet<string>;
  /** Window ids the server lease demands (visible list). */
  demand: string[];
  /** Window id the server polls once a second ('' when none). */
  focus: string;
}

/** Which windows may transfer frames now; pure, so the page can recompute it on every change. */
export function terminalFramePolicy(input: TerminalFramePolicyInput): TerminalFramePolicy {
  const online = new Set(input.windows.filter((windowInfo) => windowInfo.online).map((windowInfo) => windowInfo.id));
  if (input.hidden) return { wanted: new Set(), demand: [], focus: '' };
  const focusId = input.focusId !== null && online.has(input.focusId) ? input.focusId : null;
  if (focusId !== null) {
    const live = !input.frozen.has(focusId);
    return { wanted: live ? new Set([focusId]) : new Set(), demand: live ? [focusId] : [], focus: live ? focusId : '' };
  }
  const wanted = new Set<string>();
  input.visible.forEach((id) => { if (online.has(id)) wanted.add(id); });
  input.missing.forEach((id) => { if (online.has(id)) wanted.add(id); });
  input.frozen.forEach((id) => { if (!input.missing.has(id)) wanted.delete(id); });
  return { wanted, demand: [...wanted].sort(), focus: '' };
}

type FetchFrame = (windowId: string, digest: string, timeoutMs: number) => Promise<PycoreHttpBinaryResult>;

/** Newest frame per window, fetched under the policy; older frames are released as soon as a newer one lands. */
export class TerminalFrameStore {
  private readonly changes = new ChangeSignal();
  private readonly frames = new Map<string, TerminalFrame>();
  private readonly newest = new Map<string, TerminalScreenshotResourceMeta>();
  private readonly inflight = new Map<string, string>();
  private readonly failures = new Map<string, number>();
  private readonly firstSeen = new Map<string, number>();
  private readonly seenAt = new Map<string, number>();
  private readonly pendingForce = new Set<string>();
  private wanted: ReadonlySet<string> = new Set();
  private running = 0;
  private disposed = false;
  private revision = 0;

  constructor(private readonly fetchFrame: FetchFrame) {}

  readonly subscribe = this.changes.subscribe;

  readonly getVersion = (): number => this.revision;

  imageFor(windowId: string): TerminalFrame | null {
    return this.frames.get(windowId) ?? null;
  }

  hasFrame(windowId: string): boolean {
    return this.frames.has(windowId);
  }

  /** Online windows with no frame that were first seen less than the bootstrap window ago. */
  missingFrames(windows: readonly TerminalWindowInfo[], now: number): Set<string> {
    const missing = new Set<string>();
    windows.forEach((windowInfo) => {
      if (!windowInfo.online || this.frames.has(windowInfo.id)) return;
      const first = this.firstSeen.get(windowInfo.id) ?? now;
      this.firstSeen.set(windowInfo.id, first);
      if (now - first < BOOTSTRAP_GIVE_UP_MS) missing.add(windowInfo.id);
    });
    return missing;
  }

  setWanted(wanted: ReadonlySet<string>): void {
    this.wanted = wanted;
    this.pump();
  }

  /** The newest frame metadata of a window (snapshot, demand answer or action result). */
  offer(meta: TerminalScreenshotResourceMeta | null | undefined): void {
    if (!meta?.window_id || !meta.digest) return;
    this.newest.set(meta.window_id, meta);
    this.seenAt.set(meta.window_id, Date.now());
    this.pump();
  }

  /** Online windows only: forget what belongs to windows that stayed away for the grace period. */
  reconcile(windows: readonly TerminalWindowInfo[]): void {
    const now = Date.now();
    const online = new Set(windows.filter((windowInfo) => windowInfo.online).map((windowInfo) => windowInfo.id));
    online.forEach((id) => this.seenAt.set(id, now));
    [...this.seenAt.entries()].forEach(([id, at]) => {
      if (online.has(id) || now - at < GRACE_MS) return;
      this.seenAt.delete(id);
      this.newest.delete(id);
      this.firstSeen.delete(id);
      this.release(id);
    });
  }

  /** Fetch the newest frame of a window now, whatever the policy says (an action result, an opened terminal). */
  fetchNow(windowId: string): void {
    this.pendingForce.add(windowId);
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    [...this.frames.keys()].forEach((id) => this.release(id));
  }

  private release(windowId: string): void {
    const frame = this.frames.get(windowId);
    if (frame) URL.revokeObjectURL(frame.url);
    this.frames.delete(windowId);
  }

  private pump(): void {
    if (this.disposed) return;
    const candidates = [...new Set([...this.pendingForce, ...this.wanted])];
    for (const windowId of candidates) {
      if (this.running >= FETCH_CONCURRENCY) return;
      const meta = this.newest.get(windowId);
      if (!meta || this.inflight.has(windowId) || this.frames.get(windowId)?.digest === meta.digest) {
        if (meta && this.frames.get(windowId)?.digest === meta.digest) this.pendingForce.delete(windowId);
        continue;
      }
      const failedAt = this.failures.get(windowId);
      if (failedAt !== undefined && Date.now() - failedAt < FAILURE_COOLDOWN_MS && !this.pendingForce.has(windowId)) continue;
      this.start(windowId, meta);
    }
  }

  private start(windowId: string, meta: TerminalScreenshotResourceMeta): void {
    this.inflight.set(windowId, meta.digest);
    this.running += 1;
    void this.fetchFrame(windowId, meta.digest, FETCH_TIMEOUT_MS)
      .then((result) => {
        if (this.disposed || result.status !== 200 || !result.bytes) {
          this.failures.set(windowId, Date.now());
          return;
        }
        this.failures.delete(windowId);
        this.pendingForce.delete(windowId);
        const mime = meta.mime || 'image/webp';
        this.release(windowId);
        this.frames.set(windowId, {
          url: URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: mime })),
          mime,
          width: meta.width,
          height: meta.height,
          captured_at: meta.captured_at,
          digest: meta.digest,
        });
        this.revision += 1;
        this.changes.emit();
      })
      .catch(() => { this.failures.set(windowId, Date.now()); })
      .finally(() => {
        this.inflight.delete(windowId);
        this.running -= 1;
        this.pump();
      });
  }
}
