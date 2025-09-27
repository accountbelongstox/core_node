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

class DomainContext {
  constructor(rawUrl) {
    if (!rawUrl) {
      throw new Error('DomainContext requires a target URL');
    }
    this.mainUrl = new URL(rawUrl);
    this.origin = `${this.mainUrl.protocol}//${this.mainUrl.host}`;
    this.domainKey = this.normalizeDomain(this.mainUrl.hostname);
    this.scopePath = this.computeScopePath(this.mainUrl.pathname);
    this.scopeUrl = this.composeScopeUrl();
    this.startUrl = this.canonicalize(this.mainUrl) || this.mainUrl.toString();
  }

  computeScopePath(pathname) {
    let sanitizedPath = pathname || '/';
    sanitizedPath = sanitizedPath.replace(/\/+/g, '/');
    if (!sanitizedPath || sanitizedPath === '/') {
      return '/';
    }
    if (sanitizedPath.endsWith('/')) {
      sanitizedPath = sanitizedPath.replace(/\/+$/, '');
      if (!sanitizedPath) {
        return '/';
      }
    }
    const directory = path.posix.dirname(sanitizedPath);
    if (!directory || directory === '.' || directory === '') {
      return '/';
    }
    return directory.startsWith('/') ? directory : `/${directory}`;
  }

  composeScopeUrl() {
    if (!this.scopePath || this.scopePath === '/') {
      return this.origin;
    }
    return `${this.origin}${this.scopePath}`;
  }

  normalizeDomain(hostname) {
    if (!hostname) {
      return '';
    }
    return hostname.replace(/^www\./i, '').toLowerCase();
  }

  resolveHref(baseUrl, href) {
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      return null;
    }

    try {
      const resolved = new URL(href, baseUrl);
      if (!resolved.protocol.startsWith('http')) {
        return null;
      }
      resolved.hash = '';
      if (resolved.pathname.length > 1) {
        resolved.pathname = resolved.pathname.replace(/\/+/g, '/');
        if (resolved.pathname.endsWith('/')) {
          resolved.pathname = resolved.pathname.replace(/\/+$/, '');
          if (resolved.pathname === '') {
            resolved.pathname = '/';
          }
        }
      }
      return {
        url: resolved,
        canonical: this.canonicalize(resolved)
      };
    } catch (error) {
      return null;
    }
  }

  canonicalize(candidateUrl) {
    try {
      const urlObject = candidateUrl instanceof URL ? candidateUrl : new URL(candidateUrl);
      urlObject.hash = '';
      if (urlObject.pathname.length > 1) {
        urlObject.pathname = urlObject.pathname.replace(/\/+/g, '/');
        if (urlObject.pathname.endsWith('/')) {
          urlObject.pathname = urlObject.pathname.replace(/\/+$/, '');
          if (urlObject.pathname === '') {
            urlObject.pathname = '/';
          }
        }
      }
      return urlObject.toString();
    } catch (error) {
      return null;
    }
  }

  isInternalLink(candidateUrl) {
    if (!candidateUrl) {
      return false;
    }
    let urlObject;
    try {
      urlObject = candidateUrl instanceof URL ? candidateUrl : new URL(candidateUrl);
    } catch (error) {
      return false;
    }
    return this.normalizeDomain(urlObject.hostname) === this.domainKey;
  }

  getOrigin() {
    return this.origin;
  }

  getValidationDomain() {
    return this.domainKey;
  }

  getScopeUrl() {
    return this.scopeUrl;
  }

  getScopePath() {
    return this.scopePath;
  }

  getStartUrl() {
    return this.startUrl;
  }

  getStorageRoot() {
    return this.origin;
  }
}

module.exports = DomainContext;
