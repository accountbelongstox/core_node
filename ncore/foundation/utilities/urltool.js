// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const { URL } = require('url');
const logger = require('#@logger');

class UrlTool {
    constructor() {
        this.mimeToExtMap = {
            'audio/mpeg': '.mp3',
            'audio/mpga': '.mp3',
            'audio/mp4': '.mp4',
            'audio/wav': '.wav',
            'audio/wave': '.wav',
            'audio/x-wav': '.wav',
            'audio/x-pn-wav': '.wav',
            'audio/webm': '.webm',
            'audio/ogg': '.ogg',
            'audio/flac': '.flac',
            'audio/x-flac': '.flac',
            'audio/aac': '.aac',
            'audio/x-aac': '.aac',
            'audio/x-m4a': '.m4a',
            'audio/x-matroska': '.mka',
            'audio/vnd.wav': '.wav',
            'audio/x-ms-wma': '.wma',
            'audio/x-ms-wax': '.wax',
            'audio/vnd.rn-realaudio': '.ra',
            'audio/x-pn-realaudio': '.ram',
            'audio/basic': '.au',
            'audio/x-aiff': '.aif',
            'audio/x-mpegurl': '.m3u',
            'audio/x-scpls': '.pls',
            'audio/midi': '.mid',
            'audio/x-midi': '.mid',

            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'image/bmp': '.bmp',
            'image/x-icon': '.ico',
            'image/tiff': '.tiff',

            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogv',
            'video/x-msvideo': '.avi',
            'video/quicktime': '.mov',
            'video/x-ms-wmv': '.wmv',
            'video/x-flv': '.flv',
            'video/3gpp': '.3gp',
            'video/x-matroska': '.mkv',

            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'application/vnd.ms-powerpoint': '.ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',

            'text/plain': '.txt',
            'text/html': '.html',
            'text/css': '.css',
            'text/javascript': '.js',
            'application/json': '.json',
            'application/xml': '.xml',
            'application/zip': '.zip',
            'application/x-rar-compressed': '.rar',
            'application/x-tar': '.tar',
            'application/gzip': '.gz',
            'application/x-7z-compressed': '.7z'
        };
    }

    parse(url) {
        try {
            return new URL(url);
        } catch (error) {
            logger.warn(`Failed to parse URL: ${url}`, error.message);
            return null;
        }
    }

    isHttpUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        return url.startsWith('http://') || url.startsWith('https://');
    }

    isValidUrl(url) {
        return this.parse(url) !== null;
    }

    isDynamicUrl(url) {
        if (!url) {
            return false;
        }
        if (url.includes('?')) {
            return true;
        }
        const fileName = url.split('?').pop();
        return !fileName.includes('.');
    }

    isBlankUrl(url) {
        if (!url) {
            return true;
        }
        const normalizedUrl = url.toLowerCase();
        return normalizedUrl === 'nullblank' || normalizedUrl === 'about:blank';
    }

    isAboutBlankUrl(url) {
        return this.isBlankUrl(url);
    }

    normalizeBlankUrl(url) {
        if (!url) {
            return 'about:blank';
        }
        const normalizedUrl = url.toLowerCase();
        if (normalizedUrl === 'nullblank') {
            return 'about:blank';
        }
        return normalizedUrl;
    }

    normalizeUrl(url, options = {}) {
        const removeHash = options.removeHash !== false;
        const removeQuery = options.removeQuery === true;
        const removeTrailingSlash = options.removeTrailingSlash === true;
        const removeWww = options.removeWww === true;

        if (this.isBlankUrl(url)) {
            return this.normalizeBlankUrl(url);
        }

        const urlObj = this.parse(url);
        if (!urlObj) {
            return url;
        }

        if (removeHash) {
            urlObj.hash = '';
        }

        if (removeQuery) {
            urlObj.search = '';
        }

        if (removeWww && urlObj.hostname.startsWith('www.')) {
            urlObj.hostname = urlObj.hostname.substring(4);
        }

        let result = urlObj.href;

        if (removeTrailingSlash && result.endsWith('/')) {
            result = result.slice(0, -1);
        }

        return result;
    }

    removeHash(url) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return url;
        }
        urlObj.hash = '';
        return urlObj.href;
    }

    removeQueryParams(url) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return url;
        }
        urlObj.search = '';
        return urlObj.href;
    }

    getOrigin(url) {
        const urlObj = this.parse(url);
        return urlObj ? urlObj.origin : null;
    }

    getHostname(url) {
        const urlObj = this.parse(url);
        return urlObj ? urlObj.hostname : null;
    }

    getPathname(url) {
        const urlObj = this.parse(url);
        return urlObj ? urlObj.pathname : null;
    }

    getMainDomain(url) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return null;
        }
        return urlObj.hostname;
    }

    getDomainOnly(url) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return null;
        }
        let domain = urlObj.hostname;
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        return domain;
    }

    isSameOrigin(url1, url2) {
        const origin1 = this.getOrigin(url1);
        const origin2 = this.getOrigin(url2);
        return origin1 !== null && origin1 === origin2;
    }

    isSameDomain(url1, url2) {
        const domain1 = this.getDomainOnly(url1);
        const domain2 = this.getDomainOnly(url2);
        return domain1 !== null && domain1 === domain2;
    }

    equalDomain(url1, url2) {
        if (this.isBlankUrl(url1) || this.isBlankUrl(url2)) {
            return this.normalizeBlankUrl(url1) === this.normalizeBlankUrl(url2);
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 === url2;
        }

        const parsedUrl1 = this.parse(url1);
        const parsedUrl2 = this.parse(url2);

        if (!parsedUrl1 || !parsedUrl2) {
            return url1 === url2;
        }

        let domain1 = parsedUrl1.hostname;
        let domain2 = parsedUrl2.hostname;

        if (domain1.startsWith('www.')) {
            domain1 = domain1.substring(4);
        }
        if (domain2.startsWith('www.')) {
            domain2 = domain2.substring(4);
        }

        let pathname1 = parsedUrl1.pathname;
        let pathname2 = parsedUrl2.pathname;

        if (pathname1.endsWith('/')) {
            pathname1 = pathname1.slice(0, -1);
        }
        if (pathname2.endsWith('/')) {
            pathname2 = pathname2.slice(0, -1);
        }

        return domain1 === domain2 && pathname1 === pathname2;
    }

    equalDomainFull(url1, url2) {
        if (this.isBlankUrl(url1) || this.isBlankUrl(url2)) {
            return this.normalizeBlankUrl(url1) === this.normalizeBlankUrl(url2);
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 === url2;
        }

        const parsedUrl1 = this.parse(url1);
        const parsedUrl2 = this.parse(url2);

        if (!parsedUrl1 || !parsedUrl2) {
            return url1 === url2;
        }

        let domain1 = parsedUrl1.hostname;
        let domain2 = parsedUrl2.hostname;

        if (domain1.startsWith('www.')) {
            domain1 = domain1.substring(4);
        }
        if (domain2.startsWith('www.')) {
            domain2 = domain2.substring(4);
        }

        let pathname1 = parsedUrl1.pathname;
        let pathname2 = parsedUrl2.pathname;

        if (pathname1.endsWith('/')) {
            pathname1 = pathname1.slice(0, -1);
        }
        if (pathname2.endsWith('/')) {
            pathname2 = pathname2.slice(0, -1);
        }

        let search1 = parsedUrl1.search;
        let search2 = parsedUrl2.search;

        return domain1 === domain2 && pathname1 === pathname2 && search1 === search2;
    }

    tofile(url, mode = 'filename') {
        const safeFilename = (str) => str.replace(/[^a-z0-9.]+/gi, '_');

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            return safeFilename(url);
        }

        const hostname = parsedUrl.hostname;
        const pathname = parsedUrl.pathname;
        const segments = pathname.split('/');
        const baseFilename = segments.pop() || 'index.html';
        const safeBaseFilename = safeFilename(baseFilename);

        switch (mode) {
            case 'full': {
                const safePathname = pathname.replace(/[^a-z0-9./]+/gi, '_').slice(1);
                const safeHostname = safeFilename(hostname);
                return `${safeHostname}_${safePathname}_${safeBaseFilename}`;
            }
            case 'pathname': {
                const safePathname = pathname.replace(/[^a-z0-9./]+/gi, '_').slice(1).replace(/\//g, '_');
                return `${safePathname}_${safeBaseFilename}`;
            }
            case 'filename':
                return safeBaseFilename;
            default:
                logger.warn(`Invalid tofile mode: ${mode}, using 'filename'`);
                return safeBaseFilename;
        }
    }

    toOpenUrl(urlString) {
        const parsedUrl = this.parse(urlString);
        if (!parsedUrl) {
            return urlString;
        }

        const protocol = parsedUrl.protocol;
        let hostname = parsedUrl.hostname;
        const port = parsedUrl.port;

        if (hostname === '0.0.0.0') {
            hostname = '127.0.0.1';
        }

        if (port) {
            return `${protocol}//${hostname}:${port}`;
        }
        return `${protocol}//${hostname}`;
    }

    joinPathname(mainDomain, pathname) {
        if (!pathname) {
            return mainDomain;
        }

        if (pathname.match(/^https?:\/\//i)) {
            logger.debug(`pathname:${pathname} is already a full URL`);
            return pathname;
        }

        let baseDomain = mainDomain;

        if (pathname.startsWith('/')) {
            baseDomain = mainDomain.split(/(?<!\/)\/(?!\/)/)[0];
            baseDomain = baseDomain.replace(/\/$/, '');
        }

        const joinedUrl = baseDomain + pathname;
        return joinedUrl;
    }

    extractHttpUrl(str) {
        if (!str || typeof str !== 'string') {
            return null;
        }

        const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
        const match = regex.exec(str);
        return match ? match[0] : null;
    }

    extractAllUrls(str) {
        if (!str || typeof str !== 'string') {
            return [];
        }

        const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/g;
        return str.match(regex) || [];
    }

    addQueryParams(url, params) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return url;
        }

        Object.keys(params).forEach(key => {
            urlObj.searchParams.set(key, params[key]);
        });

        return urlObj.href;
    }

    getQueryParam(url, paramName) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return null;
        }
        return urlObj.searchParams.get(paramName);
    }

    getAllQueryParams(url) {
        const urlObj = this.parse(url);
        if (!urlObj) {
            return {};
        }

        const params = {};
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });

        return params;
    }
}

UrlTool.toString = () => '[class UrlTool]';
module.exports = new UrlTool();
