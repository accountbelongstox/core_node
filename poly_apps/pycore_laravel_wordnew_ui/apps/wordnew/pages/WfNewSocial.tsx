import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users, MessageSquare, Send, UserPlus, UserCheck, Search,
  Activity, Trophy, Check, X, Clock, ChevronRight,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import {
  wfNewApi,
  subscribeSocial,
  type WfNewActivity,
  type WfNewDiscoverUser,
  type WfNewFriendRequest,
  type WfNewConversation,
  type WfNewMessage,
  type WfNewLeaderboardEntry,
  type WfNewPresenceStatus,
  type WfNewPost,
  type WfNewPostFilter,
} from '../api';
import { WfNewSocialPlaza } from '../components/WfNewSocialPlaza';
import { WfNewSocialComposer } from '../components/WfNewSocialComposer';
import { WfNewSocialGallery } from '../components/WfNewSocialGallery';
import { WfNewSocialVideo } from '../components/WfNewSocialVideo';
import { WfNewSocialLive } from '../components/WfNewSocialLive';
import { WfNewSocialNearby } from '../components/social/WfNewSocialNearby';

interface WfNewSocialProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  currentUser: {
    nickname: string;
    avatar: string;
    nativeLang: string;
    targetLang: string;
    isLoggedIn?: boolean;
  };
  /** Route to the auth screen when a logged-out user triggers a gated action. */
  onRequireAuth?: () => void;
}

type SubTab = 'plaza' | 'post' | 'gallery' | 'video' | 'live' | 'partners' | 'nearby' | 'chat' | 'leaderboard';

import { relativeTime, presenceClass } from '../components/social/socialPresence';
import { WfNewSocialChat } from '../components/social/WfNewSocialChat';
import { WfNewUserProfileModal } from '../components/social/WfNewUserProfileModal';


export const WfNewSocial: React.FC<WfNewSocialProps> = ({ activeTheme, addToast, trans, currentUser, onRequireAuth }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('plaza');

  const isLoggedIn = !!currentUser.isLoggedIn;
  const requireAuth = useCallback(() => {
    addToast(trans('social.loginRequired'), 'info');
    onRequireAuth?.();
  }, [addToast, trans, onRequireAuth]);

  // Presence map (id → status), seeded + updated live across the whole page.
  const [presence, setPresence] = useState<Record<number, WfNewPresenceStatus>>({});

  const [posts, setPosts] = useState<WfNewPost[]>([]);
  const [plazaLoading, setPlazaLoading] = useState(true);
  const [plazaFilter, setPlazaFilter] = useState<WfNewPostFilter>('all');

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn) {
      setPosts([]);
      setPlazaLoading(false);
      return () => { alive = false; };
    }
    setPlazaLoading(true);
    wfNewApi.getPosts({ filter: plazaFilter, limit: 20 })
      .then(page => { if (alive) setPosts(page.items); })
      .catch(() => { if (alive) setPosts([]); })
      .finally(() => { if (alive) setPlazaLoading(false); });
    return () => { alive = false; };
  }, [plazaFilter, isLoggedIn]);

  const [activities, setActivities] = useState<WfNewActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn) {
      setActivities([]);
      setFeedLoading(false);
      return () => { alive = false; };
    }
    setFeedLoading(true);
    wfNewApi.getActivities()
      .then(rows => { if (alive) setActivities(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setActivities([]); })
      .finally(() => { if (alive) setFeedLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  const [discover, setDiscover] = useState<WfNewDiscoverUser[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [ribbonLang, setRibbonLang] = useState<string>('all');
  const [pendingIds, setPendingIds] = useState<Record<number, boolean>>({});
  const [incoming, setIncoming] = useState<WfNewFriendRequest[]>([]);

  const refreshRequests = useCallback(() => {
    if (!isLoggedIn) { setIncoming([]); return; }
    wfNewApi.getFriendRequests('incoming')
      .then(rows => setIncoming(Array.isArray(rows) ? rows : []))
      .catch(() => setIncoming([]));
  }, [isLoggedIn]);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn) {
      setDiscover([]);
      setDiscoverLoading(false);
      return () => { alive = false; };
    }
    setDiscoverLoading(true);
    const native = currentUser.nativeLang || undefined;
    const target = ribbonLang === 'all' ? (currentUser.targetLang || undefined) : ribbonLang;
    const handle = setTimeout(() => {
      wfNewApi.discoverByLanguage({ native, target, q: partnerSearch.trim() || undefined, limit: 50 })
        .then(rows => {
          if (!alive) return;
          const list = Array.isArray(rows) ? rows : [];
          setDiscover(list);
          setPresence(prev => {
            const next = { ...prev };
            for (const u of list) if (u.presence) next[u.id] = u.presence;
            return next;
          });
        })
        .catch(() => { if (alive) setDiscover([]); })
        .finally(() => { if (alive) setDiscoverLoading(false); });
    }, 350);
    return () => { alive = false; clearTimeout(handle); };
  }, [ribbonLang, partnerSearch, currentUser.nativeLang, currentUser.targetLang, isLoggedIn]);

  useEffect(() => { refreshRequests(); }, [refreshRequests]);

  const handleAddFriend = useCallback((user: WfNewDiscoverUser) => {
    if (!isLoggedIn) { requireAuth(); return; }
    setPendingIds(prev => ({ ...prev, [user.id]: true }));
    wfNewApi.sendFriendRequest(user.id)
      .then(() => addToast(trans('social.requestSent', { name: user.nickname }), 'success'))
      .catch(() => {
        setPendingIds(prev => { const next = { ...prev }; delete next[user.id]; return next; });
        addToast(trans('social.requestFailed'), 'warning');
      });
  }, [isLoggedIn, requireAuth, addToast, trans]);

  const handleRespond = useCallback((req: WfNewFriendRequest, action: 'accept' | 'reject') => {
    if (!isLoggedIn) { requireAuth(); return; }
    wfNewApi.respondFriendRequest(req.id, action)
      .then(() => {
        addToast(action === 'accept' ? trans('social.requestAccepted') : trans('social.requestRejected'), action === 'accept' ? 'success' : 'info');
        refreshRequests();
      })
      .catch(() => addToast(trans('social.requestFailed'), 'warning'));
  }, [isLoggedIn, requireAuth, addToast, trans, refreshRequests]);

  const [conversations, setConversations] = useState<WfNewConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<WfNewMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');

  const selectedConvIdRef = useRef<number | null>(null);
  useEffect(() => { selectedConvIdRef.current = selectedConvId; }, [selectedConvId]);

  const conversationsRef = useRef<WfNewConversation[]>([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const discoverRef = useRef<WfNewDiscoverUser[]>([]);
  useEffect(() => { discoverRef.current = discover; }, [discover]);

  useEffect(() => {
    let alive = true;
    const poll = () => {
      const ids = new Set<number>();
      for (const c of conversationsRef.current) { const id = c.peer?.id; if (typeof id === 'number') ids.add(id); }
      for (const u of discoverRef.current) { if (typeof u.id === 'number') ids.add(u.id); }
      if (!ids.size) return;
      wfNewApi.getPresence(Array.from(ids))
        .then(map => {
          if (!alive || !map) return;
          setPresence(prev => {
            const next = { ...prev };
            for (const [id, info] of Object.entries(map)) next[Number(id)] = info.status;
            return next;
          });
        })
        .catch(() => {});
    };
    const interval = setInterval(poll, 45000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedConvId) || null,
    [conversations, selectedConvId],
  );

  const loadConversations = useCallback(() => {
    if (!isLoggedIn) { setConversations([]); setConvLoading(false); return; }
    setConvLoading(true);
    return wfNewApi.getConversations()
      .then(rows => { const list = Array.isArray(rows) ? rows : []; setConversations(list); return list; })
      .catch(() => { setConversations([]); return [] as WfNewConversation[]; })
      .finally(() => setConvLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const openConversation = useCallback((conv: WfNewConversation) => {
    setSelectedConvId(conv.id);
    setMessagesLoading(true);
    setMessages([]);
    wfNewApi.getMessages(conv.id)
      .then(page => {
        const list = Array.isArray(page?.messages) ? page.messages : [];
        setMessages(list);
        const lastId = list.length ? list[list.length - 1].id : 0;
        if (lastId) void wfNewApi.markConversationRead(conv.id, lastId).catch(() => {});
      })
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
    setConversations(prev => prev.map(c => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
  }, []);

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selectedConvId) return;
    setDraft('');
    wfNewApi.sendMessage(selectedConvId, body)
      .then(msg => {
        setMessages(prev => [...prev, msg]);
        setConversations(prev => prev.map(c => (c.id === selectedConvId ? { ...c, last_message: msg.body, last_message_at: msg.created_at } : c)));
      })
      .catch(() => addToast(trans('social.sendFailed'), 'warning'));
  }, [draft, selectedConvId, addToast, trans]);

  const openConversationWithUser = useCallback((userId: number) => {
    if (!isLoggedIn) { requireAuth(); return; }
    wfNewApi.openConversation(userId)
      .then(conv => {
        setConversations(prev => (prev.some(c => c.id === conv.id) ? prev.map(c => (c.id === conv.id ? conv : c)) : [conv, ...prev]));
        setActiveSubTab('chat');
        openConversation(conv);
      })
      .catch(() => addToast(trans('social.sendFailed'), 'warning'));
  }, [isLoggedIn, requireAuth, openConversation, addToast, trans]);

  const handleMessageUser = useCallback((user: WfNewDiscoverUser) => openConversationWithUser(user.id), [openConversationWithUser]);

  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const openProfile = useCallback((id: number) => { if (Number.isFinite(id)) setProfileUserId(id); }, []);

  const [leaderboard, setLeaderboard] = useState<WfNewLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'all'>('all');

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn) {
      setLeaderboard([]);
      setLeaderboardLoading(false);
      return () => { alive = false; };
    }
    setLeaderboardLoading(true);
    wfNewApi.getLeaderboard(period)
      .then(rows => { if (alive) setLeaderboard(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setLeaderboard([]); })
      .finally(() => { if (alive) setLeaderboardLoading(false); });
    return () => { alive = false; };
  }, [period, isLoggedIn]);

  useEffect(() => {
    const ids = conversations.map(c => c.peer?.id).filter((n): n is number => typeof n === 'number');
    if (!ids.length) return;
    let alive = true;
    wfNewApi.getPresence(ids)
      .then(map => {
        if (!alive || !map) return;
        setPresence(prev => {
          const next = { ...prev };
          for (const [id, info] of Object.entries(map)) next[Number(id)] = info.status;
          return next;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [conversations]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const setPresenceFor = (payload: any, status: WfNewPresenceStatus) => {
      const id = Number(payload?.user_id ?? payload?.id);
      if (Number.isFinite(id)) setPresence(prev => ({ ...prev, [id]: payload?.status || status }));
    };

    const unsubs = [
      subscribeSocial('message.new', (payload: any) => {
        // The backend emits message.new NESTED: { conversation_id, message: {...} }.
        // Read the inner row (never the flat payload) so the bubble, dedupe id and
        // markConversationRead all use the real message fields.
        const raw = payload?.message;
        if (!raw) return;
        const convId = Number(payload?.conversation_id ?? raw?.conversation_id);
        if (!Number.isFinite(convId)) return;
        const incomingMsg: WfNewMessage = {
          id: Number(raw?.id ?? 0),
          conversation_id: convId,
          sender_id: Number(raw?.sender_id ?? 0),
          body: raw?.body ?? '',
          type: (raw?.type === 'image' || raw?.type === 'voice') ? raw.type : 'text',
          metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : null,
          created_at: raw?.created_at ?? new Date().toISOString(),
        };
        if (!incomingMsg.id) return; // no usable id → skip (avoids undefined dedupe / read)
        if (selectedConvIdRef.current === convId) {
          setMessages(prev => (prev.some(m => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]));
          void wfNewApi.markConversationRead(convId, incomingMsg.id).catch(() => {});
          setConversations(prev => prev.map(c => (c.id === convId ? { ...c, last_message: incomingMsg.body, last_message_at: incomingMsg.created_at } : c)));
        } else {
          setConversations(prev => prev.map(c => (
            c.id === convId
              ? { ...c, unread_count: (c.unread_count || 0) + 1, last_message: incomingMsg.body, last_message_at: incomingMsg.created_at }
              : c
          )));
        }
      }),
      subscribeSocial('friend.request', () => { refreshRequests(); }),
      subscribeSocial('friend.accept', (payload: any) => {
        addToast(trans('social.requestAccepted'), 'success');
        refreshRequests();
        setPresenceFor(payload, 'online');
      }),
      subscribeSocial('friend.online', (payload: any) => setPresenceFor(payload, 'online')),
      subscribeSocial('friend.offline', (payload: any) => setPresenceFor(payload, 'offline')),
      subscribeSocial('presence.update', (payload: any) => setPresenceFor(payload, 'online')),

      // ---- Social Center: plaza posts ----
      // A newly created post (by anyone) prepends to the live plaza (dedupe by id).
      subscribeSocial('post.created', (payload: any) => {
        const raw = payload?.post ?? payload;
        const id = Number(raw?.id);
        if (!Number.isFinite(id)) return;
        setPosts(prev => (prev.some(p => p.id === id) ? prev : [raw as WfNewPost, ...prev]));
      }),
      // A like elsewhere updates the counter on the matching plaza card.
      subscribeSocial('post.liked', (payload: any) => {
        const id = Number(payload?.post_id ?? payload?.id);
        if (!Number.isFinite(id)) return;
        setPosts(prev => prev.map(p => (
          p.id === id && typeof payload?.like_count === 'number' ? { ...p, like_count: payload.like_count } : p
        )));
      }),
      // A new comment elsewhere bumps the matching card's comment counter.
      subscribeSocial('post.comment', (payload: any) => {
        const id = Number(payload?.post_id ?? payload?.comment?.post_id);
        if (!Number.isFinite(id)) return;
        setPosts(prev => prev.map(p => (p.id === id ? { ...p, comment_count: p.comment_count + 1 } : p)));
      }),
    ];
    return () => { for (const u of unsubs) u(); };
  }, [isLoggedIn, addToast, trans, refreshRequests]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    const beat = () => { void wfNewApi.presenceHeartbeat('online').catch(() => {}); };
    beat();
    const interval = setInterval(() => { if (alive) beat(); }, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [isLoggedIn]);

  // ---- match badge accents ----
  const matchBadge = (match: WfNewDiscoverUser['match']) => {
    if (match === 'exchange') {
      return { label: trans('social.matchExchange'), cls: 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white border-fuchsia-400/30' };
    }
    if (match === 'native') {
      return { label: trans('social.matchNative'), cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' };
    }
    return { label: trans('social.matchTarget'), cls: 'bg-sky-500/15 text-sky-300 border-sky-500/20' };
  };

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'plaza', label: trans('social.tabPlaza') },
    { id: 'post', label: trans('social.tabPost') },
    { id: 'gallery', label: trans('social.tabGallery') },
    { id: 'video', label: trans('social.tabVideo') },
    { id: 'live', label: trans('social.tabLive') },
    { id: 'partners', label: trans('social.tabPartners') },
    { id: 'nearby', label: trans('social.tabNearby') },
    { id: 'chat', label: trans('social.tabChat') },
    { id: 'leaderboard', label: trans('social.tabLeaderboard') },
  ];

  return (
    <div className={`p-4 md:p-6 rounded-3xl ${activeTheme.cardClass} shadow-xl max-w-5xl mx-auto border border-white/5`}>
      {/* Header + sub-tab bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
              {trans('social.title')}
              <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-mono py-0.5 px-2 rounded-full border border-indigo-500/5">
                Center v3
              </span>
            </h3>
            <p className="text-zinc-500 text-xs font-mono">{trans('social.subtitle')}</p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 self-start overflow-x-auto">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {/* ====== PLAZA / FEED (post timeline) ====== */}
        {activeSubTab === 'plaza' && (
          <WfNewSocialPlaza
            activeTheme={activeTheme}
            trans={trans}
            addToast={addToast}
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
            posts={posts}
            setPosts={setPosts}
            loading={plazaLoading}
            filter={plazaFilter}
            setFilter={setPlazaFilter}
          />
        )}

        {/* ====== POST (composer: text + images) ====== */}
        {activeSubTab === 'post' && (
          <WfNewSocialComposer
            activeTheme={activeTheme}
            trans={trans}
            addToast={addToast}
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
            onPosted={(post) => {
              setPosts(prev => [post, ...prev.filter(p => p.id !== post.id)]);
              setActiveSubTab('plaza');
            }}
          />
        )}

        {/* ====== GALLERY (image-only feed + lightbox) ====== */}
        {activeSubTab === 'gallery' && (
          <WfNewSocialGallery
            activeTheme={activeTheme}
            trans={trans}
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
          />
        )}

        {/* ====== VIDEO (uploaded clips + external embeds) ====== */}
        {activeSubTab === 'video' && (
          <WfNewSocialVideo
            activeTheme={activeTheme}
            trans={trans}
            addToast={addToast}
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
          />
        )}

        {/* ====== LIVE (sessions list + viewer + go-live) ====== */}
        {activeSubTab === 'live' && (
          <WfNewSocialLive
            activeTheme={activeTheme}
            trans={trans}
            addToast={addToast}
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
          />
        )}

        {activeSubTab === 'nearby' && (
          <WfNewSocialNearby
            isLoggedIn={isLoggedIn}
            requireAuth={requireAuth}
            addToast={addToast}
            onMessage={openConversationWithUser}
            trans={trans}
          />
        )}

        {/* ====== PARTNERS ====== */}
        {activeSubTab === 'partners' && (
          <div className="space-y-6">
            {/* Incoming friend requests strip */}
            {incoming.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 space-y-3">
                <h4 className="text-[11px] font-black font-mono tracking-widest text-indigo-400 uppercase">
                  {trans('social.incomingRequests', { n: incoming.length })}
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {incoming.map(req => (
                    <div key={req.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/4 border border-white/5 shrink-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden text-sm select-none">
                        {req.avatar_url
                          ? <img src={req.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span>{(req.name || req.username || '?').slice(0, 1)}</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-200 max-w-[100px] truncate">{req.name || req.username}</span>
                      <button
                        onClick={() => handleRespond(req, 'accept')}
                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer"
                        title={trans('social.accept')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRespond(req, 'reject')}
                        className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all cursor-pointer"
                        title={trans('social.reject')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter ribbon + search */}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={e => setPartnerSearch(e.target.value)}
                  placeholder={trans('social.searchPh')}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 outline-none placeholder-zinc-500 focus:border-indigo-500/50"
                />
              </div>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1 overflow-x-auto w-full sm:w-auto">
                {['all', 'en', 'zh', 'ja', 'es', 'fr', 'ko'].map(langCode => (
                  <button
                    key={langCode}
                    onClick={() => setRibbonLang(langCode)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                      ribbonLang === langCode ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {langCode === 'all' ? trans('social.langAll') : trans('lang.name.' + langCode)}
                  </button>
                ))}
              </div>
            </div>

            {/* Discover grid */}
            {discoverLoading && (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.discoverLoading')}</div>
            )}

            {!discoverLoading && discover.length === 0 && (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.noDiscover')}</div>
            )}

            {!discoverLoading && discover.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {discover.map(user => {
                  const badge = matchBadge(user.match);
                  const isPending = pendingIds[user.id];
                  return (
                    <div
                      key={user.id}
                      className="p-5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => openProfile(user.id)}
                          title={trans('social.profile.viewProfile')}
                          className="group flex items-center gap-3 min-w-0 cursor-pointer"
                        >
                          <div className="relative">
                            <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-xl select-none overflow-hidden">
                              {/^https?:/i.test(user.avatar)
                                ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                                : <span>{user.avatar || (user.nickname || '?').slice(0, 1)}</span>}
                            </div>
                            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${presenceClass(presence[user.id] || user.presence)}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-200 truncate group-hover:text-indigo-300 transition-colors">{user.nickname}</h4>
                            <p className="text-[10px] text-indigo-400 font-mono">
                              <span className="uppercase text-slate-300 font-bold">{user.native_language}</span>
                              {' → '}
                              <span className="uppercase text-slate-300 font-bold">{(user.learning_languages || []).join(', ')}</span>
                            </p>
                          </div>
                        </div>
                        <span className={`text-[8px] font-black font-mono tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {user.stats && (
                        <div className="flex gap-3 text-[10px] font-mono text-zinc-400">
                          {typeof user.stats.learned === 'number' && <span>{trans('social.statsLearned', { n: user.stats.learned })}</span>}
                          {typeof user.stats.streak === 'number' && <span>{trans('social.statsStreak', { n: user.stats.streak })}</span>}
                        </div>
                      )}

                      <div className="flex gap-2.5 pt-3 border-t border-white/5">
                        {user.is_friend ? (
                          <span className="flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 border bg-zinc-800/40 border-zinc-700 text-indigo-400">
                            <UserCheck className="w-3.5 h-3.5" /> {trans('social.alreadyFriend')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(user)}
                            disabled={isPending}
                            className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                              isPending
                                ? 'bg-zinc-800/40 border-zinc-700 text-zinc-400'
                                : 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-500/20 text-white'
                            }`}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{isPending ? trans('social.pending') : trans('social.addFriend')}</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleMessageUser(user)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/5 text-zinc-400 transition-all cursor-pointer"
                          title={trans('social.message')}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====== CHAT ====== */}
        {activeSubTab === 'chat' && (
          <WfNewSocialChat
            trans={trans}
            convLoading={convLoading}
            conversations={conversations}
            selectedConvId={selectedConvId}
            presence={presence}
            openConversation={openConversation}
            selectedConv={selectedConv}
            messagesLoading={messagesLoading}
            messages={messages}
            handleSend={handleSend}
            draft={draft}
            setDraft={setDraft}
            setActiveSubTab={(t) => setActiveSubTab(t as SubTab)}
            onOpenProfile={openProfile}
          />
        )}

        {/* ====== LEADERBOARD ====== */}
        {activeSubTab === 'leaderboard' && (
          <div className="space-y-5 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black font-mono tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                {trans('social.leaderboardTitle')}
              </h4>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                {(['week', 'all'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      period === p ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p === 'week' ? trans('social.week') : trans('social.allTime')}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent activity digest of followed users (legacy feed, folded in here). */}
            {!feedLoading && activities.length > 0 && (
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5 space-y-3">
                <h5 className="text-[10px] font-black font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> {trans('social.feedTitle')}
                </h5>
                {activities.slice(0, 5).map(act => (
                  <div key={act.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-sm select-none overflow-hidden shrink-0">
                      {act.avatar_url
                        ? <img src={act.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span>{(act.user_name || '?').slice(0, 1)}</span>}
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 truncate">{act.user_name}</span>
                    <span className="text-[10px] text-zinc-500 truncate flex-1">{act.action || trans('social.feedDefaultAction')}</span>
                    <span className="text-[9px] text-zinc-600 font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {relativeTime(act.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {leaderboardLoading && (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.leaderboardLoading')}</div>
            )}

            {!leaderboardLoading && leaderboard.length === 0 && (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.leaderboardEmpty')}</div>
            )}

            {!leaderboardLoading && leaderboard.map(entry => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  entry.is_current_user
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-white/3 border-white/5 hover:border-white/10'
                }`}
              >
                <span className={`w-8 text-center font-black font-mono text-sm ${
                  entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-orange-400' : 'text-zinc-500'
                }`}>
                  #{entry.rank}
                </span>
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm select-none overflow-hidden shrink-0">
                  {entry.avatar_url
                    ? <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span>{(entry.name || entry.username || '?').slice(0, 1)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${entry.is_current_user ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {entry.name || entry.username}
                    {entry.is_current_user && <span className="ml-2 text-[9px] font-mono text-indigo-400">{trans('social.you')}</span>}
                  </p>
                </div>
                <span className="text-xs font-black font-mono text-emerald-400 shrink-0">
                  {trans('social.xp', { n: entry.xp })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-only public profile overlay (opened by user id from partner cards
          + chat peer headers). Portaled, so tree placement here is fine. */}
      <WfNewUserProfileModal
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        trans={trans}
        addToast={addToast}
        isLoggedIn={isLoggedIn}
        requireAuth={requireAuth}
        onMessage={openConversationWithUser}
      />
    </div>
  );
};
