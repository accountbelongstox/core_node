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

const expressUtils = require('#@ncore/foundation/express_utils');
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');
const { HttpRpcServer } = require('#@ncore/utils/http_rpc');
const logger = require('#@logger');

async function startUnifiedRpcServer() {
    logger.info('=== Starting Unified RPC Server Example ===');

    const config = {
        HTTP_PORT: 3000,
        STATIC_DIRECTORY: './public',
        STATIC_PATH: '/static'
    };

    await expressUtils.startExpressServer(config);
    logger.info('Express server started');

    const wss = expressUtils.getWebSocketServer();
    const app = expressUtils.getConfig().app;

    const wsRpc = new WsRpcServer(wss);
    await wsRpc.start();
    logger.info('WebSocket RPC attached');

    const httpRpc = new HttpRpcServer(app, {
        basePath: '/rpc',
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60000
        }
    });
    httpRpc.start();
    logger.info('HTTP RPC started');

    const translateHandler = async (params, clientId) => {
        const { text, targetLang } = params;
        logger.info(`Translation request from ${clientId}: ${text} -> ${targetLang}`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const translations = {
            'zh': '你好世界',
            'es': 'Hola mundo',
            'fr': 'Bonjour le monde'
        };

        return {
            original: text,
            translated: translations[targetLang] || text,
            targetLang: targetLang,
            timestamp: Date.now()
        };
    };

    const statusHandler = async (params, clientId) => {
        return {
            status: 'ok',
            clientId: clientId,
            timestamp: Date.now(),
            wsClients: wsRpc.getClients().length,
            routes: {
                ws: wsRpc.routes.size,
                http: httpRpc.routes.size
            }
        };
    };

    wsRpc.route('translateText', translateHandler);
    wsRpc.route('getStatus', statusHandler);

    httpRpc.route('translateText', translateHandler);
    httpRpc.route('getStatus', statusHandler);

    logger.success('Both WebSocket and HTTP RPC registered with same handlers');
    logger.info('WebSocket RPC: ws://localhost:3000');
    logger.info('HTTP RPC: http://localhost:3000/rpc');
    logger.info('Health check: http://localhost:3000/rpc/health');
}

startUnifiedRpcServer().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
