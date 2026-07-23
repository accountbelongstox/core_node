import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { mediaUrl } from '../../../config/constants';
import { wfNewApi, type WfNewPost } from '../api';
import { WfNewActorAvatar, wfNewRelativeTime } from './WfNewSocialPlaza';

/** A flattened gallery tile: one image + its source post. */
interface GalleryTile {
  postId: number;
  imageId: number;
  url: string;
  caption?: string | null;
  post: WfNewPost;
}

interface WfNewSocialGalleryProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

export const WfNewSocialGallery: React.FC<WfNewSocialGalleryProps> = ({ trans, isLoggedIn, requireAuth }) => {
  const [posts, setPosts] = useState<WfNewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn) { setPosts([]); setLoading(false); return () => { alive = false; }; }
    setLoading(true);
    wfNewApi.getPosts({ filter: 'images', limit: 40 })
      .then(page => { if (alive) setPosts(page.items); })
      .catch(() => { if (alive) setPosts([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  const tiles = useMemo<GalleryTile[]>(() => {
    const out: GalleryTile[] = [];
    for (const post of posts) {
      for (const img of post.images) {
        out.push({ postId: post.id, imageId: img.id, url: mediaUrl(img.url), caption: img.caption, post });
      }
    }
    return out;
  }, [posts]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => (i === null ? null : (i - 1 + tiles.length) % tiles.length)), [tiles.length]);
  const next = useCallback(() => setLightboxIdx(i => (i === null ? null : (i + 1) % tiles.length)), [tiles.length]);

  // Keyboard navigation while the lightbox is open.
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, close, prev, next]);

  const current = lightboxIdx !== null ? tiles[lightboxIdx] : null;

  return (
    <div className="space-y-4">
      {loading && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.loading')}</div>
      )}

      {!loading && tiles.length === 0 && (
        <div className="py-16 text-center text-zinc-500 font-mono text-xs">{trans('social.galleryEmpty')}</div>
      )}

      {!loading && tiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {tiles.map((tile, idx) => (
            <motion.button
              layout
              key={`${tile.postId}-${tile.imageId}`}
              onClick={() => { if (!isLoggedIn) { requireAuth(); return; } setLightboxIdx(idx); }}
              className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 group cursor-pointer"
            >
              <img src={tile.url} alt={tile.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-white font-mono truncate">{tile.post.author.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={close}
          >
            <button
              onClick={close}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {tiles.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <motion.div
              key={`${current.postId}-${current.imageId}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={current.url} alt={current.caption || ''} className="max-w-full max-h-[72vh] object-contain rounded-xl" />
              <div className="flex items-center gap-2.5 bg-white/5 rounded-full px-4 py-2 border border-white/10">
                <WfNewActorAvatar actor={current.post.author} size="w-7 h-7" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-100">{current.post.author.name}</p>
                  <p className="text-[9px] text-zinc-400 font-mono">{wfNewRelativeTime(current.post.created_at)}</p>
                </div>
                {current.caption && <span className="text-[11px] text-zinc-300 ml-2">{current.caption}</span>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
