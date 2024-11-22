import Base from '#@base';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class WSLUbuntuContrl extends Base {
    constructor() {
        super();
    }

    // 启动 Ubuntu
    startUbuntu() {
        try {
            console.log('Starting Ubuntu...');
            // 使用 WSL 命令启动 Ubuntu
            const result = this.execCmd('wsl -d Ubuntu');
            console.log('Ubuntu started.');
            return result;
        } catch (error) {
            this.error('Error starting Ubuntu:', error);
            return null;
        }
    }

    // 关闭 Ubuntu
    stopUbuntu() {
        try {
            console.log('Stopping Ubuntu...');
            // 使用 WSL 命令关闭 Ubuntu 实例
            const result = this.execCmd('wsl --terminate Ubuntu');
            console.log('Ubuntu stopped.');
            return result;
        } catch (error) {
            this.error('Error stopping Ubuntu:', error);
            return null;
        }
    }

    // 重启 Ubuntu
    restartUbuntu() {
        try {
            console.log('Restarting Ubuntu...');
            this.stopUbuntu(); // 先关闭
            const result = this.startUbuntu(); // 再启动
            console.log('Ubuntu restarted.');
            return result;
        } catch (error) {
            this.error('Error restarting Ubuntu:', error);
            return null;
        }
    }
}

export default new WSLUbuntuContrl();


    // 添加方法,关闭/启动/重启ubuntu
    
    