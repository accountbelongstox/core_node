// ============================================
// NAMESPACE: ITTools.Tools
// FILE: ittools-tools.js
// PURPOSE: Tool implementations and loader
// ============================================

ITTools.Tools = {
    // ============================================
    // NAMESPACE: ITTools.Tools.Registry
    // PURPOSE: Tool registration and management
    // ============================================
    Registry: {
        tools: {},
        
        register(toolId, config) {
            this.tools[toolId] = config;
        },
        
        get(toolId) {
            return this.tools[toolId];
        },
        
        getAll() {
            return this.tools;
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.Tools.API_CONFIG
    // PURPOSE: API endpoint configuration
    // ============================================
    API_CONFIG: {
        baseUrl: '/api/ittools/v1',
        endpoints: {
            hash: '/crypto/hash',
            encode: '/converter/base64/encode',
            decode: '/converter/base64/decode',
            uuid: '/crypto/uuid/generate',
            timestamp: '/converter/timestamp',
            color: '/converter/color'
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.Tools.Loader
    // PURPOSE: Dynamic tool loading
    // ============================================
    loadTool(toolId) {
        const toolConfig = ITToolsMenuConfig.getTool(toolId);
        
        if (!toolConfig) {
            console.error('Tool not found in config:', toolId);
            return;
        }
        
        const container = document.getElementById('ittools-main-content');
        if (!container) return;
        
        const tool = this.Registry.get(toolId);
        
        if (tool) {
            container.innerHTML = tool.render();
            if (tool.init) {
                tool.init();
            }
        } else {
            container.innerHTML = `
                <div class="ittools-card">
                    <div class="ittools-card-header">${toolConfig.label}</div>
                    <div class="ittools-card-body">
                        <p style="color: #666;">This tool is being implemented...</p>
                        <p style="margin-top: 10px; font-size: 13px; color: #999;">
                            Tool ID: ${toolId}<br>
                            Category: ${toolConfig.categoryId}<br>
                            Client-side: ${toolConfig.clientSide ? 'Yes' : 'No'}
                        </p>
                    </div>
                </div>
            `;
        }
        
        this.updateBottomMenu(toolId, toolConfig);
    },
    
    updateBottomMenu(toolId, tool) {
        const bottomLeft = document.querySelector('.ittools-bottom-menu-left');
        const bottomRight = document.querySelector('.ittools-bottom-menu-right');
        
        if (bottomLeft) {
            bottomLeft.innerHTML = `
                <button class="ittools-bottom-btn" onclick="ITTools.UI.toggleRightPanel()">
                    📋 Info Panel
                </button>
                <button class="ittools-bottom-btn" onclick="ITTools.Tools.resetTool('${toolId}')">
                    🔄 Reset
                </button>
            `;
        }
        
        if (bottomRight) {
            bottomRight.innerHTML = `
                <span class="ittools-bottom-status">Tool: ${tool.name || toolId}</span>
            `;
        }
    },
    
    resetTool(toolId) {
        this.loadTool(toolId);
        ITTools.UI.showToast('Tool reset', 'success');
    }
};

// ============================================
// NAMESPACE: ITTools.Tools.Text
// PURPOSE: Text manipulation tools
// ============================================
ITTools.Tools.Registry.register('text-encoder', {
    name: 'Text Encoder',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text Encoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="text-encoder-input" class="ittools-textarea" placeholder="Enter text to encode..."></textarea>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Encoding Type:</label>
                        <select id="text-encoder-type" class="ittools-select">
                            <option value="base64">Base64</option>
                            <option value="url">URL Encode</option>
                            <option value="html">HTML Entities</option>
                            <option value="hex">Hexadecimal</option>
                            <option value="binary">Binary</option>
                        </select>
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.TextEncoder.encode()">
                            🔐 Encode
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.UI.copyToClipboard(document.getElementById('text-encoder-result').textContent)">
                            📋 Copy Result
                        </button>
                    </div>
                    
                    <div id="text-encoder-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Tools.TextEncoder = {
    async encode() {
        const input = document.getElementById('text-encoder-input').value;
        const type = document.getElementById('text-encoder-type').value;
        
        if (!input) {
            ITTools.UI.showResult('text-encoder-result', 'Please enter text to encode', false);
            return;
        }
        
        ITTools.UI.showLoading('text-encoder-result', 'Encoding...');
        
        const result = await ITTools.API.post('/crypto/encode', {
            text: input,
            encoding_type: type
        });
        
        if (result.success) {
            ITTools.UI.showResult('text-encoder-result', result.data.encoded_text || result.data, true);
        } else {
            ITTools.UI.showResult('text-encoder-result', 'Error: ' + result.error, false);
        }
    }
};

// ============================================
// NAMESPACE: ITTools.Tools.Hash
// PURPOSE: Hash generation tools
// ============================================
ITTools.Tools.Registry.register('hash-generator', {
    name: 'Hash Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Hash Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="hash-input" class="ittools-textarea" placeholder="Enter text to hash..."></textarea>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Algorithm:</label>
                        <select id="hash-algorithm" class="ittools-select">
                            <option value="md5">MD5</option>
                            <option value="sha1">SHA-1</option>
                            <option value="sha256">SHA-256</option>
                            <option value="sha512">SHA-512</option>
                        </select>
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.HashGenerator.generate()">
                            🔐 Generate Hash
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.UI.copyToClipboard(document.getElementById('hash-result').textContent)">
                            📋 Copy Hash
                        </button>
                    </div>
                    
                    <div id="hash-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Tools.HashGenerator = {
    async generate() {
        const input = document.getElementById('hash-input').value;
        const algorithm = document.getElementById('hash-algorithm').value;
        
        if (!input) {
            ITTools.UI.showResult('hash-result', 'Please enter text to hash', false);
            return;
        }
        
        ITTools.UI.showLoading('hash-result', 'Generating hash...');
        
        const result = await ITTools.API.post('/crypto/hash', {
            text: input,
            algorithm: algorithm
        });
        
        if (result.success) {
            ITTools.UI.showResult('hash-result', result.data.hash || result.data, true);
        } else {
            ITTools.UI.showResult('hash-result', 'Error: ' + result.error, false);
        }
    }
};

// ============================================
// NAMESPACE: ITTools.Tools.UUID
// PURPOSE: UUID generation tool
// ============================================
ITTools.Tools.Registry.register('uuid-generator', {
    name: 'UUID Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">UUID Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">UUID Version:</label>
                        <select id="uuid-version" class="ittools-select">
                            <option value="4">Version 4 (Random)</option>
                            <option value="1">Version 1 (Time-based)</option>
                        </select>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Count:</label>
                        <input type="number" id="uuid-count" class="ittools-input" value="1" min="1" max="100">
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.UUIDGenerator.generate()">
                            🎲 Generate UUIDs
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.UI.copyToClipboard(document.getElementById('uuid-result').textContent)">
                            📋 Copy All
                        </button>
                    </div>
                    
                    <div id="uuid-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Tools.UUIDGenerator = {
    async generate() {
        const version = parseInt(document.getElementById('uuid-version').value);
        const count = parseInt(document.getElementById('uuid-count').value);
        
        ITTools.UI.showLoading('uuid-result', 'Generating UUIDs...');
        
        const result = await ITTools.API.post('/crypto/uuid/generate', {
            version: version,
            count: count
        });
        
        if (result.success) {
            const uuids = result.data.uuids || result.data;
            ITTools.UI.showResult('uuid-result', Array.isArray(uuids) ? uuids.join('\n') : uuids, true);
        } else {
            ITTools.UI.showResult('uuid-result', 'Error: ' + result.error, false);
        }
    }
};

// ============================================
// NAMESPACE: ITTools.Tools.JSON
// PURPOSE: JSON formatter tool
// ============================================
ITTools.Tools.Registry.register('json-formatter', {
    name: 'JSON Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON Formatter & Validator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">JSON Input:</label>
                        <textarea id="json-input" class="ittools-textarea" placeholder='{"key": "value"}'></textarea>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Indent Size:</label>
                        <select id="json-indent" class="ittools-select">
                            <option value="2">2 spaces</option>
                            <option value="4">4 spaces</option>
                            <option value="0">Minified</option>
                        </select>
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.JSONFormatter.format()">
                            ✨ Format JSON
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Tools.JSONFormatter.validate()">
                            ✅ Validate Only
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.UI.copyToClipboard(document.getElementById('json-result').textContent)">
                            📋 Copy Result
                        </button>
                    </div>
                    
                    <div id="json-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Tools.JSONFormatter = {
    async format() {
        const input = document.getElementById('json-input').value;
        const indent = parseInt(document.getElementById('json-indent').value);
        
        if (!input) {
            ITTools.UI.showResult('json-result', 'Please enter JSON to format', false);
            return;
        }
        
        try {
            const parsed = JSON.parse(input);
            const formatted = indent === 0 
                ? JSON.stringify(parsed) 
                : JSON.stringify(parsed, null, indent);
            ITTools.UI.showResult('json-result', formatted, true);
        } catch (e) {
            ITTools.UI.showResult('json-result', 'Invalid JSON: ' + e.message, false);
        }
    },
    
    async validate() {
        const input = document.getElementById('json-input').value;
        
        if (!input) {
            ITTools.UI.showResult('json-result', 'Please enter JSON to validate', false);
            return;
        }
        
        try {
            JSON.parse(input);
            ITTools.UI.showResult('json-result', '✅ Valid JSON', true);
        } catch (e) {
            ITTools.UI.showResult('json-result', '❌ Invalid JSON: ' + e.message, false);
        }
    }
};

// ============================================
// NAMESPACE: ITTools.Tools.Timestamp
// PURPOSE: Timestamp converter tool
// ============================================
ITTools.Tools.Registry.register('timestamp-converter', {
    name: 'Timestamp Converter',
    category: 'datetime',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Timestamp Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Current Timestamp:</label>
                        <input type="text" id="current-timestamp" class="ittools-input" value="${Math.floor(Date.now() / 1000)}" readonly>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Timestamp:</label>
                        <input type="text" id="timestamp-input" class="ittools-input" placeholder="1234567890">
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">From Format:</label>
                        <select id="timestamp-from" class="ittools-select">
                            <option value="unix">Unix Timestamp</option>
                            <option value="iso8601">ISO 8601</option>
                            <option value="rfc2822">RFC 2822</option>
                        </select>
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">To Format:</label>
                        <select id="timestamp-to" class="ittools-select">
                            <option value="iso8601">ISO 8601</option>
                            <option value="unix">Unix Timestamp</option>
                            <option value="rfc2822">RFC 2822</option>
                            <option value="mysql">MySQL DateTime</option>
                        </select>
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.TimestampConverter.convert()">
                            🔄 Convert
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="document.getElementById('timestamp-input').value = Math.floor(Date.now() / 1000)">
                            ⏰ Use Current
                        </button>
                    </div>
                    
                    <div id="timestamp-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    },
    init() {
        setInterval(() => {
            document.getElementById('current-timestamp').value = Math.floor(Date.now() / 1000);
        }, 1000);
    }
});

ITTools.Tools.TimestampConverter = {
    async convert() {
        const input = document.getElementById('timestamp-input').value;
        const fromFormat = document.getElementById('timestamp-from').value;
        const toFormat = document.getElementById('timestamp-to').value;
        
        if (!input) {
            ITTools.UI.showResult('timestamp-result', 'Please enter a timestamp', false);
            return;
        }
        
        ITTools.UI.showLoading('timestamp-result', 'Converting...');
        
        const result = await ITTools.API.post('/converter/timestamp', {
            timestamp: input,
            from_format: fromFormat,
            to_format: toFormat
        });
        
        if (result.success) {
            ITTools.UI.showResult('timestamp-result', result.data.converted_timestamp || result.data, true);
        } else {
            ITTools.UI.showResult('timestamp-result', 'Error: ' + result.error, false);
        }
    }
};

console.log('ITTools.Tools loaded successfully');
