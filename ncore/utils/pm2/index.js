import path from 'path';
import fs from 'fs';
import conf from '../../util/conf.js';
import { app } from '../electron';
import { execSync } from 'child_process';
import net from 'net';
import http from 'http';
import { getnode } from '../../utils.js';
import { strtool, urltool, file, plattool, setenv, env } from '../../utils.js';
import Base from '#@base';

class Pm2 extends Base {
    constructor() {
        super();
        this.httpPort = 18000;
    }

    startVue(port = 23350, distDir = 'dist') {
        const handler = require('serve-handler');
        const server = http.createServer((request, response) => {
            return handler(request, response, { public: distDir });
        });
        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
        });
    }

    async startFrontend(frontend, frontendCommand, yarn, callback) {
        const npmExe = await getnode.getNpmByNodeVersion('14');
        const env_FRONTEND_COMMAND = env.getEnv('FRONTEND_COMMAND');
        const env_FRONTEND_PORT = env.getEnv('FRONTEND_PORT');
        const env_FRONTEND_NODE = env.getEnv('FRONTEND_NODE');
        const env_FRONTEND = env.getEnv('FRONTEND');
        if (!yarn) yarn = setenv.where('yarn');
        const currentDir = this.getCwd();
        const frontendDir = file.resolvePath(frontend);

        console.log({ env_FRONTEND_NODE, env_FRONTEND_COMMAND, env_FRONTEND_PORT, env_FRONTEND, yarn, currentDir, frontendDir, npmExe });

        if (urltool.isHttpUrl(frontendDir)) {
            callback(frontend);
        } else if (file.isDir(file.resolvePath(frontendDir))) {
            const startCommand = `${npmExe} run ${frontendCommand}`;
            process.chdir(frontendDir);
            if (!this.isNodeModulesNotEmpty(frontendDir) && this.isPackageJson(frontendDir)) {
                plattool.spawnAsync(`${npmExe} install`, true, frontendDir);
            }
            console.log(`startCommand: ${startCommand}`);
            let debugUrl = '';
            const result = plattool.spawnAsync(startCommand, true, frontendDir);
            const output = strtool.toString(result);
            debugUrl = urltool.extractHttpUrl(output);
            process.chdir(currentDir);
            callback(debugUrl);
        } else {
            console.error(`Invalid frontend directory: ${frontendDir}`);
            callback();
        }
    }

    startHTTP(port) {
        port = port || this.httpPort;
        this.checkPort(port)
            .then((freePort) => {
                console.log(`freePort: ${freePort}`);
                this.startHTTPServer(freePort);
            })
            .catch((error) => {
                console.error('Error while checking ports:', error);
            });
    }

    checkPort(port) {
        return new Promise((resolve, reject) => {
            const tester = net.createServer();
            tester.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    tester.close(() => {
                        this.checkPort(port + 1).then(resolve).catch(reject);
                    });
                } else {
                    reject(err);
                }
            });
            tester.once('listening', () => {
                tester.close(() => resolve(port));
            });
            tester.listen(port);
        });
    }

    isNodeModulesNotEmpty(directory) {
        const nodeModulesPath = path.join(directory, 'node_modules');
        return fs.existsSync(nodeModulesPath) && !this.isEmptyDir(nodeModulesPath);
    }

    isPackageJson(directory) {
        return fs.existsSync(path.join(directory, 'package.json'));
    }

    isEmptyDir(directory) {
        return !fs.existsSync(directory) || fs.readdirSync(directory).length === 0;
    }
}

Pm2.toString = () => '[class Pm2]';
export default new Pm2();
