import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Send, Play, ExternalLink, Globe, Plus,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { mediaUrl } from '../../../config/constants';
import { WfNewAvatarView } from './WfNewAvatarView';
import {
  wfNewApi,
  type WfNewPost,
  type WfNewPostComment,
  type WfNewPostFilter,
  type WfNewSocialActor,
} from '../api';

// ---- Relative-time helper (native Intl) ------------------------------------
const RTF = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

export function wfNewRelativeTime(value?: string | null): string {
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

/** Convert a watch/share url into an embeddable iframe src for whitelisted hosts. */
export function wfNewEmbedUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith('/embed/')) return raw;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Bilibili
    if (host === 'bilibili.com' || host === 'player.bilibili.com') {
      if (u.pathname.startsWith('/video/')) {
        const bvid = u.pathname.split('/')[2];
        if (bvid) return `https://player.bilibili.com/player.html?bvid=${bvid}`;
      }
      return raw; // already a player url
    }
    // Vimeo
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'player.vimeo.com') return raw;
  } catch {
    return null;
  }
  return null;
}

/** Small avatar tile rendering an emoji OR a (root-relative) image url. */
export const WfNewActorAvatar: React.FC<{ actor: WfNewSocialActor; size?: string }> = ({ actor, size = 'w-10 h-10' }) => (
  <div className={`${size} rounded-full bg-zinc-800 flex items-center justify-center text-lg overflow-hidden shrink-0`}>
    <WfNewAvatarView value={mediaUrl(actor.avatar_url)} fallback={(actor.name || '?').slice(0, 1)} />
  </div>
);

interface WfNewSocialPlazaProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  /** External post stream so SSE 'post.created' can prepend into the plaza. */
  posts: WfNewPost[];
  setPosts: React.Dispatch<React.SetStateAction<WfNewPost[]>>;
  loading: boolean;
  filter: WfNewPostFilter;
  setFilter: (f: WfNewPostFilter) => void;
  /** Router nav: open a post's detail page (defaults to inline comments toggle). */
  onOpenPost?: (postId: number) => void;
  /** Router nav: open a user's profile page. */
  onOpenUser?: (userId: number) => void;
  /** Router nav: open the full-screen composer (compose FAB). */
  onCompose?: () => void;
}

const FILTERS: WfNewPostFilter[] = ['all', 'images', 'videos', 'following'];

export const WfNewSocialPlaza: React.FC<WfNewSocialPlazaProps> = ({
  activeTheme, trans, addToast, isLoggedIn, requireAuth, posts, setPosts, loading, filter, setFilter,
  onOpenPost, onOpenUser, onCompose,
}) => {
  const [openComments, setOpenComments] = useState<number | null>(null);

  const handleLike = useCallback((post: WfNewPost) => {
    if (!isLoggedIn) { requireAuth(); return; }
    const liked = post.liked_by_me;
    // optimistic
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) }
      : p));
    const call = liked ? wfNewApi.unlikePost(post.id) : wfNewApi.likePost(post.id);
    call
      .then(res => setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked_by_me: res.liked_by_me, like_count: res.like_count } : p)))
      .catch(() => {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked_by_me: liked, like_count: post.like_count } : p));
        addToast(trans('social.actionFailed'), 'warning');
      });
  }, [isLoggedIn, requireAuth, setPosts, addToast, trans]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Filter ribbon */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 self-start overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono whitespace-nowrap transition-all cursor-pointer ${
              filter === f
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {trans('social.filter.' + f)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>
      )}

      {!loading && posts.length === 0 && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.plazaEmpty')}</div>
      )}

      {!loading && posts.map(post => (
        <motion.div
          layout
          key={post.id}
          className="p-4 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all space-y-3"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenUser?.(post.author.id)}
              className={`flex items-center gap-3 min-w-0 flex-1 text-left ${onOpenUser ? 'cursor-pointer group/author' : ''}`}
            >
              <WfNewActorAvatar actor={post.author} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold text-slate-200 truncate ${onOpenUser ? 'group-hover/author:text-indigo-300' : ''}`}>{post.author.name}</p>
                <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {wfNewRelativeTime(post.created_at)}
                </p>
              </div>
            </button>
          </div>

          {/* Body — tapping opens the full post detail when routing is wired. */}
          {post.content && (
            <p
              onClick={() => onOpenPost?.(post.id)}
              className={`text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words ${onOpenPost ? 'cursor-pointer' : ''}`}
            >
              {post.content}
            </p>
          )}

          {/* Image grid */}
          {post.post_type === 'images' && post.images.length > 0 && (
            <div className={`grid gap-1.5 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {post.images.map(img => (
                <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
                  <img src={mediaUrl(img.url)} alt={img.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {/* Uploaded video */}
          {post.post_type === 'video' && post.video_url && (
            <video
              controls
              preload="metadata"
              poster={post.cover_url ? mediaUrl(post.cover_url) : undefined}
              className="w-full rounded-xl border border-white/5 bg-black max-h-[420px]"
              src={mediaUrl(post.video_url)}
            />
          )}

          {/* External embed */}
          {post.post_type === 'video' && !post.video_url && post.external_url && (
            wfNewEmbedUrl(post.external_url) ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  src={wfNewEmbedUrl(post.external_url)!}
                  title={`embed-${post.id}`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={post.external_url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 text-indigo-300 text-xs font-mono transition-all"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">{post.external_url}</span>
              </a>
            )
          )}

          {/* Live pointer */}
          {post.post_type === 'live' && post.external_url && (
            <a
              href={post.external_url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono"
            >
              <Play className="w-4 h-4" /> {trans('social.live.watch')}
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2 border-t border-white/5">
            <button
              onClick={() => handleLike(post)}
              className={`flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer ${
                post.liked_by_me ? 'text-rose-400' : 'text-zinc-400 hover:text-rose-300'
              }`}
            >
              <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-rose-400' : ''}`} /> {post.like_count}
            </button>
            <button
              onClick={() => (onOpenPost ? onOpenPost(post.id) : setOpenComments(openComments === post.id ? null : post.id))}
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" /> {post.comment_count}
            </button>
          </div>

          {/* Comments */}
          <AnimatePresence>
            {openComments === post.id && (
              <WfNewPostComments
                post={post}
                setPosts={setPosts}
                trans={trans}
                addToast={addToast}
                isLoggedIn={isLoggedIn}
                requireAuth={requireAuth}
              />
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      {/* Compose FAB (router nav → full-screen composer). */}
      {onCompose && (
        <button
          onClick={() => (isLoggedIn ? onCompose() : requireAuth())}
          className="fixed bottom-28 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-[0_8px_24px_rgba(99,102,241,0.45)] flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={trans('social.compose')}
          aria-label={trans('social.compose')}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

// ---- Inline comments panel -------------------------------------------------
interface WfNewPostCommentsProps {
  post: WfNewPost;
  setPosts: React.Dispatch<React.SetStateAction<WfNewPost[]>>;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

const WfNewPostComments: React.FC<WfNewPostCommentsProps> = ({
  post, setPosts, trans, addToast, isLoggedIn, requireAuth,
}) => {
  const [comments, setComments] = useState<WfNewPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    wfNewApi.getComments(post.id)
      .then(page => { if (aliveRef.current) setComments(page.items); })
      .catch(() => { if (aliveRef.current) setComments([]); })
      .finally(() => { if (aliveRef.current) setLoading(false); });
    return () => { aliveRef.current = false; };
  }, [post.id]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) { requireAuth(); return; }
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    wfNewApi.addComment(post.id, body)
      .then(comment => {
        setComments(prev => [...prev, comment]);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, comment_count: p.comment_count + 1 } : p));
      })
      .catch(() => addToast(trans('social.actionFailed'), 'warning'));
  }, [draft, isLoggedIn, requireAuth, post.id, setPosts, addToast, trans]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden space-y-2.5 pt-2"
    >
      {loading && <p className="text-[10px] text-zinc-500 font-mono py-2 text-center">{trans('social.loading')}</p>}
      {!loading && comments.length === 0 && (
        <p className="text-[10px] text-zinc-500 font-mono py-2 text-center">{trans('social.noComments')}</p>
      )}
      {!loading && comments.map(c => (
        <div key={c.id} className="flex items-start gap-2.5">
          <WfNewActorAvatar actor={c.author} size="w-7 h-7" />
          <div className="flex-1 min-w-0 bg-white/4 rounded-xl px-3 py-2 border border-white/5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-200 truncate">{c.author.name}</span>
              <span className="text-[8px] text-zinc-500 font-mono shrink-0">{wfNewRelativeTime(c.created_at)}</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed break-words mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center pt-1">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={trans('social.commentPh')}
          className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  );
};
