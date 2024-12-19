const Base = require('#@base');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    class DockerInfo extends Base {
        constructor() {
            super();
        }

        getDaemonConfigPath() {
            let configPath = '/etc/docker/daemon.json';
            if (this.isSnapInstalled()) {
                configPath = '/var/snap/docker/current/config/daemon.json';
            }
            return configPath;
        }

        isSnapInstalled() {
            try {
                const result = execSync('snap list docker');
                return result.toString().includes('docker');
            } catch (error) {
                return false;
            }
        }

        getRootDir() {
            const configPath = this.getDaemonConfigPath();
            if (fs.existsSync(configPath)) {
                const daemonConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                return daemonConfig['data-root'] || '/var/lib/docker';
            } else {
                throw new Error(`daemon.json file not found at: ${configPath}`);
            }
        }

        setRootDir(rootDirPath) {
            const configPath = this.getDaemonConfigPath();
            let daemonConfig = {};

            if (fs.existsSync(configPath)) {
                daemonConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }

            daemonConfig['data-root'] = rootDirPath;
            fs.writeFileSync(configPath, JSON.stringify(daemonConfig, null, 2));

            console.log(`Root directory set to: ${rootDirPath}`);
            this.restartDocker();
        }

        restartDocker() {
            try {
                execSync('systemctl restart docker');
                console.log('Docker service restarted successfully.');
            } catch (error) {
                console.error('Failed to restart Docker service', error);
            }
        }

        getDockerSockPath() {
            const defaultPath = '/var/run/docker.sock';
            return fs.existsSync(defaultPath) ? defaultPath : null;
        }

        setDockerMirrors(mirrors) {
            const configPath = this.getDaemonConfigPath();
            let daemonConfig = {};

            if (fs.existsSync(configPath)) {
                daemonConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }

            daemonConfig['registry-mirrors'] = mirrors;
            fs.writeFileSync(configPath, JSON.stringify(daemonConfig, null, 2));

            console.log(`Docker mirrors set to: ${mirrors.join(', ')}`);
            this.restartDocker();
        }

        enableDockerOnStartup() {
            try {
                execSync('systemctl enable docker');
                console.log('Docker is set to start on boot.');
            } catch (error) {
                console.error('Failed to enable Docker to start on boot', error);
            }
        }
    }

    module.exports = DockerInfo;