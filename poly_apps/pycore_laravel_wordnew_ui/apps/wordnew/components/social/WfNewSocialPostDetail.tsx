import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Send, ExternalLink, Reply, X } from 'lucide-react';
import { mediaUrl } from '../../../../config/constants';
import {
  wfNewApi,
  type WfNewPost,
  type WfNewPostComment,
} from '../../api';
import {
  WfNewActorAvatar, wfNewRelativeTime, wfNewEmbedUrl,
} from '../WfNewSocialPlaza';

interface WfNewSocialPostDetailProps {
  postId: number;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  onOpenUser: (userId: number) => void;
}

/** Full post + full comment thread (reply via parent_id, like). #/social/post/<id> */
export const WfNewSocialPostDetail: React.FC<WfNewSocialPostDetailProps> = ({
  postId, trans, addToast, isLoggedIn, requireAuth, onOpenUser,
}) => {
  const [post, setPost] = useState<WfNewPost | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [comments, setComments] = useState<WfNewPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<WfNewPostComment | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setPostLoading(true);
    wfNewApi.getPost(postId)
      .then(p => { if (aliveRef.current) setPost(p); })
      .catch(() => { if (aliveRef.current) setPost(null); })
      .finally(() => { if (aliveRef.current) setPostLoading(false); });
    setCommentsLoading(true);
    wfNewApi.getComments(postId)
      .then(page => { if (aliveRef.current) setComments(page.items); })
      .catch(() => { if (aliveRef.current) setComments([]); })
      .finally(() => { if (aliveRef.current) setCommentsLoading(false); });
    return () => { aliveRef.current = false; };
  }, [postId]);

  const handleLike = useCallback(() => {
    if (!post) return;
    if (!isLoggedIn) { requireAuth(); return; }
    const liked = post.liked_by_me;
    setPost(prev => prev ? { ...prev, liked_by_me: !liked, like_count: prev.like_count + (liked ? -1 : 1) } : prev);
    const call = liked ? wfNewApi.unlikePost(post.id) : wfNewApi.likePost(post.id);
    call
      .then(res => setPost(prev => prev ? { ...prev, liked_by_me: res.liked_by_me, like_count: res.like_count } : prev))
      .catch(() => {
        setPost(prev => prev ? { ...prev, liked_by_me: liked, like_count: post.like_count } : prev);
        addToast(trans('social.actionFailed'), 'warning');
      });
  }, [post, isLoggedIn, requireAuth, addToast, trans]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) { requireAuth(); return; }
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const parentId = replyTo?.id;
    setReplyTo(null);
    wfNewApi.addComment(postId, body, parentId)
      .then(comment => {
        setComments(prev => [...prev, comment]);
        setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
      })
      .catch(() => addToast(trans('social.actionFailed'), 'warning'));
  }, [draft, isLoggedIn, requireAuth, postId, replyTo, addToast, trans]);

  if (postLoading) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>;
  }
  if (!post) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.postNotFound')}</div>;
  }

  const embed = post.post_type === 'video' && !post.video_url && post.external_url ? wfNewEmbedUrl(post.external_url) : null;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Post */}
      <div className="space-y-3">
        <button onClick={() => onOpenUser(post.author.id)} className="flex items-center gap-3 cursor-pointer group/author">
          <WfNewActorAvatar actor={post.author} size="w-11 h-11" />
          <div className="text-left">
            <p className="text-sm font-bold text-slate-200 group-hover/author:text-indigo-300">{post.author.name}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{wfNewRelativeTime(post.created_at)}</p>
          </div>
        </button>

        {post.content && (
          <p className="text-[14px] text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
        )}

        {post.post_type === 'images' && post.images.length > 0 && (
          <div className={`grid gap-1.5 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {post.images.map(img => (
              <div key={img.id} className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
                <img src={mediaUrl(img.url)} alt={img.caption || ''} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {post.video_url && (
          <video
            controls
            preload="metadata"
            poster={post.cover_url ? mediaUrl(post.cover_url) : undefined}
            className="w-full rounded-xl border border-white/5 bg-black max-h-[460px]"
            src={mediaUrl(post.video_url)}
          />
        )}

        {embed && (
          <div className="relative w-full rounded-xl overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe src={embed} title={`embed-${post.id}`} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}

        {post.external_url && !post.video_url && !embed && (
          <a href={post.external_url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 text-indigo-300 text-xs font-mono transition-all">
            <ExternalLink className="w-4 h-4 shrink-0" /> <span className="truncate">{post.external_url}</span>
          </a>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-white/5">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer ${post.liked_by_me ? 'text-rose-400' : 'text-zinc-400 hover:text-rose-300'}`}
          >
            <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-rose-400' : ''}`} /> {post.like_count}
          </button>
          <span className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
            <MessageCircle className="w-4 h-4" /> {post.comment_count}
          </span>
        </div>
      </div>

      {/* Comment thread */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-black font-mono tracking-widest text-indigo-400 uppercase">
          {trans('social.commentsTitle', { n: post.comment_count })}
        </h4>
        {commentsLoading && <p className="text-[10px] text-zinc-500 font-mono py-2 text-center">{trans('social.loading')}</p>}
        {!commentsLoading && comments.length === 0 && (
          <p className="text-[10px] text-zinc-500 font-mono py-2 text-center">{trans('social.noComments')}</p>
        )}
        {!commentsLoading && comments.map(c => (
          <div key={c.id} className={`flex items-start gap-2.5 ${c.parent_id ? 'ml-8' : ''}`}>
            <button onClick={() => onOpenUser(c.author.id)} className="cursor-pointer shrink-0">
              <WfNewActorAvatar actor={c.author} size="w-8 h-8" />
            </button>
            <div className="flex-1 min-w-0 bg-white/4 rounded-xl px-3 py-2 border border-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200 truncate">{c.author.name}</span>
                <span className="text-[8px] text-zinc-500 font-mono shrink-0">{wfNewRelativeTime(c.created_at)}</span>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed break-words mt-0.5">{c.body}</p>
              <button
                onClick={() => setReplyTo(c)}
                className="mt-1 flex items-center gap-1 text-[9px] font-mono text-zinc-500 hover:text-indigo-300 transition-all cursor-pointer"
              >
                <Reply className="w-3 h-3" /> {trans('social.reply')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer (sticky-ish at the bottom of the page body) */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        {replyTo && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[10px] font-mono text-indigo-300 truncate">
              {trans('social.replyingTo', { name: replyTo.author.name })}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={trans('social.commentPh')}
            className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="p-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
