import { encyclopedia as globalEncyclopedia } from '../globalvars.js';
import express from 'express';
import expressWs from 'express-ws';
import bodyParser from 'body-parser';
import http from 'http';
import serveHandler from 'serve-handler';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import fs from 'fs';

import electron from 'electron';
const { shell } = electron;
// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const utils = {
    porttool: {
        async checkPort(port) {
            return new Promise((resolve) => {
                const server = net.createServer();
                server.once('error', () => {
                    resolve(this.checkPort(port + 1));
                });
                server.once('listening', () => {
                    server.close();
                    resolve(port);
                });
                server.listen(port);
            });
        }
    },

    strtool: {
        create_id() {
            return Math.random().toString(36).substring(2, 15);
        }
    },

    urltool: {
        toOpenUrl(url) {
            return url.replace(/\s/g, '%20');
        }
    },

    file: {
        get_static(subdir = '') {
            const staticDir = path.join(__dirname, '../../static');
            return subdir ? path.join(staticDir, subdir) : staticDir;
        },
        get_src_dir() {
            return path.join(__dirname, '../../src');
        },
        get_coredir() {
            return path.join(__dirname, '../../core');
        }
    },

    tool: {
        getParamNames(func) {
            const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
            const ARGUMENT_NAMES = /([^\s,]+)/g;
            const fnStr = func.toString().replace(STRIP_COMMENTS, '');
            const result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
            return result || [];
        },
        isCallByParam(paramNames) {
            return paramNames.includes('callback');
        },
        isAsyncFunction(func) {
            return func.constructor.name === 'AsyncFunction';
        },
        isPromise(func) {
            return func instanceof Promise || (func && typeof func.then === 'function');
        },
        arrangeAccordingToA(paramNames, callback, args) {
            const callbackIndex = paramNames.indexOf('callback');
            if (callbackIndex !== -1) {
                const newArgs = [...args];
                newArgs.splice(callbackIndex, 0, callback);
                return newArgs;
            }
            return args;
        }
    },

    env: {
        getEnv(key) {
            return process.env[key] || '3000';
        }
    }
};

let encyclopedia = globalEncyclopedia.getEncyclopedia();

let debug_send_event = false;
let debug_recieve_event = false;
let debug_recieve_execute_event = false;

class HttpWidget {
    startPort = 18000;
    expressApp = null;
    expressWs = null;
    connectedWebSockets = [];
    getClientWebsocketsData = {};

    getServerPort() {
        return this.startPort;
    }

    getServerUrl() {
        let port = this.getServerPort();
        return `http://localhost:${port}`;
    }

    getFrontendServerUrl() {
        const frontend_port = utils.env.getEnv(`FRONTEND_PORT`);
        return `http://localhost:${frontend_port}`;
    }

    openFrontendServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getFrontendServerUrl();
        openUrl = utils.urltool.toOpenUrl(openUrl);
        try {
            shell.openExternal(openUrl);
        } catch (e) {
            console.log(e);
        }
    }

    openServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getServerUrl();
        openUrl = utils.urltool.toOpenUrl(openUrl);
        try {
            shell.openExternal(openUrl);
        } catch (e) {
            console.log(e);
        }
    }

    async startHTTPServer(startPort) {
        let compile_dir = utils.file.get_static(`html_compile`);
        let static_dir = utils.file.get_static();
        let src_dir = utils.file.get_src_dir();
        let coredir = utils.file.get_coredir();
        let STATIC_DIRS = [
            static_dir,
            compile_dir,
            coredir,
            src_dir
        ];

        this.expressApp = express();
        STATIC_DIRS.forEach(dir => {
            console.log(dir);
            this.expressApp.use(express.static(dir));
        });
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
                data = JSON.parse(data);
                let wsClientFingerprint = data.wsClientFingerprint;
                this.setWSClientWebsocketById(wsClientFingerprint, ws);
                this.specifiedCall(data);
            });
            ws.on('close', () => {
                this.remoteWSClientWebsocketByWS(ws);
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
        let cid = data.cid;
        let wsClientFingerprint = data.wsClientFingerprint;
        let args = data.args;
        let event_token = data.event_name;
        if (debug_send_event) {
            console.log(`\n\n>>>>>>>>>>>>>>>>>>>>>>${event_name}`);
            console.log(`cid`, cid);
            console.log(`args`, args);
            console.log(`data`);
            console.log(data);
        }

        let category_names = null;
        let event_name = event_token;
        if (event_token.includes('.') || event_token.includes(':')) {
            let event_parse = event_token.split(/[\:\.]+/);
            category_names = event_parse[0];
            event_name = event_parse[1];
        }
        let rawData = data;
        this.execPublicEvent(category_names, event_name, args, rawData, wsClientFingerprint);
    }

    async execPublicEvent(category_name, event_name, args, rawData, wsClientFingerprint) {
        if (!category_name) {
            if (encyclopedia[`event_${data.page_name}`]) {
                category_name = `event_${data.page_name}`;
            } else if (encyclopedia[`events`]) {
                category_name = `events`;
            }
        }
        if (category_name) {
            this.execEventProcess(category_name, event_name, args, rawData, wsClientFingerprint);
        }
    }

    async execEventProcess(category_name, event_name, args, rawData, wsClientFingerprint) {
        if (encyclopedia[category_name] && event_name) {
            if (encyclopedia[category_name][event_name]) {
                let paramNames = utils.tool.getParamNames(encyclopedia[category_name][event_name]);
                let trans_args = args.slice();
                let isResult = undefined;
                if (utils.tool.isCallByParam(paramNames)) {
                    let callback = (...rArg) => {
                        isResult = true;
                        let rData = {
                            data: rArg,
                            debug_send_event,
                            debug_recieve_event,
                            debug_recieve_execute_event,
                        };
                        if (debug_recieve_event) {
                            console.log(`rData`);
                            console.log(rData);
                        }
                        this.sendToWebSocket(null, rData, rawData, wsClientFingerprint);
                    };
                    trans_args = utils.tool.arrangeAccordingToA(paramNames, callback, trans_args);
                    let data;
                    if (utils.tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
                        data = await encyclopedia[category_name][event_name](...trans_args);
                    } else {
                        data = encyclopedia[category_name][event_name](...trans_args);
                    }
                    if (data && isResult === undefined) {
                        callback(data);
                    }
                } else if (utils.tool.isPromise(encyclopedia[category_name][event_name])) {
                    encyclopedia[category_name][event_name](...args).then((...data) => {
                        let rData = {
                            data,
                            debug_send_event,
                            debug_recieve_event,
                            debug_recieve_execute_event,
                        };
                        this.sendToWebSocket(null, rData, rawData, wsClientFingerprint);
                    }).catch(e => {});

                } else if (utils.tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
                    let data = await encyclopedia[category_name][event_name](...args);
                    let rData = {
                        data,
                        debug_send_event,
                        debug_recieve_event,
                        debug_recieve_execute_event,
                    };
                    this.sendToWebSocket(null, rData, rawData, wsClientFingerprint);
                } else {
                    let data = encyclopedia[category_name][event_name](...args);
                    let rData = {
                        data,
                        debug_send_event,
                        debug_recieve_event,
                        debug_recieve_execute_event,
                    };
                    this.sendToWebSocket(null, rData, rawData, wsClientFingerprint);
                }
            } else {
                console.log(`There is no "${event_name}" of the "${category_name}" by "encyclopedia".`);
            }
        } else {
            console.log(Object.keys(encyclopedia));
            console.log(`If there is no "${category_name}" -> "${event_name}" Class on the "comlib/encyclopedia"`);
        }
    }

    sendToAllWebSockets(message) {
        if (typeof message == 'object') message = JSON.stringify(message);
        for (const ws of this.connectedWebSockets) {
            try {
                ws.send(message);
            } catch (e) {
                console.log(`sendToAllWebSockets`);
                console.log(message);
                console.log(typeof message);
                console.log(e);
            }
        }
    }

    remoteWSClientWebsocketByWS(obj, ws) {
        for (const key in this.getClientWebsocketsData) {
            if (this.getClientWebsocketsData[key] === ws) {
                delete this.getClientWebsocketsData[key];
                return true;
            }
        }
        return null;
    }

    setWSClientWebsocketById(wsCId, ws) {
        this.getClientWebsocketsData[wsCId] = ws;
    }

    getWSClientWebsocketById(wsCId) {
        if (this.getClientWebsocketsData[wsCId]) {
            return this.getClientWebsocketsData[wsCId];
        }
        return null;
    }

    sendToWebSockets(message, wsClientFingerprint) {
        let ws = this.getWSClientWebsocketById(wsClientFingerprint);
        if (ws) {
            if (typeof message == 'object') message = JSON.stringify(message);
            try {
                ws.send(message);
            } catch (e) {
                console.log(`message`);
                console.log(message);
                console.log(typeof message);
                console.log(e);
            }
        }
    }

    async startVueOrReactServer(port, distDir) {
        port = await utils.porttool.checkPort(port);
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
        let wsClientFingerprint = null;
        if (rawData) {
            wsClientFingerprint = rawData.wsClientFingerprint;
            data.rawData = rawData;
            data.wsClientFingerprint = wsClientFingerprint;
        } else {
            data = {
                wsClientFingerprint,
                data,
                rawData: {
                    event_name,
                    cid: null,
                }
            };
        }
        if (wsClientFingerprint) toAll = false;
        data.cid = (rawData && rawData.cid) ? rawData.cid : null;
        let main_class = 'preload';
        let recieve_on = event_name;
        if (event_name && (event_name.includes(`:`) || event_name.includes(`.`))) {
            let recieve_parse = event_name.split(/[\:\.]+/);
            main_class = recieve_parse[0];
            recieve_on = recieve_parse[1];
        }
        let send_id = `send_to_view_` + utils.strtool.create_id();
        data.main_class = main_class;
        data.recieve_on = recieve_on;
        data.send_id = send_id;
        if (toAll) {
            this.sendToAllWebSockets(data);
        } else {
            this.sendToWebSockets(data, wsClientFingerprint);
        }
    }
}

export default new HttpWidget();
