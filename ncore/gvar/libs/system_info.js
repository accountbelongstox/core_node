const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

class SystemInfo {
    getSystemToken = () => {
        const systemPlatform = os.platform();
        const release = os.release();
        const version = os.version();
        const machine = os.machine();
        const node = os.hostname();
        const processor = os.arch();
        const filesystemInfo = fs.statSync('/').dev;
        const uniqueString = `${systemPlatform}-${release}-${version}-${machine}-${node}-${processor}-${filesystemInfo}`;
        return uniqueString;
    }

    getSystemId = () => {
        const uniqueString = this.getSystemToken();
        return crypto.createHash('sha256').update(uniqueString).digest('hex');
    }

    isWindows = () => {
        return os.platform() === 'win32';
    }
}

module.exports = new SystemInfo();