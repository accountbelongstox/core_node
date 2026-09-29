const fs = require('fs');
const path = require('path');
const logger = require('#@logger');
const prefix = 'FStatus';

function isFileExists(filePath){
    return fs.existsSync(filePath);
}

function getFileCreateTime(filePath){
    if(!isFileExists(filePath)){
        logger.debug(`${prefix} getFileCreateTime: ${filePath} not exists`);
        return 0;
    }
    const stats = fs.statSync(filePath);
    return stats.ctime;
}

function getFileModifyTime(filePath){
    if(!isFileExists(filePath)){
        logger.debug(`${prefix} getFileModifyTime: ${filePath} not exists`);
        return 0;
    }
    const stats = fs.statSync(filePath);
    return stats.mtime;
}

function isExpired(filePath,expireTime){    
    if(!isFileExists(filePath)){
        logger.debug(`${prefix} isExpired: ${filePath} not exists`);
        return true;
    }
    const modifyTime = getFileModifyTime(filePath);
    const now = Date.now();
    return now - modifyTime > expireTime;
}

module.exports = {
    getFileCreateTime,
    getFileModifyTime,
    isExpired
}

