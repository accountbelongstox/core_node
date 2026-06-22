import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Upload, Link2, Send, Loader2, ExternalLink, Maximize2 } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { mediaUrl } from '../../../config/constants';
import { wfNewApi, type WfNewPost } from '../api';
import { WfNewActorAvatar, wfNewRelativeTime, wfNewEmbedUrl } from './WfNewSocialPlaza';

interface WfNewSocialVideoProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  /** Router nav: open the dedicated player page for a video post. */
  onOpenVideo?: (postId: number) => void;
}

export const WfNewSocialVideo: React.FC<WfNewSocialVideoProps> = ({
  trans, addToast, isLoggedIn, requireAuth, onOpenVideo,
}) => {
  const [posts, setPosts] = useState<WfNewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [externalUrl, setExternalUrl] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    wfNewApi.getPosts({ filter: 'videos', limit: 40 })
      .then(page => setPosts(page.items))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const prepend = useCallback((post: WfNewPost) => {
    setPosts(prev => (prev.some(p => p.id === post.id) ? prev.map(p => p.id === post.id ? post : p) : [post, ...prev]));
  }, []);

  // Upload a short clip: create a video post, then attach the file (multipart).
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isLoggedIn) { requireAuth(); return; }
    setSubmitting(true);
    try {
      const shell = await wfNewApi.createPost({ content: content.trim() || undefined, post_type: 'video' });
      const post = await wfNewApi.uploadPostVideo(shell.id, file);
      prepend(post);
      setContent('');
      addToast(trans('social.videoPublished'), 'success');
    } catch {
      addToast(trans('social.postFailed'), 'warning');
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, requireAuth, content, prepend, addToast, trans]);

  // Share an external embed url (youtube/bilibili/vimeo).
  const handleShareEmbed = useCallback(async () => {
    if (!isLoggedIn) { requireAuth(); return; }
    const url = externalUrl.trim();
    if (!url) return;
    if (!wfNewEmbedUrl(url)) { addToast(trans('social.embedUnsupported'), 'warning'); return; }
    setSubmitting(true);
    try {
      const post = await wfNewApi.createPost({ content: content.trim() || undefined, post_type: 'video', external_url: url });
      prepend(post);
      setExternalUrl('');
      setContent('');
      addToast(trans('social.videoPublished'), 'success');
    } catch {
      addToast(trans('social.postFailed'), 'warning');
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, requireAuth, externalUrl, content, prepend, addToast, trans]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Upload / share composer */}
      <div className="p-5 rounded-2xl bg-white/3 border border-white/5 space-y-3">
        <h4 className="text-xs font-black font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
          <Film className="w-4 h-4" /> {trans('social.videoComposeTitle')}
        </h4>
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={trans('social.videoCaptionPh')}
          className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="url"
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              placeholder={trans('social.embedPh')}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500"
            />
          </div>
          <button
            onClick={handleShareEmbed}
            disabled={submitting || !externalUrl.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white text-[11px] font-bold font-mono transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> {trans('social.shareEmbed')}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-indigo-500/15 border border-white/5 text-zinc-300 hover:text-indigo-300 text-[11px] font-mono transition-all cursor-pointer disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {trans('social.uploadClip')}
        </button>
      </div>

      {/* Video feed */}
      {loading && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>
      )}
      {!loading && posts.length === 0 && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.videoEmpty')}</div>
      )}
      {!loading && posts.map(post => {
        const embed = !post.video_url && post.external_url ? wfNewEmbedUrl(post.external_url) : null;
        return (
          <motion.div layout key={post.id} className="p-4 rounded-2xl bg-white/3 border border-white/5 space-y-3">
            <div className="flex items-center gap-3">
              <WfNewActorAvatar actor={post.author} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{post.author.name}</p>
                <p className="text-[10px] text-zinc-500 font-mono">{wfNewRelativeTime(post.created_at)}</p>
              </div>
            </div>
            {post.content && <p className="text-[13px] text-zinc-200 leading-relaxed break-words">{post.content}</p>}

            {post.video_url && (
              <video
                controls
                preload="metadata"
                poster={post.cover_url ? mediaUrl(post.cover_url) : undefined}
                className="w-full rounded-xl border border-white/5 bg-black max-h-[420px]"
                src={mediaUrl(post.video_url)}
              />
            )}

            {embed && (
              <div className="relative w-full rounded-xl overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  src={embed}
                  title={`embed-${post.id}`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {!post.video_url && post.external_url && !embed && (
              <a
                href={post.external_url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 text-indigo-300 text-xs font-mono transition-all"
              >
                <ExternalLink className="w-4 h-4 shrink-0" /> <span className="truncate">{post.external_url}</span>
              </a>
            )}

            {onOpenVideo && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => onOpenVideo(post.id)}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-indigo-300 transition-all cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> {trans('social.video.openPlayer')}
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
