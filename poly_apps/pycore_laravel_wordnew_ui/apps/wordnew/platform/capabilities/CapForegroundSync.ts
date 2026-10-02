/* =============================================================================
 * CapForegroundSync - keeps the app online while a long sync runs in the background
 * =============================================================================
 * Native (Android, app plugin `ForegroundSync`): a dataSync foreground service with a
 * low-importance notification and a partial wake lock, so Android does not block the
 * app's network (APP_BACKGROUND) when the user switches apps or the screen goes off.
 * Reference-counted leases: the service runs while any lease is held and stops shortly
 * after the last is released. Web / desktop: a no-op.
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { translateActive } from '../../WfNewLocales';

interface ForegroundSyncPlugin {
  start(options: { title: string; text: string; channelName: string }): Promise<void>;
  update(options: { title: string; text: string; channelName: string }): Promise<void>;
  stop(): Promise<void>;
}

export interface CapForegroundSyncLease {
  /** Shows the progress text (already localized); pushed to the notification at a throttled rate. */
  update(text: string): void;
  /** Idempotent. */
  release(): void;
}

const nativeSync = registerPlugin<ForegroundSyncPlugin>('ForegroundSync');
const UPDATE_INTERVAL_MS = 2_000;
const STOP_DELAY_MS = 3_000;

const leases = new Set<{ text: string }>();
let running = false;
let queue: Promise<void> = Promise.resolve();
let latestText = '';
let lastPushAt = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function options(): { title: string; text: string; channelName: string } {
  return {
    title: translateActive('foregroundSync.title'),
    text: latestText || translateActive('foregroundSync.text'),
    channelName: translateActive('foregroundSync.channel'),
  };
}

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch(() => undefined);
}

function push(): void {
  pushTimer = null;
  lastPushAt = Date.now();
  if (!running) return;
  enqueue(() => nativeSync.update(options()));
}

function schedulePush(): void {
  if (!running || pushTimer) return;
  pushTimer = setTimeout(push, Math.max(0, UPDATE_INTERVAL_MS - (Date.now() - lastPushAt)));
}

function begin(): void {
  if (running) return;
  running = true;
  lastPushAt = Date.now();
  enqueue(async () => {
    try {
      await nativeSync.start(options());
    } catch {
      // Not allowed to start (permission, background start): the app resumes its runs on foreground.
      running = false;
    }
  });
}

function end(): void {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (leases.size > 0 || !running) return;
    running = false;
    latestText = '';
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    enqueue(() => nativeSync.stop());
  }, STOP_DELAY_MS);
}

const NOOP_LEASE: CapForegroundSyncLease = { update: () => undefined, release: () => undefined };

export function acquireForegroundSync(initialText = ''): CapForegroundSyncLease {
  if (!isNativeAppShell()) return NOOP_LEASE;
  const lease = { text: initialText };
  leases.add(lease);
  if (initialText) latestText = initialText;
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  begin();
  return {
    update: (text) => {
      if (!leases.has(lease) || text === lease.text) return;
      lease.text = text;
      latestText = text;
      schedulePush();
    },
    release: () => {
      if (!leases.delete(lease)) return;
      if (leases.size === 0) end();
    },
  };
}
