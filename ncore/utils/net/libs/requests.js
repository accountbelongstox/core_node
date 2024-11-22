import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getFileNameFromUrl, ensureDirExists, getDownloadProgress } from '../unit/requests_tools.js';
import Base from '#@base';

class Requests extends Base {
    async get(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            let totalBytes = 0;
            const startTime = Date.now();
            const req = protocol.get(url, res => {
                if (res.statusCode !== 200) {
                    console.log(`http get error: statusCode(${res.statusCode})`);
                    resolve([null, Date.now() - startTime, 0]);
                    return;
                }
                let data = [];
                res.on('data', chunk => {
                    data.push(chunk);
                    totalBytes += chunk.length;
                });
                res.on('end', () => {
                    resolve([Buffer.concat(data), Date.now() - startTime, totalBytes]);
                });
            });
            req.on('error', error => {
                console.log(`http get error:`, error);
                resolve([null, Date.now() - startTime, 0]);
            });
            req.end();
        }).catch(() => {});
    }

    async post(url, postData) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol.startsWith('https') ? https : http;
            const defaultHeaders = {
                'Accept-Language': 'zh-CN,zh,en;q=0.9',
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(postData)),
            };
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.protocol.startsWith('https') ? (parsedUrl.port || 443) : (parsedUrl.port || 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: { ...defaultHeaders }
            };
            const req = protocol.request(options, res => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => {
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
        }).catch(() => {});
    }

    async getJSON(url) {
        let [data] = await this.get(url);
        try {
            if (Buffer.isBuffer(data)) {
                data = data.toString('utf8');
            }
            data = JSON.parse(data);
            if (data === null) data = {};
            return data;
        } catch (e) {
            console.log(e);
            return {};
        }
    }

    async getIMG(url) {
        let [data] = await this.get(url);
        const imageBase64 = Buffer.from(data, 'binary').toString('base64');
        return imageBase64;
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
            const req = protocol.request(options, res => {
                if (res.headers['last-modified']) {
                    resolve(res.headers['last-modified']);
                } else {
                    resolve(null);
                }
            });
            req.on('error', error => {
                reject(error);
            });
            req.end();
        });
    }

    getFileSize(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = url.startsWith('https') ? https : http;
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'HEAD'
            };
            const req = protocol.request(options, res => {
                if (res.headers['content-length']) {
                    resolve(parseInt(res.headers['content-length'], 10));
                } else {
                    resolve(null);
                }
            });
            req.on('error', error => {
                reject(error);
            });
            req.end();
        });
    }

    async download(url, savePath = path.join(os.homedir(), 'Downloads'), callback, progressCallback) {
        return new Promise((resolve, reject) => {
            const fileName = getFileNameFromUrl(url);
            const parsedUrl = new URL(url);
            const protocol = url.startsWith('https') ? https : http;
            const downloadPath = path.extname(savePath) ? savePath : path.join(savePath, fileName);

            const dirPath = path.extname(savePath) ? path.dirname(savePath) : savePath;
            ensureDirExists(dirPath);

            let totalBytes = 0;
            let receivedBytes = 0;
            const startTime = Date.now();

            const req = protocol.get(parsedUrl, res => {
                if (res.statusCode !== 200) {
                    console.log(`Download failed: statusCode(${res.statusCode})`);
                    reject(new Error(`Download failed: statusCode(${res.statusCode})`));
                    return;
                }
                totalBytes = parseInt(res.headers['content-length'], 10);
                const fileStream = fs.createWriteStream(downloadPath);
                res.pipe(fileStream);

                res.on('data', chunk => {
                    receivedBytes += chunk.length;
                    if (progressCallback) {
                        const progress = getDownloadProgress(receivedBytes, totalBytes, startTime);
                        progressCallback(progress);
                    }
                });

                fileStream.on('finish', () => {
                    const finalProgress = getDownloadProgress(receivedBytes, totalBytes, startTime);
                    if (callback) callback(finalProgress);
                    resolve(downloadPath);
                });

                fileStream.on('error', error => {
                    console.log('FileStream error:', error);
                    reject(error);
                });
            });

            req.on('error', error => {
                console.log('Request error:', error);
                reject(error);
            });

            req.end();
        });
    }

    
}

export default new Requests();
