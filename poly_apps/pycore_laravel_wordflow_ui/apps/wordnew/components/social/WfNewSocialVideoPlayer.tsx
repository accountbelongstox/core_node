import React, { useCallback, useEffect, useState } from 'react';
import { Heart, MessageCircle, ExternalLink } from 'lucide-react';
import { mediaUrl } from '../../../../config/constants';
import { wfNewApi, type WfNewPost } from '../../api';
import { WfNewActorAvatar, wfNewRelativeTime, wfNewEmbedUrl } from '../WfNewSocialPlaza';

interface WfNewSocialVideoPlayerProps {
  postId: number;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  onOpenComments: (postId: number) => void;
  onOpenUser: (userId: number) => void;
}

/** Dedicated player page (HTML5 video or embed) + like / open-comments. #/social/video/<id> */
export const WfNewSocialVideoPlayer: React.FC<WfNewSocialVideoPlayerProps> = ({
  postId, trans, addToast, isLoggedIn, requireAuth, onOpenComments, onOpenUser,
}) => {
  const [post, setPost] = useState<WfNewPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    wfNewApi.getPost(postId)
      .then(p => { if (alive) setPost(p); })
      .catch(() => { if (alive) setPost(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
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

  if (loading) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>;
  }
  if (!post) {
    return <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.postNotFound')}</div>;
  }

  const embed = !post.video_url && post.external_url ? wfNewEmbedUrl(post.external_url) : null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {post.video_url ? (
        <video
          controls
          autoPlay
          preload="metadata"
          poster={post.cover_url ? mediaUrl(post.cover_url) : undefined}
          className="w-full rounded-2xl border border-white/5 bg-black max-h-[70vh]"
          src={mediaUrl(post.video_url)}
        />
      ) : embed ? (
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: '16 / 9' }}>
          <iframe src={embed} title={`embed-${post.id}`} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : post.external_url ? (
        <a href={post.external_url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 text-indigo-300 text-sm font-mono transition-all">
          <ExternalLink className="w-5 h-5 shrink-0" /> <span className="truncate">{post.external_url}</span>
        </a>
      ) : (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.video.noSource')}</div>
      )}

      {post.content && <p className="text-[14px] text-zinc-100 leading-relaxed break-words">{post.content}</p>}

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => onOpenUser(post.author.id)} className="flex items-center gap-2.5 cursor-pointer group/author">
          <WfNewActorAvatar actor={post.author} size="w-8 h-8" />
          <div className="text-left">
            <p className="text-xs font-bold text-slate-200 group-hover/author:text-indigo-300">{post.author.name}</p>
            <p className="text-[9px] text-zinc-500 font-mono">{wfNewRelativeTime(post.created_at)}</p>
          </div>
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer ${post.liked_by_me ? 'text-rose-400' : 'text-zinc-400 hover:text-rose-300'}`}
          >
            <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-rose-400' : ''}`} /> {post.like_count}
          </button>
          <button
            onClick={() => onOpenComments(post.id)}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-indigo-300 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" /> {post.comment_count}
          </button>
        </div>
      </div>
    </div>
  );
};
