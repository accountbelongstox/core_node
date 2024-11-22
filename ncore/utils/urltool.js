'use strict';

import Base from '#@base';

class UrlTool extends Base {
    isDynamicUrl(url) {
        if (url.includes('?')) {
            return true;
        }
        const fileName = url.split('?').pop();
        return fileName.includes('.') === false;
    }

    toFile(url, mode = 'filename') {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        const pathname = parsedUrl.pathname;
        const segments = pathname.split('/');
        const baseFilename = segments.pop() || 'index.html';
        const safeFilename = baseFilename.replace(/[^a-z0-9.]+/gi, '_');
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
        url1 = this.getMainDomain(url1);
        url2 = this.getMainDomain(url2);
        if (this.isNullBackUrl(url1) || this.isNullBackUrl(url2)) {
            url1 = this.normalBackUrl(url1);
            url2 = this.normalBackUrl(url2);
            return url1 === url2;
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 === url2;
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
        if (domain1 !== domain2 || pathname1 !== pathname2) {
            return false;
        }
        return true;
    }

    toOpenUrl(urlString) {
        if (typeof urlString === 'object' && urlString.protocol && urlString.hostname && urlString.port) {
            const protocol = urlString.protocol;
            const hostname = urlString.hostname;
            const port = urlString.port;
            urlString = `${protocol}${hostname}:${port}`;
        }
        const parsedUrl = new URL(urlString);
        const protocol = parsedUrl.protocol;
        let hostname = parsedUrl.hostname;
        const port = parsedUrl.port;
        if (hostname === '0.0.0.0') {
            hostname = '127.0.0.1';
        }
        return `${protocol}//${hostname}:${port}`;
    }

    equalDomainFull(url1, url2) {
        if (this.isNullBackUrl(url1) || this.isNullBackUrl(url2)) {
            url1 = this.normalBackUrl(url1);
            url2 = this.normalBackUrl(url2);
            return url1 === url2;
        }
        if (!this.isHttpUrl(url1) || !this.isHttpUrl(url2)) {
            return url1 === url2;
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
        if (domain1 !== domain2 || pathname1 !== pathname2 || search1 !== search2) {
            return false;
        }
        return true;
    }

    isHttpUrl(url) {
        return url.startsWith('http');
    }

    normalBackUrl(url) {
        url = url.toLowerCase();
        if (url === 'nullblank') {
            return 'about:blank';
        }
        return url;
    }

    isNullBackUrl(url) {
        url = url.toLowerCase();
        return url === 'nullblank' || url === 'about:blank';
    }

    getMainDomain(url) {
        const urlObject = new URL(url);
        const domainParts = urlObject.hostname.split('/');
        return domainParts[0];
    }

    joinPathname(mainDomain, pathname) {
        if (pathname.match(/^https?:\/\//i)) {
            console.log(`pathname: ${pathname} is already a domain name`);
            return pathname;
        }
        if (pathname.startsWith('/')) {
            mainDomain = mainDomain.split(/(?<!\/)\/(?!\/)/)[0];
            mainDomain = mainDomain.replace(/\/$/, '');
        }
        const joinedUrl = mainDomain + pathname;
        console.log(`joinedUrl`, joinedUrl);
        return joinedUrl;
    }

    extractHttpUrl(str) {
        const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
        const match = regex.exec(str);
        return match ? match[0] : null;
    }
}

UrlTool.toString = () => '[class UrlTool]';

export default new UrlTool();
