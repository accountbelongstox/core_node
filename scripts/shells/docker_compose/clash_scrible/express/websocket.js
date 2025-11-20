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