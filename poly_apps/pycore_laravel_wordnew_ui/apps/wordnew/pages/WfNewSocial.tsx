import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Users } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ElementTheme } from '../WfNewThemes';
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
import { WfNewSocialPartners } from '../components/social/WfNewSocialPartners';
import { WfNewSocialLeaderboard } from '../components/social/WfNewSocialLeaderboard';
import { useSocialList } from '../components/social/useSocialList';
import { useLatestRef } from '../../../core/utils/useLatestRef';
import { formatRelativeTime } from '../../../core/utils/formatters';

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

import { WfNewSocialChat } from '../components/social/WfNewSocialChat';
import { WfNewUserProfileModal } from '../components/social/WfNewUserProfileModal';
import { PRESENCE_HEARTBEAT_MS, SOCIAL_DISCOVER_PAGE_SIZE, SOCIAL_POSTS_PAGE_SIZE, SOCIAL_PRESENCE_POLL_MS, SOCIAL_SEARCH_DEBOUNCE_MS } from '../constants/uiTiming';


export const WfNewSocial: React.FC<WfNewSocialProps> = ({ activeTheme, addToast, trans, currentUser, onRequireAuth }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('plaza');

  const isLoggedIn = !!currentUser.isLoggedIn;
  const requireAuth = useCallback(() => {
    addToast(trans('social.loginRequired'), 'info');
    onRequireAuth?.();
  }, [addToast, trans, onRequireAuth]);

  // Presence map (id → status), seeded + updated live across the whole page.
  const [presence, setPresence] = useState<Record<number, WfNewPresenceStatus>>({});

  const [plazaFilter, setPlazaFilter] = useState<WfNewPostFilter>('all');
  const { items: posts, setItems: setPosts, loading: plazaLoading } = useSocialList<WfNewPost>(
    isLoggedIn,
    () => wfNewApi.getPosts({ filter: plazaFilter, limit: SOCIAL_POSTS_PAGE_SIZE }).then((page) => page.items),
    [plazaFilter],
  );

  const { items: activities, loading: feedLoading } = useSocialList<WfNewActivity>(isLoggedIn, () => wfNewApi.getActivities(), []);

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
      wfNewApi.discoverByLanguage({ native, target, q: partnerSearch.trim() || undefined, limit: SOCIAL_DISCOVER_PAGE_SIZE })
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
    }, SOCIAL_SEARCH_DEBOUNCE_MS);
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

  const selectedConvIdRef = useLatestRef(selectedConvId);
  const conversationsRef = useLatestRef(conversations);
  const discoverRef = useLatestRef(discover);

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
    const interval = setInterval(poll, SOCIAL_PRESENCE_POLL_MS);
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

  const [period, setPeriod] = useState<'week' | 'all'>('all');
  const { items: leaderboard, loading: leaderboardLoading } = useSocialList<WfNewLeaderboardEntry>(isLoggedIn, () => wfNewApi.getLeaderboard(period), [period]);

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
    const interval = setInterval(() => { if (alive) beat(); }, PRESENCE_HEARTBEAT_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [isLoggedIn]);

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
          <ChipGroup<SubTab>
            role="tab"
            nowrap
            gapClassName="gap-0"
            className="!pb-0"
            value={activeSubTab}
            onChange={setActiveSubTab}
            chipClassName="px-3.5 py-2 rounded-xl text-xs font-mono whitespace-nowrap border-transparent"
            selectedClassName="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
            idleClassName="bg-transparent text-zinc-400 hover:text-zinc-200"
            options={subTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
          />
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

        {activeSubTab === 'partners' && (
          <WfNewSocialPartners
            trans={trans}
            incoming={incoming}
            discover={discover}
            loading={discoverLoading}
            search={partnerSearch}
            onSearchChange={setPartnerSearch}
            ribbonLang={ribbonLang}
            onRibbonLangChange={setRibbonLang}
            pendingIds={pendingIds}
            presence={presence}
            onRespond={handleRespond}
            onAddFriend={handleAddFriend}
            onMessage={handleMessageUser}
            onOpenProfile={openProfile}
          />
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

        {activeSubTab === 'leaderboard' && (
          <WfNewSocialLeaderboard
            trans={trans}
            period={period}
            onPeriodChange={setPeriod}
            activities={activities}
            feedLoading={feedLoading}
            leaderboard={leaderboard}
            loading={leaderboardLoading}
          />
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
