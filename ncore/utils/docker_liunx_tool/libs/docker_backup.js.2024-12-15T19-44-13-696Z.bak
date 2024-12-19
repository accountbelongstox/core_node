
    
import Base from '#@base';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class DockerBackup extends Base {
    constructor() {
        super();
        this.backupAddress = ''; // 备份地址 (本地/远程)
        this.autoBackup = false; // 是否自动备份
        this.autoBackupInterval = 24 * 60 * 60 * 1000; // 自动备份时长，默认24小时
    }

    /**
     * 设置备份地址
     * @param {string} address - 备份地址 (本地/远程)
     */
    setBackupAddress(address) {
        this.backupAddress = address;
    }

    /**
     * 设置是否自动备份
     * @param {boolean} autoBackup - 是否自动备份
     */
    setAutoBackup(autoBackup) {
        this.autoBackup = autoBackup;
    }

    /**
     * 设置自动备份时长
     * @param {number} interval - 自动备份时长，以毫秒为单位
     */
    setAutoBackupInterval(interval) {
        this.autoBackupInterval = interval;
    }

    /**
     * 根据容器名进行容器备份，支持 Debian9-12, Ubuntu 18-24
     * @param {string} containerName - 容器名
     */
    backupContainer(containerName) {
        if (!containerName) {
            throw new Error('Container name is required.');
        }

        const backupPath = path.join(this.backupAddress, `${containerName}-backup.tar`);
        const command = `docker export ${containerName} -o ${backupPath}`;

        try {
            execSync(command, { stdio: 'inherit' });
            console.log(`Backup for container ${containerName} created at ${backupPath}`);
        } catch (error) {
            throw new Error(`Error backing up container ${containerName}: ${error.message}`);
        }
    }

    /**
     * 根据容器名进行容器挂载，支持 Debian9-12, Ubuntu 18-24
     * @param {string} containerName - 容器名
     * @param {string} mountPoint - 挂载点
     */
    mountContainer(containerName, mountPoint) {
        if (!containerName || !mountPoint) {
            throw new Error('Container name and mount point are required.');
        }

        // Example command to mount a container's volume to the host
        const command = `docker run --rm -v ${mountPoint}:/mnt ${containerName} /bin/bash -c "cp -r /data/* /mnt/"`;

        try {
            execSync(command, { stdio: 'inherit' });
            console.log(`Container ${containerName} mounted to ${mountPoint}`);
        } catch (error) {
            throw new Error(`Error mounting container ${containerName}: ${error.message}`);
        }
    }

    /**
     * 将当前容器导出为镜像进行备份
     * @param {string} containerName - 容器名
     * @param {string} imageName - 镜像名
     */
    exportContainerAsImage(containerName, imageName) {
        if (!containerName || !imageName) {
            throw new Error('Container name and image name are required.');
        }

        const command = `docker commit ${containerName} ${imageName}`;

        try {
            execSync(command, { stdio: 'inherit' });
            console.log(`Container ${containerName} exported as image ${imageName}`);
        } catch (error) {
            throw new Error(`Error exporting container ${containerName} as image ${imageName}: ${error.message}`);
        }
    }
}

export default DockerBackup;
