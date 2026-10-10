import { useEffect, useMemo, useState } from 'react';
import { detectMobilePlatform, type CmAppPlatform } from '../cmAppDownloads';
import { cmPublicApi, type CmAppDownloadEntry } from '../api/CmPublicApi';

export interface CmAppDownloadsModel {
  /** Null while the list loads; an empty list when nothing is published. */
  downloads: CmAppDownloadEntry[] | null;
  detected: CmAppPlatform | null;
  highlighted: CmAppPlatform | null;
  featured: CmAppDownloadEntry | null;
}

/** Published app packages with the visitor's platform promoted; shared by the web and mobile download screens. */
export function useCmAppDownloads(): CmAppDownloadsModel {
  const detected = useMemo(detectMobilePlatform, []);
  const [downloads, setDownloads] = useState<CmAppDownloadEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    void cmPublicApi.getAppDownloads().then((response) => {
      if (active) setDownloads(response.success && response.data ? response.data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  const platforms = downloads ?? [];
  const highlighted = detected && platforms.some((entry) => entry.platform === detected)
    ? detected
    : platforms[0]?.platform ?? null;
  const featured = highlighted ? platforms.find((entry) => entry.platform === highlighted) ?? null : null;

  return { downloads, detected, highlighted, featured };
}
