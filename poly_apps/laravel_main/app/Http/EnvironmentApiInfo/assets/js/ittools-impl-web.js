// ============================================
// NAMESPACE: ITTools.Implementations.Web
// FILE: ittools-impl-web.js  
// PURPOSE: Web tool implementations
// ============================================

// ============================================
// JWT Parser
// ============================================
ITTools.Tools.Registry.register('jwt-parser', {
    name: 'JWT Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JWT Token Parser & Decoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">JWT Token:</label>
                        <textarea id="jwt-token" class="ittools-textarea" rows="6" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JWTParser.parse()">
                            🔍 Decode JWT
                        </button>
                    </div>
                    <div id="jwt-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JWTParser = {
    async parse() {
        const token = document.getElementById('jwt-token').value.trim();
        
        if (!token) {
            ITTools.UI.showResult('jwt-result', 'Please enter a JWT token', false);
            return;
        }
        
        ITTools.UI.showLoading('jwt-result', 'Parsing JWT...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/jwt/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success) {
                const data = result.data;
                const html = `
                    <div style="margin-top: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">📋 Header</h4>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.header, null, 2)}</pre>
                        
                        <h4 style="color: #667eea; margin: 15px 0 10px;">📦 Payload</h4>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.payload, null, 2)}</pre>
                        
                        <h4 style="color: #667eea; margin: 15px 0 10px;">🔐 Signature</h4>
                        <code style="display: block; background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all;">${data.signature}</code>
                        
                        ${data.exp_human ? `<p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">⏰ Expires: ${data.exp_human}</p>` : ''}
                        ${data.iat_human ? `<p style="margin-top: 10px; padding: 10px; background: #d1ecf1; border-radius: 5px;">📅 Issued: ${data.iat_human}</p>` : ''}
                    </div>
                `;
                ITTools.UI.showResult('jwt-result', html, true);
            } else {
                ITTools.UI.showResult('jwt-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('jwt-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// User Agent Parser
// ============================================
ITTools.Tools.Registry.register('user-agent-parser', {
    name: 'User Agent Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">User Agent Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">User Agent String:</label>
                        <textarea id="ua-input" class="ittools-textarea" rows="4" placeholder="Mozilla/5.0..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.UserAgentParser.parse()">
                            🔍 Parse User Agent
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.UserAgentParser.useCurrent()">
                            📱 Use Current Browser
                        </button>
                    </div>
                    <div id="ua-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UserAgentParser = {
    useCurrent() {
        document.getElementById('ua-input').value = navigator.userAgent;
        this.parse();
    },
    
    async parse() {
        const userAgent = document.getElementById('ua-input').value.trim();
        
        if (!userAgent) {
            ITTools.UI.showResult('ua-result', 'Please enter a user agent string', false);
            return;
        }
        
        ITTools.UI.showLoading('ua-result', 'Parsing...');
        
        try {
            const response = await fetch('/api/ittools/v1/network/user-agent/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_agent: userAgent })
            });
            const result = await response.json();
            
            if (result.success) {
                const data = result.data;
                const html = `
                    <div style="margin-top: 15px; display: grid; gap: 15px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>🖥️ Browser:</strong> ${data.browser || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>📱 Platform:</strong> ${data.platform || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>🔢 Version:</strong> ${data.version || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>📲 Device:</strong> ${data.device || 'Desktop'}
                        </div>
                    </div>
                `;
                ITTools.UI.showResult('ua-result', html, true);
            } else {
                ITTools.UI.showResult('ua-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('ua-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// HTTP Status Codes (Client-side)
// ============================================
ITTools.Tools.Registry.register('http-status-codes', {
    name: 'HTTP Status Codes',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTTP Status Codes Reference</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search Status Code:</label>
                        <input type="text" id="http-status-search" class="ittools-input" placeholder="200, 404, or 'Not Found'" oninput="ITTools.Implementations.HTTPStatusCodes.search()">
                    </div>
                    <div id="http-status-result" style="max-height: 500px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HTTPStatusCodes = {
    codes: {
        '100': 'Continue', '101': 'Switching Protocols',
        '200': 'OK', '201': 'Created', '202': 'Accepted', '204': 'No Content',
        '301': 'Moved Permanently', '302': 'Found', '304': 'Not Modified',
        '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found',
        '405': 'Method Not Allowed', '409': 'Conflict', '410': 'Gone', '429': 'Too Many Requests',
        '500': 'Internal Server Error', '501': 'Not Implemented', '502': 'Bad Gateway',
        '503': 'Service Unavailable', '504': 'Gateway Timeout'
    },
    
    search() {
        const query = document.getElementById('http-status-search').value.toLowerCase();
        const filtered = Object.entries(this.codes).filter(([code, desc]) => 
            code.includes(query) || desc.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            document.getElementById('http-status-result').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No matching status codes</p>';
            return;
        }
        
        const html = filtered.map(([code, desc]) => {
            const category = code[0] === '1' ? 'Informational' : code[0] === '2' ? 'Success' :
                           code[0] === '3' ? 'Redirection' : code[0] === '4' ? 'Client Error' : 'Server Error';
            const color = code[0] === '2' ? '#28a745' : code[0] === '3' ? '#17a2b8' :
                        code[0] === '4' ? '#ffc107' : code[0] === '5' ? '#dc3545' : '#6c757d';
            
            return `
                <div style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid ${color};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 24px; font-weight: bold; color: ${color};">${code}</span>
                            <span style="margin-left: 15px; font-size: 16px;">${desc}</span>
                        </div>
                        <span style="background: ${color}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">${category}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('http-status-result').innerHTML = html;
    }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('http-status-result')) {
        ITTools.Implementations.HTTPStatusCodes.search();
    }
});

// ============================================
// MIME Types Reference (Client-side)
// ============================================
ITTools.Tools.Registry.register('mime-types', {
    name: 'MIME Types Reference',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">MIME Types Reference</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search MIME Type or Extension:</label>
                        <input type="text" id="mime-search" class="ittools-input" placeholder=".pdf, application/pdf, or image" oninput="ITTools.Implementations.MIMETypes.search()">
                    </div>
                    <div id="mime-result" style="max-height: 500px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MIMETypes = {
    types: {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.json': 'application/json', '.xml': 'application/xml', '.pdf': 'application/pdf',
        '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
        '.txt': 'text/plain', '.csv': 'text/csv',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    },
    
    search() {
        const query = document.getElementById('mime-search').value.toLowerCase();
        const filtered = Object.entries(this.types).filter(([ext, mime]) => 
            ext.toLowerCase().includes(query) || mime.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            document.getElementById('mime-result').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No matching MIME types</p>';
            return;
        }
        
        const html = filtered.map(([ext, mime]) => `
            <div style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-weight: bold; color: #667eea;">${ext}</span>
                    <span style="margin-left: 15px; color: #666;">${mime}</span>
                </div>
                <button onclick="ITTools.UI.copyToClipboard('${mime}')" class="ittools-btn ittools-btn-sm">📋</button>
            </div>
        `).join('');
        
        document.getElementById('mime-result').innerHTML = html;
    }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('mime-result')) {
        ITTools.Implementations.MIMETypes.search();
    }
});

// ============================================
// Query String Parser (Client-side)
// ============================================
ITTools.Tools.Registry.register('query-string-parser', {
    name: 'Query String Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Query String Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Query String:</label>
                        <input type="text" id="query-string-input" class="ittools-input" placeholder="?name=John&age=30&city=NYC">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QueryStringParser.parse()">
                            🔍 Parse Query String
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.QueryStringParser.useCurrent()">
                            📍 Use Current URL
                        </button>
                    </div>
                    <div id="query-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QueryStringParser = {
    useCurrent() {
        const query = window.location.search;
        document.getElementById('query-string-input').value = query || '(No query string in current URL)';
        if (query) this.parse();
    },
    
    parse() {
        const input = document.getElementById('query-string-input').value.trim();
        
        if (!input) {
            ITTools.UI.showResult('query-result', 'Please enter a query string', false);
            return;
        }
        
        const queryString = input.startsWith('?') ? input.substring(1) : input;
        const params = new URLSearchParams(queryString);
        const parsed = {};
        
        for (const [key, value] of params.entries()) {
            parsed[key] = value;
        }
        
        if (Object.keys(parsed).length === 0) {
            ITTools.UI.showResult('query-result', 'No parameters found', false);
            return;
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Parsed Parameters (${Object.keys(parsed).length}):</strong>
                <div style="margin-top: 15px;">
                    ${Object.entries(parsed).map(([key, value]) => `
                        <div style="background: #f8f9fa; padding: 12px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-weight: bold; color: #667eea;">${key}:</span>
                                <span style="margin-left: 10px;">${value}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <h4 style="margin-top: 20px; color: #667eea;">As JSON:</h4>
                <textarea class="ittools-textarea" rows="8" readonly>${JSON.stringify(parsed, null, 2)}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${JSON.stringify(parsed, null, 2).replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy JSON</button>
            </div>
        `;
        
        ITTools.UI.showResult('query-result', html, true);
    }
};

console.log('ITTools Web Implementations loaded');
