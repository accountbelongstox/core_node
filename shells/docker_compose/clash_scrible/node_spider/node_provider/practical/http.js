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
const { porttool,env } = require('../utils.js');
const {
    file,
    strtool,
    tool,
    urltool
} = require('../utils.js');
const encyclopedia = require('../model/encyclopedia.js').getEncyclopedia();

let debug_send_event = false
let debug_recieve_event = false
let debug_recieve_execute_event = false

class httpWidget {
    startPort = 18000;
    expressApp = null
    expressWs = null
    connectedWebSockets = [];
    getClienWebcketsData = {}

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
        if (!file.isFile(localPath)) return false
        try {
            const remoteSize = await this.getRemoteFileSize(remoteUrl);
            const localSize = file.getFileSize(localPath);
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

    get_file(url, dest) {
        return new Promise(async (resolve, reject) => {
            if (!dest) {
                dest = this.getDefaultDownloadFileDir(url)
            }
            let result = {
                dest
            }
            let startTime = Date.now();
            if (fs.existsSync(dest)) {
                let compare = await this.compareFileSizes(url, dest)
                if (compare) {
                    result.success = true
                    result.usetime = Date.now() - startTime
                    return resolve(result)
                }
            }
            file.mkbasedir(dest) // 此处可能需要更改，避免变量名冲突
            const protocol = url.startsWith('https') ? https : http;
            const fileStream = fs.createWriteStream(dest); // 更改变量名
            const req = protocol.get(url, res => {
                if (res.statusCode !== 200) {
                    result.dest = false
                    result.success = false
                    result.usetime = Date.now() - startTime
                    resolve(result);
                    return;
                }
                res.pipe(fileStream); // 更改变量名
                fileStream.on('finish', () => { // 更改变量名
                    fileStream.close(); // 更改变量名
                    result.success = true
                    result.usetime = Date.now() - startTime
                    resolve(result)
                });
            });
            req.on('error', error => {
                fs.unlink(dest);
                result.dest = null
                result.success = false
                result.usetime = Date.now() - startTime
                resolve(result);
            });
            fileStream.on('error', error => { // 更改变量名
                console.log(`error`)
                console.log(error)
                fs.unlink(dest);
                result.dest = null
                result.success = false
                result.usetime = Date.now() - startTime
                resolve(result);
            });
            req.end();
        }).catch((err) => { console.log(err) })
    }
    

    async download(url, downloadDir) {
        if (!downloadDir) downloadDir = winapiWidget.getDocumentsDir()
        let downname = url.split('/').pop()
        downname = this.unescape_url(downname)
        if (!downloadDir.endsWith(downname)) {
            downloadDir = path.join(downloadDir, downname)
        }
        await this.get_file(url, downloadDir);
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
        let temp_dir = winapiWidget.getDownloadsDir(`.deskmanager_temp`)
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
            if (file.isFile(downloadFileName)) {
                file.delete(downloadFileName)
            }
        }
        if (!out) out = downloadFileName
        this.get_file(url, downloadFileName).then((result) => {
            let dest = result.dest
            if (result.dest) {
                zipWidget.putUnZipTask(
                    dest,
                    out,
                    (usetime) => {
                        result.usetime += usetime
                        if (del) file.delete(result.dest)
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
        if (!winapiWidget.hasListUserData(key, url) && file.isFile()) {
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
        openUrl = urltool.toOpenUrl(openUrl)
        try{
            const { shell } = require('electron');
            shell.openExternal(openUrl);
        }catch(e){
            console.log(e)
        }
    }
    openServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getServerUrl()
        openUrl = urltool.toOpenUrl(openUrl)
        try{
            const { shell } = require('electron');
            shell.openExternal(openUrl);
        }catch(e){
            console.log(e)
        }
    }

    async startHTTPServer(startPort) {
        let compile_dir = file.get_static(`html_compile`)
        let static_dir = file.get_static()
        let src_dir = file.get_src_dir()
        let core_dir = file.get_core_dir()
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
                let paramNames = tool.getParamNames(encyclopedia[category_name][event_name])
                let trans_args = args.slice();
                let isResult = undefined
                if (tool.isCallByParam(paramNames)) {
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
                    trans_args = tool.arrangeAccordingToA(paramNames, callback, trans_args)
                    let data
                    if (tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
                        data = await encyclopedia[category_name][event_name](...trans_args)
                    } else {
                        data = encyclopedia[category_name][event_name](...trans_args)
                    }
                    // 有可能该处函数执行两次该处函数
                    if (data && isResult === undefined) {
                        callback(data)
                    }
                } else if (tool.isPromise(encyclopedia[category_name][event_name])) {
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
                } else if (tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
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
        port = await porttool.checkPort(port)
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
        let send_id = `send_to_view_` + strtool.create_id()
        data.main_class = main_class
        data.recieve_on = recieve_on
        data.send_id = send_id
        if (toAll) {
            this.sendToAllWebSockets(data)
        } else {
            this.sendToWebSockets(data, wsClientFingerprint)
        }
    }
}

module.exports = new httpWidget()



