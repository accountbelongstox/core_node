const path = require('path');
const { URL } = require('url');

class PathResolver {
  constructor(fileMapper) {
    this.fileMapper = fileMapper;
  }

  isAbsoluteUrl(url) {
    if (!url) return false;
    url = url.trim();
    return url.startsWith('http://') ||
           url.startsWith('https://') ||
           url.startsWith('//');
  }

  isRelativeUrl(url) {
    if (!url) return false;
    url = url.trim();
    if (this.isAbsoluteUrl(url)) return false;
    if (url.startsWith('data:') ||
        url.startsWith('javascript:') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('blob:') ||
        url.startsWith('#')) {
      return false;
    }
    return true;
  }

  resolveResourcePath(resourceUrl, htmlUrl, originalResourceUrl = null) {
    try {
      const resourceUrlObj = new URL(resourceUrl);
      const htmlUrlObj = new URL(htmlUrl);
      const wasRelative = originalResourceUrl ? this.isRelativeUrl(originalResourceUrl) : false;

      if (resourceUrlObj.hostname === htmlUrlObj.hostname || wasRelative) {
        return this.fileMapper.mapPath(resourceUrlObj);
      } else {
        const domain = resourceUrlObj.hostname;
        const pathname = resourceUrlObj.pathname;
        const localPath = path.posix.join('src', domain, pathname);
        return localPath;
      }
    } catch (error) {
      return null;
    }
  }

  isSameOrigin(url1, url2) {
    try {
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);
      return urlObj1.hostname === urlObj2.hostname;
    } catch (error) {
      return false;
    }
  }

  calculateRelativePath(fromUrl, toUrl) {
    try {
      const fromUrlObj = new URL(fromUrl);
      const toUrlObj = new URL(toUrl);

      const fromPath = this.resolveResourcePath(fromUrl, fromUrl);
      const toPath = this.resolveResourcePath(toUrl, fromUrl);

      if (!fromPath || !toPath) return null;

      const fromDir = path.posix.dirname(fromPath);
      const relativePath = path.posix.relative(fromDir, toPath);

      if (relativePath.startsWith('..')) {
        return relativePath;
      }

      return relativePath || './';
    } catch (error) {
      return null;
    }
  }

  normalizePathSeparators(filePath) {
    return filePath.replace(/\\/g, '/');
  }
}

module.exports = PathResolver;
