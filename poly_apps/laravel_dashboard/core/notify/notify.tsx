/**
 * Global notification (toast) system for the unified shell.
 *
 * Self-contained, desktop-grade implementation (no third-party toast lib):
 * frosted-glass cards stacked top-right, severity icon chip, optional bold
 * title + action buttons, auto-dismiss with pause-on-hover, slide+fade
 * animations. Rendered through the dashboard's shared <Portal/> and the
 * OVERLAY_Z stacking scale so toasts always sit above feature modals and
 * auth dialogs, regardless of where they were raised from.
 *
 * Theme: neutral glass surfaces (white/slate translucency + backdrop-blur)
 * keyed off the global `.dark` class, so cards look right under every end
 * theme (nexus / pycore / iris). Severity accents are universal: success
 * emerald, error rose, info indigo, warning amber.
 *
 * Usage anywhere (string API is 100% back-compat):
 *   import { notify } from '../../core/notify/notify';
 *   notify.success('Welcome back');
 *   notify.error('Invalid credentials');
 *   notify.info({ title: 'Sync finished', message: '42 new words added' });
 *   notify.warning('Quota low', {
 *     title: 'Heads up',
 *     actions: [{ label: 'Open settings', onClick: () => nav('/settings') }],
 *   });
 *   const id = notify.loading('Uploading…'); notify.dismiss(id);
 *   await notify.promise(p, { loading: '…', success: 'Done', error: 'Failed' });
 *
 * Mount <AppToaster/> exactly ONCE at the shell root (done in ShellApp).
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import Portal from '../../components/shared/Portal';
import { OVERLAY_Z } from '../../styles/overlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotifySeverity = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';

export interface NotifyAction {
  label: string;
  /** Clicking an action also dismisses the toast. */
  onClick: () => void;
}

export interface NotifyOptions {
  /** Reuse an id to update an existing toast in place (used by promise()). */
  id?: string | number;
  /** Bold headline. Omitted → compact message-only card (legacy behavior). */
  title?: string;
  /** Ghost action buttons rendered under the message. */
  actions?: NotifyAction[];
  /** Auto-dismiss in ms. Default 4000 (errors 6000). Infinity = sticky. */
  duration?: number;
}

/** Either a plain message string or an object form carrying title/actions. */
export type NotifyInput = string | ({ message: string } & NotifyOptions);

interface ToastItem {
  id: string | number;
  /** Bumped on in-place updates so timers/animations reset. */
  rev: number;
  severity: NotifySeverity;
  title?: string;
  message: string;
  actions?: NotifyAction[];
  duration: number;
  leaving: boolean;
}

// ---------------------------------------------------------------------------
// Store (module-level, consumed via useSyncExternalStore)
// ---------------------------------------------------------------------------

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;
const EXIT_MS = 240;
const MAX_VISIBLE = 4;

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const exitTimers = new Map<string | number, ReturnType<typeof setTimeout>>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => toasts;

function defaultDuration(severity: NotifySeverity): number {
  if (severity === 'loading') return Infinity;
  if (severity === 'error') return ERROR_DURATION;
  return DEFAULT_DURATION;
}

/** Create a toast, or update an existing one in place when opts.id matches. */
function push(severity: NotifySeverity, input: NotifyInput, opts?: NotifyOptions): string | number {
  const o: { message: string } & NotifyOptions =
    typeof input === 'string' ? { message: input, ...(opts ?? {}) } : { ...input, ...(opts ?? {}) };
  const id = o.id ?? ++seq;
  const existing = toasts.find((t) => t.id === id);
  const item: ToastItem = {
    id,
    rev: (existing?.rev ?? 0) + 1,
    severity,
    title: o.title,
    message: o.message,
    actions: o.actions,
    duration: o.duration ?? defaultDuration(severity),
    leaving: false,
  };
  if (existing) {
    // Cancel a pending removal (e.g. promise resolving mid-exit) and morph.
    const pending = exitTimers.get(id);
    if (pending) {
      clearTimeout(pending);
      exitTimers.delete(id);
    }
    toasts = toasts.map((t) => (t.id === id ? item : t));
  } else {
    toasts = [item, ...toasts]; // newest on top
  }
  emit();
  return id;
}

/** Phase 1: flag as leaving (plays exit animation). Phase 2: remove. */
function startExit(id: string | number): void {
  const target = toasts.find((t) => t.id === id && !t.leaving);
  if (!target) return;
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  exitTimers.set(
    id,
    setTimeout(() => {
      exitTimers.delete(id);
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    }, EXIT_MS)
  );
}

function dismiss(id?: string | number): void {
  if (id === undefined) {
    toasts.filter((t) => !t.leaving).forEach((t) => startExit(t.id));
    return;
  }
  startExit(id);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Unified toast API. String calls render the same compact card as before. */
export const notify = {
  success: (input: NotifyInput, opts?: NotifyOptions) => push('success', input, opts),
  error: (input: NotifyInput, opts?: NotifyOptions) => push('error', input, opts),
  warning: (input: NotifyInput, opts?: NotifyOptions) => push('warning', input, opts),
  info: (input: NotifyInput, opts?: NotifyOptions) => push('info', input, opts),
  message: (input: NotifyInput, opts?: NotifyOptions) => push('default', input, opts),
  /** Returns the toast id; pass it to dismiss() to clear the spinner. */
  loading: (input: NotifyInput, opts?: NotifyOptions) => push('loading', input, opts),
  /** Loading → success/error driven by a promise. */
  promise: <T,>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ): Promise<T> => {
    const id = push('loading', msgs.loading);
    promise.then(
      (data) => push('success', { id, message: typeof msgs.success === 'function' ? msgs.success(data) : msgs.success }),
      (err) => push('error', { id, message: typeof msgs.error === 'function' ? msgs.error(err) : msgs.error })
    );
    return promise;
  },
  dismiss: (id?: string | number) => dismiss(id),
};

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<
  NotifySeverity,
  { Icon: React.ComponentType<{ className?: string }>; chip: string; action: string; spin?: boolean }
> = {
  success: {
    Icon: CheckCircle2,
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    action: 'text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400',
  },
  error: {
    Icon: XCircle,
    chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    action: 'text-rose-700 hover:bg-rose-500/10 dark:text-rose-400',
  },
  warning: {
    Icon: AlertTriangle,
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    action: 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  },
  info: {
    Icon: Info,
    chip: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    action: 'text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-400',
  },
  loading: {
    Icon: Loader2,
    chip: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    action: 'text-slate-700 hover:bg-slate-500/10 dark:text-slate-300',
    spin: true,
  },
  default: {
    Icon: Info,
    chip: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    action: 'text-slate-700 hover:bg-slate-500/10 dark:text-slate-300',
  },
};

const ToastCard: React.FC<{ item: ToastItem; paused: boolean }> = ({ item, paused }) => {
  const { Icon, chip, action, spin } = SEVERITY_STYLE[item.severity];

  // Enter animation: mount off-screen, flip to in-place on the next frame.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss with pause-on-hover: track remaining time across pauses.
  const remainingRef = useRef(item.duration);
  const startedAtRef = useRef(0);
  useEffect(() => {
    // In-place update (rev bump, e.g. promise loading → success): restart clock.
    remainingRef.current = item.duration;
  }, [item.rev, item.duration]);
  useEffect(() => {
    if (!Number.isFinite(item.duration) || paused || item.leaving) return;
    startedAtRef.current = Date.now();
    const handle = setTimeout(() => startExit(item.id), remainingRef.current);
    return () => {
      clearTimeout(handle);
      remainingRef.current = Math.max(300, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [paused, item.leaving, item.rev, item.duration, item.id]);

  const shown = entered && !item.leaving;

  return (
    <div
      role={item.severity === 'error' || item.severity === 'warning' ? 'alert' : 'status'}
      className={
        'pointer-events-auto w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl ' +
        // Frosted glass surface — neutral so it works under every end theme.
        'border border-slate-900/10 bg-white/80 backdrop-blur-xl ' +
        'dark:border-white/10 dark:bg-slate-900/75 ' +
        // Layered shadow: soft large ambient + tight contact.
        'shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.10)] ' +
        'dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)] ' +
        // Slide + fade in/out.
        'transition-all duration-300 ease-out ' +
        (shown ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-6 opacity-0 scale-[0.98]')
      }
    >
      <div className="flex items-start gap-3 p-4">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${chip}`}>
          <Icon className={`h-[18px] w-[18px]${spin ? ' animate-spin' : ''}`} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          {item.title ? (
            <>
              <div className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-50">{item.title}</div>
              <div className="mt-0.5 break-words text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                {item.message}
              </div>
            </>
          ) : (
            // Message-only card — matches the legacy string-only API.
            <div className="break-words text-sm font-medium leading-5 text-slate-800 dark:text-slate-100">
              {item.message}
            </div>
          )}
          {item.actions && item.actions.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {item.actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${action}`}
                  onClick={() => {
                    try {
                      a.onClick();
                    } finally {
                      startExit(item.id);
                    }
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="-m-1 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
          onClick={() => startExit(item.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * The single, globally-mounted toast viewport: a fixed top-right stack,
 * newest on top, at most MAX_VISIBLE cards (older ones queue behind).
 * Portaled to <body> via the shared Portal so no ancestor transform/overflow
 * can clip it; OVERLAY_Z.toast keeps it above modals and login dialogs.
 */
export const AppToaster: React.FC = () => {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [paused, setPaused] = useState(false);
  if (items.length === 0) return null;
  return (
    <Portal lockScroll={false}>
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className={`pointer-events-none fixed right-4 top-4 flex flex-col items-end gap-2.5 ${OVERLAY_Z.toast}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {items.slice(0, MAX_VISIBLE).map((t) => (
          <ToastCard key={t.id} item={t} paused={paused} />
        ))}
      </div>
    </Portal>
  );
};

export default AppToaster;
