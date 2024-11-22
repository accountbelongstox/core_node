'use strict';
const { Service } = require('@egg/ee-core');

class DownloadService extends Service {
    constructor(ctx) {
        super(ctx);

        // 方法（1）：初始化一个配置对象config，包含：最大下载线程、下载队列
        this.config = {
            maxDownloadThreads: 5, // 设置最大下载线程，您可以根据需要进行调整
            downloadQueue: [], // 初始化下载队列为空
        };
    }

    // 方法（2）：初始化任务更新进度二维数组
    initializeProgressArray() {
        // 标记a，包含[{任务ID,下载速率，总长度，当前长度，百分比，预计时长，已用时}]
        // 初始化一个空的任务更新进度二维数组
        this.progressArray = [];
    }

    // 方法（3）：将URL中的文件名提取为合法的文件名
    convertToFileNameFromURL(url) {
        // 根据URL提取文件名
        const fileName = url.split('/').pop();
        // 移除文件名中的非法字符，例如?号
        const cleanedFileName = fileName.replace(/[?&]/g, '_');
        return cleanedFileName;
    }

    // 方法（4）：将URL中的文件名转换为路径+文件名
    convertToPathAndFileNameFromURL(url, mainDomain = true) {
        // 从URL提取主域名
        const parsedURL = new URL(url);
        const domain = parsedURL.hostname;
        // 根据URL提取路径
        const path = parsedURL.pathname;
        // 移除路径中的非法字符，例如?号
        const cleanedPath = path.replace(/[?&]/g, '_');
        // 生成路径+文件名
        const pathAndFileName = mainDomain ? `${domain}${cleanedPath}` : cleanedPath;
        return pathAndFileName;
    }

    // 方法（5）：添加URL到下载队列
    addToDownloadQueue(url, customFileName, callback, groupName) {
        // 根据URL生成唯一的ID值
        const uniqueID = shortid.generate();
        // 如果未提供自定义文件名，则根据URL生成文件名
        const fileName = customFileName || this.convertToFileNameFromURL(url);
        // 拼接文件保存路径
        const filePath = this.convertToPathAndFileNameFromURL(fileName);
        // 构建下载任务对象
        const downloadTask = {
            id: uniqueID,
            url,
            filePath,
            callback,
        };
        // 设置任务组ID，默认添加到默认组
        if (groupName) {
            downloadTask.group = groupName;
        } else {
            downloadTask.group = 'default';
        }
        // 添加任务到下载队列
        this.downloadQueue.push(downloadTask);
        // 如果下载队列已经启动，不需要再次启动
        if (!this.downloadQueueStarted) {
            this.downloadQueueStarted = true;
            this.startDownloadQueue();
        }
    }
    // 开始下载队列执行
    startDownloadQueue() {
        // 如果下载队列有内容，且未达到最大下载线程数
        if (this.downloadQueue.length > 0) {
            const threadsToStart = Math.min(
                this.maxDownloadThreads,
                this.downloadQueue.length
            );
            for (let i = 0; i < threadsToStart; i++) {
                const task = this.downloadQueue.shift(); // 从队列中取出任务
                this.downloadTask(task); // 调用下载文件的方法
            }
        }
    }

    // 方法（6）：添加URL到下载队列，指定路径+文件名
    addUrlToDownloadQueue(url, customPath, callback, groupName) {
        // 判断是否提供了自定义文件路径
        if (customPath) {
            // 如果提供了自定义文件路径，使用自定义路径
            const filePath = customPath;
        } else {
            // 如果未提供自定义文件路径，根据URL生成唯一的ID值，并拼接到临时目录
            const fileId = shortid.generate();
            const fileName = this.getFileNameFromUrl(url);
            const filePath = this.getUserHomeTempDownloadPath(fileId, fileName);
        }
        // 创建任务对象，包含URL、文件路径、回调函数
        const task = {
            id: fileId,        // 使用唯一ID标识任务
            url: url,
            filePath: filePath,
            callback: callback
        };
        // 设置任务组
        if (groupName) {
            // 如果提供了任务组名，根据组名生成组ID
            const groupId = this.generateGroupId(groupName);
            task.groupId = groupId;
        }
        // 添加任务到下载队列
        this.downloadQueue.push(task);
        // 如果下载队列未启动，则启动下载队列执行
        if (!this.downloadQueueIsRunning) {
            this.startDownloadQueue();
        }
    }
    // 从URL中获取文件名
    getFileNameFromUrl(url) {
        // 根据URL的路径部分获取文件名
        // 示例实现，请根据您的需求进一步调整
        const urlParts = url.split('/');
        return urlParts[urlParts.length - 1];
    }
    // 生成用户临时下载目录路径
    getUserHomeTempDownloadPath(fileId, fileName) {
        // 使用用户临时下载目录路径拼接文件名和文件ID
        // 示例实现，请根据您的需求进一步调整
        const tempDownloadDir = this.app.config.appUserDataDir;
        return `${tempDownloadDir}/${fileId}_${fileName}`;
    }

    // 方法（7）：添加组回调
    addCallbackToGroup(groupName, callback) {
        // 初始化默认组的回调队列
        if (!this.callbackGroups.default) {
            this.callbackGroups.default = [];
        }
        // 如果提供了组名，根据组名初始化或获取组的回调队列
        if (groupName) {
            if (!this.callbackGroups[groupName]) {
                this.callbackGroups[groupName] = [];
            }
        } else {
            groupName = "default"; // 如果未提供组名，默认使用"default"组
        }
        // 将回调函数添加到指定组的回调队列
        this.callbackGroups[groupName].push(callback);
    }

    // 方法（8）：更新下载进度
    updateProgress(taskID, downloadRate, totalLength, currentLength, percentage, estimatedTime, elapsedTime) {
        // 创建或查找任务在进度二维数组中的索引
        const taskIndex = this.findTaskIndex(taskID);
        if (taskIndex !== -1) {
            // 更新任务的进度信息
            this.progressArray[taskIndex] = {
                taskID,
                downloadRate,
                totalLength,
                currentLength,
                percentage,
                estimatedTime,
                elapsedTime
            };
            // 触发更新回调函数组
            this.triggerCallbacks(taskID);
        }
    }
    // 用于查找任务在进度二维数组中的索引
    findTaskIndex(taskID) {
        for (let i = 0; i < this.progressArray.length; i++) {
            if (this.progressArray[i].taskID === taskID) {
                return i;
            }
        }
        return -1; // 如果任务未找到，返回-1表示未找到
    }
    // 触发与任务ID关联的回调函数组
    triggerCallbacks(taskID) {
        // 默认回调组
        if (this.callbackGroups.default) {
            this.callbackGroups.default.forEach(callback => {
                callback(this.progressArray, taskID);
            });
        }
        // 根据任务ID查找关联的回调组
        const task = this.findTaskByID(taskID);
        if (task && task.groupID) {
            const groupName = task.groupID;
            if (this.callbackGroups[groupName]) {
                this.callbackGroups[groupName].forEach(callback => {
                    callback(this.progressArray, taskID);
                });
            }
        }
    }
    // 根据任务ID查找任务
    findTaskByID(taskID) {
        for (const task of this.downloadQueue) {
            if (task.taskID === taskID) {
                return task;
            }
        }
        return null; // 如果任务未找到，返回null
    }

    // 方法（9）：执行下载队列
    executeDownloadQueue(maxThreads = 1) {
        if (this.isDownloading) {
            console.log("下载队列已经在执行中。");
            return;
        }
        this.isDownloading = true;
        const tasksToDownload = this.downloadQueue.slice(0, maxThreads); // 获取最多 maxThreads 个任务
        this.downloadQueue = this.downloadQueue.slice(maxThreads); // 移除正在处理的任务
        const downloadPromises = tasksToDownload.map(task => this.downloadTask(task));
        Promise.all(downloadPromises)
            .then(() => {
                this.isDownloading = false;
                this.executeDownloadQueue(maxThreads); // 递归执行下载队列
            })
            .catch(error => {
                console.error("下载队列执行失败:", error);
                this.isDownloading = false;
            });
    }
    // 下载任务
    downloadTask(task) {
        return new Promise((resolve, reject) => {
            // 在这里模拟下载，您应该实现实际的下载逻辑
            console.log(`下载任务: ${task.taskID}，来自URL: ${task.url}`);
            // 模拟下载延迟
            setTimeout(() => {
                console.log(`任务 ${task.taskID} 下载完成。`);
                // 您可以在这里添加自定义逻辑以执行任务的下载
                resolve(task);
            }, 2000); // 模拟下载时间：2秒
        });
    }
}

DownloadService.toString = () => '[class DownloadService]';
module.exports = DownloadService;
