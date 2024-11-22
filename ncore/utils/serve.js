import path from 'path';
import fs from 'fs';
import http from 'http';
import serveHandler from 'serve-handler';
import { env } from '../globalvars.js';
import { strtool, urltool, file, } from '../utils.js';
import Base from '#@base';
let electronShell = null;

class Serve extends Base {
    constructor() {
        super();
        this.httpPort = 18000;
        this.currentDir = this.getCwd();
    }

    startServer(directory, port = 3000) {
        port = parseInt(port);
        directory = this.getCwd(directory);
        const server = http.createServer((request, response) => {
            return serveHandler(request, response, {
                public: directory,
                cleanUrls: true,
                renderSingle: true,
            });
        });

        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
            console.log(`\tDist-Dir ${directory}`);
        });
    }

    startVue(port = 23350, distDir = 'dist') {
        const server = http.createServer((request, response) => {
            return serveHandler(request, response, {
                public: distDir,
            });
        });
        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
        });
    }

    async startFrontend(frontend, frontendCommand, nodeVersion = '18', callback) {
        const frontendPort = env.getEnv('FRONTEND_PORT');
        const frontendDir = file.resolvePath(frontend);
        if (urltool.isHttpUrl(frontendDir)) {
            callback(frontend);
        } else if (file.isDir(frontendDir)) {
            this.runByNpm(frontendDir, frontendCommand, nodeVersion, (result) => {
                result = result && result.stdout ? result.stdout : '';
                const resultString = strtool.toString(result);
                let debugUrl = urltool.extractHttpUrl(resultString);
                if (!debugUrl) debugUrl = `http://localhost:${frontendPort}`;
                callback(debugUrl);
            });
        } else {
            console.error(`Invalid frontend directory: ${frontendDir}`);
            callback(null);
        }
    }

    startHTTP(port) {
        port = port || this.httpPort;
        this.checkPort(port)
            .then((freePort) => {
                console.log(`freePort ${freePort}`);
                this.startHTTPServer(freePort);
            })
            .catch((error) => {
                console.error('Error while checking ports:', error);
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



    getFrontendServerUrl() {
        const frontendPort = env.getEnv('FRONTEND_PORT');
        return `http://localhost:${frontendPort}`;
    }

    openFrontendServerUrl(openUrl) {
        if (typeof openUrl === 'object' && openUrl.protocol && openUrl.hostname && openUrl.port) {
            const protocol = openUrl.protocol;
            const hostname = openUrl.hostname;
            const port = openUrl.port;
            openUrl = `${protocol}${hostname}:${port}`;
        }
        if (!openUrl) openUrl = this.getFrontendServerUrl();
        openUrl = urltool.toOpenUrl(openUrl);
        try {
            if (!electronShell) {
                const { shell } = require('electron');
                electronShell = shell;
            }
            electronShell.openExternal(openUrl);
        } catch (e) {
            console.log(e);
        }
    }
}

Serve.toString = () => '[class Serve]';
export default new Serve();
