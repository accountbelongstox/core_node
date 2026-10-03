/** Meta tag snippet builder and SERP / card preview helpers. */

export type MetaPageType = 'website' | 'article' | 'product';
export type TwitterCardType = 'summary' | 'summary_large_image';

export interface MetaTagInput {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  siteName: string;
  type: MetaPageType;
  locale: string;
  twitterCard: TwitterCardType;
  twitterSite: string;
  author: string;
  keywords: string;
  themeColor: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  viewport: boolean;
  charset: boolean;
  canonical: boolean;
}

export const DEFAULT_META_INPUT: MetaTagInput = {
  title: '',
  description: '',
  url: '',
  image: '',
  imageAlt: '',
  siteName: '',
  type: 'website',
  locale: '',
  twitterCard: 'summary_large_image',
  twitterSite: '',
  author: '',
  keywords: '',
  themeColor: '',
  robotsIndex: true,
  robotsFollow: true,
  viewport: true,
  charset: true,
  canonical: true,
};

export const TITLE_IDEAL_MAX = 60;
export const DESCRIPTION_IDEAL_MIN = 70;
export const DESCRIPTION_IDEAL_MAX = 160;

const escapeAttr = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const nameTag = (name: string, content: string): string => `<meta name="${name}" content="${escapeAttr(content)}">`;
const propertyTag = (property: string, content: string): string => `<meta property="${property}" content="${escapeAttr(content)}">`;

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export function buildMetaTags(input: MetaTagInput): string {
  const title = input.title.trim();
  const description = input.description.trim();
  const url = input.url.trim();
  const image = input.image.trim();
  const lines: string[] = [];
  if (input.charset) lines.push('<meta charset="utf-8">');
  if (input.viewport) lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if (title) lines.push(`<title>${escapeAttr(title)}</title>`);
  if (description) lines.push(nameTag('description', description));
  if (input.keywords.trim()) lines.push(nameTag('keywords', input.keywords.split(',').map((word) => word.trim()).filter(Boolean).join(', ')));
  if (input.author.trim()) lines.push(nameTag('author', input.author.trim()));
  lines.push(nameTag('robots', `${input.robotsIndex ? 'index' : 'noindex'}, ${input.robotsFollow ? 'follow' : 'nofollow'}`));
  if (input.themeColor.trim()) lines.push(nameTag('theme-color', input.themeColor.trim()));
  if (input.canonical && url) lines.push(`<link rel="canonical" href="${escapeAttr(url)}">`);
  if (title) lines.push(propertyTag('og:title', title));
  if (description) lines.push(propertyTag('og:description', description));
  lines.push(propertyTag('og:type', input.type));
  if (url) lines.push(propertyTag('og:url', url));
  if (image) lines.push(propertyTag('og:image', image));
  if (image && input.imageAlt.trim()) lines.push(propertyTag('og:image:alt', input.imageAlt.trim()));
  if (input.siteName.trim()) lines.push(propertyTag('og:site_name', input.siteName.trim()));
  if (input.locale.trim()) lines.push(propertyTag('og:locale', input.locale.trim()));
  lines.push(nameTag('twitter:card', image ? input.twitterCard : 'summary'));
  if (input.twitterSite.trim()) lines.push(nameTag('twitter:site', input.twitterSite.trim().startsWith('@') ? input.twitterSite.trim() : `@${input.twitterSite.trim()}`));
  if (title) lines.push(nameTag('twitter:title', title));
  if (description) lines.push(nameTag('twitter:description', description));
  if (image) lines.push(nameTag('twitter:image', image));
  if (image && input.imageAlt.trim()) lines.push(nameTag('twitter:image:alt', input.imageAlt.trim()));
  return lines.join('\n');
}

export const truncateText = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export const displayHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const breadcrumbUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return [`${parsed.protocol}//${parsed.hostname}`, ...parts].join(' › ');
  } catch {
    return '';
  }
};
