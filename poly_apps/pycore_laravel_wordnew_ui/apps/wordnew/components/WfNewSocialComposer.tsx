import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Camera, X, Send, Loader2 } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { pickPhoto } from '@/apps/wordnew/platform/capabilities';
import {
  wfNewApi,
  type WfNewPost,
  type WfNewPostVisibility,
} from '../api';

interface WfNewSocialComposerProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn: boolean;
  requireAuth: () => void;
  /** Called with the freshly-created post so the plaza prepends it. */
  onPosted: (post: WfNewPost) => void;
}

interface PendingImage {
  file: File;
  preview: string;
}

const MAX_IMAGES = 9;

export const WfNewSocialComposer: React.FC<WfNewSocialComposerProps> = ({
  activeTheme, trans, addToast, isLoggedIn, requireAuth, onPosted,
}) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [visibility, setVisibility] = useState<WfNewPostVisibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter(f => f.type.startsWith('image/'));
    setImages(prev => {
      const room = MAX_IMAGES - prev.length;
      const next = accepted.slice(0, Math.max(0, room)).map(file => ({ file, preview: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  }, [addFiles]);

  // CapCamera capture (native camera / web prompt). Web fallback is the file input.
  const handleCapture = useCallback(async () => {
    try {
      const photo = await pickPhoto({ quality: 85 });
      const blob = photo.blob ?? await (await fetch(photo.dataUrl)).blob();
      const file = new File([blob], `capture_${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
      addFiles([file]);
    } catch {
      // Cap API unavailable / cancelled → fall back to the file picker.
      fileInputRef.current?.click();
    }
  }, [addFiles]);

  const removeImage = useCallback((idx: number) => {
    setImages(prev => {
      const target = prev[idx];
      if (target) { try { URL.revokeObjectURL(target.preview); } catch { /* ignore */ } }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setImages(prev => { for (const im of prev) { try { URL.revokeObjectURL(im.preview); } catch { /* ignore */ } } return []; });
    setVisibility('public');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isLoggedIn) { requireAuth(); return; }
    const text = content.trim();
    if (!text && images.length === 0) return;
    setSubmitting(true);
    try {
      // 1) create the post shell (text + visibility); 2) attach images if any.
      const post = await wfNewApi.createPost({
        content: text || undefined,
        post_type: images.length > 0 ? 'images' : 'text',
        visibility,
      });
      let finalPost = post;
      if (images.length > 0) {
        finalPost = await wfNewApi.uploadPostImages(post.id, images.map(im => im.file));
      }
      onPosted(finalPost);
      addToast(trans('social.postPublished'), 'success');
      reset();
    } catch {
      addToast(trans('social.postFailed'), 'warning');
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, requireAuth, content, images, visibility, onPosted, addToast, trans, reset]);

  return (
    <div className={`p-5 rounded-2xl ${activeTheme.cardClass} border border-white/5 space-y-4 max-w-2xl mx-auto`}>
      <h4 className="text-xs font-black font-mono tracking-widest text-indigo-400 uppercase">
        {trans('social.composeTitle')}
      </h4>

      <textarea
        rows={4}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={trans('social.composePh')}
        className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500 resize-none"
      />

      {/* Pending image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((im, idx) => (
            <motion.div
              key={im.preview}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 group"
            >
              <img src={im.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Hidden multi-image file input (web fallback / explicit gallery pick) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-indigo-500/15 border border-white/5 text-zinc-300 hover:text-indigo-300 text-[11px] font-mono transition-all cursor-pointer disabled:opacity-40"
          >
            <ImagePlus className="w-4 h-4" /> {trans('social.addImages')}
          </button>
          <button
            onClick={handleCapture}
            disabled={images.length >= MAX_IMAGES}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-indigo-500/15 border border-white/5 text-zinc-300 hover:text-indigo-300 text-[11px] font-mono transition-all cursor-pointer disabled:opacity-40"
          >
            <Camera className="w-4 h-4" /> {trans('social.capture')}
          </button>

          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value as WfNewPostVisibility)}
            className="px-2.5 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] text-slate-300 font-mono outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="public">{trans('social.visibility.public')}</option>
            <option value="friends">{trans('social.visibility.friends')}</option>
            <option value="private">{trans('social.visibility.private')}</option>
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || (!content.trim() && images.length === 0)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold font-mono transition-all cursor-pointer"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {trans('social.publish')}
        </button>
      </div>
    </div>
  );
};
