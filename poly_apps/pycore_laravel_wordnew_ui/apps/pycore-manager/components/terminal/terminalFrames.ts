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
 * Each frame is first asked for as OCR text (a few KB); only when the text is unreadable, or the
 * window must be clicked on its picture, is the image itself transferred.
 */
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
import { RELAY_CONTRACT } from '@/core/contracts/RelayContract';
import type {
  PycoreHttpBinaryResult,
  TerminalScreenshotResourceMeta,
  TerminalScreenshotTextResult,
  TerminalWindowInfo,
} from '@/apps/pycore-manager/api';

const FETCH_TIMEOUT_MS = 20_000;
const FAILURE_COOLDOWN_MS = 10_000;
const FETCH_CONCURRENCY = 2;
const BOOTSTRAP_GIVE_UP_MS = 20_000;
const GRACE_MS = 30_000;
const TEXT_FETCH_TIMEOUT_MS = RELAY_CONTRACT.durations.terminal_screenshot_capture_lease_seconds * 1000;
const TEXT_RETRY_MS = RELAY_CONTRACT.durations.terminal_text_retry_seconds * 1000;
const TEXT_STALE_CODE = 'terminal_screenshot_stale';

export const TERMINAL_FOCUS_POLL_MS = 1_000;

export type TerminalFrameKind = 'text' | 'image';

export interface TerminalFrame {
  kind: TerminalFrameKind;
  /** Object URL of the image ('' for a text frame). */
  url: string;
  /** OCR text of the frame ('' for an image frame). */
  text: string;
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
  /** Online windows that still have no frame at all. */
  frameless: ReadonlySet<string>;
  /** Frameless windows still inside their first-preview window (asked for even when off screen). */
  bootstrap: ReadonlySet<string>;
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
    // A finished (static) terminal is only asked for when it has no frame to show at all.
    const live = !input.frozen.has(focusId);
    const wanted = live || input.frameless.has(focusId);
    return { wanted: wanted ? new Set([focusId]) : new Set(), demand: wanted ? [focusId] : [], focus: live ? focusId : '' };
  }
  const wanted = new Set<string>();
  input.visible.forEach((id) => { if (online.has(id)) wanted.add(id); });
  input.bootstrap.forEach((id) => { if (online.has(id)) wanted.add(id); });
  // Static terminals keep the frame they have; one without a frame is still fetched while on screen.
  input.frozen.forEach((id) => { if (!input.frameless.has(id)) wanted.delete(id); });
  return { wanted, demand: [...wanted].sort(), focus: '' };
}

type FetchFrame = (windowId: string, digest: string, timeoutMs: number) => Promise<PycoreHttpBinaryResult>;
type FetchText = (windowId: string, digest: string, timeoutMs: number) => Promise<TerminalScreenshotTextResult>;

/** A frame was replaced while it was read: nothing failed, the newer digest is fetched next. */
const STALE = 'stale';

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
  private readonly textFailedAt = new Map<string, number>();
  private wanted: ReadonlySet<string> = new Set();
  private imageRequired: ReadonlySet<string> = new Set();
  private running = 0;
  private disposed = false;
  private revision = 0;

  constructor(private readonly fetchFrame: FetchFrame, private readonly fetchText: FetchText) {}

  readonly subscribe = this.changes.subscribe;

  readonly getVersion = (): number => this.revision;

  imageFor(windowId: string): TerminalFrame | null {
    return this.frames.get(windowId) ?? null;
  }

  hasFrame(windowId: string): boolean {
    return this.frames.has(windowId);
  }

  /** Online windows with no frame, and those of them first seen less than the bootstrap window ago. */
  framelessWindows(windows: readonly TerminalWindowInfo[], now: number): { frameless: Set<string>; bootstrap: Set<string> } {
    const frameless = new Set<string>();
    const bootstrap = new Set<string>();
    windows.forEach((windowInfo) => {
      if (!windowInfo.online || this.frames.has(windowInfo.id)) return;
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

  /** Windows that must show their picture (clicked by position): text frames there are replaced by images. */
  setImageRequired(windowIds: ReadonlySet<string>): void {
    this.imageRequired = windowIds;
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
      this.textFailedAt.delete(id);
      this.release(id);
    });
  }

  /** Fetch the newest frame of a window now, whatever the policy says (an action result, an opened terminal). */
  fetchNow(windowId: string): void {
    this.pendingForce.add(windowId);
    this.pump();
  }

  /** Mounted (again): StrictMode and remounts dispose and reopen the same store. */
  open(): void {
    this.disposed = false;
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    [...this.frames.keys()].forEach((id) => this.release(id));
  }

  private release(windowId: string): void {
    const frame = this.frames.get(windowId);
    if (frame?.url) URL.revokeObjectURL(frame.url);
    this.frames.delete(windowId);
  }

  private pump(): void {
    if (this.disposed) return;
    const candidates = [...new Set([...this.pendingForce, ...this.wanted])];
    for (const windowId of candidates) {
      if (this.running >= FETCH_CONCURRENCY) return;
      const meta = this.newest.get(windowId);
      const current = meta ? this.isCurrent(windowId, meta) : false;
      if (!meta || this.inflight.has(windowId) || current) {
        if (current) this.pendingForce.delete(windowId);
        continue;
      }
      const failedAt = this.failures.get(windowId);
      if (failedAt !== undefined && Date.now() - failedAt < FAILURE_COOLDOWN_MS && !this.pendingForce.has(windowId)) continue;
      this.start(windowId, meta);
    }
  }

  private isCurrent(windowId: string, meta: TerminalScreenshotResourceMeta): boolean {
    const frame = this.frames.get(windowId);
    return frame?.digest === meta.digest && (frame.kind === 'image' || !this.imageRequired.has(windowId));
  }

  private textAllowed(windowId: string): boolean {
    const failedAt = this.textFailedAt.get(windowId);
    return !this.imageRequired.has(windowId) && (failedAt === undefined || Date.now() - failedAt >= TEXT_RETRY_MS);
  }

  private start(windowId: string, meta: TerminalScreenshotResourceMeta): void {
    this.inflight.set(windowId, meta.digest);
    this.running += 1;
    void this.load(windowId, meta)
      .then((frame) => {
        if (frame === STALE || this.disposed) return;
        if (!frame) {
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

  /** Text first; the image only when the text is unreadable or the window needs its picture. */
  private async load(windowId: string, meta: TerminalScreenshotResourceMeta): Promise<TerminalFrame | null | typeof STALE> {
    const base = { width: meta.width, height: meta.height, captured_at: meta.captured_at, digest: meta.digest };
    if (this.textAllowed(windowId)) {
      const result = await this.fetchText(windowId, meta.digest, TEXT_FETCH_TIMEOUT_MS).catch(() => null);
      if (this.disposed) return null;
      if (result?.error_code === TEXT_STALE_CODE) return STALE;
      if (result?.success && result.text) {
        this.textFailedAt.delete(windowId);
        return { ...base, kind: 'text', url: '', text: result.text, mime: 'text/plain' };
      }
      this.textFailedAt.set(windowId, Date.now());
    }
    const result = await this.fetchFrame(windowId, meta.digest, FETCH_TIMEOUT_MS);
    if (this.disposed || result.status !== 200 || !result.bytes) return null;
    const mime = meta.mime || 'image/webp';
    return {
      ...base,
      kind: 'image',
      url: URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: mime })),
      text: '',
      mime,
    };
  }
}
