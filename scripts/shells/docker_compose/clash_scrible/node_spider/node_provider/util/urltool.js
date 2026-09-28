'use strict';
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');
const { URL } = require('url');
const mime = require('mime-types');

// 加载 .env 文件
dotenv.config();

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

    isDynamicUrl(url) {
        if (url.includes('?')) {
            return true;
        }
        const fileName = url.split('?').pop();
        return fileName.includes('.') === false;
    }

    tofile(url, mode = 'filename') {
        try {
            url = new URL(url);
        } catch (e) {
            const safeInput = url.replace(/[^a-z0-9.]+/gi, '_');
            return safeInput;
        }
        const parsedUrl = url;
        const hostname = parsedUrl.hostname;
        const pathname = parsedUrl.pathname;
        const segments = pathname.split('/');
        const baseFilename = segments.pop() || 'index.html';
        const safeFilename = baseFilename.replace(/[^a-z0-9\.]+/gi, '_');
        switch (mode) {
            case 'full':
                const safePathname = pathname.replace(/[^a-z0-9./]+/gi, '_').slice(1);
                return `${hostname.replace(/[^a-z0-9.]+/gi, '_')}_${safePathname}_${safeFilename}`;
            case 'pathname':
                return pathname.replace(/[^a-z0-9./]+/gi, '_').slice(1).replace(/\//g, '_') + "_" + safeFilename;
            case 'filename':
                return safeFilename;
            default:
                console.log('Invalid mode selected.');
                return '';
        }
    }

    async savefile(url, filename = null) {
        if (!filename) filename = this.tofile(url, 'filename');

        const downloadDir = process.env.STATIC_SERVER_DIRECTORY || path.join(__dirname, '../../downloads');

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        try {
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream'
            });

            const contentType = response.headers['content-type'];
            filename = filename.replace(/[^a-zA-Z0-9\._-]/g, '_');
            let fileExtension = path.extname(filename) || ``;
  
            fileExtension = this.mimeToExtMap[contentType] || mime.extension(contentType) || fileExtension;
            fileExtension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
            filename = filename + fileExtension;

            const fullPath = path.join(downloadDir, filename);

            const writer = fs.createWriteStream(fullPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const stats = fs.statSync(fullPath);

            return {
                fullPath: fullPath,
                relativePath: path.relative(process.cwd(), fullPath),
                filename: filename,
                downloadTime: new Date().toISOString(),
                fileSize: stats.size,
                mimeType: contentType || 'application/octet-stream'
            };
        } catch (error) {
            console.error('Error downloading file:', error);
            return null;
        }
    }

    normalizeUrl(url) {
        if (this.isNullBackUrl(url)) {
            return this.normalBackUrl(url);
        }
        const parsedUrl = new URL(url);
        let domain = parsedUrl.hostname;
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        return domain;
    }

    equalDomain(url1, url2) {
        url1 = this.getMainDomain(url1)
        url2 = this.getMainDomain(url2)
        if (this.isNullBackUrl(url1) || this.isNullBackUrl(url2)) {
            url1 = this.normalBackUrl(url1)
            url2 = this.normalBackUrl(url2)
            return url1 == url2;
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 == url2;
        }
        const parsedUrl1 = new URL(url1);
        const parsedUrl2 = new URL(url2);
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
        if (domain1 != domain2) {
            return false
        }
        if (pathname1 != pathname2) {
            return false
        }
        return true
    }
    toOpenUrl(urlString) {
        const parsedUrl = new URL(urlString);
        const protocol = parsedUrl.protocol;
        let hostname = parsedUrl.hostname;
        const port = parsedUrl.port;
        if (hostname === '0.0.0.0') {
            hostname = `127.0.0.1`;
        }
        const newUrl = `${protocol}//${hostname}:${port}`;
        return newUrl;
    }

    equalDomainFull(url1, url2) {
        // console.log(`equalDomainFull: ${url1} ${url2}`)
        if (this.isNullBackUrl(url1) || this.isNullBackUrl(url2)) {
            url1 = this.normalBackUrl(url1)
            url2 = this.normalBackUrl(url2)
            return url1 == url2;
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 == url2;
        }
        const parsedUrl1 = new URL(url1);
        const parsedUrl2 = new URL(url2);
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
        if (search1.endsWith('/')) {
            search1 = search1.slice(0, -1);
        }
        if (search2.endsWith('/')) {
            search2 = search2.slice(0, -1);
        }
        // console.log(`util.date: ${domain1} ${domain2}`)
        // console.log(`equalDomainFull: ${pathname1} ${pathname2}`)
        // console.log(`equalDomainFull: ${search1} ${search2}`)
        if (domain1 != domain2) {
            return false
        }
        if (pathname1 != pathname2) {
            return false
        }
        if (search1 != search2) {
            return false
        }
        return true
    }

    isHttpUrl(url) {
        return url.startsWith('http');
    }

    normalBackUrl(url) {
        url = url.toLowerCase()
        if (url == 'nullblank') {
            return 'about:blank';
        }
        return url
    }

    isNullBackUrl(url) {
        url = url.toLowerCase()
        return url === 'nullblank' || url === 'about:blank';
    }

    isAboutBlankUrl(url) {
        return this.isNullBackUrl(url)
    }

    isAboutBlankUrl(url) {
        return this.isNullBackUrl(url)
    }

    getMainDomain(url) {
        const urlObject = new URL(url);
        const domainParts = urlObject.hostname.split('/');
        return domainParts[0];
    }

    joinPathname(mainDomain, pathname) {
        if (pathname.match(/^https?:\/\//i)) {
            console.log(`pathname:${pathname} is already a domain name`)
            return pathname;
        }
        if (pathname.startsWith('/')) {
            mainDomain = mainDomain.split(/(?<!\/)\/(?!\/)/)[0];
            mainDomain = mainDomain.replace(/\/$/, ''); 
        }
        const joinedUrl = mainDomain + pathname;
        console.log(`joinedUrl`,joinedUrl)
        return joinedUrl;
    }

    extractHttpUrl(str) {
        const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
        const match = regex.exec(str);
        return match ? match[0] : null;
    }
}

UrlTool.toString = () => '[class Url]';
module.exports = new UrlTool();
