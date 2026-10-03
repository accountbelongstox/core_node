/** Newest image frame per window under the frame policy; the image half of the redundant terminal transport. */
import { ChangeSignal } from '../../../../../core/events/ChangeSignal';
import type { TerminalScreenshotResourceMeta, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import type { TerminalImageFrame, TerminalImageTransport } from '@/apps/pycore-manager/components/terminal/transport/TerminalImageTransport';

const FAILURE_COOLDOWN_MS = 10_000;
const FETCH_CONCURRENCY = 2;
const BOOTSTRAP_GIVE_UP_MS = 20_000;
const GRACE_MS = 30_000;

/** Newest frame per window, fetched under the policy; older frames are released as soon as a newer one lands. */
export class TerminalImageFrameStore {
  private readonly changes = new ChangeSignal();
  private readonly frames = new Map<string, TerminalImageFrame>();
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

  constructor(private readonly transport: TerminalImageTransport) {}

  readonly subscribe = this.changes.subscribe;

  readonly getVersion = (): number => this.revision;

  imageFor(windowId: string): TerminalImageFrame | null {
    return this.frames.get(windowId) ?? null;
  }

  hasFrame(windowId: string): boolean {
    return this.frames.has(windowId);
  }

  /** Online windows with nothing to show, and those of them first seen less than the bootstrap window ago. */
  framelessWindows(
    windows: readonly TerminalWindowInfo[],
    now: number,
    covered: (windowId: string) => boolean = () => false,
  ): { frameless: Set<string>; bootstrap: Set<string> } {
    const frameless = new Set<string>();
    const bootstrap = new Set<string>();
    windows.forEach((windowInfo) => {
      if (!windowInfo.online || this.frames.has(windowInfo.id) || covered(windowInfo.id)) return;
      frameless.add(windowInfo.id);
      const first = this.firstSeen.get(windowInfo.id) ?? now;
      this.firstSeen.set(windowInfo.id, first);
      if (now - first < BOOTSTRAP_GIVE_UP_MS) bootstrap.add(windowInfo.id);
    });
    return { frameless, bootstrap };
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
    this.transport.release(this.frames.get(windowId));
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
    void this.transport.load(windowId, meta)
      .then((frame) => {
        if (this.disposed || !frame) {
          this.transport.release(frame ?? undefined);
          this.failures.set(windowId, Date.now());
          return;
        }
        this.failures.delete(windowId);
        this.pendingForce.delete(windowId);
        this.release(windowId);
        this.frames.set(windowId, frame);
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
