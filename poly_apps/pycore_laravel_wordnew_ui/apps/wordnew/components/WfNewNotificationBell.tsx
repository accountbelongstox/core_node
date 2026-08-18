import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, UserPlus, MessageSquare, UserCheck, Trophy, Sparkles, CheckCheck } from 'lucide-react';
import { wfNewApi, subscribeSocial, type WfNewNotification } from '../api';

interface WfNewNotificationBellProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  onOpenSocial: () => void;
}

// ---- Relative-time helper (native Intl, no third-party dep) ----------------
const RTF = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

function relativeTime(value?: string | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return String(value);
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  if (!RTF) return new Date(then).toLocaleString();
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (abs < min) return RTF.format(Math.round(diffMs / 1000), 'second');
  if (abs < hr) return RTF.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return RTF.format(Math.round(diffMs / hr), 'hour');
  if (abs < day * 30) return RTF.format(Math.round(diffMs / day), 'day');
  return new Date(then).toLocaleDateString();
}

function iconFor(type: string) {
  if (type.startsWith('friend.request')) return UserPlus;
  if (type.startsWith('friend.accept')) return UserCheck;
  if (type.startsWith('message')) return MessageSquare;
  if (type.startsWith('leaderboard') || type.startsWith('achievement')) return Trophy;
  return Sparkles;
}

export const WfNewNotificationBell: React.FC<WfNewNotificationBellProps> = ({ trans, addToast, onOpenSocial }) => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<WfNewNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Mirror `open` so the notification.new subscription reads the latest value
  // without re-subscribing on every toggle.
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  // A human label for a notification, derived from type/payload, with a locale
  // fallback chain: a specific notif.<type> key → the raw payload message → type.
  const labelFor = useCallback((n: WfNewNotification): string => {
    const key = `notif.type.${n.type}`;
    const localized = trans(key);
    if (localized && localized !== key) return localized;
    const payloadMsg = n.payload && (n.payload.message || n.payload.title || n.payload.body);
    if (typeof payloadMsg === 'string' && payloadMsg) return payloadMsg;
    return n.type;
  }, [trans]);

  const refreshCount = useCallback(() => {
    wfNewApi.getUnreadCount().then(setUnread).catch(() => setUnread(0));
  }, []);

  const loadList = useCallback(() => {
    setLoading(true);
    wfNewApi.getNotifications()
      .then(page => setItems(Array.isArray(page?.notifications) ? page.notifications : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Initial unread count + live "notification.new" updates. The push payload is
  // PARTIAL ({ id, type, _id } only — no created_at/payload), so we never prepend
  // it as a full row (that rendered blank notifications). Instead just bump the
  // unread badge; if the dropdown is open, refetch the full rows so the new one
  // shows complete. The next dropdown-open also loads the authoritative list.
  useEffect(() => {
    refreshCount();
    const unsub = subscribeSocial('notification.new', () => {
      refreshCount();
      if (openRef.current) loadList();
    });
    return unsub;
  }, [refreshCount, loadList]);

  // Load the list whenever the dropdown opens.
  useEffect(() => { if (open) loadList(); }, [open, loadList]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleMarkAll = useCallback(() => {
    wfNewApi.markNotificationRead('all')
      .then(() => {
        setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        setUnread(0);
        addToast(trans('notif.allRead'), 'success');
      })
      .catch(() => addToast(trans('notif.actionFailed'), 'warning'));
  }, [addToast, trans]);

  const handleRowClick = useCallback((n: WfNewNotification) => {
    if (!n.read_at) {
      wfNewApi.markNotificationRead(n.id).catch(() => {});
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread(c => Math.max(0, c - 1));
    }
    setOpen(false);
    onOpenSocial();
  }, [onOpenSocial]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2.5 rounded-full border bg-white/5 hover:bg-white/10 transition-all text-zinc-300 cursor-pointer ${
          open ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-white/5'
        }`}
        title={trans('notif.title')}
        aria-label={trans('notif.title')}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold font-mono">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-xs font-black font-mono uppercase tracking-widest text-slate-200">
                {trans('notif.title')}
              </span>
              {items.some(n => !n.read_at) && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {trans('notif.markAll')}
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <p className="py-10 text-center text-zinc-500 font-mono text-[10px]">{trans('notif.loading')}</p>
              )}
              {!loading && items.length === 0 && (
                <p className="py-10 text-center text-zinc-500 font-mono text-[10px]">{trans('notif.empty')}</p>
              )}
              {!loading && items.map(n => {
                const Icon = iconFor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleRowClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer ${
                      n.read_at ? '' : 'bg-indigo-500/5'
                    }`}
                  >
                    <span className={`p-2 rounded-xl shrink-0 ${n.read_at ? 'bg-white/5 text-zinc-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 leading-snug break-words">{labelFor(n)}</p>
                      <span className="text-[9px] text-zinc-500 font-mono">{relativeTime(n.created_at)}</span>
                    </div>
                    {!n.read_at && <span className="mt-1 w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
