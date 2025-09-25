// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const expressProvider = require('../provider/expressProvider');
const { getConfig } = require('../config');

class ExpressManager {
    constructor() {
    }

    getLocalIp() {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        
        // Look for the first non-internal IPv4 address
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        
        // Fallback to localhost if no external IP found
        return '127.0.0.1';
    }

    async start(port) {
        const app = expressProvider.getExpressApp()
        const server = expressProvider.getServerApp()
        this.config = await getConfig();
        const serverPort = port || this.config.HTTP_PORT;
        const serverHost = this.config.HTTP_HOST;
        const wsEnable = expressProvider.getWsToken()
        const localIp = this.getLocalIp();
        if (server) {
            return new Promise((resolve, reject) => {
                server.listen(serverPort, serverHost, (err) => {
                    if (err) {
                        logger.error('Failed to start server:'+err);
                        reject(err); // Reject the promise if there is an error
                    } else {
                        logger.success(`WebSocket server is running at ws://${localIp}:${serverPort}`);
                        logger.success(`HTTP server is running at http://${localIp}:${serverPort}`);
                        resolve(server); // Resolve the promise once the server starts successfully
                    }
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                try {
                    app.listen(serverPort, serverHost, () => {
                        const protocol = this.config.SSL_ENABLED ? 'HTTPS' : 'HTTP';
                        logger.success(`${protocol} Server running on ${serverHost}:${serverPort}`);
                        resolve(app);
                    });
                } catch (error) {
                    logger.error('Failed to start server:', error);
                    reject(error);
                }
            });
        }

    }
}

const expressManager = new ExpressManager();
module.exports = { expressManager };

