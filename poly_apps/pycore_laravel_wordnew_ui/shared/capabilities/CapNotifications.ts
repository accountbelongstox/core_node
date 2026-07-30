/* =============================================================================
 * CapNotifications — public, cross-platform LOCAL NOTIFICATIONS capability lib
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): a spaced-repetition vocabulary app needs to nudge the learner to
 *   review ("12 words are due"), keep a daily streak alive, and re-engage after
 *   a lapse. Falls back to the browser Notification API + a persisted scheduler.
 *
 * WHAT IT DOES
 *   - Permission lifecycle (check / request / ensure).
 *   - Schedule one-shot (at a Date / after N ms), DAILY at HH:MM, or on a fixed
 *     interval ('every') with an optional repeat count.
 *   - Tag-based scheduling: schedule/cancel by a stable string tag (the library
 *     maps tags <-> the numeric ids the plugin requires, persisted).
 *   - List/cancel pending; receive tap/action + delivery events.
 *   - High-level helpers: review reminder, daily study reminder, streak nudge,
 *     snooze.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/local-notifications (true OS scheduling, survives app
 *     being closed; Android channels supported).
 *   - Web: Notification API + a setTimeout scheduler whose queue is persisted to
 *     localStorage (fires while a tab is open; recurring re-arms). On the web
 *     build the plugin is aliased to that shim.
 *
 * QUICK START
 *   import { capNotify, useNotificationPermission } from
 *     '@/shared/capabilities/CapNotifications';
 *   await capNotify.ensurePermission();
 *   await capNotify.scheduleDaily('daily-review', { hour: 20, minute: 0 },
 *     { title: 'Time to review', body: '12 words are due' });
 *   await capNotify.scheduleReviewReminder(dueCount, 1000 * 60 * 60 * 4);
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapNotifyPermission = 'granted' | 'denied' | 'prompt' | 'unknown';
export type CapNotifyEvery = 'year' | 'month' | 'two-weeks' | 'week' | 'day' | 'hour' | 'minute' | 'second';

export interface CapNotifyContent {
  title: string;
  body?: string;
  /** Arbitrary payload echoed back on tap. */
  extra?: Record<string, unknown>;
  /** Android channel id (created on demand). */
  channelId?: string;
}

export interface CapNotifySchedule {
  /** Fire at an absolute time. */
  at?: Date;
  /** Fire after this many ms from now (alternative to `at`). */
  inMs?: number;
  /** Recurring interval. */
  every?: CapNotifyEvery;
  /** Max number of deliveries for an `every` schedule. */
  count?: number;
  /** Repeat the `at` time (e.g. same time daily) — native only. */
  repeats?: boolean;
  /** Allow firing in Doze mode (Android). */
  allowWhileIdle?: boolean;
}

export interface CapPendingNotification {
  id: number;
  tag?: string;
  title?: string;
  body?: string;
  schedule?: unknown;
  extra?: Record<string, unknown>;
}

export interface CapNotifyAction {
  actionId: string;
  tag?: string;
  notification: { id: number; title?: string; body?: string; extra?: Record<string, unknown> };
}

export interface CapNotifyChannel {
  id: string;
  name: string;
  description?: string;
  importance?: 1 | 2 | 3 | 4 | 5;
  sound?: string;
  vibration?: boolean;
}

// ---------------------------------------------------------------------------
// Tag <-> id registry (numeric ids are required by the plugin)
// ---------------------------------------------------------------------------

const TAG_MAP_KEY = 'cap_notify_tagmap';

function loadTagMap(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(TAG_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveTagMap(map: Record<string, number>): void {
  try {
    window.localStorage.setItem(TAG_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Stable 31-bit id for a tag (hash), so the same tag reuses the same id. */
function idForTag(tag: string): number {
  const map = loadTagMap();
  if (map[tag] != null) return map[tag];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  const id = Math.abs(h) % 2_000_000_000 || 1;
  map[tag] = id;
  saveTagMap(map);
  return id;
}

function tagForId(id: number): string | undefined {
  const map = loadTagMap();
  return Object.keys(map).find((t) => map[t] === id);
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function mapPerm(display: string | undefined): CapNotifyPermission {
  switch (display) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Date helpers (exported)
// ---------------------------------------------------------------------------

/** The next Date at the given local hour:minute (today if still ahead, else tomorrow). */
export function nextDailyTime(hour: number, minute: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Human "in 4h" / "at 20:00" label for a schedule (best-effort). */
export function describeSchedule(schedule: CapNotifySchedule): string {
  if (schedule.at) return `at ${schedule.at.toLocaleString()}`;
  if (schedule.inMs != null) {
    const min = Math.round(schedule.inMs / 60000);
    return min >= 60 ? `in ${Math.round(min / 60)}h` : `in ${min}m`;
  }
  if (schedule.every) return `every ${schedule.every}`;
  return 'soon';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapNotificationsService {
  private readonly native = safeIsNative();
  private permission: CapNotifyPermission = 'unknown';
  private wired = false;
  private actionHandle: { remove: () => Promise<void> } | null = null;
  private receivedHandle: { remove: () => Promise<void> } | null = null;
  private actionCbs = new Set<(a: CapNotifyAction) => void>();
  private receivedCbs = new Set<(n: CapPendingNotification) => void>();
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapNotifications] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  getPermission(): CapNotifyPermission {
    return this.permission;
  }

  /** Whether local notifications are available at all. */
  async isSupported(): Promise<boolean> {
    if (this.native) return true;
    try {
      return typeof window !== 'undefined' && 'Notification' in window;
    } catch {
      return false;
    }
  }

  async checkPermission(): Promise<CapNotifyPermission> {
    try {
      const r = await LocalNotifications.checkPermissions();
      this.permission = mapPerm((r as any).display);
    } catch {
      this.permission = 'unknown';
    }
    return this.permission;
  }

  async requestPermission(): Promise<CapNotifyPermission> {
    try {
      const r = await LocalNotifications.requestPermissions();
      this.permission = mapPerm((r as any).display);
    } catch {
      this.permission = 'denied';
    }
    return this.permission;
  }

  /** Ensure permission, prompting if needed. Returns true when granted. */
  async ensurePermission(): Promise<boolean> {
    let p = await this.checkPermission();
    if (p !== 'granted') p = await this.requestPermission();
    return p === 'granted';
  }

  // -- listeners ----------------------------------------------------------- #

  private async ensureListeners(): Promise<void> {
    if (this.wired) return;
    this.wired = true;
    try {
      this.actionHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (a: any) => {
        const id = a?.notification?.id;
        this.actionCbs.forEach((fn) =>
          fn({
            actionId: a?.actionId ?? 'tap',
            tag: typeof id === 'number' ? tagForId(id) : undefined,
            notification: {
              id,
              title: a?.notification?.title,
              body: a?.notification?.body,
              extra: a?.notification?.extra,
            },
          }),
        );
      });
      this.receivedHandle = await LocalNotifications.addListener('localNotificationReceived', (n: any) => {
        this.receivedCbs.forEach((fn) =>
          fn({ id: n?.id, tag: typeof n?.id === 'number' ? tagForId(n.id) : undefined, title: n?.title, body: n?.body, extra: n?.extra }),
        );
      });
    } catch (e) {
      this.log('addListener failed', e);
    }
  }

  /** Subscribe to notification taps/actions. Returns unsubscribe. */
  onAction(fn: (a: CapNotifyAction) => void): () => void {
    void this.ensureListeners();
    this.actionCbs.add(fn);
    return () => this.actionCbs.delete(fn);
  }

  /** Subscribe to delivery (foreground) events. Returns unsubscribe. */
  onReceived(fn: (n: CapPendingNotification) => void): () => void {
    void this.ensureListeners();
    this.receivedCbs.add(fn);
    return () => this.receivedCbs.delete(fn);
  }

  // -- channels (Android) -------------------------------------------------- #

  async createChannel(channel: CapNotifyChannel): Promise<void> {
    try {
      await (LocalNotifications as any).createChannel?.({
        id: channel.id,
        name: channel.name,
        description: channel.description ?? '',
        importance: channel.importance ?? 3,
        sound: channel.sound,
        vibration: channel.vibration ?? true,
      });
    } catch (e) {
      this.log('createChannel failed', e);
    }
  }

  // -- scheduling ---------------------------------------------------------- #

  /**
   * Schedule (or reschedule) a notification under a stable `tag`. Re-scheduling
   * the same tag replaces the previous one (the id is reused).
   */
  async schedule(tag: string, content: CapNotifyContent, schedule: CapNotifySchedule = {}): Promise<number> {
    if (!(await this.ensurePermission())) {
      this.log('permission not granted; skipping schedule for', tag);
      return -1;
    }
    await this.ensureListeners();
    const id = idForTag(tag);
    const at =
      schedule.at ?? (schedule.inMs != null ? new Date(Date.now() + Math.max(0, schedule.inMs)) : undefined);
    const sched: Record<string, unknown> = {};
    if (at) sched.at = at;
    if (schedule.repeats) sched.repeats = true;
    if (schedule.every) sched.every = schedule.every;
    if (schedule.count != null) sched.count = schedule.count;
    if (schedule.allowWhileIdle) sched.allowWhileIdle = true;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: content.title,
            body: content.body ?? '',
            ...(Object.keys(sched).length ? { schedule: sched } : {}),
            ...(content.channelId ? { channelId: content.channelId } : {}),
            extra: { ...(content.extra ?? {}), __tag: tag },
          } as any,
        ],
      });
      this.log('scheduled', tag, describeSchedule(schedule));
    } catch (e) {
      this.log('schedule failed', tag, e);
      return -1;
    }
    return id;
  }

  /** Fire a notification immediately (after a tiny delay). */
  notifyNow(tag: string, content: CapNotifyContent): Promise<number> {
    return this.schedule(tag, content, { inMs: 50 });
  }

  /** Schedule a recurring DAILY reminder at a local hour:minute. */
  async scheduleDaily(
    tag: string,
    time: { hour: number; minute: number },
    content: CapNotifyContent,
  ): Promise<number> {
    // Native: anchor to the next occurrence and repeat daily. Web shim: 'every day'.
    return this.schedule(tag, content, {
      at: nextDailyTime(time.hour, time.minute),
      repeats: true,
      every: 'day',
      allowWhileIdle: true,
    });
  }

  /** Cancel a scheduled notification by tag. */
  async cancel(tag: string): Promise<void> {
    const id = idForTag(tag);
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (e) {
      this.log('cancel failed', tag, e);
    }
  }

  /** Cancel several tags at once. */
  async cancelMany(tags: string[]): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: tags.map((t) => ({ id: idForTag(t) })) });
    } catch (e) {
      this.log('cancelMany failed', e);
    }
  }

  /** List currently pending notifications (with their tags resolved). */
  async getPending(): Promise<CapPendingNotification[]> {
    try {
      const r = await LocalNotifications.getPending();
      return ((r as any).notifications ?? []).map((n: any) => ({
        id: n.id,
        tag: (n.extra && n.extra.__tag) || tagForId(n.id),
        title: n.title,
        body: n.body,
        schedule: n.schedule,
        extra: n.extra,
      }));
    } catch {
      return [];
    }
  }

  /** Cancel ALL pending notifications. */
  async cancelAll(): Promise<void> {
    const pending = await this.getPending();
    if (pending.length) {
      try {
        await LocalNotifications.cancel({ notifications: pending.map((p) => ({ id: p.id })) });
      } catch (e) {
        this.log('cancelAll failed', e);
      }
    }
  }

  // -- high-level wordnew helpers ------------------------------------------ #

  /** "N words are due" reminder, fired after `delayMs` (default 4h). */
  scheduleReviewReminder(dueCount: number, delayMs = 4 * 3600_000): Promise<number> {
    const body =
      dueCount > 0 ? `${dueCount} word${dueCount === 1 ? '' : 's'} are ready to review.` : 'Keep your streak alive — review time!';
    return this.schedule('review-due', { title: 'WordNew review', body, extra: { kind: 'review', dueCount } }, { inMs: delayMs });
  }

  /** Daily study reminder at a chosen time (default 20:00). */
  scheduleDailyStudyReminder(hour = 20, minute = 0): Promise<number> {
    return this.scheduleDaily(
      'daily-study',
      { hour, minute },
      { title: 'Daily WordNew', body: 'A few minutes a day keeps the streak alive.', extra: { kind: 'daily' } },
    );
  }

  /** Re-engagement nudge if the user has been away (fire in `days`). */
  scheduleStreakNudge(days = 1): Promise<number> {
    return this.schedule(
      'streak-nudge',
      { title: "Don't lose your streak!", body: 'Come back and review a few words.', extra: { kind: 'streak' } },
      { inMs: days * 86_400_000 },
    );
  }

  /** Snooze: reschedule the review reminder for `minutes` from now. */
  snoozeReview(minutes = 30): Promise<number> {
    return this.schedule(
      'review-due',
      { title: 'WordNew review', body: 'Snoozed — ready when you are.', extra: { kind: 'review' } },
      { inMs: minutes * 60_000 },
    );
  }

  async dispose(): Promise<void> {
    try {
      await this.actionHandle?.remove();
      await this.receivedHandle?.remove();
    } catch {
      /* ignore */
    }
    this.actionHandle = null;
    this.receivedHandle = null;
    this.actionCbs.clear();
    this.receivedCbs.clear();
    this.wired = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capNotify = new CapNotificationsService();
export const scheduleReviewReminder = (dueCount: number, delayMs?: number): Promise<number> =>
  capNotify.scheduleReviewReminder(dueCount, delayMs);
export const scheduleDailyStudyReminder = (hour?: number, minute?: number): Promise<number> =>
  capNotify.scheduleDailyStudyReminder(hour, minute);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/** Track + request notification permission. */
export function useNotificationPermission(): {
  permission: CapNotifyPermission;
  request: () => Promise<void>;
} {
  const [permission, setPermission] = useState<CapNotifyPermission>(() => capNotify.getPermission());
  useEffect(() => {
    let mounted = true;
    void capNotify.checkPermission().then((p) => mounted && setPermission(p));
    return () => {
      mounted = false;
    };
  }, []);
  return {
    permission,
    request: async () => {
      setPermission(await capNotify.requestPermission());
    },
  };
}

/** Live pending-notifications list + a refresh, and tap-action subscription. */
export function useNotifications(onAction?: (a: CapNotifyAction) => void): {
  pending: CapPendingNotification[];
  refresh: () => Promise<void>;
} {
  const [pending, setPending] = useState<CapPendingNotification[]>([]);

  const refresh = async (): Promise<void> => {
    setPending(await capNotify.getPending());
  };

  useEffect(() => {
    void refresh();
    const offAction = onAction ? capNotify.onAction(onAction) : () => {};
    const offReceived = capNotify.onReceived(() => void refresh());
    return () => {
      offAction();
      offReceived();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pending, refresh };
}

// ===========================================================================
// EXTENDED CAPABILITIES — quiet hours, spaced-repetition planner, badges
// ===========================================================================
//
// Higher-level scheduling tuned to a spaced-repetition vocabulary app: avoid
// nudging the learner at night (quiet hours), schedule a whole SRS reminder
// ladder from a word's review intervals, and reflect the due count on the app
// icon badge.

export interface CapQuietHours {
  /** Start hour 0-23 (inclusive). */
  startHour: number;
  /** End hour 0-23 (exclusive). Wraps past midnight if end < start. */
  endHour: number;
}

let quietHours: CapQuietHours | null = null;

/** Configure a nightly quiet window during which reminders are shifted later. */
export function setQuietHours(hours: CapQuietHours | null): void {
  quietHours = hours;
}

/** Whether a given Date falls inside the configured quiet window. */
export function isInQuietHours(date: Date, hours: CapQuietHours | null = quietHours): boolean {
  if (!hours) return false;
  const h = date.getHours();
  if (hours.startHour <= hours.endHour) return h >= hours.startHour && h < hours.endHour;
  // Wraps midnight, e.g. 22 -> 7.
  return h >= hours.startHour || h < hours.endHour;
}

/** Shift a fire time out of the quiet window to the next allowed moment. */
export function avoidQuietHours(date: Date, hours: CapQuietHours | null = quietHours): Date {
  if (!hours || !isInQuietHours(date, hours)) return date;
  const shifted = new Date(date);
  shifted.setHours(hours.endHour, Math.floor(Math.random() * 15), 0, 0);
  if (shifted.getTime() <= date.getTime()) shifted.setDate(shifted.getDate() + 1);
  return shifted;
}

/** Default spaced-repetition reminder ladder, in HOURS from now. */
export const DEFAULT_SRS_INTERVALS_HOURS = [4, 24, 72, 168, 336];

export interface CapSrsReminderPlan {
  /** Tag prefix for the series (each step gets `${tagPrefix}-${i}`). */
  tagPrefix?: string;
  /** Intervals in hours from now. Default DEFAULT_SRS_INTERVALS_HOURS. */
  intervalsHours?: number[];
  /** Content factory per step (index, fireAt). */
  content?: (step: number, fireAt: Date) => CapNotifyContent;
}

/**
 * Schedule a whole spaced-repetition reminder ladder. Each step is shifted out
 * of quiet hours. Returns the ids scheduled. Re-call to reschedule (same tags).
 */
export async function scheduleSrsReminders(plan: CapSrsReminderPlan = {}): Promise<number[]> {
  const intervals = plan.intervalsHours ?? DEFAULT_SRS_INTERVALS_HOURS;
  const prefix = plan.tagPrefix ?? 'srs';
  const content =
    plan.content ??
    ((step: number) => ({
      title: 'WordNew review',
      body: step === 0 ? 'Fresh words are ready for their first review.' : 'Time to reinforce what you learned.',
      extra: { kind: 'srs', step },
    }));
  const ids: number[] = [];
  for (let i = 0; i < intervals.length; i++) {
    const fireAt = avoidQuietHours(new Date(Date.now() + intervals[i] * 3600_000));
    const id = await capNotify.schedule(`${prefix}-${i}`, content(i, fireAt), { at: fireAt });
    ids.push(id);
  }
  return ids;
}

/** Cancel a previously-scheduled SRS ladder. */
export async function cancelSrsReminders(tagPrefix = 'srs', steps = DEFAULT_SRS_INTERVALS_HOURS.length): Promise<void> {
  await capNotify.cancelMany(Array.from({ length: steps }, (_, i) => `${tagPrefix}-${i}`));
}

/** Schedule a WEEKLY reminder on a given weekday (0=Sun) at hour:minute. */
export async function scheduleWeekly(
  tag: string,
  weekday: number,
  time: { hour: number; minute: number },
  content: CapNotifyContent,
): Promise<number> {
  const now = new Date();
  const target = new Date(now);
  target.setHours(time.hour, time.minute, 0, 0);
  const dayDiff = (weekday - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + (dayDiff === 0 && target <= now ? 7 : dayDiff));
  return capNotify.schedule(tag, content, { at: avoidQuietHours(target), every: 'week', repeats: true });
}

// ---------------------------------------------------------------------------
// App icon badge (Badging API on web; iOS via notifications natively)
// ---------------------------------------------------------------------------

/** Set the app-icon badge count (web Badging API; best-effort). */
export async function setAppBadge(count: number): Promise<void> {
  try {
    const nav = navigator as any;
    if (count > 0 && typeof nav?.setAppBadge === 'function') await nav.setAppBadge(count);
    else if (typeof nav?.clearAppBadge === 'function') await nav.clearAppBadge();
  } catch {
    /* unsupported */
  }
}

/** Clear the app-icon badge. */
export async function clearAppBadge(): Promise<void> {
  try {
    const nav = navigator as any;
    if (typeof nav?.clearAppBadge === 'function') await nav.clearAppBadge();
  } catch {
    /* unsupported */
  }
}

// ---------------------------------------------------------------------------
// Extended React hook
// ---------------------------------------------------------------------------

/**
 * Keep an SRS reminder ladder + badge in sync with the live due-count. Call
 * `sync(dueCount)` whenever the count changes (e.g. after a review session).
 */
export function useReviewReminders(): {
  permission: CapNotifyPermission;
  sync: (dueCount: number) => Promise<void>;
  clear: () => Promise<void>;
} {
  const [permission, setPermission] = useState<CapNotifyPermission>(() => capNotify.getPermission());

  useEffect(() => {
    let mounted = true;
    void capNotify.checkPermission().then((p) => mounted && setPermission(p));
    return () => {
      mounted = false;
    };
  }, []);

  const sync = async (dueCount: number): Promise<void> => {
    await setAppBadge(dueCount);
    const granted = await capNotify.ensurePermission();
    setPermission(capNotify.getPermission());
    if (!granted) return;
    if (dueCount > 0) {
      await capNotify.scheduleReviewReminder(dueCount);
    } else {
      await capNotify.cancel('review-due');
    }
  };

  const clear = async (): Promise<void> => {
    await clearAppBadge();
    await capNotify.cancel('review-due');
    await cancelSrsReminders();
  };

  return { permission, sync, clear };
}

// ===========================================================================
// EXTENDED CAPABILITIES — action buttons, rotating copy, delivered mgmt
// ===========================================================================
//
// Interactive notification buttons (native), a rotating set of motivational
// reminder messages so the daily nudge doesn't feel robotic, and helpers to
// manage already-delivered notifications.

export interface CapNotifyActionType {
  id: string;
  actions: Array<{ id: string; title: string; destructive?: boolean; input?: boolean }>;
}

/** Register interactive action button types (native only; web no-op). */
export async function registerActionTypes(types: CapNotifyActionType[]): Promise<void> {
  try {
    await (LocalNotifications as any).registerActionTypes?.({ types });
  } catch {
    /* web / unsupported */
  }
}

/** Clear all already-delivered notifications from the tray. */
export async function clearDelivered(): Promise<void> {
  try {
    await (LocalNotifications as any).removeAllDeliveredNotifications?.();
  } catch {
    /* ignore */
  }
}

/** A small rotating set of motivational reminder bodies. */
export const MOTIVATION_MESSAGES: string[] = [
  'A few minutes now keeps your streak alive. 🔥',
  'Your future self will thank you — review time!',
  'Small daily reps beat cramming. Ready?',
  'New words are waiting to become old friends.',
  "Don't break the chain — a quick session awaits.",
  'Consistency compounds. One more day! 💪',
  'Five minutes of review > zero. Let’s go.',
];

/** Deterministically pick a message for a given day (rotates daily). */
export function messageForToday(messages: string[] = MOTIVATION_MESSAGES, day: Date = new Date()): string {
  const epochDay = Math.floor(day.getTime() / 86_400_000);
  return messages[epochDay % messages.length] || messages[0];
}

/**
 * Schedule the daily study reminder using today's rotating message. Re-call
 * once per day (e.g. on app open) to refresh the copy.
 */
export function scheduleDailyRotating(hour = 20, minute = 0): Promise<number> {
  return capNotify.scheduleDaily(
    'daily-study',
    { hour, minute },
    { title: 'Daily WordNew', body: messageForToday(), extra: { kind: 'daily' } },
  );
}

// ---------------------------------------------------------------------------
// Persisted daily-reminder setting
// ---------------------------------------------------------------------------

const DAILY_SETTING_KEY = 'cap_notify_daily_setting';

export interface CapDailyReminderSetting {
  enabled: boolean;
  hour: number;
  minute: number;
}

function loadDailySetting(): CapDailyReminderSetting {
  try {
    const raw = window.localStorage.getItem(DAILY_SETTING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { enabled: false, hour: 20, minute: 0 };
}
function saveDailySetting(s: CapDailyReminderSetting): void {
  try {
    window.localStorage.setItem(DAILY_SETTING_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Extended React hook — daily reminder toggle + time (persisted)
// ---------------------------------------------------------------------------

/**
 * A Settings-ready daily reminder control: persisted enable + time, that
 * (re)schedules or cancels the OS notification as the user changes it.
 *
 *   const { enabled, hour, minute, setEnabled, setTime } = useDailyReminder();
 */
export function useDailyReminder(): {
  enabled: boolean;
  hour: number;
  minute: number;
  setEnabled: (v: boolean) => Promise<void>;
  setTime: (hour: number, minute: number) => Promise<void>;
} {
  const [setting, setSetting] = useState<CapDailyReminderSetting>(() => loadDailySetting());

  const apply = async (next: CapDailyReminderSetting): Promise<void> => {
    setSetting(next);
    saveDailySetting(next);
    if (next.enabled) {
      const ok = await capNotify.ensurePermission();
      if (ok) await scheduleDailyRotating(next.hour, next.minute);
    } else {
      await capNotify.cancel('daily-study');
    }
  };

  return {
    enabled: setting.enabled,
    hour: setting.hour,
    minute: setting.minute,
    setEnabled: (v: boolean) => apply({ ...setting, enabled: v }),
    setTime: (hour: number, minute: number) => apply({ ...setting, hour, minute }),
  };
}

export default capNotify;
