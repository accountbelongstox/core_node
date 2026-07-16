/**
 * Rotating cover — cycles through image_urls in a small card region.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { COVER_ROTATE_INTERVAL_MS, resolveCoverUrls } from '../constants/coverPlayback';

interface WfNewRotatingCoverProps {
  imageUrl?: string;
  imageUrls?: string[] | string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  showBadge?: boolean;
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (urls.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % urls.length);
    }, COVER_ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [urls]);

  if (!urls.length) return null;

  return (
    <div className={className}>
      <img
        key={urls[index]}
        src={urls[index]}
        alt={alt}
        loading="lazy"
        className={imgClassName}
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
