// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const cheerio = require('cheerio');

class ResourceExtractor {
  constructor(domainContext) {
    this.domainContext = domainContext;
  }

  extractFromHtml(html, baseUrl) {
    const resources = {
      css: new Set(),
      js: new Set(),
      images: new Set(),
      fonts: new Set(),
      media: new Set()
    };

    const $ = cheerio.load(html, { decodeEntities: false });
    const baseUrlObj = new URL(baseUrl);

    $('link[rel="stylesheet"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const resolved = this.resolveUrl(href, baseUrlObj);
        if (resolved) resources.css.add(resolved);
      }
    });

    $('link[rel="preload"][as="style"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const resolved = this.resolveUrl(href, baseUrlObj);
        if (resolved) resources.css.add(resolved);
      }
    });

    $('style').each((i, elem) => {
      const content = $(elem).html();
      if (content) {
        const inlineUrls = this.extractInlineStyleUrls(content, baseUrlObj);
        inlineUrls.forEach(url => {
          if (this.isImageUrl(url)) {
            resources.images.add(url);
          } else if (this.isFontUrl(url)) {
            resources.fonts.add(url);
          }
        });
      }
    });

    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const resolved = this.resolveUrl(src, baseUrlObj);
        if (resolved) resources.js.add(resolved);
      }
    });

    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const resolved = this.resolveUrl(src, baseUrlObj);
        if (resolved) resources.images.add(resolved);
      }
    });

    $('img[srcset], source[srcset]').each((i, elem) => {
      const srcset = $(elem).attr('srcset');
      if (srcset) {
        const urls = this.parseSrcset(srcset, baseUrlObj);
        urls.forEach(url => resources.images.add(url));
      }
    });

    $('picture source[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const resolved = this.resolveUrl(src, baseUrlObj);
        if (resolved) resources.images.add(resolved);
      }
    });

    $('video[src], audio[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const resolved = this.resolveUrl(src, baseUrlObj);
        if (resolved) resources.media.add(resolved);
      }
    });

    $('video source[src], audio source[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const resolved = this.resolveUrl(src, baseUrlObj);
        if (resolved) resources.media.add(resolved);
      }
    });

    $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const resolved = this.resolveUrl(href, baseUrlObj);
        if (resolved) resources.images.add(resolved);
      }
    });

    $('[style]').each((i, elem) => {
      const style = $(elem).attr('style');
      if (style) {
        const inlineUrls = this.extractInlineStyleUrls(style, baseUrlObj);
        inlineUrls.forEach(url => {
          if (this.isImageUrl(url)) {
            resources.images.add(url);
          }
        });
      }
    });

    return {
      css: Array.from(resources.css),
      js: Array.from(resources.js),
      images: Array.from(resources.images),
      fonts: Array.from(resources.fonts),
      media: Array.from(resources.media)
    };
  }

  extractInlineStyleUrls(styleContent, baseUrl) {
    const urls = [];
    const urlPattern = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    let match;

    while ((match = urlPattern.exec(styleContent)) !== null) {
      const url = match[2].trim();
      if (url && !url.startsWith('data:') && !url.startsWith('#')) {
        const resolved = this.resolveUrl(url, baseUrl);
        if (resolved) urls.push(resolved);
      }
    }

    return urls;
  }

  parseSrcset(srcset, baseUrl) {
    const urls = [];
    const entries = srcset.split(',').map(e => e.trim());

    for (const entry of entries) {
      const parts = entry.split(/\s+/);
      if (parts.length > 0) {
        const url = parts[0];
        const resolved = this.resolveUrl(url, baseUrl);
        if (resolved) urls.push(resolved);
      }
    }

    return urls;
  }

  resolveUrl(url, baseUrl) {
    if (!url) return null;

    url = url.trim();
    if (!url) return null;

    if (url.startsWith('data:') ||
        url.startsWith('javascript:') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('blob:') ||
        url.startsWith('#')) {
      return null;
    }

    try {
      const absoluteUrl = new URL(url, baseUrl.href);

      if (!this.domainContext.isInternalLink(absoluteUrl)) {
        return null;
      }

      return absoluteUrl.toString();
    } catch (error) {
      return null;
    }
  }

  isImageUrl(url) {
    if (!url) return false;
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp'];
    const urlLower = url.toLowerCase();
    return imageExts.some(ext => urlLower.includes(ext));
  }

  isFontUrl(url) {
    if (!url) return false;
    const fontExts = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
    const urlLower = url.toLowerCase();
    return fontExts.some(ext => urlLower.includes(ext));
  }
}

module.exports = ResourceExtractor;
