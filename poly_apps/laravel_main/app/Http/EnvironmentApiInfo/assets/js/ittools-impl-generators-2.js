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
            const response = await fetch('/api/ittools/v1/crypto/rsa/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_size: parseInt(keySize) })
            });
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
            const response = await fetch('/api/ittools/v1/crypto/otp/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ length: parseInt(length), count: parseInt(count) })
            });
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
// SVG Placeholder Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('svg-placeholder', {
    name: 'SVG Placeholder',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">SVG Placeholder Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Width:</label>
                        <input type="number" id="svg-width" class="ittools-input" value="400" min="1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Height:</label>
                        <input type="number" id="svg-height" class="ittools-input" value="300" min="1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Background Color:</label>
                        <input type="color" id="svg-bg-color" class="ittools-input" value="#cccccc">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text Color:</label>
                        <input type="color" id="svg-text-color" class="ittools-input" value="#666666">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Custom Text (optional):</label>
                        <input type="text" id="svg-text" class="ittools-input" placeholder="Leave empty for dimensions">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.SVGPlaceholder.generate()">
                            🖼️ Generate SVG
                        </button>
                    </div>
                    <div id="svg-result" style="margin-top: 20px; text-align: center;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.SVGPlaceholder = {
    generate() {
        const width = document.getElementById('svg-width').value;
        const height = document.getElementById('svg-height').value;
        const bgColor = document.getElementById('svg-bg-color').value;
        const textColor = document.getElementById('svg-text-color').value;
        const customText = document.getElementById('svg-text').value;
        
        const text = customText || `${width}×${height}`;
        const fontSize = Math.min(width, height) / 8;
        
        const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${bgColor}"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
        
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);
        
        document.getElementById('svg-result').innerHTML = `
            <img src="${dataUrl}" alt="SVG Placeholder" style="max-width: 100%; border: 1px solid #ddd; border-radius: 5px;">
            <p style="margin-top: 15px;"><strong>SVG Code:</strong></p>
            <textarea class="ittools-textarea" rows="8" readonly>${svg}</textarea>
            <div class="ittools-btn-group" style="margin-top: 10px;">
                <button onclick="ITTools.UI.copyToClipboard(\`${svg.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm">📋 Copy SVG</button>
                <button onclick="ITTools.UI.copyToClipboard('${dataUrl}')" class="ittools-btn ittools-btn-sm">📋 Copy Data URL</button>
            </div>
        `;
    }
};

// ============================================
// Crontab Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('crontab-generator', {
    name: 'Crontab Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Crontab Expression Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Minute (0-59):</label>
                        <input type="text" id="cron-minute" class="ittools-input" value="*" placeholder="* or 0-59">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Hour (0-23):</label>
                        <input type="text" id="cron-hour" class="ittools-input" value="*" placeholder="* or 0-23">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Day of Month (1-31):</label>
                        <input type="text" id="cron-day" class="ittools-input" value="*" placeholder="* or 1-31">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Month (1-12):</label>
                        <input type="text" id="cron-month" class="ittools-input" value="*" placeholder="* or 1-12">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Day of Week (0-7, 0=Sunday):</label>
                        <input type="text" id="cron-dow" class="ittools-input" value="*" placeholder="* or 0-7">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Quick Presets:</label>
                        <select id="cron-preset" class="ittools-input" onchange="ITTools.Implementations.CrontabGenerator.applyPreset()">
                            <option value="">-- Select Preset --</option>
                            <option value="* * * * *">Every Minute</option>
                            <option value="0 * * * *">Hourly</option>
                            <option value="0 0 * * *">Daily at Midnight</option>
                            <option value="0 0 * * 0">Weekly on Sunday</option>
                            <option value="0 0 1 * *">Monthly on 1st</option>
                            <option value="0 0 1 1 *">Yearly on Jan 1st</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.CrontabGenerator.generate()">
                            ⏰ Generate Crontab
                        </button>
                    </div>
                    <div id="cron-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.CrontabGenerator = {
    applyPreset() {
        const preset = document.getElementById('cron-preset').value;
        if (!preset) return;
        
        const parts = preset.split(' ');
        document.getElementById('cron-minute').value = parts[0];
        document.getElementById('cron-hour').value = parts[1];
        document.getElementById('cron-day').value = parts[2];
        document.getElementById('cron-month').value = parts[3];
        document.getElementById('cron-dow').value = parts[4];
        
        this.generate();
    },
    
    generate() {
        const minute = document.getElementById('cron-minute').value || '*';
        const hour = document.getElementById('cron-hour').value || '*';
        const day = document.getElementById('cron-day').value || '*';
        const month = document.getElementById('cron-month').value || '*';
        const dow = document.getElementById('cron-dow').value || '*';
        
        const cron = `${minute} ${hour} ${day} ${month} ${dow}`;
        const description = this.describeCron(minute, hour, day, month, dow);
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Crontab Expression</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; font-family: monospace;">${cron}</div>
                    <button onclick="ITTools.UI.copyToClipboard('${cron}')" class="ittools-btn ittools-btn-sm" style="background: rgba(255,255,255,0.2); border: none;">📋 Copy</button>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <strong>Description:</strong><br>${description}
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px;">
                    <strong>Format:</strong><br>
                    <code style="font-size: 12px;">minute hour day month day-of-week</code>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('cron-result', html, true);
    },
    
    describeCron(minute, hour, day, month, dow) {
        let desc = 'Runs ';
        
        if (minute === '*' && hour === '*' && day === '*' && month === '*' && dow === '*') {
            return 'Runs every minute';
        }
        
        if (minute !== '*') desc += `at minute ${minute} `;
        else desc += 'every minute ';
        
        if (hour !== '*') desc += `at hour ${hour} `;
        if (day !== '*') desc += `on day ${day} `;
        if (month !== '*') desc += `in month ${month} `;
        if (dow !== '*') desc += `on weekday ${dow}`;
        
        return desc.trim();
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
