const fs = require('fs');
    const path = require('path');
    const https = require('https');
    const http = require('http');
    const file = require('./file'); // Assuming 'file' is a custom module
    
    function getFile(url, dest) {
        return new Promise(async (resolve, reject) => {
            if (!dest) {
                dest = getDefaultDownloadFileDir(url);
            }
            let result = {
                dest
            };
            let startTime = Date.now();
            if (fs.existsSync(dest)) {
                let compare = await compareFileSizes(url, dest);
                if (compare) {
                    result.success = true;
                    result.usetime = Date.now() - startTime;
                    return resolve(result);
                }
            }
            file.mkbasedir(dest);
            const protocol = url.startsWith('https') ? https : http;
            const fileStream = fs.createWriteStream(dest);
            const req = protocol.get(url, res => {
                if (res.statusCode !== 200) {
                    result.dest = false;
                    result.success = false;
                    result.usetime = Date.now() - startTime;
                    resolve(result);
                    return;
                }
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    result.success = true;
                    result.usetime = Date.now() - startTime;
                    resolve(result);
                });
            });
            req.on('error', error => {
                fs.unlink(dest);
                result.dest = null;
                result.success = false;
                result.usetime = Date.now() - startTime;
                resolve(result);
            });
            fileStream.on('error', error => {
                console.log(`error`);
                console.log(error);
                fs.unlink(dest);
                result.dest = null;
                result.success = false;
                result.usetime = Date.now() - startTime;
                resolve(result);
            });
            req.end();
        }).catch(err => {
            console.log(err);
        });
    }

    async function download(url, downloadDir) {
        if (!downloadDir) downloadDir = winapiWidget.getDocumentsDir();
        let downname = url.split('/').pop();
        downname = unescapeUrl(downname);
        if (!downloadDir.endsWith(downname)) {
            downloadDir = path.join(downloadDir, downname);
        }
        await getFile(url, downloadDir);
        return downloadDir;
    }

    async function downloadAll(urls, directory, maxThread = 10) {
        let i = 0;
        const downloadQueue = async () => {
            if (i >= urls.length) {
                return Promise.resolve();
            }
            const url = urls[i++];
            let filename = url.split('/').pop();
            filename = unescapeUrl(filename);
            const filepath = `${directory}/${filename}`;
            return download(url, filepath)
                .then(downloadQueue)
                .catch(e => {});
        };
        const downloadPromises = Array(maxThread).fill(null).map(downloadQueue);
        return Promise.all(downloadPromises);
    }

    function getRemoteFileSize(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            protocol.request(url, { method: 'HEAD' }, res => {
                const size = parseInt(res.headers['content-length'], 10);
                resolve(size);
            }).on('error', reject).end();
        });
    }

    async function compareFileSizes(remoteUrl, localPath) {
        if (!file.isFile(localPath)) return false;
        try {
            const remoteSize = await getRemoteFileSize(remoteUrl);
            const localSize = file.getFileSize(localPath);
            console.log(`compareFileSizes : url:${remoteUrl},remoteSize:${remoteSize},localPath:${localPath}`);
            return remoteSize == localSize;
        } catch (err) {
            console.error("An error occurred:", err);
            return false;
        }
    }

    module.exports = {
        getFile,
        download,
        downloadAll,
        getRemoteFileSize,
        compareFileSizes
    };