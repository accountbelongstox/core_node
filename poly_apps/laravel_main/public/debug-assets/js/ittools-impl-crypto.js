// ============================================
// NAMESPACE: ITTools.Implementations.Crypto
// FILE: ittools-impl-crypto.js  
// PURPOSE: Crypto & security tool implementations
// ============================================

// ============================================
// Bcrypt Tool
// ============================================
ITTools.Implementations.BcryptTool = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/bcrypt-tool.html',

    async render() {
        const response = await fetch(this.templateUrl);
        return await response.text();
    },

    init() {
        this.attachEventListeners();
    },

    attachEventListeners() {
        const container = document.getElementById('ittools-main-content');
        container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            if (!action) return;

            const actionName = action.dataset.action;
            if (actionName === 'switch-tab') {
                this.switchTab(action.dataset.tab, action);
            } else if (actionName === 'bcrypt-hash') {
                this.hash();
            } else if (actionName === 'bcrypt-verify') {
                this.verify();
            } else if (actionName === 'copy-hash') {
                this.copyToClipboard(action.dataset.hash);
            }
        });
    },

    switchTab(tab, button) {
        document.querySelectorAll('.bcrypt-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'hash') {
            document.getElementById('bcrypt-hash-tab').classList.remove('hidden');
        } else {
            document.getElementById('bcrypt-verify-tab').classList.remove('hidden');
        }
        button.classList.add('active');
    },
    
    async hash() {
        const password = document.querySelector('[data-input="bcrypt-password"]').value;
        const rounds = document.querySelector('[data-input="bcrypt-rounds"]').value;
        const resultDiv = document.getElementById('bcrypt-hash-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Generating hash...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/crypto/bcrypt/hash', 'POST', { 
            password, 
            rounds: parseInt(rounds) 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'crypto-result-header';
        header.textContent = 'Bcrypt Hash:';
        
        const code = document.createElement('code');
        code.className = 'crypto-result-code';
        code.textContent = result.data.hash;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm crypto-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-hash';
        copyBtn.dataset.hash = result.data.hash;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.hash);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(code);
        resultDiv.appendChild(copyBtn);
    },
    
    async verify() {
        const password = document.querySelector('[data-input="bcrypt-verify-password"]').value;
        const hash = document.querySelector('[data-input="bcrypt-verify-hash"]').value;
        const resultDiv = document.getElementById('bcrypt-verify-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Verifying...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/crypto/bcrypt/verify', 'POST', { 
            password, 
            hash 
        });
        
        resultDiv.innerHTML = '';
        resultDiv.textContent = result.data.valid ? '✅ Password matches hash!' : '❌ Password does NOT match hash';
        resultDiv.className = result.data.valid ? 'ittools-result crypto-result' : 'ittools-result crypto-result error';
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('bcrypt-tool', {
    name: 'Bcrypt Hash & Verify',
    category: 'crypto',
    render: ITTools.Implementations.BcryptTool.render.bind(ITTools.Implementations.BcryptTool),
    init: ITTools.Implementations.BcryptTool.init.bind(ITTools.Implementations.BcryptTool)
});

// ============================================
// ULID Generator
// ============================================
ITTools.Implementations.ULIDGenerator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/ulid-generator.html',

    async render() {
        const response = await fetch(this.templateUrl);
        return await response.text();
    },

    init() {
        this.attachEventListeners();
    },

    attachEventListeners() {
        const container = document.getElementById('ittools-main-content');
        container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'generate-ulid') {
                this.generate();
            } else if (action.dataset.action === 'copy-ulid') {
                this.copyToClipboard(action.dataset.ulid);
            }
        });
    },

    async generate() {
        const count = document.querySelector('[data-input="ulid-count"]').value;
        const resultDiv = document.getElementById('ulid-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Generating ULIDs...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/crypto/ulid/generate', 'POST', { 
            count: parseInt(count) 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'crypto-result-header';
        header.textContent = `${result.data.ulids.length} ULID(s) Generated:`;
        resultDiv.appendChild(header);
        
        for (const ulid of result.data.ulids) {
            const item = document.createElement('div');
            item.className = 'ulid-item';
            
            const code = document.createElement('code');
            code.className = 'ulid-code';
            code.textContent = ulid;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'ittools-btn ittools-btn-sm ulid-copy-btn';
            copyBtn.textContent = '📋';
            copyBtn.dataset.action = 'copy-ulid';
            copyBtn.dataset.ulid = ulid;
            copyBtn.addEventListener('click', () => {
                this.copyToClipboard(ulid);
            });
            
            item.appendChild(code);
            item.appendChild(copyBtn);
            resultDiv.appendChild(item);
        }
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('ulid-generator', {
    name: 'ULID Generator',
    category: 'crypto',
    render: ITTools.Implementations.ULIDGenerator.render.bind(ITTools.Implementations.ULIDGenerator),
    init: ITTools.Implementations.ULIDGenerator.init.bind(ITTools.Implementations.ULIDGenerator)
});

// ============================================
// BIP39 Generator
// ============================================
ITTools.Implementations.BIP39Generator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/bip39-generator.html',

    async render() {
        const response = await fetch(this.templateUrl);
        return await response.text();
    },

    init() {
        this.attachEventListeners();
    },

    attachEventListeners() {
        const container = document.getElementById('ittools-main-content');
        container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'generate-bip39') {
                this.generate();
            } else if (action.dataset.action === 'copy-bip39') {
                this.copyToClipboard(action.dataset.mnemonic);
            }
        });
    },

    async generate() {
        const wordCount = document.querySelector('[data-input="bip39-words"]').value;
        const resultDiv = document.getElementById('bip39-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Generating mnemonic...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/crypto/bip39/generate', 'POST', { 
            words: parseInt(wordCount) 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'crypto-result-header';
        header.textContent = `BIP39 Mnemonic (${wordCount} words):`;
        resultDiv.appendChild(header);
        
        const code = document.createElement('code');
        code.className = 'crypto-result-code';
        code.textContent = result.data.mnemonic;
        resultDiv.appendChild(code);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm crypto-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-bip39';
        copyBtn.dataset.mnemonic = result.data.mnemonic;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.mnemonic);
        });
        resultDiv.appendChild(copyBtn);
        
        const warning = document.createElement('p');
        warning.className = 'crypto-result-warning';
        warning.textContent = '⚠️ Store this safely! Never share your mnemonic phrase.';
        resultDiv.appendChild(warning);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('bip39-generator', {
    name: 'BIP39 Passphrase',
    category: 'crypto',
    render: ITTools.Implementations.BIP39Generator.render.bind(ITTools.Implementations.BIP39Generator),
    init: ITTools.Implementations.BIP39Generator.init.bind(ITTools.Implementations.BIP39Generator)
});

console.log('ITTools Crypto Implementations loaded');
