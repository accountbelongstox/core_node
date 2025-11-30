const rpc = require('./index');

console.log('=== Registering SubApp ===');
rpc.registerSubApp('TestApp', { config: {} });
rpc.registerRoute('TestApp', 'testRoute', async (params) => {
    return { success: true };
});

console.log('\n=== Checking SubAppManager ===');
const subAppManager = rpc.getSubAppManager();
console.log('SubApp routes Map:', subAppManager.routes);
console.log('Has TestApp.testRoute:', subAppManager.routes.has('TestApp.testRoute'));

console.log('\n=== Creating RPC Server ===');
const express = require('express');
const app = express();
const rpcServer = rpc.createHttpServer(app, { auth: { enabled: false } });

rpcServer.route('coreRoute', async (params) => {
    return { core: true };
});

console.log('\n=== Checking HttpRpcServer ===');
console.log('HttpRpcServer routes Map:', rpcServer.routes);
console.log('Has coreRoute:', rpcServer.routes.has('coreRoute'));

rpcServer.start();
console.log('\n=== Server started ===');
