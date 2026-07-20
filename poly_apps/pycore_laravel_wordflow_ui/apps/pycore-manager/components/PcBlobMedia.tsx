/**
 * PcBlobMedia — <img>/<audio> whose bytes come over the WS bus (data: URL via
 * local_http.blob) instead of an HTTP element src to :59000. Falls back to the
 * direct HTTP URL when WS is not connected, so display never regresses.
 */
import React, { useEffect, useState } from 'react';
import { fetchPycoreBlobUrl } from '../../../core/api-libs/pycore/PycoreBlob';

/** Resolve a pycore media path (relative or absolute) to a WS-fetched data: URL
 *  (cached), or the direct HTTP URL as fallback. */
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

/** <img> whose bytes are fetched over WS. */
export const PcBlobImage: React.FC<ImgProps> = ({ path, ...rest }) => {
  const src = usePycoreBlobUrl(path);
  return <img src={src} {...rest} />;
};

type AudioProps = { path: string | null | undefined } & Omit<React.AudioHTMLAttributes<HTMLAudioElement>, 'src'>;

/** <audio> whose bytes are fetched over WS. Forwards a ref for imperative play. */
export const PcBlobAudio = React.forwardRef<HTMLAudioElement, AudioProps>(({ path, ...rest }, ref) => {
  const src = usePycoreBlobUrl(path);
  return <audio ref={ref} src={src} {...rest} />;
});
PcBlobAudio.displayName = 'PcBlobAudio';
