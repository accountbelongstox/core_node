'use strict';
const os = require('os');
const { DownloadInterface } = require('../../interface/modus/download_interface.js');
const path = require('path');
const urlModule = require('url');
const uuidv4 = require('uuid').v4;
const Util = require('../../node_provider/utils.js');
const { getMethodNames } = require('../../utils/classUtils.js');

class Download extends DownloadInterface {

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

    constructor(browser, page) {
        super();
        this.browser = browser;
        this.pageModus = page;
        this.option.save_path = Util.file.getDefaultDownloadPath();
        this.methods = getMethodNames(Download.prototype, true, 'Download');
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
                savefile = Util.urltool.tofile(url, mode);
            }
            if (!path.isAbsolute(savefile)) savefile = path.join(option.save_path, savefile)
            Util.file.saveFile(savefile, content)
        }

        content = option.binary ? Util.str.toBinary(content) : Util.str.toText(content);

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
                return Util.str.toText(content)
            }
            detailsCopy.getJson = () => {
                Util.json.strToJSON(content)
            }
            detailsCopy.getBinary = () => {
                Util.str.toBinary(content)
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

    async download(url, option = {}, page = null) {
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

Download.toString = () => '[class Download]';
module.exports = Download;

