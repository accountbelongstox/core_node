/* =============================================================================
 * CapKeepAwake — public, cross-platform SCREEN WAKE-LOCK capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): during a Walkman / listening / shadowing session the screen must
 *   not dim or lock. Falls back to the browser Screen Wake Lock API.
 *
 * WHAT IT DOES
 *   - Keep the screen awake / allow it to sleep again.
 *   - REFERENCE-COUNTED: multiple independent features (Walkman + a timer) can
 *     each request "stay awake"; the lock is only released once ALL have let go.
 *     This is the #1 source of bugs when each screen calls keep/allow directly.
 *   - Scoped helpers (run a promise / a React component lifetime under a lock).
 *   - Emits change events so UI can show a "screen stays on" indicator.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor-community/keep-awake.
 *   - Web: navigator.wakeLock (re-acquired on tab re-focus by the shim). On the
 *     web build the plugin is aliased to a Wake-Lock-API shim.
 *
 * QUICK START
 *   import { capKeepAwake, useKeepAwake } from '@/shared/capabilities/CapKeepAwake';
 *   const release = await capKeepAwake.acquire('walkman');   // ref-counted
 *   // ... session ends ...
 *   await release();
 *   // React: useKeepAwake(isPlaying);   // lock while `isPlaying` is true
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapKeepAwakeState {
  /** Whether a wake lock is currently held. */
  active: boolean;
  /** Number of outstanding holders (reference count). */
  holders: number;
  /** Whether the platform supports keeping awake at all. */
  supported: boolean;
  /** Where the implementation runs. */
  source: 'native' | 'web' | 'unsupported';
}

export type CapKeepAwakeListener = (state: CapKeepAwakeState) => void;

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapKeepAwakeService {
  private readonly native = safeIsNative();
  private holders = new Set<string>();
  private active = false;
  private supported: boolean | null = null;
  private seq = 0;
  private listeners = new Set<CapKeepAwakeListener>();
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapKeepAwake] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }

  /** Whether the platform can keep the screen awake (cached after first check). */
  async isSupported(): Promise<boolean> {
    if (this.supported != null) return this.supported;
    try {
      if (this.native) {
        const r = await KeepAwake.isSupported();
        this.supported = !!r.isSupported;
      } else {
        this.supported = !!(navigator as any)?.wakeLock?.request;
      }
    } catch {
      this.supported = false;
    }
    return this.supported;
  }

  /** Synchronous best-effort support flag (may be null before first check). */
  isSupportedSync(): boolean {
    if (this.supported != null) return this.supported;
    if (this.native) return true;
    try {
      return !!(navigator as any)?.wakeLock?.request;
    } catch {
      return false;
    }
  }

  getState(): CapKeepAwakeState {
    return {
      active: this.active,
      holders: this.holders.size,
      supported: this.isSupportedSync(),
      source: this.isSupportedSync() ? (this.native ? 'native' : 'web') : 'unsupported',
    };
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(fn: CapKeepAwakeListener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch {
        /* ignore */
      }
    });
  }

  /**
   * Acquire a reference-counted keep-awake lock under a tag. Returns a release
   * function that is safe to call multiple times. The OS lock is engaged on the
   * first holder and released when the last holder lets go.
   */
  async acquire(tag?: string): Promise<() => Promise<void>> {
    const id = tag ? `${tag}#${++this.seq}` : `anon#${++this.seq}`;
    this.holders.add(id);
    this.log('acquire', id, 'holders=', this.holders.size);
    if (this.holders.size === 1) await this.engage();
    else this.notify();

    let released = false;
    return async () => {
      if (released) return;
      released = true;
      this.holders.delete(id);
      this.log('release', id, 'holders=', this.holders.size);
      if (this.holders.size === 0) await this.disengage();
      else this.notify();
    };
  }

  /** Run an async task while the screen is kept awake; always releases after. */
  async during<T>(task: () => Promise<T>, tag = 'during'): Promise<T> {
    const release = await this.acquire(tag);
    try {
      return await task();
    } finally {
      await release();
    }
  }

  /** Force-release ALL holders (e.g. on global teardown / logout). */
  async releaseAll(): Promise<void> {
    this.holders.clear();
    await this.disengage();
  }

  private async engage(): Promise<void> {
    if (!(await this.isSupported())) {
      this.log('keep-awake unsupported; no-op');
      this.notify();
      return;
    }
    try {
      if (this.native) await KeepAwake.keepAwake();
      else await this.webKeepAwake();
      this.active = true;
    } catch (e) {
      this.log('engage failed', e);
      this.active = false;
    }
    this.notify();
  }

  private async disengage(): Promise<void> {
    try {
      if (this.native) await KeepAwake.allowSleep();
      else await this.webAllowSleep();
    } catch (e) {
      this.log('disengage failed', e);
    }
    this.active = false;
    this.notify();
  }

  // -- web wake-lock path (mirrors the shim but kept here so a real installed
  //    @capacitor-community/keep-awake on native is the only other code path) --

  private webSentinel: any = null;
  private webVisWired = false;

  private async webKeepAwake(): Promise<void> {
    const api = (navigator as any)?.wakeLock;
    if (!api?.request) return;
    this.webSentinel = await api.request('screen');
    this.webSentinel.addEventListener?.('release', () => {
      this.webSentinel = null;
    });
    if (!this.webVisWired && typeof document !== 'undefined') {
      this.webVisWired = true;
      document.addEventListener('visibilitychange', () => {
        if (this.active && document.visibilityState === 'visible' && !this.webSentinel) {
          void this.webKeepAwake().catch(() => {});
        }
      });
    }
  }

  private async webAllowSleep(): Promise<void> {
    try {
      await this.webSentinel?.release?.();
    } catch {
      /* ignore */
    }
    this.webSentinel = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capKeepAwake = new CapKeepAwakeService();
export const acquireKeepAwake = (tag?: string): Promise<() => Promise<void>> =>
  capKeepAwake.acquire(tag);
export const keepAwakeDuring = <T>(task: () => Promise<T>, tag?: string): Promise<T> =>
  capKeepAwake.during(task, tag);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Hold a keep-awake lock while `active` is true (and the component is mounted).
 * Reference-counted, so multiple components can hold it independently.
 *
 *   useKeepAwake(isPlaying);
 */
export function useKeepAwake(active: boolean, tag = 'react'): CapKeepAwakeState {
  const [state, setState] = useState<CapKeepAwakeState>(() => capKeepAwake.getState());

  useEffect(() => capKeepAwake.subscribe(setState), []);

  useEffect(() => {
    if (!active) return;
    let release: (() => Promise<void>) | null = null;
    let cancelled = false;
    void capKeepAwake.acquire(tag).then((r) => {
      if (cancelled) void r();
      else release = r;
    });
    return () => {
      cancelled = true;
      if (release) void release();
    };
  }, [active, tag]);

  return state;
}

/** Read-only state subscription (for a "screen stays on" indicator). */
export function useKeepAwakeState(): CapKeepAwakeState {
  const [state, setState] = useState<CapKeepAwakeState>(() => capKeepAwake.getState());
  useEffect(() => capKeepAwake.subscribe(setState), []);
  return state;
}

export default capKeepAwake;
