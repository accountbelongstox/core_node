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

class CssProcessor {
  constructor(domainContext, fileMapper) {
    this.domainContext = domainContext;
    this.fileMapper = fileMapper;
    this.urlPattern = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    this.importPattern = /@import\s+(['"])([^'"]+)\1/gi;
  }

  extractUrls(cssContent, baseUrl) {
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

module.exports = CssProcessor;
