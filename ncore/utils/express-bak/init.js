const express = require('express');
const bodyParser = require('body-parser');
const { views_dir, puppeteer_dir, out_dir, exportsDir } = require('../provider/global_var');
const http = require('http');
const { initializeWebSocket } = require('./websocket');
const os = require('os');
const logger = require('../utils/log_utils');

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}

function setupStaticDirectories(app) {
    app.use('/static', express.static(views_dir));
    app.use('/static', express.static(puppeteer_dir));
    app.use('/static', express.static(out_dir));
    app.use('/static', express.static(exportsDir));
    app.use('/static', (req, res, next) => {
        res.status(404).send('File not found');
    });
}

function initializeExpress() {
    const app = express();
    const server = http.createServer(app);

    // Increase body-parser limits
    app.use(bodyParser.json({ limit: '500mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));

    setupStaticDirectories(app);

    // Initialize WebSocket
    initializeWebSocket(server);

    return { app, server };
}

function startServer(server, port) {
    return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => {
            const localIPs = getLocalIPs();
            logger.logGreen('Server startup successful!');
            logger.logYellow('Available IP addresses and ports:');
            localIPs.forEach((ip, index) => {
                logger.logGreen(` http://${ip}:${port}`);
            });
            logger.logYellow('You can access the server using any of the above addresses.');
            logger.logGreen('Tips:');
            logger.log('- Use the IP address that matches your network configuration.');
            logger.log(`- If you're accessing from the same machine, you can also use http://localhost:${port}`);
            logger.log(`- For remote access, ensure your firewall allows incoming connections on port ${port}`);
            resolve();
        });
    });
}

module.exports = {
    initializeExpress,
    startServer
};
