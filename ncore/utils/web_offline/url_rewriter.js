const cheerio = require('cheerio');
const path = require('path');

class UrlRewriter {
  constructor(domainContext, fileMapper) {
    this.domainContext = domainContext;
    this.fileMapper = fileMapper;
  }

  rewriteHtml(html, currentUrl) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const currentUrlObj = new URL(currentUrl);

    this.rewriteLinks($, 'a', 'href', currentUrlObj);
    this.rewriteLinks($, 'link', 'href', currentUrlObj);
    this.rewriteLinks($, 'script', 'src', currentUrlObj);
    this.rewriteLinks($, 'img', 'src', currentUrlObj);
    this.rewriteLinks($, 'source', 'src', currentUrlObj);
    this.rewriteLinks($, 'source', 'srcset', currentUrlObj);
    this.rewriteLinks($, 'img', 'srcset', currentUrlObj);
    this.rewriteLinks($, 'video', 'src', currentUrlObj);
    this.rewriteLinks($, 'audio', 'src', currentUrlObj);
    this.rewriteLinks($, 'iframe', 'src', currentUrlObj);

    return $.html();
  }

  rewriteLinks($, tagName, attrName, currentUrlObj) {
    const self = this;
    $(tagName).each(function() {
      const elem = $(this);
      const attrValue = elem.attr(attrName);

      if (!attrValue) {
        return;
      }

      if (attrName === 'srcset') {
        const rewritten = self.rewriteSrcset(attrValue, currentUrlObj);
        if (rewritten !== attrValue) {
          elem.attr(attrName, rewritten);
        }
        return;
      }

      const rewritten = self.rewriteUrl(attrValue, currentUrlObj);
      if (rewritten !== attrValue) {
        elem.attr(attrName, rewritten);
      }
    });
  }

  rewriteSrcset(srcset, currentUrlObj) {
    const entries = srcset.split(',').map(entry => entry.trim());
    const rewritten = entries.map(entry => {
      const parts = entry.split(/\s+/);
      if (parts.length === 0) return entry;

      const url = parts[0];
      const descriptor = parts.slice(1).join(' ');
      const rewrittenUrl = this.rewriteUrl(url, currentUrlObj);

      return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
    });

    return rewritten.join(', ');
  }

  rewriteUrl(url, currentUrlObj) {
    if (!url) return url;

    url = url.trim();
    if (!url) return url;

    if (url.startsWith('data:') ||
        url.startsWith('javascript:') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('blob:') ||
        url.startsWith('#')) {
      return url;
    }

    try {
      const absoluteUrl = new URL(url, currentUrlObj.href);

      if (!this.domainContext.isInternalLink(absoluteUrl)) {
        return url;
      }

      const relativePath = this.calculateRelativePath(currentUrlObj, absoluteUrl);
      return relativePath;

    } catch (error) {
      return url;
    }
  }

  calculateRelativePath(fromUrl, toUrl) {
    const fromPath = this.fileMapper.mapPath(fromUrl);
    const toPath = this.fileMapper.mapPath(toUrl);

    const fromDir = path.posix.dirname(fromPath);
    const relativePath = path.posix.relative(fromDir, toPath);

    if (relativePath.startsWith('..')) {
      return relativePath;
    }

    return relativePath || './';
  }
}

module.exports = UrlRewriter;
