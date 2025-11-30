const rpc = require('./index');

console.log('===========================================');
console.log('RPC Static Path Resolver Example');
console.log('===========================================\n');

const envInfo = rpc.getEnvironmentInfo();
console.log('Environment Detection:');
console.log('  Platform:', envInfo.platform);
console.log('  Windows:', envInfo.isWindows);
console.log('  Linux:', envInfo.isLinux);
console.log('  WSL:', envInfo.isWSL);
console.log('  Desktop:', envInfo.hasDesktop);
console.log('  Production:', envInfo.isProduction);
console.log('  Base Directory:', envInfo.baseDir);
console.log('  Project Root:', envInfo.projectRoot);
console.log('');

console.log('Auto-detected Static Paths:');
const defaultPaths = rpc.getDefaultStaticPaths();
for (const [urlPath, directories] of Object.entries(defaultPaths)) {
    console.log(`  ${urlPath}:`);
    if (Array.isArray(directories)) {
        directories.forEach(dir => {
            console.log(`    - ${dir}`);
        });
    } else {
        console.log(`    - ${directories}`);
    }
}
console.log('');

console.log('Custom Path Resolution:');
console.log('  wwwroot:', rpc.resolveStaticPath('wwwroot'));
console.log('  static:', rpc.resolveStaticPath('static'));
console.log('  uploads:', rpc.resolveStaticPath('uploads'));
console.log('  assets:', rpc.resolveStaticPath('assets'));
console.log('  public:', rpc.resolveStaticPath('public'));
console.log('');

async function startServerWithAutoDetectedPaths() {
    console.log('===========================================');
    console.log('Starting Server with Auto-detected Paths');
    console.log('===========================================\n');

    const server = rpc.createExpressServer({
        HTTP_PORT: 8080
    });

    const rpcServer = rpc.createHttpServer(server.getApp());

    rpcServer.route('getEnvironment', async () => {
        return rpc.getEnvironmentInfo();
    });

    rpcServer.route('getStaticPaths', async () => {
        return rpc.getDefaultStaticPaths();
    });

    rpcServer.start();
    await server.start();

    console.log('Server started successfully!');
    console.log('Try these endpoints:');
    console.log('  http://localhost:8080/rpc/health');
    console.log('  http://localhost:8080/rpc/client.js');
    console.log('');
    console.log('RPC calls:');
    console.log('  getEnvironment - Returns environment detection info');
    console.log('  getStaticPaths - Returns auto-detected static paths');
}

async function startServerWithCustomPaths() {
    console.log('===========================================');
    console.log('Starting Server with Custom Paths');
    console.log('===========================================\n');

    const server = rpc.createExpressServer({
        HTTP_PORT: 8081,
        STATIC_PATHS: {
            '/static': [
                rpc.resolveStaticPath('static'),
                rpc.resolveStaticPath('wwwroot')
            ],
            '/uploads': rpc.resolveStaticPath('uploads'),
            '/assets': rpc.resolveStaticPath('assets')
        }
    });

    const rpcServer = rpc.createHttpServer(server.getApp());

    rpcServer.route('resolveCustomPath', async (params) => {
        const { pathKey, subPath } = params;
        return {
            pathKey,
            subPath,
            resolved: rpc.resolveStaticPath(pathKey, subPath)
        };
    });

    rpcServer.start();
    await server.start();

    console.log('Server started with custom paths!');
}

if (require.main === module) {
    const mode = process.argv[2] || 'info';

    if (mode === 'info') {
        console.log('===========================================');
        console.log('Run with arguments:');
        console.log('  node STATIC_PATH_EXAMPLE.js info   - Show environment info (default)');
        console.log('  node STATIC_PATH_EXAMPLE.js auto   - Start server with auto-detected paths');
        console.log('  node STATIC_PATH_EXAMPLE.js custom - Start server with custom paths');
        console.log('===========================================');
    } else if (mode === 'auto') {
        startServerWithAutoDetectedPaths().catch(console.error);
    } else if (mode === 'custom') {
        startServerWithCustomPaths().catch(console.error);
    }
}

module.exports = {
    startServerWithAutoDetectedPaths,
    startServerWithCustomPaths
};
