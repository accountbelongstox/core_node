// ============================================
// NAMESPACE: ITTools.Implementations.Generators2
// FILE: ittools-impl-generators-2.js  
// PURPOSE: Additional generator tool implementations
// ============================================

// ============================================
// RSA Key Pair Generator
// ============================================
ITTools.Tools.Registry.register('rsa-generator', {
    name: 'RSA Key Pair Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">RSA Key Pair Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Key Size:</label>
                        <select id="rsa-key-size" class="ittools-input">
                            <option value="2048" selected>2048 bits (Recommended)</option>
                            <option value="3072">3072 bits (More Secure)</option>
                            <option value="4096">4096 bits (Maximum)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.RSAGenerator.generate()">
                            🔐 Generate Key Pair
                        </button>
                    </div>
                    <div id="rsa-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RSAGenerator = {
    async generate() {
        const keySize = document.getElementById('rsa-key-size').value;
        
        ITTools.UI.showLoading('rsa-result', 'Generating RSA key pair (this may take a moment)...');
        
        try {
            const response = await APIClient.post('/api/ittools/v1/crypto/rsa/generate', { key_size: parseInt(keySize) }, { includeAuth: false });
            const result = await response.json();
            
            if (result.success) {
                const html = `
                    <div style="margin-top: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">🔑 Private Key</h4>
                        <textarea class="ittools-textarea" rows="10" readonly>${result.data.private_key}</textarea>
                        <button onclick="ITTools.UI.copyToClipboard(\`${result.data.private_key.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 5px;">📋 Copy Private Key</button>
                        
                        <h4 style="color: #667eea; margin: 20px 0 10px;">🔓 Public Key</h4>
                        <textarea class="ittools-textarea" rows="8" readonly>${result.data.public_key}</textarea>
                        <button onclick="ITTools.UI.copyToClipboard(\`${result.data.public_key.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 5px;">📋 Copy Public Key</button>
                        
                        <p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; font-size: 12px;">
                            ⚠️ <strong>Important:</strong> Keep your private key secure and never share it. The public key can be shared freely.
                        </p>
                    </div>
                `;
                ITTools.UI.showResult('rsa-result', html, true);
            } else {
                ITTools.UI.showResult('rsa-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('rsa-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// OTP Code Generator
// ============================================
ITTools.Tools.Registry.register('otp-generator', {
    name: 'OTP Code Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">OTP Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Code Length:</label>
                        <select id="otp-length" class="ittools-input">
                            <option value="4">4 digits</option>
                            <option value="6" selected>6 digits</option>
                            <option value="8">8 digits</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Number of Codes:</label>
                        <input type="number" id="otp-count" class="ittools-input" value="5" min="1" max="20">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.OTPGenerator.generate()">
                            🔢 Generate OTP Codes
                        </button>
                    </div>
                    <div id="otp-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.OTPGenerator = {
    async generate() {
        const length = document.getElementById('otp-length').value;
        const count = document.getElementById('otp-count').value;
        
        ITTools.UI.showLoading('otp-result', 'Generating OTP codes...');
        
        try {
            const response = await APIClient.post('/api/ittools/v1/crypto/otp/generate', { length: parseInt(length), count: parseInt(count) }, { includeAuth: false });
            const result = await response.json();
            
            if (result.success) {
                const codes = result.data.codes || [result.data.otp];
                const html = `
                    <div style="margin-top: 15px;">
                        <strong>${codes.length} OTP Code(s) Generated:</strong>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 15px;">
                            ${codes.map(code => `
                                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                                    ${code}
                                </div>
                            `).join('')}
                        </div>
                        <button onclick="ITTools.UI.copyToClipboard('${codes.join(', ')}')" class="ittools-btn ittools-btn-sm" style="margin-top: 15px;">📋 Copy All</button>
                    </div>
                `;
                ITTools.UI.showResult('otp-result', html, true);
            } else {
                ITTools.UI.showResult('otp-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('otp-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Open Graph Meta Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('og-meta-generator', {
    name: 'Open Graph Meta',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Open Graph Meta Tags Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Title:</label>
                        <input type="text" id="og-title" class="ittools-input" placeholder="Page Title">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Description:</label>
                        <textarea id="og-description" class="ittools-textarea" rows="3" placeholder="Page description"></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">URL:</label>
                        <input type="url" id="og-url" class="ittools-input" placeholder="https://example.com">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Image URL:</label>
                        <input type="url" id="og-image" class="ittools-input" placeholder="https://example.com/image.jpg">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Type:</label>
                        <select id="og-type" class="ittools-input">
                            <option value="website">Website</option>
                            <option value="article">Article</option>
                            <option value="product">Product</option>
                            <option value="video">Video</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Site Name:</label>
                        <input type="text" id="og-sitename" class="ittools-input" placeholder="Your Site Name">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.OGMetaGenerator.generate()">
                            🏷️ Generate Meta Tags
                        </button>
                    </div>
                    <div id="og-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.OGMetaGenerator = {
    generate() {
        const title = document.getElementById('og-title').value;
        const description = document.getElementById('og-description').value;
        const url = document.getElementById('og-url').value;
        const image = document.getElementById('og-image').value;
        const type = document.getElementById('og-type').value;
        const siteName = document.getElementById('og-sitename').value;
        
        if (!title) {
            ITTools.UI.showResult('og-result', 'Please enter at least a title', false);
            return;
        }
        
        let meta = '<!-- Open Graph Meta Tags -->\n';
        meta += `<meta property="og:title" content="${title}">\n`;
        if (description) meta += `<meta property="og:description" content="${description}">\n`;
        if (url) meta += `<meta property="og:url" content="${url}">\n`;
        if (image) meta += `<meta property="og:image" content="${image}">\n`;
        meta += `<meta property="og:type" content="${type}">\n`;
        if (siteName) meta += `<meta property="og:site_name" content="${siteName}">\n`;
        
        meta += '\n<!-- Twitter Card Meta Tags -->\n';
        meta += '<meta name="twitter:card" content="summary_large_image">\n';
        meta += `<meta name="twitter:title" content="${title}">\n`;
        if (description) meta += `<meta name="twitter:description" content="${description}">\n`;
        if (image) meta += `<meta name="twitter:image" content="${image}">`;
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Meta Tags:</strong>
                <textarea class="ittools-textarea" rows="12" readonly>${meta}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${meta.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy All</button>
            </div>
        `;
        
        ITTools.UI.showResult('og-result', html, true);
    }
};

console.log('ITTools Additional Generators Implementations loaded');
