import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, Users, Send, Loader2, ExternalLink, Plus, X,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { mediaUrl } from '../../../config/constants';
import {
  wfNewApi,
  subscribeSocial,
  type WfNewLive,
  type WfNewLiveMsg,
} from '../api';
import { WfNewActorAvatar, wfNewRelativeTime, wfNewEmbedUrl } from './WfNewSocialPlaza';

interface WfNewSocialLiveProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  /** Open the dedicated live-room page for a session (router navigation). */
  onOpenRoom?: (live: WfNewLive) => void;
}

/** Live session LIST (the page body for #/social/live). Tapping a card → room. */
export const WfNewSocialLive: React.FC<WfNewSocialLiveProps> = ({
  trans, addToast, isLoggedIn, requireAuth, onOpenRoom,
}) => {
  const [sessions, setSessions] = useState<WfNewLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [selectedLive, setSelectedLive] = useState<WfNewLive | null>(null);

  const openRoom = useCallback((live: WfNewLive) => {
    if (!isLoggedIn) { requireAuth(); return; }
    if (onOpenRoom) onOpenRoom(live);
    else setSelectedLive(live);
  }, [isLoggedIn, requireAuth, onOpenRoom]);

  const load = useCallback(() => {
    if (!isLoggedIn) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    wfNewApi.getLiveSessions('live')
      .then(rows => setSessions(rows))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { load(); }, [load]);

  // SSE: a new live session appears at the top of the list.
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = subscribeSocial('live.started', () => { load(); });
    return () => { unsub(); };
  }, [load, isLoggedIn]);

  if (selectedLive) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedLive(null)} className="text-xs font-mono text-zinc-400 hover:text-white cursor-pointer">
          ← Back
        </button>
        <WfNewSocialLiveRoom live={selectedLive} trans={trans} addToast={addToast} isLoggedIn={isLoggedIn} requireAuth={requireAuth} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black font-mono tracking-widest text-rose-400 uppercase flex items-center gap-1.5">
          <Radio className="w-4 h-4" /> {trans('social.liveTitle')}
        </h4>
        <button
          onClick={() => { if (!isLoggedIn) { requireAuth(); return; } setGoLiveOpen(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 text-white text-[11px] font-bold font-mono transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> {trans('social.goLive')}
        </button>
      </div>

      {loading && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>
      )}
      {!loading && sessions.length === 0 && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.liveEmpty')}</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sessions.map(live => (
            <motion.button
              layout
              key={live.id}
              onClick={() => openRoom(live)}
              className="text-left rounded-2xl bg-white/3 border border-white/5 hover:border-rose-500/30 overflow-hidden transition-all cursor-pointer group"
            >
              <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                {live.cover_url
                  ? <img src={mediaUrl(live.cover_url)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <div className="w-full h-full bg-gradient-to-br from-rose-950/40 to-indigo-950/40 flex items-center justify-center"><Radio className="w-10 h-10 text-rose-400/50" /></div>}
                <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black font-mono uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {trans('social.live.badge')}
                </span>
                <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-mono">
                  <Users className="w-3 h-3" /> {live.viewer_count}
                </span>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-xs font-bold text-slate-200 line-clamp-2">{live.title}</p>
                <div className="flex items-center gap-2">
                  <WfNewActorAvatar actor={live.host} size="w-6 h-6" />
                  <span className="text-[10px] text-zinc-400 font-mono truncate">{live.host.name}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {goLiveOpen && (
        <WfNewGoLiveModal
          onClose={() => setGoLiveOpen(false)}
          onStarted={(live) => { setGoLiveOpen(false); openRoom(live); }}
          trans={trans}
          addToast={addToast}
        />
      )}
    </div>
  );
};

// ---- Live room body (iframe embed + chat + heartbeat) ----------------------
// Exported so the dedicated #/social/live/<id> page renders it. Accepts EITHER a
// loaded `live` object (fast path from the list) or just a `liveId` (deep-link),
// in which case it fetches the session itself.
interface WfNewSocialLiveRoomProps {
  live?: WfNewLive | null;
  liveId?: number;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

export const WfNewSocialLiveRoom: React.FC<WfNewSocialLiveRoomProps> = ({
  live: liveProp, liveId, trans, addToast, isLoggedIn, requireAuth,
}) => {
  const [live, setLive] = useState<WfNewLive | null>(liveProp ?? null);
  const [resolving, setResolving] = useState(!liveProp);
  const [messages, setMessages] = useState<WfNewLiveMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [viewerCount, setViewerCount] = useState(liveProp?.viewer_count ?? 0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Deep-link path: resolve the session from the list by id when no object given.
  useEffect(() => {
    if (!isLoggedIn) { setResolving(false); return; }
    if (liveProp) { setLive(liveProp); setViewerCount(liveProp.viewer_count); setResolving(false); return; }
    const id = liveId ?? 0;
    if (!id) { setResolving(false); return; }
    let alive = true;
    setResolving(true);
    wfNewApi.getLiveSessions('all')
      .then(rows => {
        if (!alive) return;
        const found = rows.find(r => r.id === id) ?? null;
        setLive(found);
        setViewerCount(found?.viewer_count ?? 0);
      })
      .catch(() => { if (alive) setLive(null); })
      .finally(() => { if (alive) setResolving(false); });
    return () => { alive = false; };
  }, [liveProp, liveId, isLoggedIn]);

  const roomId = live?.id ?? 0;

  // Load initial chat.
  useEffect(() => {
    if (!isLoggedIn || !roomId) return;
    let alive = true;
    wfNewApi.getLiveChat(roomId)
      .then(page => { if (alive) setMessages(page.items); })
      .catch(() => { if (alive) setMessages([]); });
    return () => { alive = false; };
  }, [roomId, isLoggedIn]);

  // Viewer heartbeat every 20s → keep viewer_count fresh.
  useEffect(() => {
    if (!isLoggedIn || !roomId) return;
    let alive = true;
    const beat = () => {
      wfNewApi.liveHeartbeat(roomId)
        .then(count => { if (alive) setViewerCount(count); })
        .catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 20000);
    return () => { alive = false; clearInterval(interval); };
  }, [roomId, isLoggedIn]);

  // SSE: inbound live-chat messages for THIS room.
  useEffect(() => {
    if (!isLoggedIn || !roomId) return;
    const unsub = subscribeSocial('live.chat.new', (payload: any) => {
      const room = Number(payload?.live_id ?? payload?.message?.live_id);
      if (room !== roomId) return;
      const raw = payload?.message ?? payload;
      const msg: WfNewLiveMsg = {
        id: Number(raw?.id ?? 0),
        user: { id: Number(raw?.user?.id ?? 0), name: raw?.user?.name ?? raw?.user?.nickname ?? '', avatar_url: raw?.user?.avatar_url ?? raw?.user?.avatar ?? '' },
        body: raw?.body ?? '',
        created_at: raw?.created_at ?? new Date().toISOString(),
      };
      if (!msg.id) return;
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => { unsub(); };
  }, [roomId, isLoggedIn]);

  // Auto-scroll chat to the bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) { requireAuth(); return; }
    const body = draft.trim();
    if (!body || !roomId) return;
    setDraft('');
    wfNewApi.sendLiveChat(roomId, body)
      .then(msg => setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg])))
      .catch(() => addToast(trans('social.actionFailed'), 'warning'));
  }, [draft, isLoggedIn, requireAuth, roomId, addToast, trans]);

  if (!isLoggedIn) {
    return <button onClick={requireAuth} className="w-full py-16 text-center text-indigo-300 font-mono text-xs cursor-pointer">Sign in to join this live room.</button>;
  }
  if (resolving) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>;
  }
  if (!live) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.live.notFound')}</div>;
  }

  const embed = wfNewEmbedUrl(live.external_url);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Stream */}
      <div className="lg:col-span-2 space-y-3">
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: '16 / 9' }}>
          {embed ? (
            <iframe
              src={embed}
              title={`live-${live.id}`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Radio className="w-10 h-10 text-rose-400/60" />
              {live.external_url ? (
                <a href={live.external_url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-xs font-mono text-indigo-300 hover:text-indigo-200">
                  <ExternalLink className="w-4 h-4" /> {trans('social.live.openExternal')}
                </a>
              ) : (
                <span className="text-xs font-mono">{trans('social.live.noStream')}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-100 truncate">{live.title}</h3>
            {live.description && <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{live.description}</p>}
          </div>
          <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono">
            <Users className="w-3.5 h-3.5" /> {trans('social.live.viewers', { n: viewerCount })}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <WfNewActorAvatar actor={live.host} size="w-8 h-8" />
          <span className="text-xs font-bold text-slate-200">{live.host.name}</span>
        </div>
      </div>

      {/* Live chat */}
      <div className="rounded-2xl bg-slate-950/40 border border-white/5 flex flex-col overflow-hidden h-[420px]">
        <div className="p-3 border-b border-white/5">
          <span className="text-[10px] font-black font-mono uppercase tracking-widest text-zinc-500">{trans('social.live.chatTitle')}</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {messages.length === 0 && (
            <p className="text-[10px] text-zinc-500 font-mono text-center py-4">{trans('social.live.chatEmpty')}</p>
          )}
          {messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <WfNewActorAvatar actor={m.user} size="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-300 truncate">{m.user.name}</span>
                  <span className="text-[8px] text-zinc-600 font-mono shrink-0">{wfNewRelativeTime(m.created_at)}</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed break-words">{m.body}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="p-3 bg-white/4 border-t border-white/5 flex gap-2 items-center">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={trans('social.live.chatPh')}
            className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-rose-500 placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="p-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

// ---- Go-Live composer modal ------------------------------------------------
interface WfNewGoLiveModalProps {
  onClose: () => void;
  onStarted: (live: WfNewLive) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewGoLiveModal: React.FC<WfNewGoLiveModalProps> = ({ onClose, onStarted, trans, addToast }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStart = useCallback(() => {
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    wfNewApi.createLive({ title: t, description: description.trim() || undefined, external_url: externalUrl.trim() || undefined })
      .then(live => { addToast(trans('social.liveStarted'), 'success'); onStarted(live); })
      .catch(() => { addToast(trans('social.postFailed'), 'warning'); setSubmitting(false); });
  }, [title, description, externalUrl, onStarted, addToast, trans]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-slate-950 border border-white/10 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" /> {trans('social.goLiveTitle')}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={trans('social.liveTitlePh')}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-rose-500 placeholder-zinc-500"
          />
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={trans('social.liveDescPh')}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-rose-500 placeholder-zinc-500 resize-none"
          />
          <input
            type="url"
            value={externalUrl}
            onChange={e => setExternalUrl(e.target.value)}
            placeholder={trans('social.liveUrlPh')}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-rose-500 placeholder-zinc-500"
          />
        </div>

        <button
          onClick={handleStart}
          disabled={submitting || !title.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold font-mono transition-all cursor-pointer"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          {trans('social.goLive')}
        </button>
      </motion.div>
    </motion.div>
  );
};
