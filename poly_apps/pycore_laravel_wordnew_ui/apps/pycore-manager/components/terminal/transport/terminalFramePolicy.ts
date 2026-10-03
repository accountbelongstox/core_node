/**
 * Which windows may transfer frames now (image and text alike).
 *  - a window with no picture or text yet gets ONE frame as its preview (bootstrap);
 *  - afterwards only windows scrolled into view (plus the one about to enter) are fetched, newest only;
 *  - while one terminal is operated, every other window is paused and that one is polled once a second;
 *  - a terminal whose agent finished is static until a new prompt.
 * The server mirrors this through the viewer demand lease (visible / focus / force ids).
 */
import type { TerminalWindowInfo } from '@/apps/pycore-manager/api';

export const TERMINAL_FOCUS_POLL_MS = 1_000;

export interface TerminalFramePolicyInput {
  windows: readonly TerminalWindowInfo[];
  visible: ReadonlySet<string>;
  /** The terminal being operated (preview dialog, or the explicitly selected one on a desktop layout). */
  focusId: string | null;
  /** Agent finished and no new prompt since: its screen is static. */
  frozen: ReadonlySet<string>;
  /** Online windows that still have nothing to show (no picture, no text). */
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
