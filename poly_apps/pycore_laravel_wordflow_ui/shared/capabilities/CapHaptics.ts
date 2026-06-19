/* =============================================================================
 * CapHaptics — public, cross-platform HAPTIC FEEDBACK capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): tactile feedback on correct/incorrect answers, card flips, streak
 *   milestones and button presses makes drilling feel responsive. Falls back to
 *   the Web Vibration API (silent no-op on devices without a vibrator).
 *
 * WHAT IT DOES
 *   - Thin semantic API over @capacitor/haptics: success / warning / error,
 *     light / medium / heavy taps, selection ticks.
 *   - A custom pattern player (arrays of on/off ms) for richer cues, with web
 *     fallback to navigator.vibrate(pattern).
 *   - A global, user-respecting enable flag (persisted) + per-call rate-limit so
 *     fast-repeating events (e.g. typing) don't buzz continuously.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/haptics (real Taptic Engine / vibrator).
 *   - Web: navigator.vibrate (Android Chrome buzzes; desktop / iOS Safari are
 *     silent no-ops). On the web build the plugin is aliased to a Vibration-API
 *     shim, so this module's native path also degrades cleanly.
 *
 * QUICK START
 *   import { capHaptics, useHaptics } from '@/shared/capabilities/CapHaptics';
 *   await capHaptics.success();          // correct answer
 *   await capHaptics.error();            // wrong answer
 *   await capHaptics.tap('light');       // button press
 *   capHaptics.setEnabled(false);        // honor a user "vibration off" setting
 *   // React: const h = useHaptics(); <button onPointerDown={() => h.tap()} />
 * ========================================================================== */

import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapTapStrength = 'light' | 'medium' | 'heavy';
export type CapNotifyKind = 'success' | 'warning' | 'error';

/** A custom vibration pattern: on/off durations in ms, e.g. [20, 40, 20]. */
export type CapHapticPattern = number[];

export interface CapHapticsOptions {
  /** Start enabled? Default true. */
  enabled?: boolean;
  /**
   * Minimum gap (ms) between haptic pulses. Rapid-fire requests inside this
   * window are dropped so the device doesn't buzz continuously. Default 30.
   */
  minGapMs?: number;
  /** localStorage key to persist the enabled flag. '' disables persistence. */
  persistKey?: string;
  /** Optional logger; defaults to no-op. */
  logger?: (msg: string, ...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Named patterns (exported — reusable cues)
// ---------------------------------------------------------------------------

/** A small library of reusable vibration patterns (on/off ms). */
export const HAPTIC_PATTERNS: Record<string, CapHapticPattern> = {
  tick: [8],
  doubleTap: [12, 60, 12],
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [40, 80, 40, 80, 40],
  streak: [10, 30, 10, 30, 30],
  levelUp: [15, 40, 25, 40, 45],
  heartbeat: [25, 120, 25, 400],
};

const STRENGTH_MS: Record<CapTapStrength, number> = { light: 12, medium: 25, heavy: 40 };

function strengthToStyle(s: CapTapStrength): ImpactStyle {
  switch (s) {
    case 'light':
      return ImpactStyle.Light;
    case 'heavy':
      return ImpactStyle.Heavy;
    default:
      return ImpactStyle.Medium;
  }
}

function kindToType(k: CapNotifyKind): NotificationType {
  switch (k) {
    case 'warning':
      return NotificationType.Warning;
    case 'error':
      return NotificationType.Error;
    default:
      return NotificationType.Success;
  }
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function webVibrate(pattern: number | number[]): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<CapHapticsOptions, 'logger'>> & Pick<CapHapticsOptions, 'logger'> = {
  enabled: true,
  minGapMs: 30,
  persistKey: 'cap_haptics_enabled',
  logger: undefined,
};

export class CapHapticsService {
  private readonly opts: typeof DEFAULTS;
  private readonly native = safeIsNative();
  private enabled: boolean;
  private lastPulseAt = 0;
  private listeners = new Set<(enabled: boolean) => void>();

  constructor(options: CapHapticsOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.enabled = this.loadEnabled(this.opts.enabled);
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapHaptics] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }

  /** Whether the platform can produce haptics at all. */
  isSupported(): boolean {
    if (this.native) return true;
    try {
      return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    } catch {
      return false;
    }
  }

  /** Whether haptics are currently enabled (user/global flag). */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Enable/disable all haptics (persisted). Notifies subscribers. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.saveEnabled(enabled);
    this.listeners.forEach((fn) => {
      try {
        fn(enabled);
      } catch {
        /* ignore */
      }
    });
  }

  /** Subscribe to enable-flag changes (e.g. to reflect a Settings toggle). */
  onEnabledChange(fn: (enabled: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // -- core gates ---------------------------------------------------------- #

  private gate(): boolean {
    if (!this.enabled || !this.isSupported()) return false;
    const now = Date.now();
    if (now - this.lastPulseAt < this.opts.minGapMs) return false;
    this.lastPulseAt = now;
    return true;
  }

  // -- semantic API -------------------------------------------------------- #

  /** A button/selection tap. */
  async tap(strength: CapTapStrength = 'light'): Promise<void> {
    if (!this.gate()) return;
    try {
      if (this.native) await Haptics.impact({ style: strengthToStyle(strength) });
      else webVibrate(STRENGTH_MS[strength]);
    } catch (e) {
      this.log('tap failed', e);
    }
  }

  /** A notification-style cue (success/warning/error). */
  async notify(kind: CapNotifyKind): Promise<void> {
    if (!this.gate()) return;
    try {
      if (this.native) await Haptics.notification({ type: kindToType(kind) });
      else webVibrate(HAPTIC_PATTERNS[kind] ?? HAPTIC_PATTERNS.success);
    } catch (e) {
      this.log('notify failed', e);
    }
  }

  /** Shorthand: correct answer. */
  success(): Promise<void> {
    return this.notify('success');
  }
  /** Shorthand: caution / partial. */
  warning(): Promise<void> {
    return this.notify('warning');
  }
  /** Shorthand: wrong answer. */
  error(): Promise<void> {
    return this.notify('error');
  }

  /** A short selection tick (e.g. while scrubbing a slider). */
  async selection(): Promise<void> {
    if (!this.gate()) return;
    try {
      if (this.native) await Haptics.selectionChanged();
      else webVibrate(6);
    } catch (e) {
      this.log('selection failed', e);
    }
  }

  /** Play a raw on/off pattern (ms). On native, approximated as a vibrate. */
  async pattern(pattern: CapHapticPattern): Promise<void> {
    if (!this.gate()) return;
    try {
      if (this.native) {
        // The core Haptics plugin has no arbitrary-pattern API; sum the "on"
        // segments (even indices) into a single vibrate for a comparable buzz.
        const totalOn = pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        await Haptics.vibrate({ duration: Math.max(1, totalOn) });
      } else {
        webVibrate(pattern);
      }
    } catch (e) {
      this.log('pattern failed', e);
    }
  }

  /** Play one of the named patterns from HAPTIC_PATTERNS. */
  playNamed(name: keyof typeof HAPTIC_PATTERNS): Promise<void> {
    return this.pattern(HAPTIC_PATTERNS[name] ?? HAPTIC_PATTERNS.tick);
  }

  /** A plain timed vibration (ms). */
  async vibrate(durationMs = 300): Promise<void> {
    if (!this.gate()) return;
    try {
      if (this.native) await Haptics.vibrate({ duration: durationMs });
      else webVibrate(durationMs);
    } catch (e) {
      this.log('vibrate failed', e);
    }
  }

  // -- persistence --------------------------------------------------------- #

  private loadEnabled(fallback: boolean): boolean {
    if (!this.opts.persistKey) return fallback;
    try {
      const raw = window.localStorage.getItem(this.opts.persistKey);
      if (raw === '0' || raw === 'false') return false;
      if (raw === '1' || raw === 'true') return true;
    } catch {
      /* ignore */
    }
    return fallback;
  }

  private saveEnabled(enabled: boolean): void {
    if (!this.opts.persistKey) return;
    try {
      window.localStorage.setItem(this.opts.persistKey, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capHaptics = new CapHapticsService();
export const hapticSuccess = (): Promise<void> => capHaptics.success();
export const hapticError = (): Promise<void> => capHaptics.error();
export const hapticTap = (s?: CapTapStrength): Promise<void> => capHaptics.tap(s);

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseHapticsResult {
  enabled: boolean;
  supported: boolean;
  setEnabled: (v: boolean) => void;
  tap: (s?: CapTapStrength) => Promise<void>;
  success: () => Promise<void>;
  warning: () => Promise<void>;
  error: () => Promise<void>;
  selection: () => Promise<void>;
  pattern: (p: CapHapticPattern) => Promise<void>;
  playNamed: (name: keyof typeof HAPTIC_PATTERNS) => Promise<void>;
}

/**
 * React hook exposing bound haptic actions + the live enable flag.
 *
 *   const h = useHaptics();
 *   <button onPointerDown={() => h.tap('light')} onClick={submit} />
 */
export function useHaptics(): UseHapticsResult {
  const [enabled, setEnabledState] = useState<boolean>(() => capHaptics.isEnabled());

  useEffect(() => capHaptics.onEnabledChange(setEnabledState), []);

  return useMemo<UseHapticsResult>(
    () => ({
      enabled,
      supported: capHaptics.isSupported(),
      setEnabled: (v: boolean) => capHaptics.setEnabled(v),
      tap: (s?: CapTapStrength) => capHaptics.tap(s),
      success: () => capHaptics.success(),
      warning: () => capHaptics.warning(),
      error: () => capHaptics.error(),
      selection: () => capHaptics.selection(),
      pattern: (p: CapHapticPattern) => capHaptics.pattern(p),
      playNamed: (name: keyof typeof HAPTIC_PATTERNS) => capHaptics.playNamed(name),
    }),
    [enabled],
  );
}

export default capHaptics;
