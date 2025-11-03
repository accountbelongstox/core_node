// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const { getInstance: getSingletonBrowser } = require('#@singleton_browser');
const { getInstance: getFrontendLauncher } = require('#@frontend_launcher');
const { getInstance: getItTools } = require('#@ittools');
const CoreNodeInitPlugin = require('./controller/CoreNodeInitPlugin');
const config = require('./config');
const ElectronMCPController = require('./controller/ElectronMCPController');

const singletonBrowser = getSingletonBrowser();
const frontendLauncher = getFrontendLauncher({
    appNamespace: 'ittools',
    port: 7096,
    timeout: 120000
});
const itTools = getItTools();
let downloadPlugin = null;
let electronController = null;
let itToolsController = null;

class CoreNodeInitMCPServer {
    constructor() {
        this.name = 'core_node_init_web_automation';
        this.version = '2.0.0';
        this.capabilities = {
            tools: {
                'download_vscode': {
                    description: 'Download Visual Studio Code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            options: {
                                type: 'object',
                                description: 'Download options'
                            }
                        }
                    }
                },
                'download_cursor': {
                    description: 'Download Cursor IDE',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            options: {
                                type: 'object',
                                description: 'Download options'
                            }
                        }
                    }
                },
                'open_web_page': {
                    description: 'Open a web page and return information',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to open'
                            },
                            wait_for: {
                                type: 'string',
                                description: 'CSS selector to wait for'
                            },
                            timeout: {
                                type: 'number',
                                description: 'Timeout in milliseconds'
                            }
                        },
                        required: ['url']
                    }
                },
                'take_screenshot': {
                    description: 'Take a screenshot of a web page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to screenshot'
                            },
                            full_page: {
                                type: 'boolean',
                                description: 'Capture full page'
                            },
                            quality: {
                                type: 'number',
                                description: 'Image quality (1-100)'
                            },
                            format: {
                                type: 'string',
                                enum: ['png', 'jpeg'],
                                description: 'Image format'
                            }
                        },
                        required: ['url']
                    }
                },
                'get_page_content': {
                    description: 'Get HTML content of a web page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to fetch'
                            },
                            wait_until: {
                                type: 'string',
                                enum: ['load', 'networkidle0', 'networkidle2'],
                                description: 'When to consider navigation complete'
                            },
                            timeout: {
                                type: 'number',
                                description: 'Timeout in milliseconds'
                            }
                        },
                        required: ['url']
                    }
                },
                'click_element': {
                    description: 'Click an element on a web page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to open'
                            },
                            selector: {
                                type: 'string',
                                description: 'CSS selector of element to click'
                            },
                            wait_for_navigation: {
                                type: 'boolean',
                                description: 'Wait for navigation after click'
                            }
                        },
                        required: ['url', 'selector']
                    }
                },
                'evaluate_javascript': {
                    description: 'Execute JavaScript on a web page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to open'
                            },
                            script: {
                                type: 'string',
                                description: 'JavaScript code to execute'
                            }
                        },
                        required: ['url', 'script']
                    }
                },
                'browser_status': {
                    description: 'Get browser status',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                'browser_detailed_status': {
                    description: 'Get detailed browser information including process and session details',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            include_pages: {
                                type: 'boolean',
                                description: 'Include active pages information',
                                default: false
                            }
                        }
                    }
                },
                'start_frontend': {
                    description: 'Start the frontend development server',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_namespace: {
                                type: 'string',
                                description: 'App namespace to start (default: dev)',
                                default: 'dev'
                            },
                            port: {
                                type: 'number',
                                description: 'Port number (default: 3000)',
                                default: 3000
                            },
                            wait_for_ready: {
                                type: 'boolean',
                                description: 'Wait for frontend to be ready',
                                default: true
                            }
                        }
                    }
                },
                'stop_frontend': {
                    description: 'Stop the frontend development server',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                'get_frontend_status': {
                    description: 'Get frontend development server status',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                'ittools_get_all_tools': {
                    description: 'Get all available IT tools',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                'ittools_get_tools_by_category': {
                    description: 'Get IT tools by category (crypto, converter, web, text, math, network)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            category: {
                                type: 'string',
                                enum: ['crypto', 'converter', 'web', 'text', 'math', 'network'],
                                description: 'Tool category'
                            }
                        },
                        required: ['category']
                    }
                },
                'ittools_search_tools': {
                    description: 'Search IT tools by query',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query'
                            }
                        },
                        required: ['query']
                    }
                },
                'ittools_execute': {
                    description: 'Execute an IT tool',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tool_id: {
                                type: 'string',
                                description: 'Tool ID (e.g., hash_text, base64_encode)'
                            },
                            params: {
                                type: 'object',
                                description: 'Tool parameters'
                            }
                        },
                        required: ['tool_id', 'params']
                    }
                },
                'ittools_status': {
                    description: 'Get IT tools system status',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                }
            }
        };
    }

    async initialize() {
        try {
            logger.info('Initializing Core Node Init MCP Server...');

            await singletonBrowser.initialize();

            downloadPlugin = new CoreNodeInitPlugin();
            const session = await singletonBrowser.getSession();
            await downloadPlugin.initialize(session);

            await itTools.initialize();
            logger.info('IT Tools initialized successfully');

            // Initialize ITTools Integration Controller
            try {
                itToolsController = new ITToolsIntegrationController();
                await itToolsController.initialize({
                    httpPort: 8080,
                    wsPort: 8081,
                    host: 'localhost',
                    enableCors: true,
                    enableWebSocket: true
                });

                // Start HTTP and WebSocket servers
                await itToolsController.startServers();
                logger.info('ITTools HTTP API server started on http://localhost:8080');
                logger.info('ITTools WebSocket RPC server started on ws://localhost:8081');
            } catch (itToolsError) {
                logger.warn(`ITTools integration warning: ${itToolsError.message}`);
                logger.info('MCP server continuing without ITTools HTTP API');
            }

            // Initialize Electron integration
            try {
                electronController = new ElectronMCPController();
                await electronController.initialize();
                logger.info('Electron integration initialized successfully');
                logger.info('System tray and desktop features are available');
            } catch (electronError) {
                logger.warn(`Electron initialization warning: ${electronError.message}`);
                logger.info('MCP server continuing without Electron desktop features');
            }

            // Auto-start frontend development server
            logger.info('Starting frontend development server...');
            try {
                const frontendStarted = await frontendLauncher.launch('ittools', {
                    port: 7096,
                    waitForReady: false  // Don't block initialization
                });

                if (frontendStarted) {
                    logger.info('Frontend development server started successfully');
                    logger.info('Frontend available at: http://localhost:7096/ittools');
                } else {
                    logger.warn('Frontend development server failed to start - may already be running');
                }
            } catch (frontendError) {
                logger.warn(`Frontend startup warning: ${frontendError.message}`);
                logger.info('MCP server continuing without frontend - use start_frontend tool to start manually');
            }

            logger.info('Core Node Init MCP Server initialized successfully');
        } catch (error) {
            logger.error(`Failed to initialize MCP server: ${error.message}`);
            throw error;
        }
    }

    async callTool(toolName, args) {
        try {
            switch (toolName) {
                case 'download_vscode':
                    return await this._downloadVSCode(args.options || {});

                case 'download_cursor':
                    return await this._downloadCursor(args.options || {});

                case 'open_web_page':
                    return await this._openWebPage(args.url, args);

                case 'take_screenshot':
                    return await this._takeScreenshot(args);

                case 'get_page_content':
                    return await this._getPageContent(args);

                case 'click_element':
                    return await this._clickElement(args);

                case 'evaluate_javascript':
                    return await this._evaluateJavaScript(args);

                case 'browser_status':
                    return await this._getBrowserStatus();

                case 'browser_detailed_status':
                    return await this._getDetailedBrowserStatus(args);

                case 'start_frontend':
                    return await this._startFrontend(args);

                case 'stop_frontend':
                    return await this._stopFrontend();

                case 'get_frontend_status':
                    return await this._getFrontendStatus(args);

                case 'ittools_get_all_tools':
                    return await this._itToolsGetAllTools();

                case 'ittools_get_tools_by_category':
                    return await this._itToolsGetToolsByCategory(args);

                case 'ittools_search_tools':
                    return await this._itToolsSearchTools(args);

                case 'ittools_execute':
                    return await this._itToolsExecute(args);

                case 'ittools_status':
                    return await this._itToolsGetStatus();

                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            logger.error(`Error in tool ${toolName}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _downloadVSCode(options = {}) {
        try {
            logger.info('Starting VSCode download...');
            const result = await downloadPlugin.downloadApplication('vscode', options);

            return {
                success: result.success,
                download_path: result.downloadPath,
                message: result.success ? 'VSCode download completed successfully' : 'VSCode download failed',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'VSCode download failed'
            };
        }
    }

    async _downloadCursor(options = {}) {
        try {
            logger.info('Starting Cursor IDE download...');
            const result = await downloadPlugin.downloadApplication('cursor', options);

            return {
                success: result.success,
                download_path: result.downloadPath,
                message: result.success ? 'Cursor IDE download completed successfully' : 'Cursor IDE download failed',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Cursor IDE download failed'
            };
        }
    }

    async _openWebPage(url, options = {}) {
        try {
            const session = await singletonBrowser.getSession();
            const page = await session.createPage();

            await page.goto(url, {
                waitUntil: options.wait_for || 'networkidle2',
                timeout: options.timeout || 30000
            });

            const title = await page.title();
            const content = await page.content();

            await page.close();

            return {
                success: true,
                url: url,
                title: title,
                content_length: content.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: url
            };
        }
    }

    async _takeScreenshot(args) {
        try {
            const screenshot = await singletonBrowser.takeScreenshot(args.url, {
                format: args.format || 'png',
                quality: args.quality || 80,
                fullPage: args.fullPage || false
            });

            // Convert to base64 for JSON transport
            const base64 = screenshot.toString('base64');

            return {
                success: true,
                screenshot: base64,
                format: args.format || 'png',
                url: args.url,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: args.url
            };
        }
    }

    async _getPageContent(args) {
        try {
            const content = await singletonBrowser.getPageContent(args.url, {
                waitUntil: args.wait_until,
                timeout: args.timeout
            });

            return {
                success: true,
                url: content.url,
                title: content.title,
                html: content.html,
                timestamp: content.timestamp
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: args.url
            };
        }
    }

    async _clickElement(args) {
        try {
            const result = await singletonBrowser.clickElement(args.url, args.selector, {
                waitForNavigation: args.wait_for_navigation,
                waitTimeout: 10000,
                navTimeout: 10000
            });

            return {
                success: true,
                url: result.url,
                title: result.title,
                selector: args.selector,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: args.url,
                selector: args.selector
            };
        }
    }

    async _evaluateJavaScript(args) {
        try {
            const result = await singletonBrowser.evaluateJavaScript(args.url, args.script);

            return {
                success: true,
                result: result,
                url: args.url,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: args.url
            };
        }
    }

    async _getBrowserStatus() {
        const status = await singletonBrowser.getStatus();

        return {
            success: true,
            status: status,
            timestamp: new Date().toISOString()
        };
    }

    async _getDetailedBrowserStatus(args) {
        const status = await singletonBrowser.getStatus();
        const includePages = args.include_pages || false;

        const detailedStatus = {
            success: true,
            browser: {
                initialized: status.isInitialized,
                responsive: status.browser?.responsive || false,
                process_id: status.browser?.processId || null,
                user_agent: status.browser?.userAgent || null,
                version: status.browser?.version || null,
                headless: true // Browser runs in background/headless mode
            },
            session: {
                id: status.sessionId,
                pages_count: status.session?.pagesCount || 0,
                active_pages: status.session?.activePages || []
            },
            system: {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory_usage: process.memoryUsage(),
                platform: process.platform,
                node_version: process.version
            }
        };

        // Add detailed pages information if requested
        if (includePages && status.session?.activePages) {
            detailedStatus.pages = [];
            try {
                const session = await singletonBrowser.getSession();
                for (const pageId of status.session.activePages) {
                    const page = session.pages.get(pageId);
                    if (page) {
                        detailedStatus.pages.push({
                            id: pageId,
                            url: page.url(),
                            title: await page.title(),
                            is_loading: page.isLoading(),
                            viewport: page.viewport()
                        });
                    }
                }
            } catch (error) {
                detailedStatus.pages_error = error.message;
            }
        }

        return detailedStatus;
    }

    async _startFrontend(args) {
        try {
            const appNamespace = args.app_namespace || 'ittools';
            const port = args.port || 7096;
            const waitForReady = args.wait_for_ready !== false;

            logger.info(`Starting frontend development server: ${appNamespace} on port ${port}`);

            // Check if frontend is already running
            const portAvailable = await frontendLauncher.checkPortAvailable(port);
            if (!portAvailable) {
                return {
                    success: false,
                    error: `Port ${port} is already in use. Frontend may already be running.`,
                    message: 'Frontend startup failed - port in use'
                };
            }

            const frontendStarted = await frontendLauncher.launch(appNamespace, {
                port: port,
                timeout: 120000,
                waitForReady: waitForReady
            });

            if (frontendStarted) {
                return {
                    success: true,
                    url: `http://localhost:${port}/${appNamespace}`,
                    app_namespace: appNamespace,
                    port: port,
                    message: `Frontend development server started successfully`,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to start frontend development server',
                    message: 'Frontend startup failed'
                };
            }
        } catch (error) {
            logger.error(`Error starting frontend: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: 'Frontend startup failed'
            };
        }
    }

    async _stopFrontend() {
        try {
            const stopped = await frontendLauncher.stop();

            return {
                success: stopped,
                message: stopped ? 'Frontend development server stopped successfully' : 'Frontend development server was not running',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error stopping frontend: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: 'Failed to stop frontend development server'
            };
        }
    }

    async _getFrontendStatus() {
        try {
            const status = await frontendLauncher.getStatus();
            const portAvailable = await frontendLauncher.checkPortAvailable(status.port);

            return {
                success: true,
                status: {
                    isRunning: status.isRunning && !portAvailable,
                    port: status.port,
                    appNamespace: status.appNamespace,
                    url: status.url,
                    hasChildProcess: status.hasChildProcess,
                    hasTempScript: status.hasTempScript
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error getting frontend status: ${error.message}`);
            return {
                success: false,
                error: error.message,
                status: null
            };
        }
    }

    async _itToolsGetAllTools() {
        try {
            const tools = itTools.getAllTools();
            return {
                success: true,
                data: {
                    tools: tools,
                    total: tools.length
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error getting all IT tools: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _itToolsGetToolsByCategory(args) {
        try {
            const category = args.category;
            const tools = itTools.getToolsByCategory(category);

            return {
                success: true,
                data: {
                    category: category,
                    tools: tools,
                    total: tools.length
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error getting IT tools by category: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _itToolsSearchTools(args) {
        try {
            const query = args.query;
            const tools = itTools.searchTools(query);

            return {
                success: true,
                data: {
                    query: query,
                    tools: tools,
                    total: tools.length
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error searching IT tools: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _itToolsExecute(args) {
        try {
            const toolId = args.tool_id;
            const params = args.params || {};

            const result = await itTools.executeTool(toolId, params);

            return {
                success: result.success,
                data: result.data,
                error: result.error,
                executionTime: result.executionTime,
                timestamp: result.timestamp
            };
        } catch (error) {
            logger.error(`Error executing IT tool: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _itToolsGetStatus() {
        try {
            const status = itTools.getStatus();

            return {
                success: true,
                data: status,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error getting IT tools status: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cleanup() {
        try {
            if (downloadPlugin) {
                await downloadPlugin.cleanup();
            }
            await singletonBrowser.cleanup();

            // Clean up Electron controller
            if (electronController) {
                await electronController.shutdown();
            }

            // Stop frontend if running
            await frontendLauncher.stop();

            logger.info('Core Node Init MCP Server cleaned up successfully');
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
        }
    }
}

// Create and export server instance
const mcpServer = new CoreNodeInitMCPServer();

async function start() {
    try {
        await mcpServer.initialize();
        logger.info('Core Node Init MCP Server started successfully');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await mcpServer.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await mcpServer.cleanup();
            process.exit(0);
        });

        // Export the server for MCP framework
        return mcpServer;
    } catch (error) {
        logger.error(`Failed to start Core Node Init MCP Server: ${error.message}`);
        process.exit(1);
    }
}

module.exports = {
    start,
    CoreNodeInitMCPServer,
    mcpServer
};