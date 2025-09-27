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

const DYNAMIC_FALLBACK_EXTENSIONS = new Set([
  '.asp', '.aspx', '.ashx', '.jsp', '.jspx', '.php', '.php3', '.php4', '.php5', '.phtml',
  '.do', '.action', '.cfm', '.cgi', '.pl'
]);

class FileMapper {
  constructor(allowedExtensions) {
    const fallbackExtensions = new Set(['.html']);
    const source = allowedExtensions && allowedExtensions.size > 0 ? allowedExtensions : fallbackExtensions;
    const normalized = Array.from(source).map(item => (item || '').toLowerCase());
    this.allowedExtensions = new Set(normalized);
    this.dynamicExtensions = DYNAMIC_FALLBACK_EXTENSIONS;
  }

  mapPath(parsedUrl) {
    let pathname = parsedUrl.pathname || '/';
    const search = parsedUrl.search || '';
    const hasTrailingSlash = pathname.endsWith('/');
    const segments = pathname.split('/').filter(Boolean);
    const sanitizedSegments = segments.map(segment => this.sanitize(segment)).filter(Boolean);
    const rawLastSegment = segments.length > 0 ? segments[segments.length - 1] : '';
    const sanitizedLastSegment = rawLastSegment ? this.sanitize(rawLastSegment) : '';
    const rawExtension = rawLastSegment ? path.extname(rawLastSegment) : '';
    const normalizedExtension = rawExtension ? rawExtension.toLowerCase() : '';
    const sanitizedBase = rawExtension ? this.sanitize(rawLastSegment.slice(0, -rawExtension.length)) : sanitizedLastSegment;
    const directorySegments = [];
    let filename = 'index';
    let extension = '.html';
    let finalPath;

    if (segments.length === 0) {
      filename = 'index';
      extension = '.html';
    } else if (hasTrailingSlash) {
      directorySegments.push(...sanitizedSegments);
      filename = 'index';
      extension = '.html';
    } else if (normalizedExtension) {
      const directorySlice = sanitizedSegments.slice(0, -1);
      const extensionPart = normalizedExtension.slice(1);
      const allowedExtension = this.isAllowedExtension(normalizedExtension);
      const baseIsNumeric = /^[0-9]+$/.test(sanitizedBase || '');
      const looksLikeFileExt = extensionPart.length >= 2 && /^[a-zA-Z0-9]{2,8}$/.test(extensionPart);
      const shortExtLooksLikeFile = extensionPart.length === 1 && !baseIsNumeric;
      const treatAsFile = allowedExtension || this.dynamicExtensions.has(normalizedExtension) || looksLikeFileExt || shortExtLooksLikeFile;

      if (treatAsFile) {
        directorySegments.push(...directorySlice);
        filename = sanitizedBase || 'index';
        extension = allowedExtension ? normalizedExtension : '.html';
      } else {
        directorySegments.push(...sanitizedSegments);
        filename = 'index';
        extension = '.html';
      }
    } else {
      directorySegments.push(...sanitizedSegments);
      filename = 'index';
      extension = '.html';
    }

    if (search) {
      const normalizedSearch = search.replace(/^\?/, '');
      const querySafe = this.sanitize(normalizedSearch);
      if (querySafe) {
        filename = `${filename}_${querySafe}`;
      }
    }

    const safeDir = directorySegments.length > 0 ? path.join(...directorySegments) : '';
    const safeFile = `${filename}${extension}`;
    if (safeDir) {
      finalPath = path.join(safeDir, safeFile);
    } else {
      finalPath = safeFile;
    }

    return finalPath.replace(/^[/\\]+/, '');
  }

  isAllowedExtension(ext) {
    if (!ext) {
      return false;
    }
    return this.allowedExtensions.has(ext.toLowerCase());
  }

  sanitize(name) {
    if (!name) {
      return '';
    }
    return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }
}

module.exports = FileMapper;
