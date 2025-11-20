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

const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc');

class RpcIntegrationController {
    constructor(mainController, config) {
        this.mainController = mainController;
        this.config = config;
        this.rpcServer = null;
        this.expressServer = null;
        this.httpServer = null;
        this.isRunning = false;
    }

    async start() {
        try {
            logger.info('[RPC Integration] Starting RPC server...');

            const rpcPort = this.config.rpcConfig?.port || 8090;
            const rpcHost = this.config.rpcConfig?.host || '0.0.0.0';

            rpc.registerSubApp('AITranslator', {
                config: {
                    AI_TRANSLATOR_TIMEOUT: 60000,
                    MAX_TRANSLATION_SIZE: 1048576
                },
                staticPaths: {}
            });

            rpc.registerRoute('AITranslator', 'translate', async (params, context) => {
                logger.info(`[RPC Integration] Translation request received: ${context.requestId}`);
                try {
                    const { text, sourceLanguage, targetLanguage, options } = params;

                    if (!text) {
                        throw new Error('Text parameter is required');
                    }

                    const result = {
                        originalText: text,
                        translatedText: `[Translation pending for: ${text.substring(0, 50)}...]`,
                        sourceLanguage: sourceLanguage || 'auto',
                        targetLanguage: targetLanguage || this.mainController.config.translationConfig.targetLanguage,
                        timestamp: new Date().toISOString(),
                        requestId: context.requestId
                    };

                    return result;
                } catch (error) {
                    logger.error(`[RPC Integration] Translation error: ${error.message}`);
                    throw error;
                }
            });

            rpc.registerRoute('AITranslator', 'getStatus', async (params, context) => {
                logger.info(`[RPC Integration] Status request received: ${context.requestId}`);
                try {
                    const status = await this.mainController.getStatus();
                    return {
                        ...status,
                        rpc: {
                            enabled: true,
                            port: rpcPort,
                            uptime: process.uptime()
                        },
                        requestId: context.requestId
                    };
                } catch (error) {
                    logger.error(`[RPC Integration] Status error: ${error.message}`);
                    throw error;
                }
            });

            rpc.registerRoute('AITranslator', 'restart', async (params, context) => {
                logger.info(`[RPC Integration] Restart request received: ${context.requestId}`);
                try {
                    await this.mainController.restart();
                    return {
                        success: true,
                        message: 'AI Translator restarted successfully',
                        requestId: context.requestId
                    };
                } catch (error) {
                    logger.error(`[RPC Integration] Restart error: ${error.message}`);
                    throw error;
                }
            });

            this.expressServer = rpc.createExpressServer({
                HTTP_PORT: rpcPort,
                HTTP_HOST: rpcHost,
                auth: {
                    enabled: false
                }
            });

            this.httpServer = rpc.createHttpServer(this.expressServer.getApp());

            this.httpServer.route('health', async (params) => {
                return {
                    status: 'healthy',
                    service: 'ai-translator-rpc',
                    timestamp: new Date().toISOString()
                };
            });

            this.httpServer.start();
            await this.expressServer.start();

            this.isRunning = true;

            logger.success(`[RPC Integration] RPC server started at http://${rpcHost}:${rpcPort}`);
            logger.success(`[RPC Integration] RPC endpoints:`);
            logger.info(`  - AITranslator.translate`);
            logger.info(`  - AITranslator.getStatus`);
            logger.info(`  - AITranslator.restart`);
            logger.info(`  - health`);

        } catch (error) {
            logger.error(`[RPC Integration] Failed to start RPC server: ${error.message}`);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('[RPC Integration] RPC server is not running');
            return;
        }

        try {
            logger.info('[RPC Integration] Stopping RPC server...');

            if (this.expressServer) {
                this.expressServer.stop();
            }

            if (this.httpServer) {
                await this.httpServer.stop();
            }

            this.isRunning = false;
            logger.info('[RPC Integration] RPC server stopped');

        } catch (error) {
            logger.error(`[RPC Integration] Error stopping RPC server: ${error.message}`);
            throw error;
        }
    }

    async getStatus() {
        return {
            running: this.isRunning,
            port: this.config.rpcConfig?.port || 8090,
            subAppsRegistered: rpc.getSubAppStats().subAppsCount,
            routesRegistered: rpc.getSubAppStats().routesCount
        };
    }
}

module.exports = RpcIntegrationController;
