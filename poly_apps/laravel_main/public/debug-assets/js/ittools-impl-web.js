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
            const response = await APIClient.post('/api/ittools/v1/web/jwt/parse', { token }, { includeAuth: false });
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
            const response = await APIClient.post('/api/ittools/v1/network/user-agent/parse', { user_agent: userAgent }, { includeAuth: false });
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
    ITTools.Implementations.HTTPStatusCodes.search();
});

console.log('ITTools Web Implementations loaded');
