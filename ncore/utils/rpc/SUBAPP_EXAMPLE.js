const rpc = require('./index');
const path = require('path');

console.log('===========================================');
console.log('RPC SubApp Integration Example');
console.log('===========================================\n');

async function startServerWithSubApps() {
    console.log('Step 1: Register SubApp "UserModule"');
    console.log('--------------------------------------');

    rpc.registerSubApp('UserModule', {
        config: {
            USER_MODULE_TIMEOUT: 5000,
            USER_MODULE_MAX_USERS: 1000
        },
        staticPaths: {
            '/user-static': [
                path.join(__dirname, 'test_subapp', 'user_static'),
                path.join(__dirname, 'public', 'users')
            ]
        }
    });

    rpc.registerRoute('UserModule', 'getUser', async (params, context) => {
        console.log(`  → UserModule.getUser called`);
        console.log(`    requestId: ${context.requestId}`);
        console.log(`    appName: ${context.appName}`);
        console.log(`    params:`, params);

        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            userId: params.userId,
            username: `User_${params.userId}`,
            email: `user${params.userId}@example.com`,
            processedBy: context.appName,
            requestId: context.requestId,
            timestamp: Date.now()
        };
    });

    rpc.registerRoute('UserModule', 'createUser', async (params, context) => {
        console.log(`  → UserModule.createUser called`);
        console.log(`    requestId: ${context.requestId}`);

        return {
            success: true,
            userId: Math.floor(Math.random() * 10000),
            username: params.username,
            email: params.email,
            createdAt: Date.now(),
            requestId: context.requestId
        };
    });

    console.log('✓ UserModule registered with 2 routes\n');

    console.log('Step 2: Register SubApp "OrderModule"');
    console.log('--------------------------------------');

    rpc.registerSubApp('OrderModule', {
        config: {
            ORDER_MODULE_TIMEOUT: 10000,
            MAX_ORDERS_PER_USER: 50
        },
        staticPaths: {
            '/order-static': path.join(__dirname, 'test_subapp', 'order_static')
        }
    });

    rpc.registerRoute('OrderModule', 'getOrder', async (params, context) => {
        console.log(`  → OrderModule.getOrder called`);
        console.log(`    requestId: ${context.requestId}`);

        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            orderId: params.orderId,
            userId: params.userId,
            items: ['Item1', 'Item2', 'Item3'],
            total: 99.99,
            status: 'pending',
            processedBy: context.appName,
            requestId: context.requestId,
            timestamp: Date.now()
        };
    });

    rpc.registerRoute('OrderModule', 'createOrder', async (params, context) => {
        console.log(`  → OrderModule.createOrder called`);

        if (!params.userId || !params.items) {
            throw new Error('userId and items are required');
        }

        return {
            success: true,
            orderId: Math.floor(Math.random() * 100000),
            userId: params.userId,
            items: params.items,
            total: params.items.length * 10,
            status: 'created',
            requestId: context.requestId,
            createdAt: Date.now()
        };
    });

    console.log('✓ OrderModule registered with 2 routes\n');

    console.log('Step 3: Create Express Server with SubApp paths');
    console.log('------------------------------------------------');

    const server = rpc.createExpressServer({
        HTTP_PORT: 8080
    });

    console.log('✓ Express Server created\n');

    console.log('Step 4: Create RPC Server');
    console.log('-------------------------');

    const rpcServer = rpc.createHttpServer(server.getApp());

    rpcServer.route('coreFunction', async (params) => {
        console.log('  → Core RPC route called');
        return {
            message: 'This is a core RPC function',
            timestamp: Date.now()
        };
    });

    rpcServer.start();
    console.log('✓ RPC Server started\n');

    await server.start();

    console.log('\n===========================================');
    console.log('Server Started Successfully!');
    console.log('===========================================');
    console.log('HTTP Server:      http://localhost:8080');
    console.log('');
    console.log('Core Routes:');
    console.log('  coreFunction           - Core RPC function');
    console.log('');
    console.log('SubApp Routes (managed by RPC framework):');
    console.log('  UserModule.getUser     - Get user info');
    console.log('  UserModule.createUser  - Create new user');
    console.log('  OrderModule.getOrder   - Get order info');
    console.log('  OrderModule.createOrder- Create new order');
    console.log('');
    console.log('Static Paths:');
    console.log('  /user-static           - User module static files');
    console.log('  /order-static          - Order module static files');
    console.log('');
    console.log('Special Endpoints:');
    console.log('  GET  /rpc/health       - Server health check');
    console.log('  GET  /rpc/subapps      - SubApp statistics');
    console.log('  GET  /rpc/client.js    - Client library');
    console.log('===========================================\n');

    const stats = rpc.getSubAppStats();
    console.log('SubApp Statistics:');
    console.log(`  Registered SubApps: ${stats.subAppsCount}`);
    console.log(`  Total Routes: ${stats.routesCount}`);
    console.log(`  SubApps: ${stats.subApps.map(s => s.name).join(', ')}`);
    console.log('===========================================\n');
}

async function testSubAppClients() {
    console.log('\n===========================================');
    console.log('Testing SubApp RPC Calls');
    console.log('===========================================\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const client = rpc.createClient('http://localhost:8080/rpc', {
        clientId: 'subapp-test-client',
        httpFallback: true
    });

    client.on('connected', (data) => {
        console.log(`✓ Client connected via ${data.mode}\n`);
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Test 1: Call UserModule.getUser');
    console.log('--------------------------------');
    try {
        const result1 = await client.call('UserModule.getUser', { userId: 12345 });
        console.log('✓ Result:', JSON.stringify(result1, null, 2));
    } catch (error) {
        console.log('✗ Error:', error.message);
    }

    console.log('\nTest 2: Call UserModule.createUser');
    console.log('-----------------------------------');
    try {
        const result2 = await client.call('UserModule.createUser', {
            username: 'john_doe',
            email: 'john@example.com'
        });
        console.log('✓ Result:', JSON.stringify(result2, null, 2));
    } catch (error) {
        console.log('✗ Error:', error.message);
    }

    console.log('\nTest 3: Call OrderModule.getOrder');
    console.log('----------------------------------');
    try {
        const result3 = await client.call('OrderModule.getOrder', {
            orderId: 99999,
            userId: 12345
        });
        console.log('✓ Result:', JSON.stringify(result3, null, 2));
    } catch (error) {
        console.log('✗ Error:', error.message);
    }

    console.log('\nTest 4: Call OrderModule.createOrder');
    console.log('-------------------------------------');
    try {
        const result4 = await client.call('OrderModule.createOrder', {
            userId: 12345,
            items: ['Product A', 'Product B', 'Product C']
        });
        console.log('✓ Result:', JSON.stringify(result4, null, 2));
    } catch (error) {
        console.log('✗ Error:', error.message);
    }

    console.log('\nTest 5: Call Core Function');
    console.log('---------------------------');
    try {
        const result5 = await client.call('coreFunction', {});
        console.log('✓ Result:', JSON.stringify(result5, null, 2));
    } catch (error) {
        console.log('✗ Error:', error.message);
    }

    console.log('\nTest 6: Call Non-existent Route (expect error)');
    console.log('-----------------------------------------------');
    try {
        const result6 = await client.call('NonExistent.route', {});
        console.log('✗ Unexpected success:', result6);
    } catch (error) {
        console.log('✓ Expected error:', error.message);
    }

    client.close();
    console.log('\n✓ Client closed');

    console.log('\n===========================================');
    console.log('All Tests Completed!');
    console.log('===========================================\n');

    console.log('Key Points:');
    console.log('  ✓ SubApp routes are automatically prefixed (AppName.routeName)');
    console.log('  ✓ All results are managed by RPC framework using requestId');
    console.log('  ✓ SubApps can have their own configurations');
    console.log('  ✓ SubApps can add static paths');
    console.log('  ✓ All responses go through RPC caching/notification mechanism');
    console.log('  ✓ WebSocket retries (3x) and HTTP polling (1.5s) work for all routes');
    console.log('===========================================\n');

    process.exit(0);
}

if (require.main === module) {
    const mode = process.argv[2] || 'server';

    if (mode === 'server') {
        startServerWithSubApps().catch(console.error);
    } else if (mode === 'client') {
        testSubAppClients().catch(console.error);
    } else if (mode === 'both') {
        startServerWithSubApps().then(() => {
            setTimeout(() => {
                testSubAppClients().catch(console.error);
            }, 3000);
        }).catch(console.error);
    }
}

module.exports = {
    startServerWithSubApps,
    testSubAppClients
};
