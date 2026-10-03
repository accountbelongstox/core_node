/**
 * Scrollback text per window; the text half of the redundant terminal transport.
 * A window's whole scrollback arrives once, then only changed lines. The operated terminal asks pycore
 * to export again (idle-gated there); other windows only pick up exports the backup scanner made.
 */
import { ChangeSignal } from '../../../../../core/events/ChangeSignal';
import { RELAY_CONTRACT } from '@/core/contracts/RelayContract';
import type { TerminalTextDoc, TerminalTextTransport } from '@/apps/pycore-manager/components/terminal/transport/TerminalTextTransport';

const TICK_MS = 1_000;
const FETCH_CONCURRENCY = 2;
const FOCUS_POLL_MS = RELAY_CONTRACT.durations.terminal_text_refresh_seconds * 1000;
const IDLE_POLL_MS = RELAY_CONTRACT.durations.terminal_viewer_demand_lease_seconds * 1000;
const RETRY_MS = RELAY_CONTRACT.durations.terminal_text_retry_seconds * 1000;

export interface TerminalTextTarget {
  windowId: string;
  terminalNumber: number;
}

export class TerminalTextStore {
  private readonly changes = new ChangeSignal();
  private readonly docs = new Map<string, TerminalTextDoc>();
  private readonly polledAt = new Map<string, number>();
  private readonly failedAt = new Map<string, number>();
  private readonly inflight = new Set<string>();
  private targets: TerminalTextTarget[] = [];
  private focusId: string | null = null;
  private timer: number | null = null;
  private disposed = false;
  private revision = 0;

  constructor(private readonly transport: TerminalTextTransport) {}

  readonly subscribe = this.changes.subscribe;

  readonly getVersion = (): number => this.revision;

  docFor(windowId: string): TerminalTextDoc | null {
    return this.docs.get(windowId) ?? null;
  }

  /** Text that still matches the screen. */
  isLive(windowId: string): boolean {
    const doc = this.docs.get(windowId);
    return Boolean(doc && !doc.stale);
  }

  /** The last text read failed: the picture stands in until the retry. */
  isUnavailable(windowId: string): boolean {
    return this.failedAt.has(windowId);
  }

  /** Windows that may receive text now; the focused one is re-exported on its own cadence. */
  setTargets(targets: TerminalTextTarget[], focusId: string | null): void {
    this.targets = targets;
    this.focusId = focusId;
    const kept = new Set(targets.map((target) => target.windowId));
    if (this.timer === null && targets.length && !this.disposed) {
      this.timer = window.setInterval(() => this.pump(), TICK_MS);
    } else if (this.timer !== null && !targets.length) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    [...this.docs.keys()].forEach((windowId) => {
      if (!kept.has(windowId) && !this.inflight.has(windowId)) this.polledAt.delete(windowId);
    });
    this.pump();
  }

  /** Ask for the window's text at the next tick (after input was sent to it). */
  pollSoon(windowId: string): void {
    this.polledAt.delete(windowId);
    this.failedAt.delete(windowId);
    this.pump();
  }

  /** Windows that left for good: drop their text. */
  forget(onlineWindowIds: ReadonlySet<string>): void {
    let changed = false;
    [...this.docs.keys()].forEach((windowId) => {
      if (onlineWindowIds.has(windowId)) return;
      this.docs.delete(windowId);
      this.polledAt.delete(windowId);
      this.failedAt.delete(windowId);
      changed = true;
    });
    if (changed) this.emit();
  }

  /** Mounted (again): StrictMode and remounts dispose and reopen the same store. */
  open(): void {
    this.disposed = false;
    this.setTargets(this.targets, this.focusId);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private pump(): void {
    if (this.disposed) return;
    const now = Date.now();
    for (const target of this.targets) {
      if (this.inflight.size >= FETCH_CONCURRENCY) return;
      if (this.inflight.has(target.windowId) || !this.due(target.windowId, now)) continue;
      this.start(target);
    }
  }

  private due(windowId: string, now: number): boolean {
    const failedAt = this.failedAt.get(windowId);
    if (failedAt !== undefined && now - failedAt < RETRY_MS) return false;
    const polledAt = this.polledAt.get(windowId);
    if (polledAt === undefined) return true;
    return now - polledAt >= (windowId === this.focusId ? FOCUS_POLL_MS : IDLE_POLL_MS);
  }

  private start(target: TerminalTextTarget): void {
    const { windowId, terminalNumber } = target;
    const previous = this.docs.get(windowId) ?? null;
    // Exporting is intrusive (select-all in the terminal): only the operated window, or one with no text at all.
    const refresh = windowId === this.focusId || previous === null;
    this.inflight.add(windowId);
    this.polledAt.set(windowId, Date.now());
    void this.transport.load(previous, windowId, terminalNumber, refresh)
      .then((doc) => {
        if (this.disposed) return;
        if (!doc) {
          this.fail(windowId);
          return;
        }
        this.failedAt.delete(windowId);
        if (previous && previous.revision === doc.revision && previous.stale === doc.stale) {
          this.docs.set(windowId, doc);
          return;
        }
        this.docs.set(windowId, doc);
        this.emit();
      })
      .catch(() => { if (!this.disposed) this.fail(windowId); })
      .finally(() => {
        this.inflight.delete(windowId);
        this.pump();
      });
  }

  private fail(windowId: string): void {
    this.failedAt.set(windowId, Date.now());
    this.docs.delete(windowId);
    this.emit();
  }

  private emit(): void {
    this.revision += 1;
    this.changes.emit();
  }
}
