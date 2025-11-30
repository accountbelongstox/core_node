// ============================================
// NAMESPACE: ITTools.Implementations.Batch3a
// FILE: ittools-impl-batch3a.js  
// PURPOSE: Batch 3a - IPv6 ULA & Text Encryption (2/5 tools)
// ============================================

// ============================================
// IPv6 ULA Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('ipv6-ula-generator', {
    name: 'IPv6 ULA Generator',
    category: 'network',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">IPv6 Unique Local Address (ULA) Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Global ID (40-bit random):</label>
                        <input type="text" id="ipv6-global-id" class="ittools-input" placeholder="Auto-generated" readonly>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Subnet ID (16-bit):</label>
                        <input type="text" id="ipv6-subnet" class="ittools-input" value="0001" maxlength="4">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.IPv6ULA.generate()">
                            🔢 Generate ULA Prefix
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.IPv6ULA.generateMultiple()">
                            📋 Generate 10 Subnets
                        </button>
                    </div>
                    <div id="ipv6-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.IPv6ULA = {
    generateGlobalID() {
        let id = '';
        for (let i = 0; i < 10; i++) {
            id += Math.floor(Math.random() * 16).toString(16);
        }
        return id;
    },
    
    formatULA(globalID, subnet) {
        const formatted = globalID.match(/.{1,4}/g).join(':');
        return `fd${formatted}:${subnet}::/64`;
    },
    
    generate() {
        const globalID = this.generateGlobalID();
        const subnet = document.getElementById('ipv6-subnet').value.padStart(4, '0');
        
        document.getElementById('ipv6-global-id').value = globalID;
        
        const ula = this.formatULA(globalID, subnet);
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; margin-bottom: 15px;">
                    <strong>ULA Prefix:</strong><br>
                    <span style="font-size: 24px; font-family: monospace;">${ula}</span>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <strong>📝 Details:</strong><br>
                    <div style="font-family: monospace; font-size: 13px; margin-top: 10px;">
                        Prefix: fd (ULA identifier)<br>
                        Global ID: ${globalID}<br>
                        Subnet ID: ${subnet}<br>
                        Network: /64<br><br>
                        <strong>Example Address:</strong><br>
                        ${ula.replace('::/64', '::1')}
                    </div>
                </div>
                <button onclick="ITTools.UI.copyToClipboard('${ula}')" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy ULA</button>
            </div>
        `;
        
        ITTools.UI.showResult('ipv6-result', html, true);
    },
    
    generateMultiple() {
        const globalID = this.generateGlobalID();
        document.getElementById('ipv6-global-id').value = globalID;
        
        let html = '<div style="margin-top: 15px;"><strong>Generated 10 Subnets:</strong><pre style="background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; font-family: monospace; max-height: 300px; overflow-y: auto;">';
        
        const subnets = [];
        for (let i = 1; i <= 10; i++) {
            const subnet = i.toString(16).padStart(4, '0');
            const ula = this.formatULA(globalID, subnet);
            subnets.push(ula);
            html += `${ula}\n`;
        }
        
        html += '</pre><button onclick="ITTools.UI.copyToClipboard(`' + subnets.join('\\n') + '`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy All</button></div>';
        
        ITTools.UI.showResult('ipv6-result', html, true);
    }
};

// ============================================
// Text Encryptor/Decryptor (Client-side AES)
// ============================================
ITTools.Tools.Registry.register('text-encryptor', {
    name: 'Text Encryptor/Decryptor',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">AES Text Encryption</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Mode:</label>
                        <select id="crypto-mode" class="ittools-input" onchange="ITTools.Implementations.TextCrypto.switchMode()">
                            <option value="encrypt">Encrypt</option>
                            <option value="decrypt">Decrypt</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Password/Key:</label>
                        <input type="password" id="crypto-password" class="ittools-input" placeholder="Enter encryption password">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label" id="crypto-input-label">Text to Encrypt:</label>
                        <textarea id="crypto-input" class="ittools-input" rows="8" placeholder="Enter text to encrypt"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TextCrypto.process()">
                            🔐 <span id="crypto-btn-text">Encrypt</span>
                        </button>
                    </div>
                    <div id="crypto-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TextCrypto = {
    switchMode() {
        const mode = document.getElementById('crypto-mode').value;
        document.getElementById('crypto-input-label').textContent = mode === 'encrypt' ? 'Text to Encrypt:' : 'Encrypted Text (Base64):';
        document.getElementById('crypto-btn-text').textContent = mode === 'encrypt' ? 'Encrypt' : 'Decrypt';
        document.getElementById('crypto-input').placeholder = mode === 'encrypt' ? 'Enter text to encrypt' : 'Enter encrypted text (Base64)';
    },
    
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },
    
    async encrypt() {
        const password = document.getElementById('crypto-password').value;
        const text = document.getElementById('crypto-input').value;
        
        if (!password || !text) {
            ITTools.UI.showResult('crypto-result', 'Please enter both password and text', false);
            return;
        }
        
        try {
            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.deriveKey(password, salt);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(text)
            );
            
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            const base64 = btoa(String.fromCharCode(...combined));
            
            const html = `
                <div style="margin-top: 15px;">
                    <strong>Encrypted Text (Base64):</strong>
                    <pre style="background: #2c3e50; color: #00ff00; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; max-height: 200px; overflow-y: auto;">${base64}</pre>
                    <button onclick="ITTools.UI.copyToClipboard(\`${base64}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
                </div>
            `;
            
            ITTools.UI.showResult('crypto-result', html, true);
        } catch (error) {
            ITTools.UI.showResult('crypto-result', 'Encryption error: ' + error.message, false);
        }
    },
    
    async decrypt() {
        const password = document.getElementById('crypto-password').value;
        const base64 = document.getElementById('crypto-input').value;
        
        if (!password || !base64) {
            ITTools.UI.showResult('crypto-result', 'Please enter both password and encrypted text', false);
            return;
        }
        
        try {
            const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 28);
            const encrypted = combined.slice(28);
            
            const key = await this.deriveKey(password, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            const text = decoder.decode(decrypted);
            
            const html = `
                <div style="margin-top: 15px;">
                    <strong>Decrypted Text:</strong>
                    <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${text}</pre>
                    <button onclick="ITTools.UI.copyToClipboard(\`${text.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
                </div>
            `;
            
            ITTools.UI.showResult('crypto-result', html, true);
        } catch (error) {
            ITTools.UI.showResult('crypto-result', 'Decryption error: Wrong password or corrupted data', false);
        }
    },
    
    process() {
        const mode = document.getElementById('crypto-mode').value;
        if (mode === 'encrypt') {
            this.encrypt();
        } else {
            this.decrypt();
        }
    }
};

console.log('ITTools Batch 3a Implementations loaded');
