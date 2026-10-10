import { useEffect } from 'react';
import { flavorAssetUrl } from '../../shell/flavor';

const FAVICON_MARK = 'data-cm-favicon';
const FAVICON_LINKS = [
  { rel: 'icon', type: 'image/svg+xml', sizes: 'any', file: 'favicon.svg' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', file: 'favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '192x192', file: 'icon-192.png' },
  { rel: 'icon', type: 'image/png', sizes: '512x512', file: 'icon-512.png' },
  { rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180', file: 'apple-touch-icon-180.png' },
] as const;
const FLAVOR_DIR = 'flavors/codemart';

/** Small-logo favicon set for the CodeMart routes; the previous icons are restored on leave. */
export function useCmFavicon(): void {
  useEffect(() => {
    const replaced = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]'));
    const added: HTMLLinkElement[] = [];
    FAVICON_LINKS.forEach((spec) => {
      const href = flavorAssetUrl(`${FLAVOR_DIR}/${spec.file}`);
      if (!href) return;
      const link = document.createElement('link');
      link.rel = spec.rel;
      link.type = spec.type;
      link.setAttribute('sizes', spec.sizes);
      link.href = href;
      link.setAttribute(FAVICON_MARK, '');
      document.head.appendChild(link);
      added.push(link);
    });
    if (added.length > 0) replaced.forEach((link) => link.remove());
    return () => {
      added.forEach((link) => link.remove());
      replaced.forEach((link) => document.head.appendChild(link));
    };
  }, []);
}
