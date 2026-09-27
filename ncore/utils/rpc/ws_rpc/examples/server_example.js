const { createServer } = require('#@ncore/utils/ws_rpc');
const logger = require('#@logger');

const server = createServer({
    port: 8080,
    host: '0.0.0.0',
    debug: true
});

server.route('hello', (params, clientId) => {
    logger.info(`Client ${clientId} says: ${params.name}`);
    return {
        message: `Hello, ${params.name}!`,
        timestamp: new Date().toISOString()
    };
});

server.route('getUserData', async (params, clientId) => {
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
        userId: params.userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
    };
});

server.route('calculate', (params, clientId) => {
    const { operation, a, b } = params;
    let result;

    switch (operation) {
        case 'add':
            result = a + b;
            break;
        case 'subtract':
            result = a - b;
            break;
        case 'multiply':
            result = a * b;
            break;
        case 'divide':
            if (b === 0) {
                logger.error('Division by zero attempt');
                return { error: 'Cannot divide by zero' };
            }
            result = a / b;
            break;
        default:
            logger.error(`Unknown operation: ${operation}`);
            return { error: `Unknown operation: ${operation}` };
    }

    return {
        operation,
        a,
        b,
        result
    };
});

server.on('chat:message', (data, clientId) => {
    logger.info(`Chat message from ${clientId}: ${data.message}`);

    server.triggerEvent('chat:message', {
        from: clientId,
        message: data.message,
        timestamp: Date.now()
    });
});

server.on('client:status', (data, clientId) => {
    logger.debug(`Client ${clientId} status:`, data);
});

server.on('clientConnected', (clientId) => {
    logger.success(`Client connected: ${clientId}`);

    server.triggerEvent('welcome:message', {
        message: 'Welcome to WebSocket RPC Server!',
        serverVersion: '1.0.0'
    }, clientId);
});

server.on('clientDisconnected', (clientId) => {
    logger.warn(`Client disconnected: ${clientId}`);
});

setInterval(async () => {
    const clients = server.getClients();

    for (const clientId of clients) {
        try {
            const status = await server.callClient('getStatus', {}, clientId);
            logger.debug(`Client ${clientId} status:`, status);
        } catch (error) {
            logger.error(`Failed to get status from ${clientId}:`, error.message);
        }
    }
}, 30000);

server.start().then(() => {
    logger.success('WebSocket RPC Server started successfully');
}).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down server...');
    await server.stop();
    process.exit(0);
});
