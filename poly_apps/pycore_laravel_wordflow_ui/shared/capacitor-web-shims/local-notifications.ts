/**
 * Web shim for @capacitor/local-notifications.
 *
 * Backs the Capacitor LocalNotifications plugin with the browser Notification
 * API + a setTimeout-based scheduler whose pending queue is persisted to
 * localStorage (so it survives reloads within the session). Recurring schedules
 * ('every') re-arm themselves on fire. Aliased on the web build (vite.config).
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build) —
 * e.g. spaced-repetition review reminders — with this browser fallback.
 */

export interface LocalNotificationSchema {
  id: number;
  title: string;
  body?: string;
  schedule?: {
    at?: Date | string;
    repeats?: boolean;
    every?: 'year' | 'month' | 'two-weeks' | 'week' | 'day' | 'hour' | 'minute' | 'second';
    count?: number;
  };
  extra?: any;
  channelId?: string;
}

export interface PendingResult {
  notifications: Array<{ id: number; title?: string; body?: string; schedule?: any; extra?: any }>;
}
export interface PermissionStatus {
  display: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}
export type PluginListenerHandle = { remove: () => Promise<void> };

const STORE_KEY = '__cap_web_local_notifications__';
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const actionListeners = new Set<(n: any) => void>();
const receivedListeners = new Set<(n: any) => void>();

const EVERY_MS: Record<string, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  'two-weeks': 1_209_600_000,
  month: 2_592_000_000,
  year: 31_536_000_000,
};

interface Stored {
  schema: LocalNotificationSchema;
  fireAt: number;
  firedCount: number;
}

function loadStore(): Record<string, Stored> {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveStore(store: Record<string, Stored>): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function permission(): PermissionStatus['display'] {
  try {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

function fire(stored: Stored): void {
  const { schema } = stored;
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(schema.title, { body: schema.body, tag: String(schema.id), data: schema.extra });
      n.onclick = () => {
        actionListeners.forEach((fn) =>
          fn({ actionId: 'tap', notification: { id: schema.id, title: schema.title, body: schema.body, extra: schema.extra } }),
        );
      };
    }
  } catch {
    /* ignore */
  }
  receivedListeners.forEach((fn) =>
    fn({ id: schema.id, title: schema.title, body: schema.body, extra: schema.extra }),
  );

  // Recurring re-arm.
  const every = schema.schedule?.every;
  const store = loadStore();
  if (every && EVERY_MS[every]) {
    stored.firedCount += 1;
    const limit = schema.schedule?.count ?? Infinity;
    if (stored.firedCount < limit) {
      stored.fireAt = Date.now() + EVERY_MS[every];
      store[String(schema.id)] = stored;
      saveStore(store);
      arm(stored);
      return;
    }
  }
  delete store[String(schema.id)];
  saveStore(store);
  timers.delete(schema.id);
}

function arm(stored: Stored): void {
  const delay = Math.max(0, stored.fireAt - Date.now());
  const existing = timers.get(stored.schema.id);
  if (existing) clearTimeout(existing);
  // setTimeout max ~24.8 days; clamp and re-check.
  const clamped = Math.min(delay, 2_000_000_000);
  timers.set(
    stored.schema.id,
    setTimeout(() => {
      if (Date.now() >= stored.fireAt) fire(stored);
      else arm(stored);
    }, clamped),
  );
}

export const LocalNotifications = {
  async checkPermissions(): Promise<PermissionStatus> {
    return { display: permission() };
  },
  async requestPermissions(): Promise<PermissionStatus> {
    try {
      if (typeof Notification === 'undefined') return { display: 'denied' };
      const res = await Notification.requestPermission();
      return { display: res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'prompt' };
    } catch {
      return { display: 'denied' };
    }
  },
  async schedule(options: { notifications: LocalNotificationSchema[] }): Promise<{ notifications: Array<{ id: number }> }> {
    const store = loadStore();
    for (const schema of options.notifications) {
      const at = schema.schedule?.at ? new Date(schema.schedule.at).getTime() : Date.now() + 50;
      const stored: Stored = { schema, fireAt: at, firedCount: 0 };
      store[String(schema.id)] = stored;
      arm(stored);
    }
    saveStore(store);
    return { notifications: options.notifications.map((n) => ({ id: n.id })) };
  },
  async cancel(options: { notifications: Array<{ id: number }> }): Promise<void> {
    const store = loadStore();
    for (const { id } of options.notifications) {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
      delete store[String(id)];
    }
    saveStore(store);
  },
  async getPending(): Promise<PendingResult> {
    const store = loadStore();
    return {
      notifications: Object.values(store).map((s) => ({
        id: s.schema.id,
        title: s.schema.title,
        body: s.schema.body,
        schedule: s.schema.schedule,
        extra: s.schema.extra,
      })),
    };
  },
  async removeAllDeliveredNotifications(): Promise<void> {
    /* browser notifications self-dismiss; nothing tracked */
  },
  async createChannel(): Promise<void> {
    /* channels are Android-only; no-op on web */
  },
  async deleteChannel(): Promise<void> {
    /* no-op */
  },
  async listChannels(): Promise<{ channels: any[] }> {
    return { channels: [] };
  },
  async addListener(
    eventName: 'localNotificationReceived' | 'localNotificationActionPerformed',
    cb: (n: any) => void,
  ): Promise<PluginListenerHandle> {
    if (eventName === 'localNotificationActionPerformed') actionListeners.add(cb);
    else receivedListeners.add(cb);
    return {
      remove: async () => {
        actionListeners.delete(cb);
        receivedListeners.delete(cb);
      },
    };
  },
  async removeAllListeners(): Promise<void> {
    actionListeners.clear();
    receivedListeners.clear();
  },
};

// Re-arm any persisted notifications from a previous load.
try {
  if (typeof window !== 'undefined') {
    const store = loadStore();
    for (const stored of Object.values(store)) arm(stored);
  }
} catch {
  /* ignore */
}

export default { LocalNotifications };
