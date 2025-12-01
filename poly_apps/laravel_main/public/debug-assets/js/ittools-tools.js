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
// NAMESPACE: ITTools.Tools.PDFSplitter
// ============================================
ITTools.Tools.Registry.register('pdf-splitter', {
    name: 'PDF Splitter',
    category: 'pdf',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">PDF Splitter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload PDF:</label>
                        <input type="file" id="pdf-splitter-file" class="ittools-input" accept=".pdf">
                    </div>
                    
                    <div class="ittools-form-group">
                        <label class="ittools-label">Page Ranges:</label>
                        <input type="text" id="pdf-splitter-ranges" class="ittools-input" 
                               placeholder="1-3, 5, 7-10 or JSON: [{'start':1,'end':3},5]">
                        <small style="color: #666; font-size: 12px;">
                            Enter comma-separated ranges (e.g., "1-3, 5-7") or individual pages (e.g., "1, 3, 5")
                        </small>
                    </div>
                    
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Tools.PDFSplitter.split()">
                            ✂️ Split PDF
                        </button>
                    </div>
                    
                    <div id="pdf-splitter-result" class="ittools-result" style="display: none;"></div>
                    <div id="pdf-splitter-downloads" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Tools.PDFSplitter = {
    async split() {
        const fileInput = document.getElementById('pdf-splitter-file');
        const ranges = document.getElementById('pdf-splitter-ranges').value;
        
        if (!fileInput.files || !fileInput.files[0]) {
            ITTools.UI.showResult('pdf-splitter-result', 'Please select a PDF file', false);
            return;
        }
        
        if (!ranges) {
            ITTools.UI.showResult('pdf-splitter-result', 'Please enter page ranges', false);
            return;
        }
        
        ITTools.UI.showLoading('pdf-splitter-result', 'Splitting PDF...');
        
        const formData = new FormData();
        formData.append('pdf', fileInput.files[0]);
        formData.append('ranges', ranges);
        
        try {
            const response = await fetch('/api/ittools/v1/advanced/pdf/split', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                const files = result.data.files;
                ITTools.UI.showResult('pdf-splitter-result', 
                    `Successfully split into ${files.length} file(s)`, true);
                
                const downloadDiv = document.getElementById('pdf-splitter-downloads');
                downloadDiv.innerHTML = files.map((file, i) => `
                    <div style="margin: 10px 0; padding: 10px; background: rgba(103, 126, 234, 0.1); border-radius: 6px;">
                        <strong>File ${i + 1}</strong> - Pages: ${file.pages} (${file.file_size_readable})
                        <br>
                        <a href="${file.data}" download="split_${i + 1}.pdf" 
                           class="ittools-btn ittools-btn-secondary" style="margin-top: 5px; display: inline-block;">
                            📥 Download
                        </a>
                    </div>
                `).join('');
            } else {
                ITTools.UI.showResult('pdf-splitter-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('pdf-splitter-result', 'Error: ' + error.message, false);
        }
    }
};

console.log('ITTools.Tools loaded successfully');
