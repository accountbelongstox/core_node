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

const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

class UnifiedResourceProcessor {
  constructor(domainContext, fileMapper, downloader, logger) {
    this.domainContext = domainContext;
    this.fileMapper = fileMapper;
    this.downloader = downloader;
    this.logger = logger;

    this.urlPattern = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    this.importPattern = /@import\s+(['"])([^'"]+)\1/gi;
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp'];
    this.fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];

    this.resourceMap = {
      css: new Set(),
      js: new Set(),
      images: new Set(),
      fonts: new Set(),
      media: new Set(),
      backgroundImages: new Set(),
      httpsImages: new Set(),
      externalCss: new Set(),
      externalJs: new Set(),
      externalImages: new Set(),
      externalFonts: new Set(),
      externalMedia: new Set()
    };
    this.downloaded = new Set();
    this.processedUrls = new Set();
  }

  extractAllResources(html, baseUrl, isFullMode = false) {
    const resources = this.extractFromHtml(html, baseUrl);

    if (isFullMode) {
      this.extractBackgroundImages(html, baseUrl, resources);
      this.extractHttpsImages(html, baseUrl, resources);
    }

    this.extractExternalResources(html, baseUrl, resources);

    return resources;
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

  extractBackgroundImages(html, baseUrl, resources) {
    const baseUrlObj = new URL(baseUrl);
    const backgroundImagePattern = /background(?:-image)?\s*:\s*url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    const imagesSet = new Set(resources.images);

    let match;
    while ((match = backgroundImagePattern.exec(html)) !== null) {
      const url = match[1].trim();
      if (url && !url.startsWith('data:') && !url.startsWith('#')) {
        const resolved = this.resolveUrl(url, baseUrlObj);
        if (resolved && !imagesSet.has(resolved)) {
          imagesSet.add(resolved);
          this.resourceMap.backgroundImages.add(resolved);
        }
      }
    }

    resources.images = Array.from(imagesSet);
  }

  extractHttpsImages(html, baseUrl, resources) {
    const httpsPattern = /https:\/\/[^\s<>"'{}|\\^`\[\]]*\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)/gi;
    const imagesSet = new Set(resources.images);

    let match;
    while ((match = httpsPattern.exec(html)) !== null) {
      const url = match[0];
      if (!imagesSet.has(url) && this.domainContext.isInternalLink(new URL(url))) {
        imagesSet.add(url);
        this.resourceMap.httpsImages.add(url);
      }
    }

    resources.images = Array.from(imagesSet);
  }

  extractExternalResources(html, baseUrl, resources) {
    const baseUrlObj = new URL(baseUrl);
    const $ = cheerio.load(html, { decodeEntities: false });

    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && !this.domainContext.isInternalLink(new URL(src, baseUrl.href))) {
        this.resourceMap.externalJs.add(src);
        if (!resources.externalJs) resources.externalJs = [];
        resources.externalJs.push(src);
      }
    });

    $('link[rel="stylesheet"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && !this.domainContext.isInternalLink(new URL(href, baseUrl.href))) {
        this.resourceMap.externalCss.add(href);
        if (!resources.externalCss) resources.externalCss = [];
        resources.externalCss.push(href);
      }
    });

    $('[style]').each((i, elem) => {
      const style = $(elem).attr('style');
      if (style) {
        const fontUrls = this.extractFontUrls(style, baseUrlObj);
        fontUrls.forEach(url => {
          if (!this.domainContext.isInternalLink(new URL(url, baseUrl.href))) {
            this.resourceMap.externalFonts.add(url);
            if (!resources.externalFonts) resources.externalFonts = [];
            resources.externalFonts.push(url);
          }
        });
      }
    });

    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && !src.startsWith('data:')) {
        try {
          const srcUrl = new URL(src, baseUrl.href).href;
          if (!this.domainContext.isInternalLink(new URL(srcUrl))) {
            this.resourceMap.externalImages.add(srcUrl);
            if (!resources.externalImages) resources.externalImages = [];
            resources.externalImages.push(srcUrl);
          }
        } catch (e) {}
      }
    });

    this.detectAndAddFavicon(baseUrlObj, resources);
  }

  detectAndAddFavicon(baseUrlObj, resources) {
    const faviconUrl = baseUrlObj.href.replace(/\/$/, '') + '/favicon.ico';

    if (!resources.externalImages) resources.externalImages = [];

    if (!resources.externalImages.includes(faviconUrl)) {
      this.resourceMap.externalImages.add(faviconUrl);
      resources.externalImages.push(faviconUrl);
    }
  }

  extractFontUrls(styleContent, baseUrl) {
    const urls = [];
    const fontPattern = /url\s*\(\s*['"]?([^'")\s]+\.(?:woff2?|ttf|otf|eot))['"]?\s*\)/gi;
    let match;

    while ((match = fontPattern.exec(styleContent)) !== null) {
      const url = match[1].trim();
      if (url) {
        try {
          const absoluteUrl = new URL(url, baseUrl.href);
          urls.push(absoluteUrl.toString());
        } catch (error) {}
      }
    }

    return urls;
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

  extractCssUrls(cssContent, baseUrl) {
    const urls = new Set();
    const baseUrlObj = new URL(baseUrl);

    const urlMatches = cssContent.matchAll(this.urlPattern);
    for (const match of urlMatches) {
      const url = match[2].trim();
      if (url && !url.startsWith('data:') && !url.startsWith('#')) {
        try {
          const absoluteUrl = new URL(url, baseUrlObj.href);
          urls.add(absoluteUrl.toString());
        } catch (error) {
        }
      }
    }

    const importMatches = cssContent.matchAll(this.importPattern);
    for (const match of importMatches) {
      const url = match[2].trim();
      if (url && !url.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(url, baseUrlObj.href);
          urls.add(absoluteUrl.toString());
        } catch (error) {
        }
      }
    }

    return Array.from(urls);
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

  rewriteCss(cssContent, currentUrl) {
    const currentUrlObj = new URL(currentUrl);
    let rewritten = cssContent;

    rewritten = rewritten.replace(this.urlPattern, (match, quote, url) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl || trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('#')) {
        return match;
      }

      try {
        const absoluteUrl = new URL(trimmedUrl, currentUrlObj.href);

        if (!this.domainContext.isInternalLink(absoluteUrl)) {
          return match;
        }

        const relativePath = this.calculateRelativePath(currentUrlObj, absoluteUrl);
        const q = quote || '';
        return `url(${q}${relativePath}${q})`;
      } catch (error) {
        return match;
      }
    });

    rewritten = rewritten.replace(this.importPattern, (match, quote, url) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl || trimmedUrl.startsWith('data:')) {
        return match;
      }

      try {
        const absoluteUrl = new URL(trimmedUrl, currentUrlObj.href);

        if (!this.domainContext.isInternalLink(absoluteUrl)) {
          return match;
        }

        const relativePath = this.calculateRelativePath(currentUrlObj, absoluteUrl);
        return `@import ${quote}${relativePath}${quote}`;
      } catch (error) {
        return match;
      }
    });

    return rewritten;
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
      const isInternal = this.domainContext.isInternalLink(absoluteUrl);

      if (!isInternal) {
        const domain = absoluteUrl.hostname;
        const pathname = absoluteUrl.pathname;
        const localPath = path.posix.join('src', domain, pathname);

        const fromDir = path.posix.dirname(this.getLocalPathForUrl(currentUrlObj.href));
        const relativePath = path.posix.relative(fromDir, localPath);

        if (relativePath.startsWith('../')) {
          return relativePath;
        }

        return relativePath || './';
      }

      const relativePath = this.calculateRelativePath(currentUrlObj, absoluteUrl);

      if (relativePath.startsWith('../')) {
        return relativePath;
      }

      return relativePath || './';

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

  getLocalPathForUrl(url) {
    try {
      const urlObj = new URL(url);
      const isInternal = this.domainContext.isInternalLink(urlObj);

      if (isInternal) {
        return this.fileMapper.mapPath(urlObj);
      } else {
        const domain = urlObj.hostname;
        const pathname = urlObj.pathname;
        const localPath = path.posix.join('src', domain, pathname);
        return localPath;
      }
    } catch (error) {
      return null;
    }
  }

  async downloadResources(resources, baseDir) {
    const allUrls = [
      ...resources.css,
      ...resources.js,
      ...resources.images,
      ...resources.fonts,
      ...resources.media,
      ...(resources.externalCss || []),
      ...(resources.externalJs || []),
      ...(resources.externalImages || []),
      ...(resources.externalFonts || []),
      ...(resources.externalMedia || [])
    ];

    if (allUrls.length === 0) {
      return { downloaded: 0, skipped: 0, failed: 0 };
    }

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const url of allUrls) {
      const result = await this.downloadResource(url, baseDir);

      if (result.success) {
        downloaded++;
        if (result.isText && this.isCssContent(result.path)) {
          const rewrittenCss = this.rewriteCss(result.content, url);
          await fs.promises.writeFile(result.path, rewrittenCss, 'utf8');
        }
      } else if (result.skipped) {
        skipped++;
      } else {
        failed++;
      }

      await this.delay(50);
    }

    return { downloaded, skipped, failed };
  }

  async downloadResource(url, baseDir) {
    const canonical = url;

    if (this.downloaded.has(canonical)) {
      return { skipped: true, reason: 'already_downloaded' };
    }

    try {
      const relativePath = this.getLocalPathForUrl(url);
      if (!relativePath) {
        return { success: false, error: 'invalid_url' };
      }

      const finalPath = path.join(baseDir, relativePath);

      if (fs.existsSync(finalPath)) {
        this.downloaded.add(canonical);
        return { skipped: true, reason: 'file_exists', path: finalPath };
      }

      const directory = path.dirname(finalPath);
      this.ensureDirectory(directory);

      let contentType = null;
      const downloadedPath = await this.downloader.HTTPDownload(url, finalPath, {
        onProgress: () => {},
        onHeaders: (headers) => {
          contentType = headers['content-type'] || null;
        }
      });

      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        return { success: false, error: 'download_failed' };
      }

      this.downloaded.add(canonical);

      const isTextContent = this.isTextContentType(contentType);
      const content = isTextContent
        ? await fs.promises.readFile(downloadedPath, 'utf8')
        : await fs.promises.readFile(downloadedPath);

      return {
        success: true,
        path: downloadedPath,
        content: content,
        contentType: contentType,
        isText: isTextContent,
        isBinary: !isTextContent
      };

    } catch (error) {
      this.logger.error(`Failed to download resource ${url}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  generateMapsite(downloadedUrls, baseDir) {
    const mapsiteData = {
      timestamp: new Date().toISOString(),
      domain: this.domainContext.getOrigin(),
      totalUrls: downloadedUrls.length,
      resourceStats: {
        css: this.resourceMap.css.size,
        js: this.resourceMap.js.size,
        images: this.resourceMap.images.size,
        fonts: this.resourceMap.fonts.size,
        media: this.resourceMap.media.size,
        backgroundImages: this.resourceMap.backgroundImages.size,
        httpsImages: this.resourceMap.httpsImages.size
      },
      urls: downloadedUrls.map(url => ({
        url: url,
        localPath: this.fileMapper.mapPath(new URL(url)),
        fetchedAt: new Date().toISOString()
      }))
    };

    const mapsitePath = path.join(baseDir, 'mapsite.json');
    fs.writeFileSync(mapsitePath, JSON.stringify(mapsiteData, null, 2), 'utf8');

    return mapsitePath;
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
    const urlLower = url.toLowerCase();
    return this.imageExtensions.some(ext => urlLower.includes(ext));
  }

  isFontUrl(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return this.fontExtensions.some(ext => urlLower.includes(ext));
  }

  isCssContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.css';
  }

  isTextContentType(contentType) {
    if (!contentType) {
      return false;
    }
    const textTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/xhtml+xml',
      'application/x-javascript'
    ];
    const lowerType = contentType.toLowerCase();
    return textTypes.some(type => lowerType.includes(type));
  }

  ensureDirectory(directory) {
    if (fs.existsSync(directory)) {
      const stats = fs.lstatSync(directory);
      if (stats.isDirectory()) {
        return;
      }
      fs.unlinkSync(directory);
    }
    fs.mkdirSync(directory, { recursive: true });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset() {
    this.resourceMap = {
      css: new Set(),
      js: new Set(),
      images: new Set(),
      fonts: new Set(),
      media: new Set(),
      backgroundImages: new Set(),
      httpsImages: new Set(),
      externalCss: new Set(),
      externalJs: new Set(),
      externalImages: new Set(),
      externalFonts: new Set(),
      externalMedia: new Set()
    };
    this.downloaded.clear();
    this.processedUrls.clear();
  }
}

module.exports = UnifiedResourceProcessor;
