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

// vue to electron lib
import { ipcApiRoute, productApi } from './index.js';
import { io } from 'socket.io-client';

const wsPort = '7070';
import mittEvent from '@/store/mitt';
let isConnecting = false
let socketing = null
let socketingCount = 0

class Socket {
    constructor() {
        this.queue = [];
        this.socket = null;
        this.isConnected = false;
        this.connect();
    }

    getIpFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const ip = params.get('ip');
        return ip || '127.0.0.1';
    }
    
    get_remote_url() {
        const params = new URLSearchParams(window.location.search);
        const remoteUrl = params.get('remote_url');
        return remoteUrl || '127.0.0.1';
    }
    
    async connect() {
        if (this.socket) {
            console.log(`socket already exists`);
            return
        }
        if (isConnecting) {
            socketingCount += 1
            if (socketingCount >= 100) {
                socketing = null
                isConnecting = false
            }
            console.log(`Connection is already in progress. Skipping ${socketingCount}...`);
            return;
        }
        socketingCount = 0
        isConnecting = true;

        if (!this.socket) {
            const invokeIp = this.getIpFromUrl();
            const servicAddress = `ws://${invokeIp}:${wsPort}`
            console.log(servicAddress);
            socketing = io(servicAddress);
            socketing.on('client-listing', (data) => {
                // mittEvent.emit('service-message', data)
                let method = 'service-message'
                let params = data
                if (typeof data == 'object' && data.method) {
                    params = data.params
                    method = data.method
                }
                mittEvent.emit(method, params)
                // console.log(`socket emit `, method)
            });
            socketing.on('error', (error) => {
                isConnecting = false;
                console.error('Connection error:', error);
                this.isConnected = false;
            });
            socketing.on('connect', () => {
                console.log('Connected to socket.io server');
                isConnecting = false;
                this.isConnected = true;
                this.socket = socketing;
            });
            socketing.on('disconnect', () => {
                console.log('Disconnected from socket.io server. Reconnecting...');
                isConnecting = false;
                this.socket = null;
                setTimeout(() => {
                    this.connect();
                }, 100);
            });
        }

        // return new Promise((resolve) => {
        //     if (this.isConnected) {
        //         resolve();
        //     } else {
        //         socket.on('connect', () => {
        //             console.log('Connected to Promise');
        //             isConnecting = false;
        //             this.socket = socket;
        //             this.isConnected = true;
        //             resolve();
        //         });
        //     }
        // });
    }

    async addToQueue(method, params = {}, callback) {
        await this.connect();
        this.sendData(method, params, callback);
    }

    async postBySocketQueue(method, params = {}, callback) {
        await this.connect();
        this.sendData(method, params, callback);
    }


    async getBySocketQueue(method, params = {}, callback) {
        if (arguments.length === 2 && typeof params === 'function') {
            callback = params;
            params = {};
        }
        await this.connect();
        this.sendData(method, params, callback);
    }

    serialize(obj, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
        if (currentDepth >= maxDepth) { return null; }
        if (obj === null || typeof obj !== 'object') { return obj; }
        if (seen.has(obj)) { return null; }
        seen.add(obj);
        let result = Array.isArray(obj) ? [] : {};
        const keys = Object.keys(obj)
        keys.forEach(key => {
            let value = obj[key];
            if (exclude[key] != undefined) {
                if (exclude[key].value != undefined) {
                    result[key] = exclude[key].value;
                }
                return;
            }
            if (typeof value === 'function') {
                result[key] = null;
                return;
            }
            result[key] = this.serialize(value, maxDepth, currentDepth + 1, seen, exclude);
        })
        seen.delete(obj);
        return result;
    }

    async sendData(method, params, callback, direct = false) {
        if (this.socket) {
            // console.log(`sendData-method`, method)
            if (!direct && method.indexOf(`.`) == -1) {
                method = ipcApiRoute[method];
            }
            params = this.serialize(params)
            // console.log(`direct-method`, method)
            // console.log(`sendData-params`, params)
            params = JSON.stringify(params)
            params = JSON.parse(params)
            this.socket.emit('c1', { cmd: method, params: params }, (response) => {
                let data = {}, message = '', success = false;
                // console.log(`sendData-response`, response)
                if (response) {
                    if (!response.success) {
                        console.log(response)
                    }
                    if (response.data) {
                        data = response.data
                    }
                    if (response.message) {
                        message = response.message
                    }
                    if (response.success != undefined) {
                        success = response.success
                    }
                } else {
                    console.log(`socket Not fetch response`, response)
                }
                if (callback) callback(data, message, success);
            });
        } else {
            await this.connect();
            setTimeout(async () => {
                await this.sendData(method, params, callback)
            }, 2000)
        }
    }
}

const socket = new Socket();

export {
    socket
};