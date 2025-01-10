const expressProvider = require('../provider/expressProvider');
const app = expressProvider.getExpressApp();
const WebSocket = require('ws');
const http = require('http');
const logger = require('../logger/index.js');


function ensureParsedObject(message,) {
    let data;
    if (typeof message === 'string') {
        try{
            data = JSON.parse(message);
            return data
        }catch(e){
            logger.warn(e)
            return {
                'data': message
            }
        }
    } else if (typeof message === 'object' && message !== null) {
        return message;
    } else {
        return {
            'data': message
        };
    }
}

class WsManager {
    constructor() {
        this.wss = null;
        this.server = null;
        this.clients = new Set();
    }


    async start(portOrConfig) {
        let port = portOrConfig.HTTP_PORT;
        this.server = http.createServer(app);
        logger.success(`Express server with WebSocket started on port ${port}.`);
        this.wss = new WebSocket.Server({ server: this.server });

        this.wss.on('connection', (ws) => {
            logger.info('New WebSocket client connected');
            this.clients.add(ws);

            ws.on('message', (message) => {
                try {
                    const data = ensureParsedObject(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    logger.error('Error parsing WebSocket message:', error);
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                logger.info('Client disconnected');
                this.clients.delete(ws);
            });

            // Handle errors
            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });

        expressProvider.setWsToken(true)
        expressProvider.setServerApp(this.server)
        expressProvider.setExpressApp(app)
    }

    /**
     * Handle incoming messages
     * @param {WebSocket} ws - WebSocket client
     * @param {Object} data - Message data
     */
    handleMessage(ws, data) {
        const { type, payload } = data;
        logger.info(`Received message type: ${type}`);

        switch (type) {
            case 'ping':
                this.sendToWsClient(ws, { type: 'pong', payload: Date.now() });
                break;
            case 'broadcast':
                this.broadcastWs(payload);
                break;
            default:
                logger.warn(`Unknown message type: ${type}`);
        }
    }

    sendToWsClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    broadcastWs(data) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    stop() {
        if (this.wss) {
            this.clients.forEach(client => client.close());
            this.clients.clear();
            this.wss.close();
            logger.info('WebSocket server stopped');
        }
    }
}

module.exports = new WsManager();