const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const Base = require('../base/base.js');
const { getnode,porttool } = require('../utils.js');
// const appRoot = path.resolve(app.getAppPath());
// const mainServer = conf.getValue('mainServer')
// const indexDir = "." + path.dirname(mainServer.indexPath)
// const distDir = path.join(appRoot, indexDir)
const http = require('http');
const { strtool, urltool, file, plattool, setenv, env } = require('../utils.js');
let electronShell = null

class Serve extends Base {
    httpPort = 18000
    currentDir = process.cwd();
    constructor() {
        super()
    }
    startVue(port = 23350, distDir = "dist") {
        const handler = require('serve-handler');
        const server = http.createServer((request, response) => {
            return handler(request, response, {
                "public": distDir
            });
        });
        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
        });
    }
    async startFrontend(frontend, frontend_command, node_version = `18`, callback) {
        const frontend_port = env.getEnv(`FRONTEND_PORT`)
        const frontendDir = file.resolvePath(frontend);
        if (urltool.isHttpUrl(frontendDir)) {
            callback(frontend);
        } else if (file.isDir(file.resolvePath(frontendDir))) {
            this.runByNpm(frontendDir, frontend_command, node_version, (result) => {
                result = result && result.stdout ? result.stdout : ``
                const resultString = strtool.toString(result);
                let debugUrl = urltool.extractHttpUrl(resultString)
                if (!debugUrl) debugUrl = `http://localhost:${frontend_port}`
                callback(debugUrl);
            })
        } else {
            console.error(`Invalid frontend directory: ${frontendDir}`);
            callback(null);
        }
    }
    async runCommand(frontendDir, frontend_command, node_version = '18', useYarn = false, callback) {
        const frontend_port = env.getEnv(`FRONTEND_PORT`)
        let is_port_use = await porttool.isPortInUse(frontend_port)
        // if (is_port_use) {
        //     await this.killProcessByPort(frontend_port)
        // }
        if (!is_port_use) {
            let exe = await getnode.getNpmByNodeVersion(node_version);
            if (useYarn) {
                exe = await getnode.getYarnByNodeVersion(node_version);
            }
            let start_command = `${exe} run ${frontend_command}`;
            if (useYarn) {
                start_command = `${exe} ${frontend_command}`;
            }
            process.chdir(frontendDir);
            if (!this.isNodeModulesNotEmpty(frontendDir) && this.isPackageJson(frontendDir)) {
                await this.installNodeModules(frontendDir, node_version, useYarn);
            }
            plattool.spawnAsync(start_command, true, frontendDir, null, callback)
        } else {
            this.info(`The front-end server is started and the port ${frontend_port} is occupied.`)
            if(callback)callback(null)
        }
    }
    async runByNpm(frontendDir, frontend_command, node_version = '18', callback) {
        const useYarn = false
        const result = await this.runCommand(frontendDir, frontend_command, node_version, useYarn, callback);
        return result
    }
    async runByYarn(frontendDir, frontend_command, node_version = '18', callback) {
        const result = await this.runCommand(frontendDir, frontend_command, node_version, true, callback);
        return result
    }
    startHTTP(port) {
        port = port ? port : this.startPort
        this.checkPort(port)
            .then((freePort) => {
                console.log(`freePort ${freePort}`)
                this.startHTTPServer(freePort)
            })
            .catch((error) => {
                console.error('Error while checking ports:', error);
            });
    }
    isNodeModulesNotEmpty(directory) {
        const nodeModulesPath = path.join(directory, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            return false;
        }
        return !this.isEmptyDir(nodeModulesPath);
    }
    isPackageJson(directory) {
        const filePath = path.join(directory, 'package.json');
        if (fs.existsSync(filePath)) {
            return true;
        }
        return false;
    }
    isEmptyDir(directory) {
        if (!fs.existsSync(directory)) {
            return true;
        }
        const contents = fs.readdirSync(directory);
        return contents.length == 0;
    }

    async installNodeModules(directory, node_version = '18', useYarn = false) {
        let exe;
        if (useYarn) {
            exe = await getnode.getYarnByNodeVersion(node_version);
        } else {
            exe = await getnode.getNpmByNodeVersion(node_version);
        }
        let resultString = ``
        if (!this.isNodeModulesNotEmpty(directory) && this.isPackageJson(directory)) {
            process.chdir(directory);
            const command = `${exe} install`
            const result = await plattool.spawnAsync(command, true, directory);
            resultString = strtool.toString(result);
        }
        process.chdir(this.currentDir);
        return resultString
    }
    
    getFrontendServerUrl() {
        const frontend_port = env.getEnv(`FRONTEND_PORT`)
        return `http://localhost:${frontend_port}`
    }

    openFrontendServerUrl(openUrl) {
        if (!openUrl) openUrl = this.getFrontendServerUrl()
        openUrl = urltool.toOpenUrl(openUrl)
        try{
            if(!electronShell){
                const { shell } = require('electron');
                electronShell = shell
            }
            electronShell.openExternal(openUrl);
        }catch(e){
            console.log(e)
        }
    }

}

Serve.toString = () => '[class Serve]';
module.exports = new Serve();


