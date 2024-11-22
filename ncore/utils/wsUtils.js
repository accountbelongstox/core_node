export function sendToAllWebSockets(message) {
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

export function sendToWebSockets(message, wsClientFingerprint) {
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

export function specifiedCall(data) {
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

export async function execPublicEvent(category_name, event_name, args, rawData, wsClientFingerprint) {
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

export async function execEventProcess(category_name, event_name, args, rawData, wsClientFingerprint) {
    if (encyclopedia[category_name] && event_name) {
        if (encyclopedia[category_name][event_name]) {
            let paramNames = tool.getParamNames(encyclopedia[category_name][event_name]);
            let trans_args = args.slice();
            let isResult = undefined;
            if (tool.isCallByParam(paramNames)) {
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
                trans_args = tool.arrangeAccordingToA(paramNames, callback, trans_args);
                let data;
                if (tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
                    data = await encyclopedia[category_name][event_name](...trans_args);
                } else {
                    data = encyclopedia[category_name][event_name](...trans_args);
                }
                if (data && isResult === undefined) {
                    callback(data);
                }
            } else if (tool.isPromise(encyclopedia[category_name][event_name])) {
                encyclopedia[category_name][event_name](...args).then((...data) => {
                    let rData = {
                        data,
                        debug_send_event,
                        debug_recieve_event,
                        debug_recieve_execute_event,
                    };
                    this.sendToWebSocket(null, rData, rawData, wsClientFingerprint);
                }).catch(e => {});

            } else if (tool.isAsyncFunction(encyclopedia[category_name][event_name])) {
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

export function remoteWSClientWebsocketByWS(obj, ws) {
    for (const key in this.getClienWebcketsData) {
        if (this.getClienWebcketsData[key] === ws) {
            delete this.getClienWebcketsData[key];
            return true;
        }
    }
    return null;
}

export function setWSClientWebsocketById(wsCId, ws) {
    this.getClienWebcketsData[wsCId] = ws;
}

export function getWSClientWebsocketById(wsCId) {
    if (this.getClienWebcketsData[wsCId]) {
        return this.getClienWebcketsData[wsCId];
    }
    return null;
}
