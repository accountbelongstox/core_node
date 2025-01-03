const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

let wss;

function initializeWebSocket(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        ws.on('message', (message) => {
            console.log('Received message:', message);
            handleIncomingMessage(ws, message);
        });

        ws.on('close', () => {
            console.log('WebSocket client disconnected');
        });
    });

    return wss;
}

function handleIncomingMessage(ws, message) {
    try {
        const parsedMessage = JSON.parse(message);
        const standardizedMessage = standardizeMessage(parsedMessage.data, parsedMessage.eventName, parsedMessage.type);
        // Process the standardized message
        console.log('Standardized message:', standardizedMessage);
        // Additional message processing logic can be added here
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

function standardizeMessage(data, eventName = 'unknown', type = 'default') {
    const now = new Date();
    return {
        eventName: eventName,
        id: data.id || uuidv4(),
        data: data.data || data,
        serverTime: now.toISOString(),
        receivedTime: now,
        duration: null,
        status: data.status || 'success',
        type: type
    };
}

function broadcastMessage(message, eventName = 'unknown', type = 'default') {
    if (wss) {
        const standardizedMessage = standardizeMessage(message, eventName, type);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(standardizedMessage));
            }
        });
    }
}

module.exports = {
    initializeWebSocket,
    broadcastMessage
};