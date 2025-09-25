#!/usr/bin/env node
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

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Configuration
const PORT = process.env.MCP_HTTP_PORT || 8080;
const MCP_DIR = process.env.MCP_DIR || path.join(process.env.HOME, 'compile', 'mcp_server');
const HTML_FILE = path.join(MCP_DIR, 'mcp_services_dashboard.html');

// Editor configuration paths
const EDITOR_CONFIGS = {
    cursor: {
        windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
        macos: path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
        linux: path.join(os.homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
    },
    claude: {
        windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
        macos: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        linux: path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json')
    },
    vscode: {
        windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json'),
        macos: path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
        linux: path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json')
    }
};

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Get MIME type
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'text/plain';
}

// Scan MCP service specifications
function scanMCPServices() {
    const services = [];

    if (!fs.existsSync(MCP_DIR)) {
        return services;
    }

    const entries = fs.readdirSync(MCP_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const serviceDir = path.join(MCP_DIR, entry.name);
            const specFile = path.join(serviceDir, 'mcp_service_spec.json');

            if (fs.existsSync(specFile)) {
                try {
                    const specContent = fs.readFileSync(specFile, 'utf8');
                    const spec = JSON.parse(specContent);

                    // Skip dashboard server (port 38000)
                    if (spec.port === '38000' || spec.name.includes('dashboard') || spec.name.includes('server')) {
                        continue;
                    }

                    services.push(spec);
                } catch (error) {
                    console.error(`Error parsing ${specFile}:`, error.message);
                }
            }
        }
    }

    return services;
}

// Generate MCP client configuration JSON
function generateMCPClientConfig(services) {
    const mcpServers = {};

    for (const service of services) {
        if (service.mcp_client_config) {
            const config = service.mcp_client_config;
            const serverName = config.server_name || service.name;

            mcpServers[serverName] = {
                command: config.command,
                args: config.args || [],
                timeout: config.timeout || 300,
                disabled: config.disabled || false
            };

            // Add environment variables if present
            if (service.environment_variables && service.environment_variables.length > 0) {
                const env = {};
                for (const envVar of service.environment_variables) {
                    env[envVar.name] = envVar.default || '';
                }
                mcpServers[serverName].env = env;
            }

            // Add autoApprove if present
            if (config.autoApprove && config.autoApprove.length > 0) {
                mcpServers[serverName].autoApprove = config.autoApprove;
            }

            // Add cwd if present
            if (config.cwd) {
                mcpServers[serverName].cwd = config.cwd;
            }
        }
    }

    return { mcpServers };
}

// Get platform-specific editor config path
function getEditorConfigPath(editor) {
    const platform = os.platform();
    const platformKey = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';

    if (EDITOR_CONFIGS[editor] && EDITOR_CONFIGS[editor][platformKey]) {
        return EDITOR_CONFIGS[editor][platformKey];
    }

    return null;
}

// Update editor configuration
function updateEditorConfig(editor, mcpConfig) {
    const configPath = getEditorConfigPath(editor);

    if (!configPath) {
        return { success: false, message: `Unsupported editor: ${editor}` };
    }

    try {
        // Ensure directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        let existingConfig = {};
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            existingConfig = JSON.parse(content);
        }

        // Merge MCP configuration
        if (editor === 'claude') {
            existingConfig.mcpServers = mcpConfig.mcpServers;
        } else if (editor === 'cursor') {
            existingConfig.mcpServers = mcpConfig.mcpServers;
        } else if (editor === 'vscode') {
            existingConfig['mcp.servers'] = mcpConfig.mcpServers;
        }

        // Write updated configuration
        fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf8');

        return { success: true, message: `Updated ${editor} configuration at ${configPath}` };
    } catch (error) {
        return { success: false, message: `Error updating ${editor} config: ${error.message}` };
    }
}

// Read HTML file
function readHTMLFile() {
    try {
        // Always use enhanced HTML for better functionality
        return generateEnhancedHTML();
    } catch (error) {
        console.error('Error generating enhanced HTML:', error);
        // Fallback to static file if it exists
        try {
            if (fs.existsSync(HTML_FILE)) {
                return fs.readFileSync(HTML_FILE, 'utf8');
            } else {
                return generateDefaultHTML();
            }
        } catch (fallbackError) {
            return generateErrorHTML(error.message);
        }
    }
}

// Generate AI-friendly simplified HTML
function generateEnhancedHTML() {
    const services = scanMCPServices();

    // Separate web and stdio services
    const webServices = services.filter(s => s.port !== 'auto' && s.port !== '38000');
    const stdioServices = services.filter(s => s.port === 'auto');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MCP Services - AI Guide</title>
</head>
<body>
    <h1>🤖 MCP Services - AI Usage Guide</h1>

    <h2>⚠️ IMPORTANT FOR AI AGENTS</h2>
    <p><strong>All MCP services are ALREADY RUNNING in background - no startup needed!</strong></p>
    <p><strong>Always use 127.0.0.1 IP addresses - NEVER use 'localhost'!</strong></p>

    <h2>🌐 Web-Accessible Services (${webServices.length})</h2>
    ${webServices.length === 0 ? '<p>No web services available.</p>' : ''}
    ${webServices.map(service => `
        <h3>${service.display_name}</h3>
        <p>${service.description}</p>
        <p><strong>Web Interface:</strong> <a href="http://127.0.0.1:${service.port}">http://127.0.0.1:${service.port}</a></p>
        <p><strong>Health Check:</strong> <a href="http://127.0.0.1:${service.port}/health">http://127.0.0.1:${service.port}/health</a></p>
        <p><strong>Usage:</strong> Access via HTTP API endpoints for database operations</p>
        <hr>
    `).join('')}

    <h2>📡 MCP Protocol Services (${stdioServices.length})</h2>
    <p>These services use MCP protocol over stdio - no web interface available.</p>
    ${stdioServices.map(service => `
        <h3>${service.display_name}</h3>
        <p>${service.description}</p>
        <p><strong>MCP Client Command:</strong> <code>${service.mcp_client_config?.command || 'uvx'} ${service.mcp_client_config?.args?.join(' ') || service.install_method?.package}</code></p>
        <p><strong>Usage:</strong> Connect via MCP client application</p>
        <hr>
    `).join('')}

    <h2>🔧 MCP Client Configuration</h2>
    <p>For Claude Desktop, Cursor, or other MCP clients:</p>
    <button onclick="showConfig()">Show Configuration JSON</button>
    <button onclick="copyConfig()">Copy to Clipboard</button>
    <div id="config-output" style="display:none; background:#f0f0f0; padding:10px; margin:10px 0; font-family:monospace; white-space:pre-wrap;"></div>

    <script>
        let mcpConfig = null;

        async function loadConfig() {
            if (!mcpConfig) {
                try {
                    const response = await fetch('/api/mcp-config');
                    mcpConfig = await response.json();
                } catch (error) {
                    console.error('Failed to load config:', error);
                }
            }
            return mcpConfig;
        }

        async function showConfig() {
            const config = await loadConfig();
            if (config) {
                document.getElementById('config-output').textContent = JSON.stringify(config, null, 2);
                document.getElementById('config-output').style.display = 'block';
            }
        }

        async function copyConfig() {
            const config = await loadConfig();
            if (config) {
                try {
                    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                    alert('Configuration copied to clipboard!');
                } catch (error) {
                    alert('Copy failed: ' + error.message);
                }
            }
        }
    </script>
</body>
</html>`;
}

// Generate default HTML if file doesn't exist
function generateDefaultHTML() {
    // Try to generate enhanced HTML first
    try {
        return generateEnhancedHTML();
    } catch (error) {
        // Fallback to simple HTML
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Services Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MCP Services Dashboard</h1>
            <p>Model Context Protocol Services</p>
        </div>
        <div class="warning">
            <h3>No MCP Services Found</h3>
            <p>The MCP services dashboard file was not found at: <code>${HTML_FILE}</code></p>
            <p>Please run the MCP installation script to generate the services dashboard.</p>
            <p>Expected MCP directory: <code>${MCP_DIR}</code></p>
        </div>
    </div>
</body>
</html>`;
    }
}

// Generate error HTML
function generateErrorHTML(error) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Services Dashboard - Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .error { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MCP Services Dashboard</h1>
            <p>Model Context Protocol Services</p>
        </div>
        <div class="error">
            <h3>Error Loading Dashboard</h3>
            <p>An error occurred while loading the MCP services dashboard:</p>
            <pre>${error}</pre>
        </div>
    </div>
</body>
</html>`;
}

// Copy HTML to MCP directory if it doesn't exist
function copyHTMLToMCPDir() {
    try {
        const mcpDir = path.dirname(HTML_FILE);
        if (!fs.existsSync(mcpDir)) {
            fs.mkdirSync(mcpDir, { recursive: true });
            console.log(`Created MCP directory: ${mcpDir}`);
        }
        
        if (!fs.existsSync(HTML_FILE)) {
            const defaultHTML = generateDefaultHTML();
            fs.writeFileSync(HTML_FILE, defaultHTML);
            console.log(`Created default dashboard file: ${HTML_FILE}`);
        }
    } catch (error) {
        console.error('Error copying HTML to MCP directory:', error);
    }
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url;
    
    if (url === '/index.html' || url === '/' || url === '/dashboard') {
        // Serve the main HTML dashboard page
        const html = readHTMLFile();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (url === '/api/services') {
        // API endpoint to get MCP services
        try {
            const services = scanMCPServices();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(services));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    } else if (url === '/api/mcp-config') {
        // API endpoint to get MCP client configuration
        try {
            const services = scanMCPServices();
            const mcpConfig = generateMCPClientConfig(services);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mcpConfig, null, 2));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    } else if (url.startsWith('/api/update-editor/')) {
        // API endpoint to update editor configuration
        const editor = url.split('/api/update-editor/')[1];

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const services = scanMCPServices();
                    const mcpConfig = generateMCPClientConfig(services);
                    const result = updateEditorConfig(editor, mcpConfig);

                    res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error.message }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    } else if (url === '/api/refresh') {
        // API endpoint to refresh the HTML
        try {
            copyHTMLToMCPDir();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', message: 'HTML refreshed' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
        }
    } else {
        // 404 for other requests
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>The requested resource was not found.</p>');
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`MCP HTTP Server started on port ${PORT}`);
    console.log(`Dashboard URL: http://localhost:${PORT}`);
    console.log(`MCP Directory: ${MCP_DIR}`);
    console.log(`HTML File: ${HTML_FILE}`);
    
    // Copy HTML to MCP directory on startup
    copyHTMLToMCPDir();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down MCP HTTP Server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
