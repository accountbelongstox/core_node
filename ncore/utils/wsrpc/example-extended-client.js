const { WsRpcClientExtended } = require('./index');
const fs = require('fs');
const path = require('path');

class SimpleStorage {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf8');
                this.data = JSON.parse(content);
            }
        } catch (error) {
            console.error('Failed to load storage:', error.message);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Failed to save storage:', error.message);
        }
    }

    setItem(key, value) {
        this.data[key] = value;
        this.save();
    }

    getItem(key) {
        return this.data[key] || null;
    }

    removeItem(key) {
        delete this.data[key];
        this.save();
    }

    key(index) {
        const keys = Object.keys(this.data);
        return keys[index] || null;
    }

    get length() {
        return Object.keys(this.data).length;
    }
}

async function main() {
    const storage = new SimpleStorage(path.join(__dirname, '.client-storage.json'));

    const client = new WsRpcClientExtended('ws://localhost:8081', {
        httpUrl: 'http://localhost:8082',
        debug: true,
        reconnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        enableHttp: true,
        preferWebSocket: true,
        enablePersistence: true,
        storage: storage,
        httpPollingInterval: 1000,
        httpMaxPollingAttempts: 60,
        onConnected: async () => {
            console.log('\n=== Connected to server! ===\n');
        },
        onDisconnected: async () => {
            console.log('\n=== Disconnected from server! ===\n');
        },
        onReconnecting: async (attempt) => {
            console.log(`Reconnecting... attempt ${attempt}`);
        }
    });

    client.route('clientInfo', async (params) => {
        console.log('Server requested client info');
        return {
            name: 'Extended Client App',
            version: '2.0.0',
            platform: process.platform,
            nodeVersion: process.version,
            features: ['persistence', 'http-fallback', 'polling']
        };
    });

    client.route('notify', async (params) => {
        console.log('\n=== Server notification ===');
        console.log('Message:', params.message);
        console.log('========================\n');
        return { received: true, timestamp: Date.now() };
    });

    client.on('result_ready', (data) => {
        console.log('\n=== Result ready notification ===');
        console.log('Request ID:', data.requestId);
        console.log('Result:', data.result);
        console.log('================================\n');
    });

    console.log('Loading persisted requests...');
    const persisted = client.getPersistedRequests();
    if (persisted.length > 0) {
        console.log(`Found ${persisted.length} persisted requests:`, persisted);
    } else {
        console.log('No persisted requests found');
    }

    console.log('\nConnecting to server...');
    try {
        await client.connect();
    } catch (error) {
        console.log('WebSocket connection failed, continuing with HTTP mode...');
    }

    try {
        console.log('\n--- Test 1: WebSocket/HTTP call (add) ---');
        const sumResult = await client.call('add', { a: 5, b: 3 });
        console.log('Sum result:', sumResult);

        console.log('\n--- Test 2: WebSocket/HTTP call (getUserInfo) ---');
        const userInfo = await client.call('getUserInfo', { userId: 123 });
        console.log('User info:', userInfo);

        console.log('\n--- Test 3: WebSocket/HTTP call (processData) ---');
        const processResult = await client.call('processData', { data: 'test data' });
        console.log('Process result:', processResult);

        console.log('\n--- Test 4: HTTP call with custom request ID ---');
        const customRequestId = `custom_${Date.now()}`;
        const customResult = await client.call('add', { a: 100, b: 200 }, {
            requestId: customRequestId,
            polling: false
        });
        console.log('Custom result:', customResult);

        console.log('\n--- Test 5: Get result by request ID ---');
        if (customResult.requestId) {
            const cachedResult = await client.getResult(customResult.requestId);
            console.log('Cached result:', cachedResult);

            const status = await client.getStatus(customResult.requestId);
            console.log('Request status:', status);
        }

        console.log('\n--- Test 6: Slow operation with HTTP polling ---');
        const slowResult = await client.call('slowOperation', { duration: 3000 });
        console.log('Slow operation result:', slowResult);

        console.log('\n--- Test 7: Delayed callback (wait for notification) ---');
        console.log('Waiting for delayed notification from server...');
        console.log('(Server should send notification in ~5 seconds)');

        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log('\n--- Test 8: Check persisted requests ---');
        const currentPersisted = client.getPersistedRequests();
        console.log('Current persisted requests:', currentPersisted);

    } catch (error) {
        console.error('\nError:', error.message);
    }

    console.log('\n--- All tests completed ---');
    console.log('Press Ctrl+C to exit');
}

main().catch(console.error);
