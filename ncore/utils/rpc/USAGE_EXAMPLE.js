const rpc = require('./index');
const path = require('path');

async function serverExample() {
    const server = rpc.createExpressServer({
        HTTP_PORT: 8080,
        STATIC_PATHS: {
            '/static': [
                path.join(__dirname, 'public'),
            ],
            '/assets': [
                path.join(__dirname, 'assets'),
            ]
        }
    });

    server.getRouterManager().api('/test', async (req, res) => {
        return { message: 'Hello from API' };
    });

    const rpcServer = rpc.createHttpServer(server.getApp(), {
        auth: { enabled: false }
    });

    rpcServer.route('sayHello', async (params) => {
        return { greeting: `Hello, ${params.name}!` };
    });

    rpcServer.route('calculate', async (params) => {
        const { a, b, operation } = params;
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
                result = a / b;
                break;
            default:
                throw new Error('Invalid operation');
        }

        return { result };
    });

    rpcServer.start();

    await server.start();

    console.log('RPC Server running on http://localhost:8080');
    console.log('RPC Client Library: http://localhost:8080/rpc/client.js');
    console.log('Health: http://localhost:8080/rpc/health');
    console.log('Static Files: /static, /assets');
}

async function clientExample() {
    const client = rpc.createClient('http://localhost:8080/rpc', {
        clientId: 'client-123',
        httpFallback: true
    });

    client.on('connected', (data) => {
        console.log('Connected via:', data.mode);
    });

    client.on('error', (error) => {
        console.error('Client error:', error);
    });

    try {
        const helloResult = await client.call('sayHello', { name: 'World' });
        console.log('Hello Result:', helloResult);

        const calcResult = await client.call('calculate', {
            a: 10,
            b: 5,
            operation: 'multiply'
        });
        console.log('Calculate Result:', calcResult);

    } catch (error) {
        console.error('RPC Error:', error);
    }

    client.close();
}

if (require.main === module) {
    const mode = process.argv[2] || 'server';

    if (mode === 'server') {
        serverExample().catch(console.error);
    } else if (mode === 'client') {
        setTimeout(() => {
            clientExample().catch(console.error);
        }, 1000);
    } else if (mode === 'both') {
        serverExample().then(() => {
            setTimeout(() => {
                clientExample().catch(console.error);
            }, 2000);
        }).catch(console.error);
    }
}

module.exports = {
    serverExample,
    clientExample
};
