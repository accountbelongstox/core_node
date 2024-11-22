const path = require('path');
// const Log = require('@egg/ee-core/log');
const Conf = require('@egg/ee-core/config');
// const fs = require('fs');
const { app } = require('electron');
const remoteUrl = Conf.getValue('remoteUrl')
const expressPort = remoteUrl.url.match(/:(\d+)/);
const port = parseInt(expressPort[1], 10);
const appRoot = path.resolve(app.getAppPath());
const mainServer = Conf.getValue('mainServer')
const indexDir = "." + path.dirname(mainServer.indexPath)
const distDir = path.join(appRoot, indexDir)

class ServeAddon {

    constructor() {
    }

    create() {
        const handler = require('serve-handler');
        const http = require('http');
        const server = http.createServer((request, response) => {
            return handler(request, response, {
                "public": distDir
            });
        });

        server.listen(port, () => {
            console.log(`Running at http://localhost:${port}`);
        });
    }
}

ServeAddon.toString = () => '[class ServeAddon]';
module.exports = ServeAddon;





