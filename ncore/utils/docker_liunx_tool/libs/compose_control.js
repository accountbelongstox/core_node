const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    class ComposeControl extends Base {
        constructor() {
            super();
            this.composeDir = './compose-template/compose-template.yml'; // 默认未设置 compose.yaml 目录
        }

        /**
         * 设置 compose.yaml 的目录
         * @param {string} dirPath - compose.yaml 的目录路径
         */
        setComposeDir(dirPath) {
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                this.composeDir = dirPath;
            } else {
                throw new Error(`Invalid directory path: ${dirPath}`);
            }
        }

        /**
         * 根据 compose.yaml 的目录编译 compose.yaml
         */
        compileCompose() {
            if (!this.composeDir) {
                throw new Error('Compose directory is not set.');
            }

            const composeFilePath = path.join(this.composeDir, 'compose-template.yaml');

            if (!fs.existsSync(composeFilePath)) {
                throw new Error(`docker-compose.yaml file not found in directory: ${this.composeDir}`);
            }

            try {
                // 使用 docker-compose 编译 compose.yaml
                execSync(`docker-compose -f ${composeFilePath} config`, { stdio: 'inherit' });
            } catch (error) {
                throw new Error(`Error compiling docker-compose.yaml: ${error.message}`);
            }
        }
    }

    module.exports = ComposeControl;