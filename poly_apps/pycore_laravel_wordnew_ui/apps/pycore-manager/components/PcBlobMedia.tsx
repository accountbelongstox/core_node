/**
 * PcBlobMedia — image/audio bytes returned by an HTTP controller as a data URL via
 * concrete HTTP v2 resource controllers instead of an HTTP element src to :59000. It remains
 * empty until the HTTP request completes.
 */
import React, { useEffect, useState } from 'react';
import { fetchPycoreBlobUrl } from '../../../core/api-libs/pycore/PycoreBlob';

/** Resolve a pycore media path to an HTTP-fetched data URL. */
export function usePycoreBlobUrl(url: string | null | undefined): string | undefined {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!url) { setSrc(undefined); return; }
    void fetchPycoreBlobUrl(url).then((u) => { if (alive) setSrc(u || undefined); });
    return () => { alive = false; };
  }, [url]);
  return src;
}

type ImgProps = { path: string | null | undefined } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/** Image whose bytes are fetched through HTTP. */
export const PcBlobImage: React.FC<ImgProps> = ({ path, ...rest }) => {
  const src = usePycoreBlobUrl(path);
  return <img src={src} {...rest} />;
};

type AudioProps = { path: string | null | undefined } & Omit<React.AudioHTMLAttributes<HTMLAudioElement>, 'src'>;

/** Audio whose bytes are fetched through HTTP. */
export const PcBlobAudio = React.forwardRef<HTMLAudioElement, AudioProps>(({ path, ...rest }, ref) => {
  const src = usePycoreBlobUrl(path);
  return <audio ref={ref} src={src} {...rest} />;
});
PcBlobAudio.displayName = 'PcBlobAudio';
