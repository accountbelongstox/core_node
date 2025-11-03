const { WsRpcServerExtended } = require('./index');

async function main() {
    const server = new WsRpcServerExtended({
        port: 8081,
        httpPort: 8082,
        host: 'localhost',
        debug: true,
        enableHttp: true,
        cacheMaxSize: 1000,
        cacheTTL: 3600000
    });

    server.route('add', async (params) => {
        const { a, b } = params;
        console.log(`Processing add: ${a} + ${b}`);
        return a + b;
    });

    server.route('slowOperation', async (params) => {
        const { duration } = params;
        console.log(`Starting slow operation (${duration}ms)...`);

        await new Promise(resolve => setTimeout(resolve, duration || 2000));

        console.log('Slow operation completed');
        return {
            status: 'completed',
            duration: duration || 2000,
            timestamp: Date.now()
        };
    });

    server.route('getUserInfo', async (params, context) => {
        const { userId } = params;
        console.log(`Getting user info for: ${userId} from client: ${context.clientId}`);
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
            clientId: context.clientId,
            timestamp: Date.now()
        };
    });

    server.on('connection', async ({ clientId }) => {
        console.log(`\n=== New client connected: ${clientId} ===`);

        setTimeout(async () => {
            try {
                console.log('\n--- Testing callback with result caching ---');
                const result = await server.callWithCallback('clientInfo', {}, clientId);
                console.log('Client info result:', result);
                console.log('Result cached with ID:', result.requestId);

                const cached = server.getResult(result.requestId);
                console.log('Retrieved from cache:', cached);
            } catch (error) {
                console.error('Failed to call client:', error.message);
            }
        }, 2000);

        setTimeout(async () => {
            try {
                console.log('\n--- Testing delayed callback (5 seconds) ---');
                const requestId = await server.executeDelayedCallback(
                    `delayed_${Date.now()}`,
                    'notify',
                    { message: 'This is a delayed notification!' },
                    clientId,
                    5000
                );
                console.log('Delayed callback scheduled with ID:', requestId);
                console.log('Client will be notified via WebSocket when ready');
            } catch (error) {
                console.error('Failed to schedule delayed callback:', error.message);
            }
        }, 4000);
    });

    server.on('disconnect', ({ clientId }) => {
        console.log(`\n=== Client disconnected: ${clientId} ===`);
    });

    await server.start();

    console.log('\n========================================');
    console.log('WebSocket RPC Server (Extended) is running...');
    console.log(`WebSocket: ws://${server.host}:${server.port}`);
    console.log(`HTTP API:  http://${server.httpHost}:${server.httpPort}`);
    console.log('========================================\n');

    console.log('Available HTTP endpoints:');
    console.log('  GET  /api/health               - Health check');
    console.log('  GET  /api/stats                - Server statistics');
    console.log('  GET  /api/result?requestId=... - Get cached result');
    console.log('  GET  /api/status?requestId=... - Get request status');
    console.log('  POST /api/request              - Execute request via HTTP');
    console.log('\nExample HTTP request:');
    console.log('  curl -X POST http://localhost:8082/api/request \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"route":"add","params":{"a":10,"b":20}}\'');
    console.log('\nExample delayed request:');
    console.log('  curl -X POST http://localhost:8082/api/request \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"route":"slowOperation","params":{"duration":3000},"delay":5000}\'');
    console.log('');
}

main().catch(console.error);
