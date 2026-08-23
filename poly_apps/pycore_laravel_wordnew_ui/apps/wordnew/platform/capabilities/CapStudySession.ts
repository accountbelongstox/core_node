/** Foreground-aware study-session state and React hook. */
import { useEffect, useRef, useState } from 'react';
import { capApp } from './CapAppStateCore';
// ===========================================================================
// EXTENDED CAPABILITIES — foreground-aware study session stopwatch
// ===========================================================================
//
// Measuring real study time correctly is surprisingly fiddly: a naive timer
// keeps counting while the app is backgrounded or the user has it paused.
// CapStudySession only accrues time while it is RUNNING and the app is in the
// FOREGROUND, auto-pausing/resuming with the lifecycle.

export type CapStudySessionState = 'idle' | 'running' | 'paused';

export interface CapStudySessionSnapshot {
  state: CapStudySessionState;
  /** Accrued foreground time in ms. */
  elapsedMs: number;
  /** Lap marks (ms offsets from start), e.g. one per reviewed word. */
  laps: number[];
}

export class CapStudySession {
  private state: CapStudySessionState = 'idle';
  private accrued = 0;
  private since: number | null = null; // when the current running span began
  private laps: number[] = [];
  private listeners = new Set<(s: CapStudySessionSnapshot) => void>();
  private offResume: (() => void) | null = null;
  private offPause: (() => void) | null = null;

  /** Begin (or restart) the session. */
  start(): void {
    void capApp.init();
    this.accrued = 0;
    this.laps = [];
    this.beginSpan();
    this.state = 'running';
    this.wireLifecycle();
    this.emit();
  }

  /** Pause accrual (keeps elapsed). */
  pause(): void {
    if (this.state !== 'running') return;
    this.endSpan();
    this.state = 'paused';
    this.emit();
  }

  /** Resume after an explicit pause. */
  resume(): void {
    if (this.state !== 'paused') return;
    if (capApp.isActive()) this.beginSpan();
    this.state = 'running';
    this.emit();
  }

  /** Stop and return the final elapsed ms. */
  stop(): number {
    this.endSpan();
    this.state = 'idle';
    this.unwireLifecycle();
    const total = this.accrued;
    this.emit();
    return total;
  }

  /** Reset to zero (keeps it idle). */
  reset(): void {
    this.endSpan();
    this.accrued = 0;
    this.laps = [];
    this.state = 'idle';
    this.unwireLifecycle();
    this.emit();
  }

  /** Record a lap mark at the current elapsed time. */
  lap(): number {
    const at = this.elapsedMs();
    this.laps.push(at);
    this.emit();
    return at;
  }

  /** Current accrued foreground time (ms). */
  elapsedMs(): number {
    let total = this.accrued;
    if (this.state === 'running' && this.since != null && capApp.isActive()) {
      total += Date.now() - this.since;
    }
    return total;
  }

  getState(): CapStudySessionState {
    return this.state;
  }
  snapshot(): CapStudySessionSnapshot {
    return { state: this.state, elapsedMs: this.elapsedMs(), laps: this.laps.slice() };
  }

  /** Subscribe to state-change snapshots (not per-tick; poll elapsedMs for ticks). */
  subscribe(fn: (s: CapStudySessionSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  dispose(): void {
    this.unwireLifecycle();
    this.listeners.clear();
  }

  private beginSpan(): void {
    this.since = Date.now();
  }
  private endSpan(): void {
    if (this.since != null && capApp.isActive()) this.accrued += Date.now() - this.since;
    this.since = null;
  }

  private wireLifecycle(): void {
    if (this.offPause) return;
    this.offPause = capApp.onPause(() => {
      // Backgrounded: bank the current span but stay logically 'running'.
      if (this.state === 'running') {
        this.endSpan();
        this.emit();
      }
    });
    this.offResume = capApp.onResume(() => {
      if (this.state === 'running' && this.since == null) {
        this.beginSpan();
        this.emit();
      }
    });
  }
  private unwireLifecycle(): void {
    this.offPause?.();
    this.offResume?.();
    this.offPause = null;
    this.offResume = null;
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {
        /* ignore */
      }
    });
  }
}

/**
 * React hook: a foreground-aware study stopwatch. Returns the live elapsed ms
 * (ticking ~every second while running) plus controls.
 *
 *   const { elapsedMs, running, start, pause, stop, lap } = useStudySession();
 */
export function useStudySession(tickMs = 1000): {
  elapsedMs: number;
  state: CapStudySessionState;
  running: boolean;
  laps: number[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => number;
  reset: () => void;
  lap: () => number;
} {
  const sessionRef = useRef<CapStudySession | null>(null);
  if (!sessionRef.current) sessionRef.current = new CapStudySession();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [state, setState] = useState<CapStudySessionState>('idle');
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    const s = sessionRef.current!;
    const off = s.subscribe((snap) => {
      setState(snap.state);
      setLaps(snap.laps);
      setElapsedMs(snap.elapsedMs);
    });
    const timer = setInterval(() => setElapsedMs(s.elapsedMs()), tickMs);
    return () => {
      off();
      clearInterval(timer);
      s.dispose();
      sessionRef.current = null;
    };
  }, [tickMs]);

  const s = sessionRef.current;
  return {
    elapsedMs,
    state,
    running: state === 'running',
    laps,
    start: () => s?.start(),
    pause: () => s?.pause(),
    resume: () => s?.resume(),
    stop: () => s?.stop() ?? 0,
    reset: () => s?.reset(),
    lap: () => s?.lap() ?? 0,
  };
}


