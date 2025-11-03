const { WsRpcServer } = require('./index');

async function main() {
    const server = new WsRpcServer({
        port: 8081,
        host: 'localhost',
        debug: true
    });

    server.route('add', async (params) => {
        const { a, b } = params;
        return a + b;
    });

    server.route('getUserInfo', async (params) => {
        const { userId } = params;
        return {
            id: userId,
            name: 'John Doe',
            email: 'john@example.com',
            timestamp: Date.now()
        };
    });

    server.route('processData', async (params, context) => {
        console.log(`Processing data from client: ${context.clientId}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            status: 'success',
            processed: params.data,
            clientId: context.clientId
        };
    });

    server.on('connection', ({ clientId }) => {
        console.log(`New client connected: ${clientId}`);

        setTimeout(async () => {
            try {
                const result = await server.callClient('clientInfo', {}, clientId);
                console.log('Client info:', result);
            } catch (error) {
                console.error('Failed to call client:', error.message);
            }
        }, 2000);
    });

    server.on('disconnect', ({ clientId }) => {
        console.log(`Client disconnected: ${clientId}`);
    });

    await server.start();
    console.log('WebSocket RPC Server is running...');
}

main().catch(console.error);
