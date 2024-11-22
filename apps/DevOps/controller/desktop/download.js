'use strict';
const { Controller } = require('@egg/ee-core');

class DownloadController extends Controller {
    constructor(ctx) {
        super(ctx);

        dServer = Services.get('download');
    }

    initializeConfig() {
        return dService.initializeConfig();
    }

    initializeProgressArray() {
        return dService.initializeProgressArray();
    }

    convertToFileNameFromURL(url) {
        return dService.convertToFileNameFromURL(url);
    }

    convertToPathAndFileNameFromURL(url, mainDomain = true) {
        return dService.convertToPathAndFileNameFromURL(url, mainDomain);
    }

    addToDownloadQueue(url, customFileName, callback, groupName) {
        return dService.addToDownloadQueue(url, customFileName, callback, groupName);
    }

    addUrlToDownloadQueue(url, customPath, callback, groupName) {
        return dService.addUrlToDownloadQueue(url, customPath, callback, groupName);
    }

    addCallbackToGroup(groupName, callback) {
        return dService.addCallbackToGroup(groupName, callback);
    }

    updateProgress(taskID, downloadRate, totalLength, currentLength, percentage, estimatedTime, elapsedTime) {
        return dService.updateProgress(taskID, downloadRate, totalLength, currentLength, percentage, estimatedTime, elapsedTime);
    }

    // 方法（9）：执行下载队列
    executeDownloadQueue(maxThreads = 1) {
        return dService.executeDownloadQueue(maxThreads);
    }
}

DownloadController.toString = () => '[class DownloadController]';
module.exports = DownloadController;
