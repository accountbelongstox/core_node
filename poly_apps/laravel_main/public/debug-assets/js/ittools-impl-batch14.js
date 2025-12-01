// ============================================
// NAMESPACE: ITTools.Implementations.Batch14
// FILE: ittools-impl-batch14.js
// PURPOSE: Menu ID aliases and remaining tools
// ============================================

// ============================================
// Alias registrations for menu ID mismatches
// ============================================

// docker-converter -> docker-run-to-compose
if (ITTools.Tools.Registry.get('docker-run-to-compose')) {
    ITTools.Tools.Registry.register('docker-converter', ITTools.Tools.Registry.get('docker-run-to-compose'));
}

// color-blindness -> color-blindness-simulator
if (ITTools.Tools.Registry.get('color-blindness-simulator')) {
    ITTools.Tools.Registry.register('color-blindness', ITTools.Tools.Registry.get('color-blindness-simulator'));
}

// json-csv -> json-to-csv
if (ITTools.Tools.Registry.get('json-to-csv')) {
    ITTools.Tools.Registry.register('json-csv', ITTools.Tools.Registry.get('json-to-csv'));
}

// ipv6-ula -> ipv6-ula-generator
if (ITTools.Tools.Registry.get('ipv6-ula-generator')) {
    ITTools.Tools.Registry.register('ipv6-ula', ITTools.Tools.Registry.get('ipv6-ula-generator'));
}

// pdf-unlock -> unlock-pdf
if (ITTools.Tools.Registry.get('unlock-pdf')) {
    ITTools.Tools.Registry.register('pdf-unlock', ITTools.Tools.Registry.get('unlock-pdf'));
}

// ============================================
// Case Converter
// ============================================
ITTools.Tools.Registry.register('case-converter', {
    name: 'Case Converter',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text Case Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="case-input" class="ittools-textarea" rows="4" placeholder="Enter text to convert..."></textarea>
                    </div>
                    <div class="ittools-btn-group" style="flex-wrap:wrap;">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.CaseConverter.convert('lower')">lowercase</button>
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.CaseConverter.convert('upper')">UPPERCASE</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('title')">Title Case</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('sentence')">Sentence case</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('camel')">camelCase</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('pascal')">PascalCase</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('snake')">snake_case</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('kebab')">kebab-case</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.CaseConverter.convert('constant')">CONSTANT_CASE</button>
                    </div>
                    <div id="case-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.CaseConverter = {
    convert(type) {
        const input = document.getElementById('case-input').value;
        if (!input) { ITTools.UI.showResult('case-result', 'Please enter text', false); return; }
        let result;
        const words = input.trim().split(/[\s_\-]+/).filter(w => w);
        switch (type) {
            case 'lower': result = input.toLowerCase(); break;
            case 'upper': result = input.toUpperCase(); break;
            case 'title': result = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); break;
            case 'sentence': result = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase(); break;
            case 'camel': result = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''); break;
            case 'pascal': result = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''); break;
            case 'snake': result = words.map(w => w.toLowerCase()).join('_'); break;
            case 'kebab': result = words.map(w => w.toLowerCase()).join('-'); break;
            case 'constant': result = words.map(w => w.toUpperCase()).join('_'); break;
        }
        ITTools.UI.showResult('case-result', `<pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;">${result}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g,'\\`')}\`)">Copy</button>`, true);
    }
};

// ============================================
// Color Converter
// ============================================
ITTools.Tools.Registry.register('color-converter', {
    name: 'Color Converter',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Color Format Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Pick Color:</label>
                        <input type="color" id="color-picker" class="ittools-input" value="#667eea" style="width:100px;height:50px;cursor:pointer;" onchange="ITTools.Implementations.ColorConverter.convert()">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Or Enter HEX:</label>
                        <input type="text" id="color-hex-input" class="ittools-input" placeholder="#667eea" oninput="ITTools.Implementations.ColorConverter.fromHex()">
                    </div>
                    <div id="color-convert-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ColorConverter = {
    convert() {
        const hex = document.getElementById('color-picker').value;
        document.getElementById('color-hex-input').value = hex;
        this.showResults(hex);
    },
    fromHex() {
        let hex = document.getElementById('color-hex-input').value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            document.getElementById('color-picker').value = hex;
            this.showResults(hex);
        }
    },
    showResults(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        let h = 0, s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            const rr = r / 255, gg = g / 255, bb = b / 255;
            if (rr === max) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
            else if (gg === max) h = ((bb - rr) / d + 2) / 6;
            else h = ((rr - gg) / d + 4) / 6;
        }
        h = Math.round(h * 360); s = Math.round(s * 100); const ll = Math.round(l * 100);
        const html = `
            <div style="display:grid;gap:10px;">
                <div style="height:80px;background:${hex};border-radius:5px;box-shadow:0 2px 5px rgba(0,0,0,0.2);"></div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;display:flex;justify-content:space-between;">
                    <span><strong>HEX:</strong> ${hex}</span>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${hex}')">Copy</button>
                </div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;display:flex;justify-content:space-between;">
                    <span><strong>RGB:</strong> rgb(${r}, ${g}, ${b})</span>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('rgb(${r}, ${g}, ${b})')">Copy</button>
                </div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;display:flex;justify-content:space-between;">
                    <span><strong>HSL:</strong> hsl(${h}, ${s}%, ${ll}%)</span>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('hsl(${h}, ${s}%, ${ll}%)')">Copy</button>
                </div>
            </div>
        `;
        document.getElementById('color-convert-result').innerHTML = html;
    }
};

// ============================================
// Slugify String
// ============================================
ITTools.Tools.Registry.register('slugify', {
    name: 'Slugify String',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">URL Slug Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <input type="text" id="slug-input" class="ittools-input" placeholder="Enter text to slugify..." oninput="ITTools.Implementations.Slugify.convert()">
                    </div>
                    <div id="slug-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.Slugify = {
    convert() {
        const input = document.getElementById('slug-input').value;
        if (!input) { document.getElementById('slug-result').innerHTML = ''; return; }
        const slug = input.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        document.getElementById('slug-result').innerHTML = `
            <div style="background:#667eea;color:white;padding:20px;border-radius:5px;text-align:center;">
                <div style="font-size:12px;opacity:0.8;">URL Slug</div>
                <div style="font-size:24px;font-weight:bold;font-family:monospace;word-break:break-all;">${slug}</div>
                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${slug}')" style="background:rgba(255,255,255,0.2);border:none;margin-top:10px;">Copy</button>
            </div>
        `;
    }
};

// ============================================
// Token Generator (Simple)
// ============================================
ITTools.Tools.Registry.register('token-generator', {
    name: 'Token Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Token Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Length:</label>
                            <input type="number" id="token-length" class="ittools-input" value="32" min="8" max="256">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Format:</label>
                            <select id="token-format" class="ittools-input">
                                <option value="hex">Hexadecimal</option>
                                <option value="base64">Base64</option>
                                <option value="alphanumeric">Alphanumeric</option>
                            </select>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TokenGenerator.generate()">Generate Token</button>
                    </div>
                    <div id="token-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TokenGenerator = {
    generate() {
        const length = parseInt(document.getElementById('token-length').value) || 32;
        const format = document.getElementById('token-format').value;
        let token = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        if (format === 'hex') {
            token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
        } else if (format === 'base64') {
            token = btoa(String.fromCharCode.apply(null, array)).slice(0, length);
        } else {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            token = Array.from(array).map(b => chars[b % chars.length]).join('').slice(0, length);
        }
        ITTools.UI.showResult('token-result', `<code style="word-break:break-all;background:#f8f9fa;padding:15px;display:block;border-radius:4px;font-size:14px;">${token}</code><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${token}')" style="margin-top:10px;">Copy</button>`, true);
    }
};

// ============================================
// HMAC Generator
// ============================================
ITTools.Tools.Registry.register('hmac-generator', {
    name: 'HMAC Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HMAC Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Message:</label>
                        <textarea id="hmac-message" class="ittools-textarea" rows="3" placeholder="Enter message..."></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Secret Key:</label>
                        <input type="text" id="hmac-key" class="ittools-input" placeholder="Enter secret key...">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Algorithm:</label>
                        <select id="hmac-algo" class="ittools-input">
                            <option value="SHA-256">HMAC-SHA256</option>
                            <option value="SHA-384">HMAC-SHA384</option>
                            <option value="SHA-512">HMAC-SHA512</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.HmacGenerator.generate()">Generate HMAC</button>
                    </div>
                    <div id="hmac-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HmacGenerator = {
    async generate() {
        const message = document.getElementById('hmac-message').value;
        const key = document.getElementById('hmac-key').value;
        const algo = document.getElementById('hmac-algo').value;
        if (!message || !key) { ITTools.UI.showResult('hmac-result', 'Please enter message and key', false); return; }
        try {
            const enc = new TextEncoder();
            const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: algo }, false, ['sign']);
            const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
            const hash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
            ITTools.UI.showResult('hmac-result', `<strong>${algo}:</strong><br><code style="word-break:break-all;background:#f8f9fa;padding:10px;display:block;border-radius:4px;">${hash}</code><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${hash}')" style="margin-top:10px;">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('hmac-result', 'Error: ' + e.message, false); }
    }
};

// ============================================
// Password Analyzer (detailed)
// ============================================
ITTools.Tools.Registry.register('password-analyzer', {
    name: 'Password Strength Analyzer',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Password Strength Analyzer</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Enter Password:</label>
                        <input type="text" id="pwd-analyze-input" class="ittools-input" placeholder="Enter password..." oninput="ITTools.Implementations.PasswordAnalyzer.analyze()">
                    </div>
                    <div id="pwd-analyze-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PasswordAnalyzer = {
    analyze() {
        const pwd = document.getElementById('pwd-analyze-input').value;
        if (!pwd) { document.getElementById('pwd-analyze-result').innerHTML = ''; return; }
        const length = pwd.length;
        const hasLower = /[a-z]/.test(pwd);
        const hasUpper = /[A-Z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
        const hasRepeat = /(.)\1{2,}/.test(pwd);
        const hasSequence = /(abc|bcd|cde|123|234|345|qwe|wer)/i.test(pwd);
        const charsetSize = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasNumber ? 10 : 0) + (hasSymbol ? 32 : 0);
        const entropy = Math.log2(Math.pow(charsetSize, length));
        const crackTime = Math.pow(2, entropy) / 1e10;
        let timeStr = crackTime < 1 ? 'Instant' : crackTime < 60 ? `${Math.round(crackTime)} seconds` : crackTime < 3600 ? `${Math.round(crackTime/60)} minutes` : crackTime < 86400 ? `${Math.round(crackTime/3600)} hours` : crackTime < 31536000 ? `${Math.round(crackTime/86400)} days` : crackTime < 3153600000 ? `${Math.round(crackTime/31536000)} years` : 'Centuries+';
        const score = Math.min(100, Math.round(entropy / 1.28));
        const color = score < 30 ? '#dc3545' : score < 60 ? '#ffc107' : score < 80 ? '#28a745' : '#20c997';
        const html = `
            <div style="background:${color};color:white;padding:20px;border-radius:5px;text-align:center;margin-bottom:15px;">
                <div style="font-size:48px;font-weight:bold;">${score}%</div>
                <div>Strength Score</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;"><strong>Length:</strong> ${length} chars</div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;"><strong>Entropy:</strong> ${entropy.toFixed(1)} bits</div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;"><strong>Charset:</strong> ${charsetSize} chars</div>
                <div style="background:#f8f9fa;padding:10px;border-radius:4px;"><strong>Crack time:</strong> ${timeStr}</div>
            </div>
            <div style="margin-top:15px;">
                <div style="padding:5px;background:${hasLower?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${hasLower?'✓':'✗'} Lowercase letters</div>
                <div style="padding:5px;background:${hasUpper?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${hasUpper?'✓':'✗'} Uppercase letters</div>
                <div style="padding:5px;background:${hasNumber?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${hasNumber?'✓':'✗'} Numbers</div>
                <div style="padding:5px;background:${hasSymbol?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${hasSymbol?'✓':'✗'} Special characters</div>
                <div style="padding:5px;background:${!hasRepeat?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${!hasRepeat?'✓':'✗'} No repeated characters</div>
                <div style="padding:5px;background:${!hasSequence?'#d4edda':'#f8d7da'};border-radius:3px;margin:2px 0;">${!hasSequence?'✓':'✗'} No common sequences</div>
            </div>
        `;
        document.getElementById('pwd-analyze-result').innerHTML = html;
    }
};

// ============================================
// Category placeholders for special menu items
// ============================================
ITTools.Tools.Registry.register('color-tools-advanced', {
    name: 'Color Tools',
    category: 'color',
    render() { return '<div class="ittools-card"><div class="ittools-card-header">Color Tools</div><div class="ittools-card-body"><p>Select a specific color tool from the menu.</p></div></div>'; }
});

ITTools.Tools.Registry.register('text-tools-advanced', {
    name: 'Text Tools Advanced',
    category: 'text',
    render() { return '<div class="ittools-card"><div class="ittools-card-header">Advanced Text Tools</div><div class="ittools-card-body"><p>Select a specific text tool from the menu.</p></div></div>'; }
});

ITTools.Tools.Registry.register('utility-tools-advanced', {
    name: 'Utility Tools',
    category: 'utility',
    render() { return '<div class="ittools-card"><div class="ittools-card-header">Utility Tools</div><div class="ittools-card-body"><p>Select a specific utility tool from the menu.</p></div></div>'; }
});

console.log('ITTools Batch 14 loaded (aliases + case-converter, color-converter, slugify, token-generator, hmac-generator, password-analyzer, category placeholders)');
