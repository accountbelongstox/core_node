/**
 * PcSearchImage — lazy (IntersectionObserver) image-search thumbnail whose bytes
 * come through the image-search resource route, cached per URL.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';

const LAZY_ROOT_MARGIN = '120px';
const resourceCache = new Map<string, Promise<string>>();

function loadResource(url: string): Promise<string> {
  const cached = resourceCache.get(url);
  if (cached) return cached;
  const pending = pycoreApi.getImageSearchResourceDataUrl(url).then((value) => {
    if (!value) resourceCache.delete(url);
    return value;
  });
  resourceCache.set(url, pending);
  return pending;
}

export const PcSearchImage: React.FC<{ url: string; alt: string; className: string }> = ({ url, alt, className }) => {
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: LAZY_ROOT_MARGIN });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    void loadResource(url).then((value) => { if (active) setSrc(value); });
    return () => { active = false; };
  }, [url, visible]);

  return src
    ? <img src={src} alt={alt} className={className} />
    : <span ref={targetRef} className={`${className} flex items-center justify-center`}><ImageOff className="w-4 h-4 text-slate-400" /></span>;
};
