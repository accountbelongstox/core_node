/**
 * Rotating cover — cycles through a book's latest covers (max 5) in a small
 * card region. Each card gets a deterministic transition mode (slide left /
 * right / up / down / rounded zoom reveal) and a staggered interval derived
 * from its seed, so a grid of cards never refreshes in lockstep.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  coverCarouselMode,
  coverRotateInterval,
  resolveCoverUrls,
  type CoverCarouselMode,
} from '../constants/coverPlayback';

interface WfNewRotatingCoverProps {
  imageUrl?: string;
  imageUrls?: string[] | string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  showBadge?: boolean;
}

/** Enter animation per mode (the outgoing slide stays put underneath). */
const ENTER_CLASS: Record<CoverCarouselMode, string> = {
  'slide-left': 'wf-cover-enter-slide-left',
  'slide-right': 'wf-cover-enter-slide-right',
  'slide-up': 'wf-cover-enter-slide-up',
  'slide-down': 'wf-cover-enter-slide-down',
  'zoom-reveal': 'wf-cover-enter-zoom-reveal',
};

const KEYFRAMES = `
@keyframes wfCoverSlideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes wfCoverSlideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes wfCoverSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes wfCoverSlideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@keyframes wfCoverZoomReveal {
  from { transform: scale(0.35); border-radius: 50%; opacity: 0.4; }
  to { transform: scale(1); border-radius: 0; opacity: 1; }
}
.wf-cover-enter-slide-left { animation: wfCoverSlideLeft 0.7s ease both; }
.wf-cover-enter-slide-right { animation: wfCoverSlideRight 0.7s ease both; }
.wf-cover-enter-slide-up { animation: wfCoverSlideUp 0.7s ease both; }
.wf-cover-enter-slide-down { animation: wfCoverSlideDown 0.7s ease both; }
.wf-cover-enter-zoom-reveal { animation: wfCoverZoomReveal 0.8s ease both; }
`;

let keyframesInjected = false;
function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === 'undefined') return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-wf-cover', '1');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

export const WfNewRotatingCover: React.FC<WfNewRotatingCoverProps> = ({
  imageUrl,
  imageUrls,
  alt = '',
  className = 'absolute inset-0 h-full w-full',
  imgClassName = 'absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105',
  showBadge = true,
}) => {
  const urls = useMemo(() => resolveCoverUrls(imageUrl, imageUrls), [imageUrl, imageUrls]);
  const seed = useMemo(() => alt || urls[0] || 'cover', [alt, urls]);
  const mode = useMemo(() => coverCarouselMode(seed), [seed]);
  const intervalMs = useMemo(() => coverRotateInterval(seed), [seed]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  useEffect(() => {
    setIndex(0);
    if (urls.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % urls.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [urls, intervalMs]);

  if (!urls.length) return null;

  return (
    <div className={className} style={{ overflow: 'hidden' }}>
      <img
        key={`${urls[index]}-${index}`}
        src={urls[index]}
        alt={alt}
        loading="lazy"
        className={`${imgClassName} ${urls.length > 1 ? ENTER_CLASS[mode] : ''}`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      {showBadge && urls.length > 1 && (
        <span className="absolute bottom-1.5 right-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-black/45 text-white/90">
          {index + 1}/{urls.length}
        </span>
      )}
    </div>
  );
};
