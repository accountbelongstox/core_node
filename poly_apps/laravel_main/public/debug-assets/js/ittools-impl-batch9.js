// ============================================
// NAMESPACE: ITTools.Implementations.Batch9
// FILE: ittools-impl-batch9.js
// PURPOSE: Web tools, generators, utility tools
// ============================================

// ============================================
// URL Parser
// ============================================
ITTools.Tools.Registry.register('url-parser', {
    name: 'URL Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">URL Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">URL:</label>
                        <input type="text" id="url-parse-input" class="ittools-input" placeholder="https://example.com:8080/path?query=value#hash" oninput="ITTools.Implementations.UrlParser.parse()">
                    </div>
                    <div id="url-parse-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UrlParser = {
    parse() {
        const input = document.getElementById('url-parse-input').value.trim();
        if (!input) { document.getElementById('url-parse-result').innerHTML = ''; return; }
        try {
            const url = new URL(input);
            const params = [...url.searchParams.entries()];
            const paramsHtml = params.length ? params.map(([k, v]) => `<div style="display:flex;gap:10px;"><code style="background:#e9ecef;padding:2px 6px;border-radius:3px;">${k}</code><span>=</span><span>${v}</span></div>`).join('') : '<span style="color:#999;">None</span>';
            const html = `
                <div style="display:grid;gap:10px;">
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Protocol:</strong> <code>${url.protocol}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Host:</strong> <code>${url.host}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Hostname:</strong> <code>${url.hostname}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Port:</strong> <code>${url.port || 'default'}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Pathname:</strong> <code>${url.pathname}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Search:</strong> <code>${url.search || 'none'}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Hash:</strong> <code>${url.hash || 'none'}</code></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Origin:</strong> <code>${url.origin}</code></div>
                    <div style="background:#fff3cd;padding:10px;border-radius:5px;"><strong>Query Parameters:</strong><div style="margin-top:5px;">${paramsHtml}</div></div>
                </div>
            `;
            document.getElementById('url-parse-result').innerHTML = html;
        } catch (e) {
            document.getElementById('url-parse-result').innerHTML = '<span style="color:#dc3545;">Invalid URL</span>';
        }
    }
};

// ============================================
// QR Code Generator
// ============================================
ITTools.Tools.Registry.register('qr-generator', {
    name: 'QR Code Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">QR Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text/URL:</label>
                        <textarea id="qr-gen-input" class="ittools-textarea" rows="3" placeholder="Enter text or URL to encode..."></textarea>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Size:</label>
                            <select id="qr-gen-size" class="ittools-input">
                                <option value="150">Small (150x150)</option>
                                <option value="200" selected>Medium (200x200)</option>
                                <option value="300">Large (300x300)</option>
                            </select>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Error Correction:</label>
                            <select id="qr-gen-ecc" class="ittools-input">
                                <option value="L">Low (7%)</option>
                                <option value="M" selected>Medium (15%)</option>
                                <option value="Q">Quartile (25%)</option>
                                <option value="H">High (30%)</option>
                            </select>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QrGenerator.generate()">Generate QR Code</button>
                    </div>
                    <div id="qr-gen-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QrGenerator = {
    generate() {
        const text = document.getElementById('qr-gen-input').value.trim();
        if (!text) { ITTools.UI.showResult('qr-gen-result', 'Please enter text or URL', false); return; }
        const size = document.getElementById('qr-gen-size').value;
        const ecc = document.getElementById('qr-gen-ecc').value;
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=${ecc}&data=${encodeURIComponent(text)}`;
        ITTools.UI.showResult('qr-gen-result', `
            <div style="text-align:center;">
                <img src="${apiUrl}" alt="QR Code" style="border:1px solid #ddd;border-radius:5px;margin-bottom:10px;">
                <br>
                <a href="${apiUrl}" download="qrcode.png" class="ittools-btn ittools-btn-sm">Download PNG</a>
            </div>
        `, true);
    }
};

// ============================================
// WiFi QR Code Generator
// ============================================
ITTools.Tools.Registry.register('wifi-qr', {
    name: 'WiFi QR Code',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">WiFi QR Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Network Name (SSID):</label>
                        <input type="text" id="wifi-ssid" class="ittools-input" placeholder="MyWiFiNetwork">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Password:</label>
                        <input type="text" id="wifi-password" class="ittools-input" placeholder="WiFi password">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Security Type:</label>
                        <select id="wifi-security" class="ittools-input">
                            <option value="WPA">WPA/WPA2</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">None</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.WifiQr.generate()">Generate WiFi QR</button>
                    </div>
                    <div id="wifi-qr-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.WifiQr = {
    generate() {
        const ssid = document.getElementById('wifi-ssid').value.trim();
        const password = document.getElementById('wifi-password').value;
        const security = document.getElementById('wifi-security').value;
        if (!ssid) { ITTools.UI.showResult('wifi-qr-result', 'Please enter SSID', false); return; }
        const wifiString = `WIFI:T:${security};S:${ssid};P:${password};;`;
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiString)}`;
        ITTools.UI.showResult('wifi-qr-result', `
            <div style="text-align:center;">
                <img src="${apiUrl}" alt="WiFi QR Code" style="border:1px solid #ddd;border-radius:5px;margin-bottom:10px;">
                <br>
                <p style="font-size:12px;color:#666;margin-top:10px;">Scan with your phone's camera to connect to WiFi</p>
                <a href="${apiUrl}" download="wifi-qr.png" class="ittools-btn ittools-btn-sm">Download</a>
            </div>
        `, true);
    }
};

// ============================================
// HTTP Status Codes
// ============================================
ITTools.Tools.Registry.register('http-status', {
    name: 'HTTP Status Codes',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTTP Status Codes Reference</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search Status Code:</label>
                        <input type="text" id="http-status-search" class="ittools-input" placeholder="Search by code or description..." oninput="ITTools.Implementations.HttpStatus.search()">
                    </div>
                    <div id="http-status-list" style="max-height:400px;overflow:auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HttpStatus = {
    codes: {
        '100': { name: 'Continue', desc: 'Server received request headers, client should proceed', cat: 'info' },
        '101': { name: 'Switching Protocols', desc: 'Server switching protocols as requested', cat: 'info' },
        '200': { name: 'OK', desc: 'Request succeeded', cat: 'success' },
        '201': { name: 'Created', desc: 'Request succeeded and resource created', cat: 'success' },
        '204': { name: 'No Content', desc: 'Request succeeded but no content returned', cat: 'success' },
        '301': { name: 'Moved Permanently', desc: 'Resource permanently moved to new URL', cat: 'redirect' },
        '302': { name: 'Found', desc: 'Resource temporarily at different URL', cat: 'redirect' },
        '304': { name: 'Not Modified', desc: 'Resource not modified since last request', cat: 'redirect' },
        '400': { name: 'Bad Request', desc: 'Server cannot process malformed request', cat: 'error' },
        '401': { name: 'Unauthorized', desc: 'Authentication required', cat: 'error' },
        '403': { name: 'Forbidden', desc: 'Server refuses to authorize request', cat: 'error' },
        '404': { name: 'Not Found', desc: 'Requested resource not found', cat: 'error' },
        '405': { name: 'Method Not Allowed', desc: 'HTTP method not allowed for resource', cat: 'error' },
        '408': { name: 'Request Timeout', desc: 'Server timed out waiting for request', cat: 'error' },
        '409': { name: 'Conflict', desc: 'Request conflicts with server state', cat: 'error' },
        '422': { name: 'Unprocessable Entity', desc: 'Request well-formed but has semantic errors', cat: 'error' },
        '429': { name: 'Too Many Requests', desc: 'Rate limit exceeded', cat: 'error' },
        '500': { name: 'Internal Server Error', desc: 'Generic server error', cat: 'server' },
        '502': { name: 'Bad Gateway', desc: 'Invalid response from upstream server', cat: 'server' },
        '503': { name: 'Service Unavailable', desc: 'Server temporarily unavailable', cat: 'server' },
        '504': { name: 'Gateway Timeout', desc: 'Upstream server timeout', cat: 'server' }
    },
    colors: { info: '#17a2b8', success: '#28a745', redirect: '#ffc107', error: '#dc3545', server: '#6f42c1' },
    search() {
        const query = document.getElementById('http-status-search').value.toLowerCase();
        const filtered = Object.entries(this.codes).filter(([code, info]) => 
            code.includes(query) || info.name.toLowerCase().includes(query) || info.desc.toLowerCase().includes(query)
        );
        this.render(filtered);
    },
    render(items = null) {
        const list = items || Object.entries(this.codes);
        const html = list.map(([code, info]) => `
            <div style="display:flex;align-items:center;gap:15px;padding:10px;border-bottom:1px solid #eee;">
                <span style="background:${this.colors[info.cat]};color:white;padding:5px 10px;border-radius:4px;font-weight:bold;min-width:50px;text-align:center;">${code}</span>
                <div><strong>${info.name}</strong><br><span style="color:#666;font-size:13px;">${info.desc}</span></div>
            </div>
        `).join('');
        document.getElementById('http-status-list').innerHTML = html || '<p style="color:#666;text-align:center;padding:20px;">No matching status codes</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('http-status-list');
    if (el) ITTools.Implementations.HttpStatus.render();
});

// ============================================
// Device Information
// ============================================
ITTools.Tools.Registry.register('device-info', {
    name: 'Device Information',
    category: 'web',
    render() {
        setTimeout(() => ITTools.Implementations.DeviceInfo.show(), 0);
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Device Information</div>
                <div class="ittools-card-body">
                    <div id="device-info-result"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.DeviceInfo = {
    show() {
        const nav = navigator;
        const screen = window.screen;
        const html = `
            <div style="display:grid;gap:10px;">
                <div style="background:#667eea;color:white;padding:15px;border-radius:5px;"><strong>User Agent:</strong><br><code style="word-break:break-all;font-size:12px;">${nav.userAgent}</code></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Platform:</strong> ${nav.platform}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Language:</strong> ${nav.language}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Cookies:</strong> ${nav.cookieEnabled ? 'Enabled' : 'Disabled'}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Online:</strong> ${nav.onLine ? 'Yes' : 'No'}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Screen:</strong> ${screen.width}x${screen.height}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Viewport:</strong> ${window.innerWidth}x${window.innerHeight}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Color Depth:</strong> ${screen.colorDepth}-bit</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Pixel Ratio:</strong> ${window.devicePixelRatio}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Touch:</strong> ${('ontouchstart' in window) ? 'Yes' : 'No'}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>CPU Cores:</strong> ${nav.hardwareConcurrency || 'N/A'}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Memory:</strong> ${nav.deviceMemory ? nav.deviceMemory + 'GB' : 'N/A'}</div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;"><strong>Timezone:</strong> ${Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
                </div>
            </div>
        `;
        document.getElementById('device-info-result').innerHTML = html;
    }
};

// ============================================
// Keycode Info
// ============================================
ITTools.Tools.Registry.register('keycode-info', {
    name: 'Keycode Info',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Keyboard Event Info</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Press any key:</label>
                        <input type="text" id="keycode-input" class="ittools-input" placeholder="Click here and press any key..." onkeydown="ITTools.Implementations.KeycodeInfo.capture(event)">
                    </div>
                    <div id="keycode-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.KeycodeInfo = {
    capture(e) {
        e.preventDefault();
        const html = `
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:48px;font-weight:bold;color:#667eea;">${e.key === ' ' ? 'Space' : e.key}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
                <div style="background:#f8f9fa;padding:10px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;color:#667eea;">${e.keyCode}</div><div style="font-size:12px;color:#666;">keyCode (deprecated)</div></div>
                <div style="background:#f8f9fa;padding:10px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;color:#28a745;">${e.which}</div><div style="font-size:12px;color:#666;">which</div></div>
                <div style="background:#f8f9fa;padding:10px;border-radius:5px;text-align:center;"><div style="font-size:18px;font-weight:bold;color:#17a2b8;">${e.code}</div><div style="font-size:12px;color:#666;">code</div></div>
                <div style="background:#f8f9fa;padding:10px;border-radius:5px;text-align:center;"><div style="font-size:18px;font-weight:bold;color:#6f42c1;">${e.key}</div><div style="font-size:12px;color:#666;">key</div></div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:15px;">
                <span style="background:${e.ctrlKey?'#667eea':'#e9ecef'};color:${e.ctrlKey?'white':'#333'};padding:5px 15px;border-radius:4px;">Ctrl</span>
                <span style="background:${e.shiftKey?'#667eea':'#e9ecef'};color:${e.shiftKey?'white':'#333'};padding:5px 15px;border-radius:4px;">Shift</span>
                <span style="background:${e.altKey?'#667eea':'#e9ecef'};color:${e.altKey?'white':'#333'};padding:5px 15px;border-radius:4px;">Alt</span>
                <span style="background:${e.metaKey?'#667eea':'#e9ecef'};color:${e.metaKey?'white':'#333'};padding:5px 15px;border-radius:4px;">Meta</span>
            </div>
        `;
        document.getElementById('keycode-result').innerHTML = html;
    }
};

// ============================================
// Regex Tester
// ============================================
ITTools.Tools.Registry.register('regex-tester', {
    name: 'Regex Tester',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Regular Expression Tester</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Pattern:</label>
                        <div style="display:flex;gap:5px;">
                            <span style="padding:8px;background:#f8f9fa;border-radius:4px 0 0 4px;">/</span>
                            <input type="text" id="regex-pattern" class="ittools-input" style="border-radius:0;" placeholder="[a-z]+">
                            <span style="padding:8px;background:#f8f9fa;">/</span>
                            <input type="text" id="regex-flags" class="ittools-input" style="width:60px;border-radius:0 4px 4px 0;" placeholder="gi" value="g">
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Test String:</label>
                        <textarea id="regex-test" class="ittools-textarea" rows="4" placeholder="Enter text to test..." oninput="ITTools.Implementations.RegexTester.test()"></textarea>
                    </div>
                    <div id="regex-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RegexTester = {
    test() {
        const pattern = document.getElementById('regex-pattern').value;
        const flags = document.getElementById('regex-flags').value;
        const text = document.getElementById('regex-test').value;
        if (!pattern || !text) { document.getElementById('regex-result').style.display = 'none'; return; }
        try {
            const regex = new RegExp(pattern, flags);
            const matches = text.match(regex);
            let highlighted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (matches) {
                const uniqueMatches = [...new Set(matches)];
                uniqueMatches.forEach(m => {
                    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    highlighted = highlighted.replace(new RegExp(escaped, flags), `<mark style="background:#ffc107;padding:0 2px;">$&</mark>`);
                });
            }
            const matchCount = matches ? matches.length : 0;
            ITTools.UI.showResult('regex-result', `
                <div style="margin-bottom:10px;"><strong>Matches:</strong> ${matchCount}</div>
                ${matches ? `<div style="margin-bottom:10px;"><strong>Found:</strong> ${[...new Set(matches)].map(m => `<code style="background:#e9ecef;padding:2px 5px;border-radius:3px;margin:2px;">${m.replace(/</g,'&lt;')}</code>`).join(' ')}</div>` : ''}
                <div style="background:#f8f9fa;padding:10px;border-radius:5px;white-space:pre-wrap;word-break:break-all;">${highlighted}</div>
            `, true);
        } catch (e) {
            ITTools.UI.showResult('regex-result', 'Invalid regex: ' + e.message, false);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const patternEl = document.getElementById('regex-pattern');
    const flagsEl = document.getElementById('regex-flags');
    patternEl.addEventListener('input', () => ITTools.Implementations.RegexTester.test());
    flagsEl.addEventListener('input', () => ITTools.Implementations.RegexTester.test());
});

console.log('ITTools Batch 9 loaded (url-parser, qr-generator, wifi-qr, http-status, device-info, keycode-info, regex-tester)');
