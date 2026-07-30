import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ZoomIn } from 'lucide-react';

/**
 * WfNewAvatarCropper — a dependency-free circular avatar cropper.
 *
 * No crop library is installed in this app (only framer-motion / react-router);
 * react-easy-crop / @use-gesture were evaluated but adding a dependency was
 * avoided. Gestures are handled with native Pointer Events (one API for touch +
 * mouse + pen): drag a single pointer to PAN, pinch two fingers to ZOOM (plus
 * a slider / mouse-wheel fallback). The visible circular region is rendered to a
 * 512×512 canvas and handed back as a JPEG `File`. Used by WfNewProfile before
 * calling wfNewApi.uploadAvatar.
 */

const VIEW = 280; // on-screen viewport size (px)
const OUT = 512;  // exported avatar size (px)

interface WfNewAvatarCropperProps {
  file: File;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

export const WfNewAvatarCropper: React.FC<WfNewAvatarCropperProps> = ({
  file,
  trans,
  onCancel,
  onCropped,
}) => {
  const [imgUrl, setImgUrl] = useState<string>('');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Active pointers (touch/mouse/pen) + the last gesture centroid & pinch span,
  // so one pointer pans and two pointers pinch-zoom.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Load the selected file into an object URL (revoked on unmount).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Scale that makes the image COVER the square viewport at zoom = 1.
  const baseScale = natural ? VIEW / Math.min(natural.w, natural.h) : 1;
  const effScale = baseScale * zoom;
  const dispW = natural ? natural.w * effScale : VIEW;
  const dispH = natural ? natural.h * effScale : VIEW;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gestureRef.current = null; // recomputed on the next move
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts: Array<{ x: number; y: number }> = Array.from(pointers.values());

    if (pts.length === 1) {
      // One pointer → PAN by the centroid delta.
      const g = gestureRef.current;
      if (g) setOffset((o) => ({ x: o.x + (pts[0].x - g.cx), y: o.y + (pts[0].y - g.cy) }));
      gestureRef.current = { dist: 0, cx: pts[0].x, cy: pts[0].y };
    } else if (pts.length >= 2) {
      // Two pointers → PINCH zoom (distance ratio) + pan by centroid delta.
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const g = gestureRef.current;
      if (g && g.dist > 0) {
        const ratio = dist / g.dist;
        setZoom((z) => Math.min(4, Math.max(1, z * ratio)));
        setOffset((o) => ({ x: o.x + (cx - g.cx), y: o.y + (cy - g.cy) }));
      }
      gestureRef.current = { dist, cx, cy };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const pts: Array<{ x: number; y: number }> = Array.from(pointersRef.current.values());
    // Re-anchor so the remaining finger doesn't jump after a pinch ends.
    gestureRef.current = pts.length === 1 ? { dist: 0, cx: pts[0].x, cy: pts[0].y } : null;
  };

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)));
  };

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    if (!img || !natural) return;
    // Map the visible circular viewport back to source pixels.
    const srcVisible = VIEW / effScale;
    const srcCenterX = natural.w / 2 - offset.x / effScale;
    const srcCenterY = natural.h / 2 - offset.y / effScale;
    const sx = srcCenterX - srcVisible / 2;
    const sy = srcCenterY - srcVisible / 2;

    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, srcVisible, srcVisible, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cropped = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCropped(cropped);
      },
      'image/jpeg',
      0.9
    );
  }, [natural, effScale, offset, onCropped]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-lg" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm bg-zinc-900/95 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-100">{trans('crop.title')}</h3>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Circular crop viewport */}
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-full border-2 border-indigo-500/40 bg-slate-950 cursor-grab active:cursor-grabbing touch-none"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="crop"
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  width: dispW,
                  height: dispH,
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  maxWidth: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            {/* Ring overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/20" />
          </div>
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-1">
          <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 border border-white/10 cursor-pointer"
          >
            {trans('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-xs font-mono font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>{trans('crop.apply')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
