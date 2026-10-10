import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { ElementTheme } from '../WfNewThemes';
import { laravelMediaUrl as mediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { wfNewApi, type WfNewPost } from '../api';
import { formatRelativeTime } from '../../../core/utils/formatters';
import { WfNewActorAvatar } from './social/WfNewSocialAvatar';
import { useSocialList } from './social/useSocialList';
import { StateMessage } from '@/shared/ui/StateMessage';
import { WfNewCachedImage } from './WfNewCachedImage';

/** A flattened gallery tile: one image + its source post. */
interface GalleryTile {
  postId: number;
  imageId: number;
  url: string;
  caption?: string | null;
  post: WfNewPost;
}

const GALLERY_PAGE_SIZE = 40;

interface WfNewSocialGalleryProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

export const WfNewSocialGallery: React.FC<WfNewSocialGalleryProps> = ({ trans, isLoggedIn, requireAuth }) => {
  const { items: posts, loading } = useSocialList<WfNewPost>(
    isLoggedIn,
    () => wfNewApi.getPosts({ filter: 'images', limit: GALLERY_PAGE_SIZE }).then((page) => page.items),
    [],
  );
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

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
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, prev, next]);

  const current = lightboxIdx !== null ? tiles[lightboxIdx] : null;

  return (
    <div className="space-y-4">
      {loading && <StateMessage kind="empty" size="page">{trans('social.loading')}</StateMessage>}

      {!loading && tiles.length === 0 && <StateMessage kind="empty" size="page">{trans('social.galleryEmpty')}</StateMessage>}

      {!loading && tiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {tiles.map((tile, idx) => (
            <motion.button
              layout
              key={`${tile.postId}-${tile.imageId}`}
              onClick={() => { if (!isLoggedIn) { requireAuth(); return; } setLightboxIdx(idx); }}
              className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 group cursor-pointer"
            >
              <WfNewCachedImage src={tile.url} alt={tile.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-white font-mono truncate">{tile.post.author.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <ModalShell open={!!current} onClose={close} backdrop="black" cardClassName={null}>
        {current && (
          <>
            <button
              onClick={close}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {tiles.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={next}
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
              className="relative max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
            >
              <WfNewCachedImage src={current.url} alt={current.caption || ''} className="max-w-full max-h-[72vh] object-contain rounded-xl" />
              <div className="flex items-center gap-2.5 bg-white/5 rounded-full px-4 py-2 border border-white/10">
                <WfNewActorAvatar actor={current.post.author} size="w-7 h-7" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-100">{current.post.author.name}</p>
                  <p className="text-[9px] text-zinc-400 font-mono">{formatRelativeTime(current.post.created_at)}</p>
                </div>
                {current.caption && <span className="text-[11px] text-zinc-300 ml-2">{current.caption}</span>}
              </div>
            </motion.div>
          </>
        )}
      </ModalShell>
    </div>
  );
};
