
class SocketCall {
    debug_send_event = true
    debug_recieve_event = true
    debug_recieve_execute_event = true
    cids = []
    socketCallbacks = {}
    webSocket = null
    webSocketMessageQueue = [];
    webSocketUrl = null
    apiRoute = null

    constructor(apiRoute) {
        this.useSocketEventNames = true;
        this.useParameterWrapping = true;
        this.sendingMethod = 'default';
        this.notifyEventCall = true;
        this.send_type = "emit" // default | send | emit;
        this.webSocketUrl = this.wsByLocal()
        this.startWebsocket()
        if (apiRoute) this.apiRoute = apiRoute
    }

    /* interface 方法, 必须要实现*/
    initApiRoute(){
        if(!this.apiRoute){
            this.apiRoute = require("./egg")
        }
        return this.apiRoute
    }
    
    getGroup(groupname = "") {
        const route = this.initApiRoute()
        const apiRoute = this.getValueByPath(groupname,route);
        const sendApi = (event_name, data, callback) => {
            event_name = apiRoute[event_name];
            return this.send(event_name, data, callback);
        };
        const sendAsync = async (event_name, data, callback) => {
            event_name = apiRoute[event_name];
            const rData = await this.asyncSend(event_name, data, callback);
            return rData;
        };
        return {
            sendApi,
            sendAsync
        };
    }

    getApiRoute(groupname) {
        const keys = groupname.split('.');
        let currentApiRoute = this.apiRoute;
        for (const key of keys) {
            if (currentApiRoute && typeof currentApiRoute === 'object' && key in currentApiRoute) {
                currentApiRoute = currentApiRoute[key];
            } else {
                return {};
            }
        }
        return currentApiRoute;
    }

    getValueByPath(path,obj) {
        const keys = path.split('.');
        let currentObj = obj;
        for (const key of keys) {
            if (currentObj && typeof currentObj === 'object' && key in currentObj) {
                currentObj = currentObj[key];
            } else {
                return undefined;
            }
        }
        return currentObj;
    }

    wsByLocal() {
        return `ws://localhost:${window.location.port}/ws`
    }

    getWSUrl() {
        return this.webSocketUrl
    }

    wsByCoustom(webSocketUrl, port = '') {
        if (webSocketUrl && webSocketUrl.startsWith('ws://')) {
            this.webSocketUrl = webSocketUrl;
        } else {
            if (port) port = `:${port}`
            this.webSocketUrl = `ws://${webSocketUrl}${port}`;
        }
    }

    wsByOriginURL() {
        const port = window.location.port;
        return `ws://${window.location.hostname}:${port}`;
    }

    startWebsocket(callback) {
        let wsUrl = this.getWSUrl()
        if (!this.webSocket) {
            this.webSocket = new WebSocket(wsUrl);
            console.log(`webSocket ${this.webSocket}`)
            this.webSocket.onopen = (event) => {
                console.log('Connected to the WebSocket server.');
                if (callback) callback(true)
            };
            this.webSocket.onmessage = (event) => {
                let data = event.data
                try {
                    if (typeof data === 'string') {
                        data = JSON.parse(data)
                    }
                } catch (e) {
                    console.log(event)
                    console.log(data)
                    console.error(e)
                }
                this.websocketCallback(data, event)
            };
            this.webSocket.onerror = (event) => {
                console.error('WebSocket Error:', event);
                if (callback) callback(false)
            };

            this.webSocket.onclose = (event) => {
                this.webSocket = null
                if (callback) callback(false)
                console.log('WebSocket Connection Closed. Trying to reconnect...');
                setTimeout(() => {
                    this.startWebsocket(callback)
                }, 10);
            };
        }
    }

    websocketCallback(rData, event) {
        let cid = rData.cid ? rData.cid : rData.send_id
        let data = rData.data
        let rawData = rData.rawData
        if (this.debug_send_event === undefined) this.debug_send_event = rData.debug_send_event
        if (this.debug_recieve_event === undefined) this.debug_recieve_event = rData.debug_recieve_event
        if (this.debug_recieve_execute_event === undefined) this.debug_recieve_execute_event = rData.debug_recieve_execute_event
        let print_event = rData.event_name ? rData.event_name : rData.recieve_on
        let event_name = rData.event_name
        let recieve_on = rData.recieve_on
        let callbacks = this.getSocketCallbacks(cid, true)
        if (this.debug_recieve_event) {
            console.log(`\n\n-------------- ${print_event} of receive --------------`)
            console.log(`wsClientFingerprint`, rData.wsClientFingerprint)
            console.log(`cid :`, cid)
            console.log(`event_name :`, event_name)
            console.log(`recieve_on :`, recieve_on)
            console.log(`callbacks :`, callbacks)
            console.log(rData)
        }
        if (recieve_on) {
            this.execReceive(recieve_on, rData)
        }
        if (callbacks.length) {
            callbacks.forEach((callObject) => {
                let callback = callObject.func
                let index = callObject.index
                callback(rData)
            })
        }
    }

    getSocketCallbacks(key, del = false) {
        if (key) {
            let result = this.socketCallbacks[key]
            if (del && result) {
                delete this.socketCallbacks[key]
            }
            if (result) {
                return result
            } else {
                return []
            }
        }
        return []
    }

    setSocketCallbacks(k, v) {
        if (k) {
            if (!this.socketCallbacks[k]) {
                this.socketCallbacks[k] = []
            }
            if (v) {
                this.socketCallbacks[k].push(v)
            }
        }
    }

    getPageName() {
        let pagename = ``
        const lastPart = window.location.href.split('/').pop();
        if (!lastPart || !lastPart.includes('.')) {
            pagename = lastPart;
        }
        if (pagename) {
            const partsWithoutExtension = lastPart.split('.');
            partsWithoutExtension.pop();
            pagename = partsWithoutExtension.join('.')
        }
        pagename = pagename ? pagename : 'index'
        return pagename
    }

    getPathName() {
        return window.location.pathname
    }

    websocketSend(event_name, ...args) {
        let cid = this.generateCID(32)
        let [nArgs, callbackFunction] = this.extractFunctions(args)
        if (callbackFunction.length) {
            if (!this.socketCallbacks[cid]) {
                this.socketCallbacks[cid] = []
            }
            this.socketCallbacks[cid] = this.socketCallbacks[cid].concat(callbackFunction)
        }

        if (debug_send_event) {
            console.log(`------------ websocketSend: ${event_name} ------------`)
            console.log(`event_name: ${event_name}`)
            console.log(`cid: ${cid}`)
            console.log(`callback: ${this.socketCallbacks[cid]}`)
        }
        nArgs = nArgs.map(value => this.toData(value));
        let sendObj = {
            cid,
            event_name,
            page_name: this.getPageName(),
            path_name: this.getPathName(),
            data: nArgs,
            wsClientFingerprint: this.getOrSetIfNotExists(`wsClientFingerprint`, this.generateCID(128)),
            startTime: Date.now()
        }
        this.webSocketMessageQueue.push(sendObj)
        this.sendToWebsocket()
    }

    send_use(event_name,stringiryData) {
        switch (this.send_type) {
            case "send":
            case "default":
                this.default_send(event_name,stringiryData)
                break;
            case "emit":
                this.emit_send(event_name,stringiryData)
                break;
            default:
                this.default_send(event_name,stringiryData)
        }
    }

    default_send(event_name,stringiryData) {
        this.webSocket.send(stringiryData);
    }

    emit_send(event_name,stringiryData) {
        this.webSocket.emit(event_name,stringiryData);
    }

    sendToWebsocket() {
        if (this.sendToWebsocketProcess) {
            if (this.sendToWebsocketEvent) {
                clearInterval(this.sendToWebsocketEvent);
            }
            return;
        }
        this.sendToWebsocketProcess = true;
        const sendNextMessage = () => {
            if (this.webSocketMessageQueue.length === 0) {
                this.sendToWebsocketProcess = false;
                if (this.sendToWebsocketEvent) {
                    clearInterval(this.sendToWebsocketEvent);
                }
                return;
            }
            const sendData = this.webSocketMessageQueue.shift();
            if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
                try {
                    let stringiryData = JSON.stringify(sendData)
                    const event_name = sendData.event_name
                    this.send_use(event_name,stringiryData)
                    const cid = sendData.cid;
                    if (debug_send_event) {
                        console.log(`websocket: Message has been sent, cid ${cid}`);
                    }
                    sendNextMessage();
                } catch (e) {
                    console.log(`--------------- Error ---------------`);
                    console.log(e);
                    console.log(`(websocket)Error : ${this.webSocketMessageQueue.length}, messages have not been sent yet`);
                    this.webSocketMessageQueue.push(sendData);
                    this.sendToWebsocketProcess = false;
                    if (this.sendToWebsocketEvent) {
                        clearInterval(this.sendToWebsocketEvent);
                    }
                    this.sendToWebsocketEvent = setInterval(() => {
                        this.sendToWebsocket();
                    }, 500);
                }
            } else {
                console.log(`webSocket: ${this.webSocketMessageQueue.length}, messages have not been sent yet`);
                this.webSocketMessageQueue.push(sendData);
                this.sendToWebsocketProcess = false;
                if (this.sendToWebsocketEvent) {
                    clearInterval(this.sendToWebsocketEvent);
                }
                this.sendToWebsocketEvent = setInterval(() => {
                    this.sendToWebsocket();
                }, 500);
            }
        };
        sendNextMessage();
    }

    execReceive(recieve_on, rData) {
        let mainClassName = rData.main_class ? rData.main_class : `preload`
        let mainClases = [this]
        if (this.debug_recieve_execute_event || true) {
            console.log(` --------recieve_on ${recieve_on}--------`)
            console.log(`mainClassName : ${mainClassName}`)
            console.dir(mainClases)
            console.log(`recieve_on : ${recieve_on}`)
            console.log(rData)
            console.log(`\n`)
        }
        if (mainClases) {
            mainClases.forEach((mainClass) => {
                console.dir(mainClass)
                if (mainClass[recieve_on]) {
                    rData.self = mainClass
                    mainClass[recieve_on](rData)
                } else {
                    console.dir(mainClases)
                    console.log(`execReceive the ${recieve_on} does not exist in class ${mainClassName}`)
                }
            })
        } else {
            console.dir(mainClases)
            console.log(`execReceive ${recieve_on} does not exist in class ${mainClassName}`)
        }
    }

    convertObjectToKeyValue(element) {
        if (typeof element == 'string') {
            return element
        }
        const result = {};
        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
            const attribute = attributes[i];
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateCID(length = 16) {
        let result;
        do {
            result = this.generateUUID(length);
        } while (this.cids.includes(result));
        this.cids.push(result);
        return result;
    }

    toData(obj) {
        if (obj instanceof HTMLElement) {
            return this.convertObjectToKeyValue(obj)
        } else {
            return obj
        }
    }

    extractFunctions(args) {
        let functions = [];
        for (let i = 0; i < args.length; i++) {
            if (typeof args[i] === 'function') {
                functions.push({
                    index: i,
                    func: args[i]
                });
                args[i] = null;
            }
        }
        return [args, functions];
    }

    getOrSetIfNotExists(key, value) {
        const existingValue = localStorage.getItem(key);
        if (existingValue === null) {
            localStorage.setItem(key, JSON.stringify(value));
            return value;
        } else {
            try {
                return JSON.parse(existingValue);
            } catch (error) {
                return existingValue;
            }
        }
    }

    send(event_name, ...arg) {
        if (!event_name.includes(`:`) && !event_name.includes(`.`)) {
            event_name = `event_${MainInstance.getPageName()}.${event_name}`
        }
        this.websocketSend(event_name, ...arg)
    }

    async asyncSend(event_name, ...arg) {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const callback = (rData, event, args) => {
            if (this.debug_recieve_execute_event) {
                console.log(` -- ${rData.rawData.event_name} Promise callback --`)
                console.log(` usetime: ${rData.usetime}ms`)
                console.log(rData)
            }
            let data = rData.data
            if (args) {
                resolve(data, event, ...args);
            } else {
                resolve(data, event, args);
            }
        }
        arg.push(callback)
        if (arg) {
            send(event_name, ...arg);
        } else {
            send(data, arg);
        }
        return promise;
    };
}

SocketCall.toString = () => '[class SocketCall]';
module.exports = new SocketCall();
