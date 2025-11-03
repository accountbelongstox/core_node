const { WsRpcClient } = require('./index');

async function main() {
    const client = new WsRpcClient('ws://localhost:8081', {
        debug: true,
        reconnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        onConnected: async () => {
            console.log('Connected to server!');
        },
        onDisconnected: async () => {
            console.log('Disconnected from server!');
        },
        onReconnecting: async (attempt) => {
            console.log(`Reconnecting... attempt ${attempt}`);
        }
    });

    client.route('clientInfo', async (params) => {
        return {
            name: 'Client App',
            version: '1.0.0',
            platform: process.platform,
            nodeVersion: process.version
        };
    });

    client.route('notify', async (params) => {
        console.log('Server notification:', params);
        return { received: true };
    });

    client.on('customEvent', (data) => {
        console.log('Received custom event:', data);
    });

    client.addRequestInterceptor(
        async (message) => {
            console.log('Request interceptor - sending:', message.route);
            return message;
        },
        async (error) => {
            console.error('Request interceptor error:', error.message);
            throw error;
        }
    );

    client.addResponseInterceptor(
        async (result) => {
            console.log('Response interceptor - received result');
            return result;
        },
        async (error) => {
            console.error('Response interceptor error:', error.message);
            throw error;
        }
    );

    await client.connect();

    try {
        console.log('\n--- Testing add function ---');
        const sumResult = await client.call('add', { a: 5, b: 3 });
        console.log('Sum result:', sumResult);

        console.log('\n--- Testing getUserInfo ---');
        const userInfo = await client.call('getUserInfo', { userId: 123 });
        console.log('User info:', userInfo);

        console.log('\n--- Testing processData ---');
        const processResult = await client.call('processData', { data: 'test data' });
        console.log('Process result:', processResult);

        console.log('\n--- Testing non-existent route ---');
        try {
            await client.call('nonExistentRoute', {});
        } catch (error) {
            console.log('Expected error:', error.message);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main().catch(console.error);
