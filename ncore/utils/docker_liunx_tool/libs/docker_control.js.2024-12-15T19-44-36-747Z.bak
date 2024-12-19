import Base from '#@base';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class DockerControl extends Base {
    constructor() {
        super();
    }

    /**
     * 启动/停止 Docker 服务
     * @param {string} action - 'start' 或 'stop'
     */
    controlDockerService(action) {
        const validActions = ['start', 'stop'];
        if (!validActions.includes(action)) {
            throw new Error('Invalid action. Use "start" or "stop".');
        }
        try {
            console.log(`Attempting to ${action} Docker service...`);
            execSync(`systemctl ${action} docker`);
            console.log(`Docker service ${action}ed successfully.`);
        } catch (error) {
            console.error(`Failed to ${action} Docker service`, error);
        }
    }

    /**
     * 获得 Docker 正在运行的所有容器
     * @returns {Array} 容器ID数组
     */
    getRunningContainers() {
        try {
            const result = execSync(`docker ps --filter "status=running" --format "{{.ID}}"`);
            const containers = result.toString().trim().split('\n');
            return containers.filter(container => container);
        } catch (error) {
            console.error('Failed to get running containers', error);
            return [];
        }
    }

    /**
     * 获得 Docker 正在暂停的所有容器
     * @returns {Array} 容器ID数组
     */
    getPausedContainers() {
        try {
            const result = execSync(`docker ps --filter "status=paused" --format "{{.ID}}"`);
            const containers = result.toString().trim().split('\n');
            return containers.filter(container => container);
        } catch (error) {
            console.error('Failed to get paused containers', error);
            return [];
        }
    }

    /**
     * 获得 Docker 正在停止的所有容器
     * @returns {Array} 容器ID数组
     */
    getStoppedContainers() {
        try {
            const result = execSync(`docker ps --filter "status=exited" --format "{{.ID}}"`);
            const containers = result.toString().trim().split('\n');
            return containers.filter(container => container);
        } catch (error) {
            console.error('Failed to get stopped containers', error);
            return [];
        }
    }

    /**
     * 启动所有暂停的容器
     */
    startPausedContainers() {
        const pausedContainers = this.getPausedContainers();
        pausedContainers.forEach(containerID => {
            try {
                execSync(`docker unpause ${containerID}`);
                console.log(`Started paused container: ${containerID}`);
            } catch (error) {
                console.error(`Failed to start paused container: ${containerID}`, error);
            }
        });
    }

    /**
     * 启动所有停止的容器
     */
    startStoppedContainers() {
        const stoppedContainers = this.getStoppedContainers();
        stoppedContainers.forEach(containerID => {
            try {
                execSync(`docker start ${containerID}`);
                console.log(`Started stopped container: ${containerID}`);
            } catch (error) {
                console.error(`Failed to start stopped container: ${containerID}`, error);
            }
        });
    }

    /**
     * 获得 Docker 日志
     * @param {string} containerName - 容器名
     * @returns {string} 日志内容
     */
    getDockerLogs(containerName) {
        try {
            const logs = execSync(`docker logs ${containerName}`).toString();
            return logs;
        } catch (error) {
            console.error(`Failed to get logs for container: ${containerName}`, error);
            return '';
        }
    }

    /**
     * 获得 Docker 错误日志
     * @param {string} containerName - 容器名
     * @returns {string} 错误日志内容
     */
    getDockerErrorLogs(containerName) {
        try {
            const logs = execSync(`docker logs ${containerName} 2>&1 | grep -i error`).toString();
            return logs;
        } catch (error) {
            console.error(`Failed to get error logs for container: ${containerName}`, error);
            return '';
        }
    }

    /**
     * 根据容器名, 启动/停止/暂停/重启 一个 Docker 容器
     * @param {string} containerName - 容器名
     * @param {string} action - 'start', 'stop', 'pause', 'restart'
     */
    controlContainer(containerName, action) {
        const validActions = ['start', 'stop', 'pause', 'restart'];
        if (!validActions.includes(action)) {
            throw new Error('Invalid action. Use "start", "stop", "pause", or "restart".');
        }
        try {
            console.log(`Attempting to ${action} container: ${containerName}`);
            execSync(`docker ${action} ${containerName}`);
            console.log(`Container ${containerName} ${action}ed successfully.`);
        } catch (error) {
            console.error(`Failed to ${action} container: ${containerName}`, error);
        }
    }
}

export default DockerControl;
