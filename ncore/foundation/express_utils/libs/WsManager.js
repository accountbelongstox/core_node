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

const expressProvider = require('../provider/expressProvider');
const app = expressProvider.getExpressApp();
const WebSocket = require('ws');
const http = require('http');
const logger = require('#@logger');

let wss = null;
const clients = new Set();

/**
 * Wrap data into standard message format
 * @param {*} data - Original data to send
 * @param {string} [event='message'] - Event type
 * @returns {Object} Wrapped message object
 */
function wrapMessage(data, event = 'message') {
    const timestamp = Date.now();
    
    // If data is string, wrap it in object
    if (typeof data === 'string') {
        return {
            event,
            timestamp,
            data: {
                data: data
            }
        };
    }
    
    // If data is already an object
    if (typeof data === 'object' && data !== null) {
        // If it has event property, just add timestamp
        if (data.event) {
            return {
                ...data,
                timestamp: data.timestamp || timestamp
            };
        }
        
        // If no event property, wrap the entire object
        return {
            event,
            timestamp,
            data: data
        };
    }
    
    // For other types (number, boolean, etc.)
    return {
        event,
        timestamp,
        data: {
            data: data
        }
    };
}

function ensureParsedObject(message) {
    let data;
    if (typeof message === 'string') {
        try {
            data = JSON.parse(message);
            return data;
        } catch(e) {
            logger.warn(e);
            return {
                'data': message
            };
        }
    } else if (typeof message === 'object' && message !== null) {
        return message;
    } else {
        return {
            'data': message
        };
    }
}

/**
 * Handle incoming messages
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} data - Message data
 */
function handleMessage(ws, data) {
    const { type = "message", payload } = data;

    switch (type) {
        case 'message':
            sendToWsClient(ws, { type: 'message', payload: Date.now() });
            break;
        case 'ping':
            sendToWsClient(ws, { type: 'ping', payload: Date.now() });
            break;
        case 'broadcast':
            broadcastWs(payload);
            break;
        default:
            logger.warn(`Unknown message(handleMessage) type: ${type}`);
    }
}

/**
 * Send message to specific WebSocket client
 * @param {WebSocket} ws - WebSocket client
 * @param {*} data - Data to send
 */
function sendToWsClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        const wrappedData = wrapMessage(data);
        ws.send(JSON.stringify(wrappedData));
    }
}

/**
 * Broadcast message to all connected clients
 * @param {*} data - Data to broadcast
 */
function broadcastWs(data) {
    const wrappedData = wrapMessage(data);
    const message = JSON.stringify(wrappedData);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

class WsManager {
    constructor() {
        this.server = null;
    }

    async start(portOrConfig) {
        let port = portOrConfig.HTTP_PORT;
        this.server = http.createServer(app);
        wss = new WebSocket.Server({ server: this.server });

        wss.on('connection', (ws) => {
            logger.info('New WebSocket client connected');
            clients.add(ws);

            ws.on('message', (message) => {
                try {
                    const data = ensureParsedObject(message);
                    handleMessage(ws, data);
                } catch (error) {
                    logger.error('Error parsing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                logger.info('Client disconnected');
                clients.delete(ws);
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
                clients.delete(ws);
            });
        });

        logger.setWsBroadcast(broadcastWs);
        expressProvider.setWsToken(true);
        expressProvider.setServerApp(this.server);
        expressProvider.setExpressApp(app);
    }

    stop() {
        if (wss) {
            clients.forEach(client => client.close());
            clients.clear();
            wss.close();
            logger.info('WebSocket server stopped');
            wss = null;
        }
    }
}

module.exports = new WsManager();
module.exports.broadcastWs = broadcastWs;
module.exports.sendToWsClient = sendToWsClient;
