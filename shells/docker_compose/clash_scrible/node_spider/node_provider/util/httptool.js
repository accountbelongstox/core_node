const https = require('node:https');
const http = require('node:http');
const serveHandler = require('serve-handler');
const fs = require('fs');
const querystring = require('querystring');
const path = require('path');
const net = require('net');
const bodyParser = require('body-parser');
const express = require('express');
const expressWs = require('express-ws');
const Base = require('../base/base.js');
const {
    gdir,
    env,
} = require('../globalvars.js');
let eggSocket = null, eggSocketServer = null
const encyclopedia = require('../model/encyclopedia.js').getEncyclopedia();

let debug_send_event = false
let debug_recieve_event = false
let debug_recieve_execute_event = false

class Httptool extends Base {
    startPort = 18000;
    expressApp = null
    expressWs = null
    connectedWebSockets = [];
    getClienWebcketsData = {}

    constructor() {
        super()
    }

    async https_get(url) {
        return await this.get(url)
    }

    get(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            let totalBytes = 0;
            // let prevBytes = 0;
            let startTime = Date.now();
            const req = protocol.get(url, res => {
                if (res.statusCode !== 200) {
                    console.log(`http get error: statusCode(${res.statusCode})`)
                    resolve(null, Date.now() - startTime, 0);
                    return;
                }
                let data = [];
                res.on('data', chunk => {
                    data.push(chunk);
                    totalBytes += chunk.length;
                });
                res.on('end', () => {
                    resolve(Buffer.concat(data), Date.now() - startTime, totalBytes);
                });
            });
            req.on('error', error => {
                console.log(`http get error:`)
                console.log(error)
                resolve(null, Date.now() - startTime, 0);
            });
            req.end();
        }).catch(() => { })
    }

    async getJSON(url) {
        let data = await this.get(url)
        try {
            if (Buffer.isBuffer(data)) {
                data = data.toString('utf8')
            }
            data = JSON.parse(data)
            if (data === null) data = {}
            return data
        } catch (e) {
            // console.log(data)
            console.log(e)
            return {}
        }
    }

    async getText(url) {
        let data = await this.get(url)
        try {
            if (Buffer.isBuffer(data)) {
                data = data.toString('utf8')
            }
            return data
        } catch (e) {
            console.log(e)
            return ``
        }
    }

    getLastModified(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);

            const protocol = url.startsWith('https') ? https : http;
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'HEAD'
            };

            const req = protocol.request(options, (res) => {
                console.log(res)
                if (res.headers['last-modified']) {
                    resolve(res.headers['last-modified']);
                } else {
                    resolve(null);
                }
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    async readRemoteImage(url) {
        let data = await this.https_get(url)
        const imageBase64 = Buffer.from(data, 'binary').toString('base64');
        return imageBase64
    }

    getRemoteFileSize(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            protocol.request(url, { method: 'HEAD' }, (res) => {
                const size = parseInt(res.headers['content-length'], 10);
                resolve(size);
            }).on('error', reject).end();
        });
    }

    async compareFileSizes(remoteUrl, localPath) {
        if (!this.isFile(localPath)) return false
        try {
            const remoteSize = await this.getRemoteFileSize(remoteUrl);
            const localSize = this.getFileSize(localPath);
            console.log(`compareFileSizes : url:${remoteUrl},remoteSize:${remoteSize},localPath:${localPath}`)
            return remoteSize == localSize;
        } catch (err) {
            console.error("An error occurred:", err);
            return false;
        }
    }

    async compareFileSizesSycn(remoteUrl, localPath) {
        let compare = await this.compareFileSizes(remoteUrl, localPath)
        return compare
    }
    downloadFile(url, dest, progressCallback) {
        let lastCallbackTime = 0;

        return new Promise((resolve, reject) => {
            if (!dest) {
                dest = this.getDefaultDownloadFileDir(url);
            }
            const startTime = Date.now();
            const protocol = url.startsWith('https') ? https : http;
            const fileStream = fs.createWriteStream(dest);
            const req = protocol.get(url, res => {
                if (res.statusCode !== 200) {
                    fileStream.close();
                    fs.unlink(dest, () => {
                        const message = `Failed to download file from ${url}. Status code: ${res.statusCode}`
                        const error = new Error(message);
                        console.error(error);
                        progressCallback && progressCallback(-1, -1, -1,message);
                        resolve({ dest: null, success: false, usetime: Date.now() - startTime });
                    });
                    return;
                }
                const totalSize = parseInt(res.headers['content-length'], 10);
                let downloadedSize = 0;
                res.on('data', chunk => {
                    downloadedSize += chunk.length;   
                    const currentTime = Date.now();
                    if (progressCallback && currentTime - lastCallbackTime >= 1000) {
                        const percentage = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
                        progressCallback(percentage, totalSize, downloadedSize);
                        lastCallbackTime = currentTime;
                    }
                });
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    progressCallback && progressCallback(100, totalSize, downloadedSize); 
                    resolve({ dest, success: true, usetime: Date.now() - startTime });
                });
            });
            req.on('error', error => {
                fs.unlink(dest, () => {
                    console.error(`Error downloading file from ${url}: ${error.message}`);
                    progressCallback && progressCallback(-1, -1, -1);
                    resolve({ dest: null, success: false, usetime: Date.now() - startTime });
                });
            });
            fileStream.on('error', error => {
                fs.unlink(dest, () => {
                    console.error(`Error writing file ${dest}: ${error.message}`);
                    progressCallback && progressCallback(-1, -1, -1); // 返回 -1 表示错误
                    resolve({ dest: null, success: false, usetime: Date.now() - startTime });
                });
            });
            req.end();
        });
    }

    async download(url, downloadDir) {
        if (!downloadDir) downloadDir = winapiWidget.getDocumentsDir()
        let downname = url.split('/').pop()
        downname = this.unescape_url(downname)
        if (!downloadDir.endsWith(downname)) {
            downloadDir = path.join(downloadDir, downname)
        }
        await this.downloadFile(url, downloadDir);
        return downloadDir
    }

    async downloadAll(urls, directory, max_thread = 10) {
        let i = 0;
        let downloadQueue = async () => {
            if (i >= urls.length) {
                return Promise.resolve();
            }
            const url = urls[i++];
            let filename = url.split('/').pop()
            filename = this.unescape_url(filename)
            const filepath = `${directory}/${filename}`;
            return this.download(url, filepath)
                .then(downloadQueue)
                .catch(e => { })
        }
        const downloadPromises = Array(max_thread).fill(null).map(downloadQueue);
        return Promise.all(downloadPromises);
    }


    https_post(url, postData) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol.startsWith('https') ? https : http;
            const defaultHeaders = {
                'Accept-Language': 'zh-CN,zh,en;q=0.9',
                'Sec-CH-UA': 'Not A;Brand\";v=\"99\" \"Chromium\";v=\"102\" \"Google Chrome\";v=\"102',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': 'Windows',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(postData)),
            };
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.protocol.startsWith('https') ? (parsedUrl.port || 443) : (parsedUrl.port || 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    ...defaultHeaders
                }
            };
            const req = protocol.request(options, res => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(data);
                });
            });
            req.on('error', error => {
                reject(error);
            });
            req.write(JSON.stringify(postData));
            req.end();
        }).catch(() => { })
    }

    get_url_protocol(url) {
        let protocol;
        if (url.includes('://')) {
            protocol = url.split('://')[0] + '://';
        } else {
            protocol = 'http://';
        }
        return protocol;
    }

    get_url_body(url) {
        let domain;
        if (url.includes('://')) {
            domain = url.split('://')[1];
        } else {
            domain = url;
        }
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        if (domain.includes('/')) {
            domain = domain.split('/')[0];
        }
        return domain;
    }

    simple_url(url) {
        let hostname;
        if (url.includes('://')) {
            hostname = url.split('://')[1].split('/')[0];
        } else {
            hostname = url;
        }
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        const tld_parts = hostname.split('.').slice(-2);
        const tld = tld_parts.join('.');
        return tld;
    }

    joinURL(base, path) {
        const baseURL = new URL(base);
        return new URL(path, baseURL).toString();
    }

    unescape_url(url) {
        const unescapedURL = querystring.unescape(url);
        return unescapedURL
    }

    getDefaultDownloadFileDir(url) {
        let filename = this.getSaveFilename(url)
        let temp_dir = gdir.getDownloadDir()
        console.log(temp_dir, filename)
        filename = path.join(temp_dir, filename)
        return filename
    }

    getSaveFilename(url) {
        const possibleFilename = url.split('/').pop();
        const invalidCharacters = /[<>:"/\\|?*\x00-\x1F]/g;
        const safeFilename = possibleFilename.replace(invalidCharacters, '_');
        return safeFilename;
    }

    async getFileAndUnzip(url, out, callback, force, del = true) {
        let downloadFileName = this.getSaveFilename(url)
        downloadFileName = this.getDefaultDownloadFileDir(url)
        if (force) {
            if (this.isFile(downloadFileName)) {
                this.delete(downloadFileName)
            }
        }
        if (!out) out = downloadFileName
        this.downloadFile(url, out).then((result) => {
            let dest = result.dest
            if (result.dest) {
                zipWidget.putUnZipTask(
                    dest,
                    out,
                    (usetime) => {
                        result.usetime += usetime
                        if (del) this.delete(result.dest)
                        if (callback) callback(dest, out, result.usetime)
                    }
                )
            } else {
                if (callback) callback(null, null, result.usetime)
            }
        }).catch(e => { })
    }

    async getFileAndUnzipOne(url, out, callback, force = true) {
        let key = `http.downloadandunziponece`
        if (!winapiWidget.hasListUserData(key, url) && this.isFile()) {
            this.getFileAndUnzip(url, out, (downloadfile, usetime) => {
                winapiWidget.addListUserData(key, url)
                if (callback) callback(downloadfile, usetime)
            }, force)
        } else {

        }
        winapiWidget.hasAndAddListUserData(url)
    }

    getServerPort() {
        return this.startPort
    }

    getServerUrl() {
        let port = this.getServerPort()
        return `http://localhost:${port}`
    }

    getFrontendServerUrl() {
        const frontend_port = env.getEnv(`FRONTEND_PORT`)
        return `http://localhost:${frontend_port}`
    }

    openFrontendServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getFrontendServerUrl()
        openUrl = this.toOpenUrl(openUrl)
        try {
            const { shell } = require('electron');
            shell.openExternal(openUrl);
        } catch (e) {
            console.log(e)
        }
    }
    openServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getServerUrl()
        openUrl = this.toOpenUrl(openUrl)
        try {
            const { shell } = require('electron');
            shell.openExternal(openUrl);
        } catch (e) {
            console.log(e)
        }
    }

    async startHTTPServer(startPort) {
        let compile_dir = gdir.getStaticDir(`html_compile`)
        let static_dir = gdir.getStaticDir()
        let src_dir = gdir.getSrcDir()
        let core_dir = gdir.getCoreDir()
        let STATIC_DIRS = [
            static_dir,
            compile_dir,
            core_dir,
            src_dir
        ]

        this.expressApp = express();
        STATIC_DIRS.forEach(dir => {
            console.log(dir)
            this.expressApp.use(express.static(dir));
        })
        this.expressApp.use(bodyParser.json());

        this.expressApp.use((req, res, next) => {
            res.on('finish', () => {
                if (!res.get('Content-Type')) {
                    console.warn(`No Content-Type set for response of ${req.method} ${req.path}`);
                }
            });
            next();
        });

        this.expressApp.all('/event', (req, res) => {
            let data = req.body || req.query;
            if (data && data.event_name) {
                let func = component[data.event_name];
                if (func && typeof func === 'function') {
                    try {
                        func(data);
                        res.send({ status: 'success', message: 'Event processed successfully' });
                    } catch (error) {
                        res.status(500).send({ status: 'error', message: error.message });
                    }
                } else {
                    res.status(404).send({ status: 'error', message: 'Function not found' });
                }
            } else {
                res.status(400).send({ status: 'error', message: 'Invalid data' });
            }
        });

        expressWs(this.expressApp);
        this.expressApp.ws('/ws', (ws, req) => {
            this.connectedWebSockets.push(ws);
            ws.on('message', (data) => {
                data = JSON.parse(data)
                let wsClientFingerprint = data.wsClientFingerprint
                this.setWSClientWebsocketById(wsClientFingerprint, ws)
                this.specifiedCall(data)

            });
            ws.on('close', () => {
                this.remoteWSClientWebsocketByWS(ws)
                const index = this.connectedWebSockets.indexOf(ws);
                if (index !== -1) {
                    this.connectedWebSockets.splice(index, 1);
                }
                console.log('WebSocket closed');
            });
            console.log('WebSocket connected');
        });
        this.expressApp.listen(startPort, () => {
            console.log(`Server is running on http://localhost:${startPort}`);
        });
    }

    specifiedCall(data) {
        if (debug_recieve_event) {
            console.log('Received:');
            console.log(typeof data);
            console.log(data);
        }
        let cid = data.cid
        let wsClientFingerprint = data.wsClientFingerprint
        let args = data.args
        // this.setWSCidRawData(wsClientFingerprint, data)
        // event.cid = cid
        let event_token = data.event_name
        if (debug_send_event) {
            console.log(`\n\n>>>>>>>>>>>>>>>>>>>>>>${event_name}`)
            console.log(`cid`, cid)
            console.log(`args`, args)
            console.log(`data`)
            console.log(data)
        }

        let category_names = null
        let event_name = event_token
        if (event_token.includes('.') || event_token.includes(':')) {
            let event_parse = event_token.split(/[\:\.]+/);
            category_names = event_parse[0]
            event_name = event_parse[1]
        }
        let rawData = data
        this.execPublicEvent(category_names, event_name, args, rawData, wsClientFingerprint)
    }

    async execPublicEvent(category_name, event_name, args, rawData, wsClientFingerprint) {
        if (!category_name) {
            if (encyclopedia[`event_${data.page_name}`]) {
                category_name = `event_${data.page_name}`
            } else if (encyclopedia[`events`]) {
                category_name = `events`
            }
        }
        if (category_name) {
            this.execEventProcess(category_name, event_name, args, rawData, wsClientFingerprint)
        }
    }

    async execEventProcess(category_name, event_name, args, rawData, wsClientFingerprint) {
        if (encyclopedia[category_name] && event_name) {
            if (encyclopedia[category_name][event_name]) {
                let paramNames = this.getParamNames(encyclopedia[category_name][event_name])
                let trans_args = args.slice();
                let isResult = undefined
                if (this.isCallByParam(paramNames)) {
                    let callback = (...rArg) => {
                        isResult = true
                        let rData = {
                            data: rArg,
                            debug_send_event,
                            debug_recieve_event,
                            debug_recieve_execute_event,
                        }
                        if (debug_recieve_event) {
                            console.log(`rData`)
                            console.log(rData)
                        }
                        this.sendToWebSocket(null, rData, rawData, wsClientFingerprint)
                    }
                    trans_args = this.arrangeAccordingToA(paramNames, callback, trans_args)
                    let data
                    if (this.isAsyncFunction(encyclopedia[category_name][event_name])) {
                        data = await encyclopedia[category_name][event_name](...trans_args)
                    } else {
                        data = encyclopedia[category_name][event_name](...trans_args)
                    }
                    // 有可能该处函数执行两次该处函数
                    if (data && isResult === undefined) {
                        callback(data)
                    }
                } else if (this.isPromise(encyclopedia[category_name][event_name])) {
                    encyclopedia[category_name][event_name](...args).then((...data) => {
                        let rData = {
                            data,
                            debug_send_event,
                            debug_recieve_event,
                            debug_recieve_execute_event,
                        }
                        this.sendToWebSocket(null, rData, rawData, wsClientFingerprint)
                    }).catch(e => { })

                    // AsyncFunction
                } else if (this.isAsyncFunction(encyclopedia[category_name][event_name])) {
                    let data = await encyclopedia[category_name][event_name](...args)
                    let rData = {
                        data,
                        debug_send_event,
                        debug_recieve_event,
                        debug_recieve_execute_event,
                    }
                    this.sendToWebSocket(null, rData, rawData, wsClientFingerprint)
                } else {
                    let data = encyclopedia[category_name][event_name](...args)
                    let rData = {
                        data,
                        debug_send_event,
                        debug_recieve_event,
                        debug_recieve_execute_event,
                    }
                    this.sendToWebSocket(null, rData, rawData, wsClientFingerprint)
                }
            } else {
                console.log(`There is no "${event_name}" of the "${category_name}" by "encyclopedia".`)
            }
        } else {
            console.log(Object.keys(encyclopedia))
            console.log(`If there is no "${category_name}" -> "${event_name}" Class on the "comlib/encyclopedia"`)
        }
    }

    sendToAllWebSockets(message) {
        if (typeof message == 'object') message = JSON.stringify(message)
        for (const ws of this.connectedWebSockets) {
            try {
                ws.send(message);
            } catch (e) {
                console.log(`sendToAllWebSockets`)
                console.log(message)
                console.log(typeof message)
                console.log(e)
            }
        }
    }

    remoteWSClientWebsocketByWS(obj, ws) {
        for (const key in this.getClienWebcketsData) {
            if (this.getClienWebcketsData[key] === ws) {
                delete this.getClienWebcketsData[key];
                return true;
            }
        }
        return null;
    }

    setWSClientWebsocketById(wsCId, ws) {
        this.getClienWebcketsData[wsCId] = ws
    }

    getWSClientWebsocketById(wsCId) {
        if (this.getClienWebcketsData[wsCId]) {
            return this.getClienWebcketsData[wsCId];
        }
        return null;
    }

    sendToWebSockets(message, wsClientFingerprint) {
        let ws = this.getWSClientWebsocketById(wsClientFingerprint)
        if (ws) {
            if (typeof message == 'object') message = JSON.stringify(message)
            try {
                ws.send(message);
            } catch (e) {
                console.log(`message`)
                console.log(message)
                console.log(typeof message)
                console.log(e)
            }
        }
    }

    async startVueOrReactServer(port, distDir) {
        port = await this.checkPort(port)
        const server = http.createServer((request, response) => {
            return serveHandler(request, response, {
                "public": distDir
            });
        });
        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
        });
    }

    async checkAndStartServer(updatedConfig) {
        const { embeddedPageMode, port, distDir } = updatedConfig;
        if (embeddedPageMode === "html") {
            await this.startHTTPServer(port);
        } else if (["vue", "react"].includes(embeddedPageMode)) {
            await this.startVueOrReactServer(port, distDir, embeddedPageMode);
        } else {
            console.error("Unsupported embeddedPageMode:", embeddedPageMode);
        }
    }

    async eggSocket(method = null, params = null, callback = null, exclude = {}) {
        try {
            if (!eggSocket) {
                eggSocket = require('ee-core/socket');
                if (!eggSocketServer) {
                    eggSocketServer = eggSocket.getSocketServer();
                }
            }
            if (method) {
                if (!params) {
                    params = method;
                    method = null;
                }
                if (params) {
                    params = this.toJSON(params, 10, 0, new Set(), exclude);
                    let data = {
                        method,
                        params
                    };
                    eggSocketServer.io.emit("cl", data);
                } else {
                    console.log(`Params is empty. Cannot emit socket event.`);
                }
            } else {
                console.log(`Method not provided. Cannot emit socket event.`);
            }

            if (callback) callback();
        } catch (error) {
            console.error(`Error in eggSocket:`);
            console.log(error);
        }
    }

    sendToWebSocket(event_name, data, rawData, toAll = true) {
        let wsClientFingerprint = null
        if (rawData) {
            wsClientFingerprint = rawData.wsClientFingerprint
            data.rawData = rawData
            data.wsClientFingerprint = wsClientFingerprint
        } else {
            data = {
                wsClientFingerprint,
                data,
                rawData: {
                    event_name,
                    cid: null,
                }
            }
        }
        if (wsClientFingerprint) toAll = false
        data.cid = (rawData && rawData.cid) ? rawData.cid : null
        let main_class = 'preload'
        let recieve_on = event_name
        if (event_name && (event_name.includes(`:`) || event_name.includes(`.`))) {
            let recieve_parse = event_name.split(/[\:\.]+/)
            main_class = recieve_parse[0]
            recieve_on = recieve_parse[1]
        }
        let send_id = `send_to_view_` + this.create_id()
        data.main_class = main_class
        data.recieve_on = recieve_on
        data.send_id = send_id
        if (toAll) {
            this.sendToAllWebSockets(data)
        } else {
            this.sendToWebSockets(data, wsClientFingerprint)
        }
    }

    isFile(filename) {
        if (!filename || typeof filename != "string") {
            return false
        }
        if (fs.existsSync(filename)) {
            const stats = fs.statSync(filename);
            if (stats.isFile()) {
                return true
            }
        }
        return false
    }
    getFileSize(filePath) {
        if (!fs.existsSync(filePath)) {
            return -1
        }
        try {
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            return fileSizeInBytes;
        } catch (error) {
            return -1;
        }
    }

    delete(filename) {
        if (fs.existsSync(filename)) {
            if (fs.lstatSync(filename).isDirectory()) {
                this.deleteFolder(filename)
            } else {
                this.deleteFile(filename)
            }
        }
    }

    deleteFile(filePath) {
        fs.unlinkSync(filePath);
    }

    deleteFolder(folderPath) {
        if (fs.existsSync(folderPath)) {
            if (fs.lstatSync(folderPath).isDirectory() && !folderPath.endsWith('.asar')) {
                fs.rmSync(folderPath, {
                    force: true,
                    recursive: true,
                    maxRetries: 50,
                    retryDelay: 1000,
                })
            } else {
                fs.unlinkSync(folderPath);
            }
        }
    }

    mkbasedir(directoryPath) {
        directoryPath = path.dirname(directoryPath)
        return this.mkdir(directoryPath)
    }

    mkdir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    createString(length = 10) {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return result;
    }

    get_id(value, pre) {
        value = `` + value
        const md5 = this.get_md5(value);
        let _id = `id${md5}`
        if (pre) _id = pre + _id
        return _id;
    }

    create_id(value) {
        if (!value) value = this.createString(128)
        const _id = this.get_id(value);
        return _id;
    }
    getParamNames(func) {
        const fnStr = func.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '');
        let result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
        result = result === null ? [] : result;
        result = result.map(item => item.toLowerCase());
        return result;
    }
    isCallByParam(paramNames) {
        const callbackIndex = paramNames.findIndex((param) => param.toLowerCase() === 'callback');
        if (callbackIndex === -1) {
            return false;
        }
        return true
    }

    arrangeAccordingToA(paramNames, callback, args) {
        const l = paramNames.length;
        const index = paramNames.indexOf('callback');
        if (index !== -1) {
            paramNames[index] = callback;
            const args_a = args.slice(0, index);
            const args_b = args.slice(index);
            for (let i = 0; i < l; i++) {
                if (i < index) {
                    paramNames[i] = args_a[i] !== undefined ? args_a[i] : null;
                } else if (i > index) {
                    paramNames[i] = args_b[i - index - 1] !== undefined ? args_b[i - index - 1] : null;
                }
            }
        } else {
            const maxLength = Math.max(l, args.length);
            for (let i = 0; i < maxLength; i++) {
                if (i < l) {
                    paramNames[i] = args[i] !== undefined ? args[i] : null;
                } else {
                    paramNames.push(args[i]);
                }
            }
        }
        return paramNames;
    }
    isAsyncFunction(func) {
        return func.constructor && func.constructor.name == 'AsyncFunction';
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
    isPromise(func) {
        return func instanceof Promise
    }
    async checkPort(port) {
        return new Promise((resolve, reject) => {
            port = parseInt(port);
            const tester = net.createServer();
            tester.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    reject(err);
                }
            });

            tester.once('listening', () => {
                tester.close(() => {
                    resolve(false);
                });
            });

            tester.listen(port, 'localhost');
        });
    }

    toJSON(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
        if (typeof data === 'string') {
            return this.strToJSON(data)
        } else {
            return this.serializeData(data, maxDepth, currentDepth, seen, exclude)
        }
    }
    strToJSON(data) {
        if (Buffer.isBuffer(data)) {
            data = data.toString('utf-8');
        }
        try {
            data = JSON.stringify(data, null, indent);
            return data
        } catch (e) {
            console.log('strToJSON');
            console.log(e);
            return {}
        }
    }
    serializeData(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
        function serialize(obj, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
            if (currentDepth >= maxDepth) { return null; }
            if (obj === null || typeof obj !== 'object') { return obj; }
            if (seen.has(obj)) { return null; }
            seen.add(obj);
            let result = Array.isArray(obj) ? [] : {};
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    let value = obj[key];
                    if (exclude.hasOwnProperty(key)) {
                        if (exclude[key].value != undefined) {
                            result[key] = exclude[key].value;
                        }
                        continue;
                    }
                    if (typeof value === 'function') {
                        result[key] = null;
                        continue;
                    }
                    result[key] = serialize(value, maxDepth, currentDepth + 1, seen, exclude);
                }
            }
            seen.delete(obj);
            return result;
        }

        data = serialize(data, maxDepth, currentDepth, seen, exclude)
        return data
    }

}

module.exports = new Httptool()



