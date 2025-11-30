// ============================================
// NAMESPACE: ITTools.Implementations.Crypto
// FILE: ittools-impl-crypto.js  
// PURPOSE: Crypto & security tool implementations
// ============================================

// ============================================
// Bcrypt Tool
// ============================================
ITTools.Tools.Registry.register('bcrypt-tool', {
    name: 'Bcrypt Hash & Verify',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Bcrypt Hash & Verify</div>
                <div class="ittools-card-body">
                    <div class="ittools-tabs">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.BcryptTool.switchTab('hash')">Hash</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.BcryptTool.switchTab('verify')">Verify</button>
                    </div>
                    
                    <div id="bcrypt-hash-tab" class="bcrypt-tab-content">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Password:</label>
                            <input type="text" id="bcrypt-password" class="ittools-input" placeholder="Enter password to hash">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Rounds (4-31):</label>
                            <input type="number" id="bcrypt-rounds" class="ittools-input" value="10" min="4" max="31">
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BcryptTool.hash()">
                                🔐 Generate Hash
                            </button>
                        </div>
                        <div id="bcrypt-hash-result" class="ittools-result" style="display: none;"></div>
                    </div>
                    
                    <div id="bcrypt-verify-tab" class="bcrypt-tab-content" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Password:</label>
                            <input type="text" id="bcrypt-verify-password" class="ittools-input" placeholder="Enter password">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Hash:</label>
                            <input type="text" id="bcrypt-verify-hash" class="ittools-input" placeholder="Enter bcrypt hash">
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BcryptTool.verify()">
                                ✓ Verify Password
                            </button>
                        </div>
                        <div id="bcrypt-verify-result" class="ittools-result" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BcryptTool = {
    switchTab(tab) {
        document.querySelectorAll('.bcrypt-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'hash') {
            document.getElementById('bcrypt-hash-tab').style.display = 'block';
            event.target.classList.add('active');
        } else {
            document.getElementById('bcrypt-verify-tab').style.display = 'block';
            event.target.classList.add('active');
        }
    },
    
    async hash() {
        const password = document.getElementById('bcrypt-password').value;
        const rounds = document.getElementById('bcrypt-rounds').value;
        
        if (!password) {
            ITTools.UI.showResult('bcrypt-hash-result', 'Please enter a password', false);
            return;
        }
        
        ITTools.UI.showLoading('bcrypt-hash-result', 'Generating hash...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bcrypt/hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, rounds: parseInt(rounds) })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('bcrypt-hash-result', 
                    `<strong>Bcrypt Hash:</strong><br><code style="word-break: break-all;">${result.data.hash}</code>
                    <button onclick="ITTools.UI.copyToClipboard('${result.data.hash}')" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('bcrypt-hash-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bcrypt-hash-result', 'Error: ' + error.message, false);
        }
    },
    
    async verify() {
        const password = document.getElementById('bcrypt-verify-password').value;
        const hash = document.getElementById('bcrypt-verify-hash').value;
        
        if (!password || !hash) {
            ITTools.UI.showResult('bcrypt-verify-result', 'Please enter both password and hash', false);
            return;
        }
        
        ITTools.UI.showLoading('bcrypt-verify-result', 'Verifying...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bcrypt/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, hash })
            });
            const result = await response.json();
            
            if (result.success) {
                const valid = result.data.valid;
                ITTools.UI.showResult('bcrypt-verify-result', 
                    valid ? '✅ Password matches hash!' : '❌ Password does NOT match hash', 
                    valid);
            } else {
                ITTools.UI.showResult('bcrypt-verify-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bcrypt-verify-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// ULID Generator
// ============================================
ITTools.Tools.Registry.register('ulid-generator', {
    name: 'ULID Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">ULID Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Number of ULIDs:</label>
                        <input type="number" id="ulid-count" class="ittools-input" value="5" min="1" max="100">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ULIDGenerator.generate()">
                            🆔 Generate ULIDs
                        </button>
                    </div>
                    <div id="ulid-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ULIDGenerator = {
    async generate() {
        const count = document.getElementById('ulid-count').value;
        
        ITTools.UI.showLoading('ulid-result', 'Generating ULIDs...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/ulid/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(count) })
            });
            const result = await response.json();
            
            if (result.success) {
                const ulids = result.data.ulids;
                const html = `<strong>${ulids.length} ULID(s) Generated:</strong><br>` +
                    ulids.map(ulid => `<code>${ulid}</code> <button onclick="ITTools.UI.copyToClipboard('${ulid}')" class="ittools-btn ittools-btn-sm">📋</button>`).join('<br>');
                ITTools.UI.showResult('ulid-result', html, true);
            } else {
                ITTools.UI.showResult('ulid-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('ulid-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// BIP39 Generator
// ============================================
ITTools.Tools.Registry.register('bip39-generator', {
    name: 'BIP39 Passphrase',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">BIP39 Mnemonic Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Word Count:</label>
                        <select id="bip39-words" class="ittools-input">
                            <option value="12">12 words</option>
                            <option value="15">15 words</option>
                            <option value="18">18 words</option>
                            <option value="21">21 words</option>
                            <option value="24">24 words</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BIP39Generator.generate()">
                            🔑 Generate Mnemonic
                        </button>
                    </div>
                    <div id="bip39-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BIP39Generator = {
    async generate() {
        const wordCount = document.getElementById('bip39-words').value;
        
        ITTools.UI.showLoading('bip39-result', 'Generating mnemonic...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bip39/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: parseInt(wordCount) })
            });
            const result = await response.json();
            
            if (result.success) {
                const mnemonic = result.data.mnemonic;
                ITTools.UI.showResult('bip39-result', 
                    `<strong>BIP39 Mnemonic (${wordCount} words):</strong><br>
                    <code style="display: block; padding: 15px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">${mnemonic}</code>
                    <button onclick="ITTools.UI.copyToClipboard('${mnemonic}')" class="ittools-btn ittools-btn-sm">📋 Copy</button>
                    <p style="color: #dc3545; font-size: 12px; margin-top: 10px;">⚠️ Store this safely! Never share your mnemonic phrase.</p>`, 
                    true);
            } else {
                ITTools.UI.showResult('bip39-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bip39-result', 'Error: ' + error.message, false);
        }
    }
};

// Continue in next file...
console.log('ITTools Crypto Implementations loaded');
