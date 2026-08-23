/* =============================================================================
 * CapAppState — public, cross-platform APP LIFECYCLE capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): pause audio/Walkman + study timers when the app is backgrounded,
 *   handle the Android hardware back button, and route deep links. Falls back to
 *   browser visibility / popstate / focus events.
 *
 * WHAT IT DOES
 *   - Foreground/background state + active/pause/resume events.
 *   - Hardware back-button handling with a prioritized handler stack (the top
 *     handler can consume the press, e.g. close a modal instead of exiting).
 *   - Deep-link routing: register path matchers for appUrlOpen / launch URL.
 *   - Helpers: a foreground-gated interval (auto-pauses when backgrounded) — the
 *     correct way to drive study timers so they don't drift in the background.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/app (appStateChange / backButton / appUrlOpen / pause /
 *     resume / getLaunchUrl / minimizeApp / exitApp).
 *   - Web: document visibilitychange + window focus/blur + popstate (aliased
 *     shim). minimize/exit are no-ops; deep links arrive via the page URL.
 *
 * QUICK START
 *   import { capApp, useAppActive, useBackButton } from
 *     '@/apps/wordnew/platform/capabilities/CapAppState';
 *   await capApp.init();
 *   capApp.onPause(() => audio.pause());
 *   capApp.onResume(() => audio.resume());
 *   // React: const active = useAppActive();
 *   //        useBackButton(() => { if (modalOpen) { close(); return true; } return false; });
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { TypedEventEmitter } from '../../../../core/events/TypedEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapBackButtonEvent {
  canGoBack: boolean;
}
export interface CapUrlOpenEvent {
  url: string;
}

export interface CapAppStateEventMap {
  /** App became active (true) or inactive (false). */
  activechange: boolean;
  pause: void;
  resume: void;
  backButton: CapBackButtonEvent;
  urlOpen: CapUrlOpenEvent;
}

export type CapAppStateListener<K extends keyof CapAppStateEventMap> = (p: CapAppStateEventMap[K]) => void;

/** A back-button handler. Return true to CONSUME the press (stop propagation). */
export type CapBackHandler = (event: CapBackButtonEvent) => boolean | void;

/** A deep-link route: a path/pattern + handler. */
export interface CapDeepLinkRoute {
  /** Match the URL pathname; string = exact/prefix, RegExp = test. */
  match: string | RegExp;
  handler: (url: URL, raw: string) => void;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

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

export class CapAppStateService {
  private readonly native = safeIsNative();
  private readonly emitter = new TypedEventEmitter<CapAppStateEventMap>('CapAppState');
  private active = true;
  private initialized = false;
  private handles: Array<{ remove: () => Promise<void> }> = [];

  // back-button handler stack (last registered = highest priority)
  private backStack: CapBackHandler[] = [];
  // deep-link routes
  private routes: CapDeepLinkRoute[] = [];
  private launchUrlHandled = false;
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapAppState] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  isActive(): boolean {
    return this.active;
  }
  isInitialized(): boolean {
    return this.initialized;
  }

  on<K extends keyof CapAppStateEventMap>(e: K, fn: CapAppStateListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  off<K extends keyof CapAppStateEventMap>(e: K, fn: CapAppStateListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Convenience: subscribe to pause (backgrounded). */
  onPause(fn: () => void): () => void {
    return this.emitter.on('pause', fn);
  }
  /** Convenience: subscribe to resume (foregrounded). */
  onResume(fn: () => void): () => void {
    return this.emitter.on('resume', fn);
  }

  /** Initialize OS listeners (idempotent). */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const s = await App.getState();
      this.active = !!s.isActive;
    } catch {
      /* default true */
    }
    try {
      this.handles.push(
        await App.addListener('appStateChange', (state: any) => this.setActive(!!state?.isActive)),
      );
      this.handles.push(
        await App.addListener('backButton', (e: any) =>
          this.handleBack({ canGoBack: !!e?.canGoBack }),
        ),
      );
      this.handles.push(
        await App.addListener('appUrlOpen', (e: any) => this.handleUrl(String(e?.url || ''))),
      );
      // pause/resume aren't on every platform; guard.
      this.handles.push(await App.addListener('pause', () => this.setActive(false)));
      this.handles.push(await App.addListener('resume', () => this.setActive(true)));
    } catch (e) {
      this.log('addListener failed', e);
    }
    // Process the launch URL once (deep link that cold-started the app).
    void this.processLaunchUrl();
  }

  private setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.emitter.emit('activechange', active);
    this.emitter.emit(active ? 'resume' : 'pause', undefined);
  }

  // -- back button --------------------------------------------------------- #

  /**
   * Push a back-button handler (highest priority). The handler may return true
   * to consume the press. Returns an unregister function. If no handler
   * consumes the press and there's no web history to pop, the app minimizes
   * (native) — matching expected Android behavior.
   */
  registerBackHandler(handler: CapBackHandler): () => void {
    this.backStack.push(handler);
    return () => {
      const i = this.backStack.lastIndexOf(handler);
      if (i >= 0) this.backStack.splice(i, 1);
    };
  }

  private handleBack(event: CapBackButtonEvent): void {
    this.emitter.emit('backButton', event);
    // Walk the stack from the top; first handler returning true consumes it.
    for (let i = this.backStack.length - 1; i >= 0; i--) {
      try {
        if (this.backStack[i](event) === true) return;
      } catch (e) {
        this.log('back handler error', e);
      }
    }
    // Default behavior: go back if possible, else minimize the app (native).
    if (event.canGoBack && typeof window !== 'undefined') {
      window.history.back();
    } else if (this.native) {
      void App.minimizeApp().catch(() => {});
    }
  }

  // -- deep links ---------------------------------------------------------- #

  /** Register a deep-link route. Returns an unregister function. */
  registerRoute(route: CapDeepLinkRoute): () => void {
    this.routes.push(route);
    return () => {
      const i = this.routes.indexOf(route);
      if (i >= 0) this.routes.splice(i, 1);
    };
  }

  private handleUrl(raw: string): void {
    if (!raw) return;
    this.emitter.emit('urlOpen', { url: raw });
    let url: URL | null = null;
    try {
      url = new URL(raw);
    } catch {
      try {
        url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://app/');
      } catch {
        url = null;
      }
    }
    if (!url) return;
    for (const route of this.routes) {
      const ok =
        typeof route.match === 'string'
          ? url.pathname === route.match || url.pathname.startsWith(route.match)
          : route.match.test(url.pathname);
      if (ok) {
        try {
          route.handler(url, raw);
        } catch (e) {
          this.log('route handler error', e);
        }
      }
    }
  }

  /** Fetch + process the launch URL (the deep link that started the app). */
  async processLaunchUrl(): Promise<string | null> {
    if (this.launchUrlHandled) return null;
    this.launchUrlHandled = true;
    try {
      const r = await App.getLaunchUrl();
      const url = (r as any)?.url;
      if (url) {
        this.handleUrl(String(url));
        return String(url);
      }
    } catch {
      /* none */
    }
    return null;
  }

  /** Read the current launch URL without routing it. */
  async getLaunchUrl(): Promise<string | null> {
    try {
      const r = await App.getLaunchUrl();
      return (r as any)?.url ?? null;
    } catch {
      return null;
    }
  }

  // -- app control --------------------------------------------------------- #

  /** Minimize the app (native Android); no-op on web. */
  async minimize(): Promise<void> {
    try {
      await App.minimizeApp();
    } catch {
      /* no-op on web */
    }
  }

  /** Exit the app (native); no-op on web. */
  async exit(): Promise<void> {
    try {
      await App.exitApp();
    } catch {
      /* no-op on web */
    }
  }

  /**
   * A foreground-gated interval: runs `fn` every `ms`, but PAUSES while the app
   * is backgrounded and resumes when it returns. The right primitive for study
   * timers / countdowns so they don't tick (or drift) in the background.
   * Returns a stop function.
   */
  foregroundInterval(fn: () => void, ms: number): () => void {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = (): void => {
      if (timer == null) timer = setInterval(fn, ms);
    };
    const stop = (): void => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (this.active) start();
    const offResume = this.onResume(start);
    const offPause = this.onPause(stop);
    return () => {
      stop();
      offResume();
      offPause();
    };
  }

  async dispose(): Promise<void> {
    for (const h of this.handles) {
      try {
        await h.remove();
      } catch {
        /* ignore */
      }
    }
    this.handles = [];
    this.backStack = [];
    this.routes = [];
    this.emitter.clear();
    this.initialized = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capApp = new CapAppStateService();
export const initAppState = (): Promise<void> => capApp.init();

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/** Whether the app is currently active (foreground). Auto-inits. */
export function useAppActive(): boolean {
  const [active, setActive] = useState<boolean>(() => capApp.isActive());
  useEffect(() => {
    void capApp.init();
    const off = capApp.on('activechange', setActive);
    setActive(capApp.isActive());
    return off;
  }, []);
  return active;
}

/** Alias returning the full state object for symmetry with other hooks. */
export function useAppState(): { active: boolean } {
  return { active: useAppActive() };
}

/** Run a callback when the app is backgrounded / foregrounded. */
export function useAppLifecycle(handlers: { onPause?: () => void; onResume?: () => void }): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    void capApp.init();
    const offPause = capApp.onPause(() => ref.current.onPause?.());
    const offResume = capApp.onResume(() => ref.current.onResume?.());
    return () => {
      offPause();
      offResume();
    };
  }, []);
}

/**
 * Register a back-button handler for the component's lifetime. Return true from
 * `handler` to consume the press (e.g. close a modal).
 */
export function useBackButton(handler: CapBackHandler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    void capApp.init();
    return capApp.registerBackHandler((e) => ref.current(e));
  }, []);
}

/** Subscribe to deep-link opens while mounted. */
export function useAppUrlOpen(handler: (url: URL, raw: string) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    void capApp.init();
    return capApp.registerRoute({ match: /.*/, handler: (url, raw) => ref.current(url, raw) });
  }, []);
}

// ===========================================================================
// EXTENDED CAPABILITIES — idle detection, foreground time, double-back-to-exit
// ===========================================================================
//
// Session-quality signals on top of raw lifecycle: detect when the learner has
// gone idle (to pause TTS / dim the UI), measure real foreground study time
// (excluding backgrounded periods), and the Android "press back again to exit"
// pattern at the app root.

export interface CapIdleOptions {
  /** Inactivity (ms) before 'idle' fires. Default 60000. */
  thresholdMs?: number;
  /** DOM events that count as activity. */
  events?: string[];
}

/**
 * Fires onIdle after `thresholdMs` of no user activity, and onActive on the
 * next interaction. Also treats backgrounding as immediate idle.
 *
 *   const idle = new CapIdleDetector({ thresholdMs: 90000 });
 *   idle.onIdle(() => capTTS.pause());
 *   idle.start();
 */
export class CapIdleDetector {
  private readonly thresholdMs: number;
  private readonly events: string[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idle = false;
  private idleCbs = new Set<() => void>();
  private activeCbs = new Set<() => void>();
  private bound: (() => void) | null = null;
  private offResume: (() => void) | null = null;
  private offPause: (() => void) | null = null;

  constructor(options: CapIdleOptions = {}) {
    this.thresholdMs = options.thresholdMs ?? 60_000;
    this.events = options.events ?? ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'wheel'];
  }

  isIdle(): boolean {
    return this.idle;
  }
  onIdle(fn: () => void): () => void {
    this.idleCbs.add(fn);
    return () => this.idleCbs.delete(fn);
  }
  onActive(fn: () => void): () => void {
    this.activeCbs.add(fn);
    return () => this.activeCbs.delete(fn);
  }

  start(): void {
    if (this.bound) return;
    void capApp.init();
    this.bound = () => this.activity();
    if (typeof window !== 'undefined') {
      for (const e of this.events) window.addEventListener(e, this.bound, { passive: true });
    }
    this.offPause = capApp.onPause(() => this.goIdle());
    this.offResume = capApp.onResume(() => this.activity());
    this.arm();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.bound && typeof window !== 'undefined') {
      for (const e of this.events) window.removeEventListener(e, this.bound);
    }
    this.bound = null;
    this.offPause?.();
    this.offResume?.();
    this.offPause = null;
    this.offResume = null;
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.goIdle(), this.thresholdMs);
  }

  private goIdle(): void {
    if (this.idle) return;
    this.idle = true;
    this.idleCbs.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }

  private activity(): void {
    if (this.idle) {
      this.idle = false;
      this.activeCbs.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    }
    this.arm();
  }
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/** True after `thresholdMs` of no interaction (and while backgrounded). */
export function useIdle(thresholdMs = 60_000): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const detector = new CapIdleDetector({ thresholdMs });
    const offIdle = detector.onIdle(() => setIdle(true));
    const offActive = detector.onActive(() => setIdle(false));
    detector.start();
    return () => {
      offIdle();
      offActive();
      detector.stop();
    };
  }, [thresholdMs]);
  return idle;
}

/**
 * Accumulated FOREGROUND time (ms) since mount — excludes time the app spent
 * backgrounded. Ticks roughly every second. Reset by remounting.
 */
export function useForegroundTime(tickMs = 1000): number {
  const [ms, setMs] = useState(0);
  const accRef = useRef(0);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    void capApp.init();
    lastRef.current = capApp.isActive() ? Date.now() : null;

    const flush = (): void => {
      if (lastRef.current != null) {
        accRef.current += Date.now() - lastRef.current;
        lastRef.current = Date.now();
      }
      setMs(accRef.current);
    };
    const timer = setInterval(flush, tickMs);
    const offResume = capApp.onResume(() => {
      lastRef.current = Date.now();
    });
    const offPause = capApp.onPause(() => {
      flush();
      lastRef.current = null;
    });
    return () => {
      clearInterval(timer);
      offResume();
      offPause();
    };
  }, [tickMs]);

  return ms;
}

/**
 * Android "press back again to exit" at the app root. The first back press is
 * consumed and `onHint` is called; a second press within `windowMs` exits.
 *
 *   useDoubleBackExit(() => toast('Press back again to exit'));
 */
export function useDoubleBackExit(onHint?: () => void, windowMs = 2000): void {
  const hintRef = useRef(onHint);
  hintRef.current = onHint;
  useEffect(() => {
    void capApp.init();
    let last = 0;
    return capApp.registerBackHandler(() => {
      const now = Date.now();
      if (now - last < windowMs) {
        void capApp.exit();
        return true;
      }
      last = now;
      hintRef.current?.();
      return true; // consume the first press
    });
  }, [windowMs]);
}

export default capApp;

