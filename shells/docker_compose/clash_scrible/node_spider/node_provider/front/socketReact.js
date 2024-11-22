import { io } from 'socket.io-client';

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
    send_type = "emit" // default | send | emit
    wrap_data = null // default | send | emit

    constructor(apiRoute) {
        this.webSocketUrl = this.wsByLocal()
        this.connectSocket()
        if (apiRoute) this.apiRoute = apiRoute
    }

    init() {
        //强制使用 socket 事件名
        //是否使用: 参数包装方法
        //使用发送方式 default | send | emit
        //通知事件调用 
        //发送时是否json反序列化 data
        //数据包装 wrap_data 类型函数。用于根据该函数，对数据进行包装。
        //回调数据包装 wrap_callback_data 类型函数。用于根据该函数，对数据进行包装。
    }
    //请根据以上的注释。给出对应的设置项，已设置该类。Node.js。
    
    
    resolveCallback(rData, event) {
        let cid = rData.cid ? rData.cid : rData.send_id
        let data = rData.data
        let rawData = rData.rawData
        if (this.debug_send_event === undefined) this.debug_send_event = rData.debug_send_event
        if (this.debug_recieve_event === undefined) this.debug_recieve_event = rData.debug_recieve_event
        if (this.debug_recieve_execute_event === undefined) this.debug_recieve_execute_event = rData.debug_recieve_execute_event
        let print_event = rData.event_name ? rData.event_name : rData.recieve_on
        let event_name = rData.event_name
        let recieve_on = rData.recieve_on
        let callbacks = this.getCallbacks(cid, true)
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

    connectSocket(callback) {
        let wsUrl = this.getWSUrl()
        if (!this.webSocket) {
            this.webSocket = io(wsUrl);
            this.webSocket.onopen = (event) => {
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
                this.resolveCallback(data, event)
            };
            this.webSocket.onerror = (event) => {
                console.error('WebSocket Error:', event);
                if (callback) callback(false)
            };
            this.webSocket.onclose = (event) => {
                this.webSocket = null
                if (callback) callback(false)
                setTimeout(() => {
                    this.connectSocket(callback)
                }, 10);
            };
        }
    }

    getCallbacks(key, del = false) {
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

    getCallbacks(k, v) {
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
            console.log(`------------ websocket Send: ${event_name} ------------`)
            console.log(`event_name: ${event_name}`)
            console.log(`cid: ${cid}`)
            console.log(`callback: ${this.socketCallbacks[cid]}`)
        }
        nArgs = nArgs.map(value => this.toData(value));
        let sendObj = this.dataWrap(event_name,cid,nArgs)
        this.webSocketMessageQueue.push(sendObj)
        this.sendToWebsocket()
    }

    useDataWrap(event_name,cid,nData){
        if(this.wrap_data){
            return this.wrap_data(event_name,cid,nData)
        }else{
            return this.dataWrap(event_name,cid,nData)
        }
    }

    dataWrap(event_name,cid,nData){
        let sendObj = {
            cid,
            event_name,
            page_name: this.getPageName(),
            path_name: this.getPathName(),
            data: nData,
            wsClientFingerprint: this.getOrSetIfNotExists(`wsClientFingerprint`, this.generateCID(128)),
            startTime: Date.now()
        }
        return sendObj
    }

    send_use(event_name, stringiryData) {
        switch (this.send_type) {
            case "send":
            case "default":
                this.default_send(event_name, stringiryData)
                break;
            case "emit":
                this.emit_send(event_name, stringiryData)
                break;
            default:
                this.default_send(event_name, stringiryData)
        }
    }

    default_send(event_name, stringiryData) {
        this.webSocket.send(stringiryData);
    }

    emit_send(event_name, stringiryData) {
        this.webSocket.emit(event_name, stringiryData);
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
                    this.send_use(event_name, stringiryData)
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

    convertToKeyValueString(element) {
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
            return this.convertToKeyValueString(obj)
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
