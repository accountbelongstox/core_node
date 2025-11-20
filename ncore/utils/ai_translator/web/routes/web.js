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
const path = require('path');
const { freader } = require('#@btools');

class WebRoutes {
    constructor(translationManager, config) {
        this.translationManager = translationManager;
        this.config = config;
        this.router = require('express').Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // Main dashboard
        this.router.get('/', async (req, res) => {
            try {
                const templatePath = path.join(__dirname, '../templates/dashboard.html');
                const template = freader.readText(templatePath);
                
                const status = await this.translationManager.getStatus();
                
                const renderedTemplate = this.renderTemplate(template, {
                    title: 'AI Translator Dashboard',
                    status: status,
                    config: this.config,
                    timestamp: new Date().toISOString()
                });
                
                res.setHeader('Content-Type', 'text/html');
                res.send(renderedTemplate);
                
            } catch (error) {
                logger.error(`[Web Routes] Dashboard error: ${error.message}`);
                res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
            }
        });

        // Status page
        this.router.get('/status', async (req, res) => {
            try {
                const templatePath = path.join(__dirname, '../templates/status.html');
                const template = freader.readText(templatePath);
                
                const status = await this.translationManager.getStatus();
                
                const renderedTemplate = this.renderTemplate(template, {
                    title: 'Translation Service Status',
                    status: status,
                    config: this.config,
                    timestamp: new Date().toISOString()
                });
                
                res.setHeader('Content-Type', 'text/html');
                res.send(renderedTemplate);
                
            } catch (error) {
                logger.error(`[Web Routes] Status page error: ${error.message}`);
                res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
            }
        });

        // Configuration page
        this.router.get('/config', async (req, res) => {
            try {
                const configHtml = this.generateConfigPage();
                res.setHeader('Content-Type', 'text/html');
                res.send(configHtml);
                
            } catch (error) {
                logger.error(`[Web Routes] Config page error: ${error.message}`);
                res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
            }
        });

        // API documentation page
        this.router.get('/docs', (req, res) => {
            try {
                const docsHtml = this.generateDocsPage();
                res.setHeader('Content-Type', 'text/html');
                res.send(docsHtml);
                
            } catch (error) {
                logger.error(`[Web Routes] Docs page error: ${error.message}`);
                res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
            }
        });

        // Real-time status endpoint for AJAX
        this.router.get('/api/live-status', async (req, res) => {
            try {
                const status = await this.translationManager.getStatus();
                res.json(status);
            } catch (error) {
                logger.error(`[Web Routes] Live status error: ${error.message}`);
                res.status(500).json({ error: error.message });
            }
        });
    }

    renderTemplate(template, data) {
        let rendered = template;
        
        // Simple template replacement
        rendered = rendered.replace(/\{\{title\}\}/g, data.title || 'AI Translator');
        rendered = rendered.replace(/\{\{timestamp\}\}/g, data.timestamp || new Date().toISOString());
        
        // Status information
        if (data.status) {
            rendered = rendered.replace(/\{\{isRunning\}\}/g, data.status.isRunning ? 'Running' : 'Stopped');
            rendered = rendered.replace(/\{\{uptime\}\}/g, this.formatUptime(data.status.uptime || 0));
            rendered = rendered.replace(/\{\{startTime\}\}/g, data.status.startTime || 'N/A');
        }
        
        // Configuration information
        if (data.config) {
            rendered = rendered.replace(/\{\{watchPath\}\}/g, data.config.watchConfig.watchPath || 'N/A');
            rendered = rendered.replace(/\{\{watchExtensions\}\}/g, 
                (data.config.watchConfig.watchExtensions || []).join(', '));
            rendered = rendered.replace(/\{\{targetLanguage\}\}/g, 
                data.config.translationConfig.targetLanguage || 'auto');
            rendered = rendered.replace(/\{\{openRouterModel\}\}/g, 
                data.config.openRouterConfig.defaultModel || 'N/A');
        }
        
        return rendered;
    }

    generateConfigPage() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Translator - Configuration</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .config-section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
        .config-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #333; }
        .config-item { margin-bottom: 8px; }
        .config-label { font-weight: bold; color: #555; }
        .config-value { color: #333; }
        .nav { margin-bottom: 20px; }
        .nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
        .nav a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="/">Dashboard</a>
            <a href="/status">Status</a>
            <a href="/config">Configuration</a>
            <a href="/docs">API Docs</a>
        </div>
        
        <h1>AI Translator Configuration</h1>
        
        <div class="config-section">
            <div class="config-title">Watch Configuration</div>
            <div class="config-item">
                <span class="config-label">Watch Path:</span>
                <span class="config-value">${this.config.watchConfig.watchPath}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Extensions:</span>
                <span class="config-value">${this.config.watchConfig.watchExtensions.join(', ')}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Watch Depth:</span>
                <span class="config-value">${this.config.watchConfig.watchDepth}</span>
            </div>
        </div>
        
        <div class="config-section">
            <div class="config-title">Translation Configuration</div>
            <div class="config-item">
                <span class="config-label">Target Language:</span>
                <span class="config-value">${this.config.translationConfig.targetLanguage}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Translation Style:</span>
                <span class="config-value">${this.config.translationConfig.translationStyle}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Preserve Formatting:</span>
                <span class="config-value">${this.config.translationConfig.preserveFormatting}</span>
            </div>
        </div>
        
        <div class="config-section">
            <div class="config-title">OpenRouter Configuration</div>
            <div class="config-item">
                <span class="config-label">Model:</span>
                <span class="config-value">${this.config.openRouterConfig.defaultModel}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Timeout:</span>
                <span class="config-value">${this.config.openRouterConfig.timeout}ms</span>
            </div>
            <div class="config-item">
                <span class="config-label">Max Retries:</span>
                <span class="config-value">${this.config.openRouterConfig.maxRetries}</span>
            </div>
        </div>
        
        <div class="config-section">
            <div class="config-title">Web Server Configuration</div>
            <div class="config-item">
                <span class="config-label">Port:</span>
                <span class="config-value">${this.config.webConfig.port}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Host:</span>
                <span class="config-value">${this.config.webConfig.host}</span>
            </div>
            <div class="config-item">
                <span class="config-label">CORS Enabled:</span>
                <span class="config-value">${this.config.webConfig.enableCors}</span>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    generateDocsPage() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Translator - API Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .endpoint { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
        .method { font-weight: bold; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px; }
        .get { background-color: #28a745; }
        .post { background-color: #007bff; }
        .endpoint-url { font-family: monospace; background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px; }
        .nav { margin-bottom: 20px; }
        .nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
        .nav a:hover { text-decoration: underline; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="/">Dashboard</a>
            <a href="/status">Status</a>
            <a href="/config">Configuration</a>
            <a href="/docs">API Docs</a>
        </div>
        
        <h1>AI Translator API Documentation</h1>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="endpoint-url">/api/status</span></h3>
            <p>Get translation service status and statistics.</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="endpoint-url">/api/start</span></h3>
            <p>Start the translation monitoring service.</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="endpoint-url">/api/stop</span></h3>
            <p>Stop the translation monitoring service.</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="endpoint-url">/api/restart</span></h3>
            <p>Restart the translation monitoring service.</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="endpoint-url">/api/translate</span></h3>
            <p>Translate a single text.</p>
            <pre>
{
  "text": "Hello world",
  "sourceLanguage": "en",
  "targetLanguage": "zh"
}
            </pre>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="endpoint-url">/api/translate/batch</span></h3>
            <p>Translate multiple texts in batch.</p>
            <pre>
{
  "texts": ["Hello", "World"],
  "sourceLanguage": "en",
  "targetLanguage": "zh"
}
            </pre>
        </div>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="endpoint-url">/api/statistics</span></h3>
            <p>Get translation statistics and metrics.</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="endpoint-url">/api/history</span></h3>
            <p>Get translation history (optional limit parameter).</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="endpoint-url">/health</span></h3>
            <p>Health check endpoint.</p>
        </div>
    </div>
</body>
</html>`;
    }

    formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = WebRoutes;