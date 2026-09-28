const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    const logger = require('#@logger');

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
                return true;
            }
            logger.error(`Invalid directory path: ${dirPath}`);
            return false;
        }

        /**
         * 根据 compose.yaml 的目录编译 compose.yaml
         */
        compileCompose() {
            if (!this.composeDir) {
                logger.error('Compose directory is not set.');
                return false;
            }

            const composeFilePath = path.join(this.composeDir, 'compose-template.yaml');

            if (!fs.existsSync(composeFilePath)) {
                logger.error(`docker-compose.yaml file not found in directory: ${this.composeDir}`);
                return false;
            }

            try {
                // 使用 docker-compose 编译 compose.yaml
                execSync(`docker-compose -f ${composeFilePath} config`, { stdio: 'inherit' });
                return true;
            } catch (error) {
                logger.error(`Error compiling docker-compose.yaml: ${error.message}`);
                return false;
            }
        }
    }

    module.exports = ComposeControl;