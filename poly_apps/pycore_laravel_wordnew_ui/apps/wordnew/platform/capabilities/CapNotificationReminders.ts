/** Reminder planning, badges, action types, and reminder React hooks. */
import { useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { capNotify } from './CapNotificationsCore';
import type { CapNotifyContent, CapNotifyPermission } from './CapNotificationsCore';
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


