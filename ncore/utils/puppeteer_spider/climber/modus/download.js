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
const os = require('os');
const path = require('path');
const urlModule = require('url');
const uuidv4 = require('uuid').v4;
const gconfig = require('#@gconfig');
const { urltool, jsontool, strtool, file } = require('#@ncore/foundation/utilities/index.js')
const FileMonitor = require('./file_monitor.js');
// const Practical = require('../../../../node_provider/practicals');

class Download {

    option = {
        inner: true,
        binary: false,
        save: true,
        save_path: '',
        coverfile: true,
        domain_path: false,
        domain_root: false,
        save_file: '',
        details: false,
        callback: null,
        encode: 'utf-8',
        response_format: 'text',
        resolve: null,
    };

    details = {
        success: false,
        info: '',
        content: '',
        url: '',
        savefile: '',
        filename: '',
    }

    constructor() {
        this.option.save_path = gconfig.DOWNLOAD_DIR;
        this.fileMonitor = new FileMonitor();
    }

    async init(browser, page) {
        this.browser = browser
        this.pageModus = page
    }

    optionMerg(option = {}) {
        let optionCopy = { ...this.option, ...option };
        return optionCopy;
    }

    result(option = {}, content = '', info = '', url = '', success) {
        if (success === undefined) success = !!content;
        option = this.optionMerg(option);
        if (option.save) option.details = true
        let savefile = '';
        if (option.save) {
            let save_file = option.save_file
            if (save_file) {
                savefile = save_file;
            } else {
                let mode = `filename`
                if (option.domain_root) {
                    mode = `full`
                } else if (option.domain_path) {
                    mode = `pathname`
                }
                savefile = urltool.tofile(url, mode);
            }
            if (!path.isAbsolute(savefile)) savefile = path.join(option.save_path, savefile)
            file.saveFile(savefile, content)
        }

        content = option.binary ? strtool.toBinary(content) : strtool.toText(content);

        if (option.details) {
            let filename = path.basename(savefile)
            return this.set_details(success, info, url, savefile, filename)
        } else {
            return content
        }
    }

    set_details(success = false, info = '', content = '', url = '', savefile = '', filename = '') {
        let detailsCopy = { ...this.details };

        if (typeof success === 'object' && arguments.length === 1) {
            Object.assign(detailsCopy, success);
            if (!('filename' in success) && success.savefile) {
                detailsCopy.filename = this.extractFilename(success.savefile);
            }
        } else {
            detailsCopy.success = success;
            detailsCopy.info = info;
            detailsCopy.content = content || '';
            detailsCopy.url = url;
            detailsCopy.savefile = savefile;
            detailsCopy.filename = filename || this.extractFilename(savefile);
            detailsCopy.getText = () => {
                return strtool.toText(content)
            }
            detailsCopy.getJson = () => {
                jsontool.strToJSON(content)
            }
            detailsCopy.getBinary = () => {
                strtool.toBinary(content)
            }
            detailsCopy.getLines = () => {

            }
            detailsCopy.getLine = () => {

            }
            detailsCopy.getIps = () => {

            }
            detailsCopy.getImagesByHTML = () => {

            }
            detailsCopy.getLinksByHTML = () => {

            }
            detailsCopy.getStylesheetsByHTML = () => {

            }
        }
        return detailsCopy;
    }

    extractFilename(fullPath) {
        const path = require('path');
        return fullPath ? path.basename(fullPath) : '';
    }

    async getCurrentPage(page = null) {
        const currentPage = await this.pageModus.getCurrentPage(page)
        return currentPage
    }

    validateOptions(options) {
        if (!options) {
            logger.warn('⚠️ Warning: Download: option is empty')
            return
        }
        for (const key in options) {
            logger.info(`Option: ${key}, Value: ${options[key]}`);
            if (key === 'save_path' || key === 'save_file') {
                continue
            }
            if (!(key in downloadOptions)) {
                logger.warn(`⚠️ Warning: Unknown option detected - "${key}"`);
            }
        }
        if (!options.save_path) {
            logger.warn('⚠️ Warning: Download: option "save_path" is empty');
        }
        if (!options.save_file) {
            logger.warn('⚠️ Warning: Download: option "save_file" is empty');
        }
    }

    async download(url, option = {}, page = null) {
        this.validateOptions(option)
        option = this.optionMerg(option)
        if (option.inner) {
            return await this.downloadInner(url, option, page)
        }
    }

    async get(url, option = {}, page = null) {
        option.details = false
        option.save = false
        option = this.optionMerg(option)
        return await this.download(url, option, page)
    }

    async downloadInner(url, option = {}, page = null) {
        let content = null
        let info = ``
        let success = false
        option = this.optionMerg(option)
        const currentPage = await this.getCurrentPage(page);
        try {
            const data = await currentPage.evaluate(this.fetch_, url, option.response_format, option.callback);
            content = data
            success = data ? true : false
            return Promise.resolve(
                this.result(option, content, info, url, success)
            );
        } catch (error) {
            info = 'Error:' + error.message
            console.log(info);
            return Promise.resolve(
                this.result(option, content, info, url, success)
            );
        }
    }

    async fetch_(url, response_format = 'text', callback = null) {
        const response = await fetch(url);
        if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            return Promise.resolve(null)
        }
        try {
            let data = null
            switch (response_format) {
                case 'json':
                    data = await response.json();
                    break;
                case 'text':
                    const contentType = response.headers.get("Content-Type");
                    let charset = "utf-8";
                    if (contentType) {
                        const match = /charset=([^;]+)/i.exec(contentType);
                        if (match && match[1]) {
                            charset = match[1].trim().toLowerCase();
                        }
                    }
                    const buffer = await response.arrayBuffer();
                    const decoder = new TextDecoder(charset);
                    data = decoder.decode(buffer);
                    break;
                case 'arrayBuffer':
                    data = await response.arrayBuffer();
                    break;
                case 'blob':
                    data = await response.blob();
                    break;
                case 'formData':
                    data = await response.formData();
                    break;
                default:
                    console.log(`Unsupported format: ${response_format}`);
            }
            // if(handle)data = handle(data)
            return Promise.resolve(data)
        } catch (e) {
            console.log(`fetch`);
            console.log(e);
            return Promise.resolve(null)
        }
    }

    setDefaultDownloadPath(newPath) {
        this.defaultDownloadPath = newPath;
    }

    extractFileNameFromURL(url) {
        let baseName = path.basename(urlModule.parse(url).pathname);
        if (!baseName.includes('.')) {
            baseName = baseName.replace(/[/?#]/g, '_');
        }
        return baseName;
    }

    getDownloadFileName(url, specifiedName) {
        return specifiedName || this.extractFileNameFromURL(url);
    }

    getDefaultTempDownloadPath(config) {
        // Assuming the config is an object with a 'tempDownloadPath' key.
        this.tempDownloadPath = config.tempDownloadPath || path.join(__dirname, 'tempDownloads');
        if (!fs.existsSync(this.tempDownloadPath)) {
            fs.mkdirSync(this.tempDownloadPath);
        }
        return this.tempDownloadPath;
    }

    async downloadLinkResource(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const href = await currentPage.$eval(selector, link => link.href);
        const content = await axios.get(href);
        const fileName = this.getDownloadFileName(href);
        const savePath = path.join(this.defaultDownloadPath, fileName);
        fs.writeFileSync(savePath, content.data);
        this.downloadPath = savePath;
    }

    // Find files by pattern in download directories
    findFilesByPattern(pattern, options = {}) {
        return this.fileMonitor.findFilesByPattern(pattern, options);
    }

    // Find the latest file matching pattern
    findLatestFile(pattern, options = {}) {
        return this.fileMonitor.findLatestFile(pattern, options);
    }

    // Wait for file to appear with pattern matching
    async waitForFileByPattern(pattern, options = {}) {
        const defaultOptions = {
            timeout: 300000, // 5 minutes
            pollInterval: 2000, // 2 seconds
            stableTime: 3000, // 3 seconds
            onProgress: (elapsed, total) => {
                if (elapsed % 30000 === 0) { // Log every 30 seconds
                    console.log(`Waiting for download... ${Math.round(elapsed/1000)}s / ${Math.round(total/1000)}s`);
                }
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        return await this.fileMonitor.waitForFile(pattern, mergedOptions);
    }

    // Click download link and wait for file
    async clickDownloadAndWait(selector, filePattern, options = {}, page = null) {
        const currentPage = await this.getCurrentPage(page);

        try {
            // Click the download link
            await currentPage.click(selector);
            console.log(`Clicked download link: ${selector}`);

            // Wait for file to appear
            const downloadedFile = await this.waitForFileByPattern(filePattern, options);

            return {
                success: true,
                file: downloadedFile,
                message: 'Download completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Download failed'
            };
        }
    }

    // Find and click download link by keywords
    async findAndClickDownloadLink(keywords, filePattern, options = {}, page = null) {
        const currentPage = await this.getCurrentPage(page);

        try {
            // Find download links containing the keywords
            const downloadLinks = await currentPage.$$eval('a', (links, keywords) => {
                return links
                    .filter(link => {
                        const text = link.textContent.toLowerCase();
                        const href = link.href.toLowerCase();
                        return keywords.some(keyword =>
                            text.includes(keyword.toLowerCase()) ||
                            href.includes(keyword.toLowerCase())
                        );
                    })
                    .map(link => ({
                        href: link.href,
                        text: link.textContent.trim(),
                        id: link.id,
                        className: link.className
                    }));
            }, keywords);

            if (downloadLinks.length === 0) {
                throw new Error(`No download links found with keywords: ${keywords.join(', ')}`);
            }

            console.log(`Found ${downloadLinks.length} potential download links`);

            // Try to click the first matching link
            const targetLink = downloadLinks[0];
            console.log(`Clicking download link: ${targetLink.text}`);

            // Click the download link and wait for file
            return await this.clickDownloadAndWait(`a[href="${targetLink.href}"]`, filePattern, options, page);

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to find or click download link'
            };
        }
    }

    async saveImageFromSelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const src = await currentPage.$eval(selector, img => img.src);
        const content = await axios.get(src, { responseType: 'arraybuffer' });
        const fileName = this.getDownloadFileName(src);
        const savePath = path.join(this.defaultDownloadPath, fileName);
        fs.writeFileSync(savePath, content.data);
    }

    async saveAudioFromSelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const src = await currentPage.$eval(selector, audio => audio.src);
        const content = await axios.get(src, { responseType: 'arraybuffer' });
        const fileName = this.getDownloadFileName(src);
        const savePath = path.join(this.defaultDownloadPath, fileName);
        fs.writeFileSync(savePath, content.data);
    }

    async createAndClickDownloadLink(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const resourceUrl = await currentPage.$eval(selector, elem => elem.src || elem.href);
        const uniqueID = uuidv4();
        const downloadLink = `<a href="${resourceUrl}" target="_bank" id="${uniqueID}" download>Download</a>`;
        await currentPage.evaluate((downloadLinkContent) => {
            const div = document.createElement('div');
            div.innerHTML = downloadLinkContent;
            document.body.appendChild(div);
        }, downloadLink);
        await currentPage.click(`#${uniqueID}`);
        setTimeout(async () => {
            await currentPage.evaluate((uniqueID) => {
                const link = document.getElementById(uniqueID);
                link.parentElement.removeChild(link);
            }, uniqueID);
        }, 1000);
    }

    async downloadImages(urls) {
        const results = [];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const response = await fetch(url);
            const blob = await response.blob();
            const savedir = await downloadFile(blob);
            results.push({ src: url, savedir });
        }
        return results;
    }

    async downloadImages(urls) {
        const promises = urls.map(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            const savedir = await this.saveFile(blob);
            return { src: url, savedir };
        });
        this.images = await Promise.all(promises);
    }


    toString() {
        return `[class Download]`;
    }

}


module.exports = Download;

