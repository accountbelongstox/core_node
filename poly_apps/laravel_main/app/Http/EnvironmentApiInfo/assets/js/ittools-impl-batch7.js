// ============================================
// NAMESPACE: ITTools.Implementations.Batch7
// FILE: ittools-impl-batch7.js
// PURPOSE: Text tools, converters, generators
// ============================================

// ============================================
// ASCII Binary Converter
// ============================================
ITTools.Tools.Registry.register('ascii-binary', {
    name: 'Text to ASCII Binary',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text to ASCII Binary Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="ascii-binary-input" class="ittools-textarea" rows="4" placeholder="Enter text to convert..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.AsciiBinary.toBinary()">Text to Binary</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.AsciiBinary.toText()">Binary to Text</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.AsciiBinary.toHex()">Text to Hex</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.AsciiBinary.toDecimal()">Text to Decimal</button>
                    </div>
                    <div id="ascii-binary-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.AsciiBinary = {
    toBinary() {
        const input = document.getElementById('ascii-binary-input').value;
        if (!input) { ITTools.UI.showResult('ascii-binary-result', 'Please enter text', false); return; }
        const binary = input.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        ITTools.UI.showResult('ascii-binary-result', `<strong>Binary:</strong><br><code style="word-break:break-all;">${binary}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${binary.replace(/'/g, "\\'")}')">Copy</button>`, true);
    },
    toText() {
        const input = document.getElementById('ascii-binary-input').value.replace(/\s+/g, ' ').trim();
        try {
            const text = input.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
            ITTools.UI.showResult('ascii-binary-result', `<strong>Text:</strong> ${text}<br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${text.replace(/'/g, "\\'")}')">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('ascii-binary-result', 'Invalid binary input', false); }
    },
    toHex() {
        const input = document.getElementById('ascii-binary-input').value;
        if (!input) { ITTools.UI.showResult('ascii-binary-result', 'Please enter text', false); return; }
        const hex = input.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        ITTools.UI.showResult('ascii-binary-result', `<strong>Hex:</strong><br><code>${hex}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${hex}')">Copy</button>`, true);
    },
    toDecimal() {
        const input = document.getElementById('ascii-binary-input').value;
        if (!input) { ITTools.UI.showResult('ascii-binary-result', 'Please enter text', false); return; }
        const decimal = input.split('').map(c => c.charCodeAt(0)).join(' ');
        ITTools.UI.showResult('ascii-binary-result', `<strong>Decimal:</strong><br><code>${decimal}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${decimal}')">Copy</button>`, true);
    }
};

// ============================================
// Base64 Encoder/Decoder
// ============================================
ITTools.Tools.Registry.register('base64-encoder', {
    name: 'Base64 Encoder/Decoder',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Base64 Encoder/Decoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input:</label>
                        <textarea id="base64-input" class="ittools-textarea" rows="4" placeholder="Enter text or base64 string..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.Base64Encoder.encode()">Encode</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.Base64Encoder.decode()">Decode</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.Base64Encoder.encodeUrl()">URL-Safe Encode</button>
                    </div>
                    <div id="base64-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.Base64Encoder = {
    encode() {
        const input = document.getElementById('base64-input').value;
        if (!input) { ITTools.UI.showResult('base64-result', 'Please enter text', false); return; }
        try {
            const encoded = btoa(unescape(encodeURIComponent(input)));
            ITTools.UI.showResult('base64-result', `<strong>Encoded:</strong><br><code style="word-break:break-all;">${encoded}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${encoded}')">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('base64-result', 'Encoding error: ' + e.message, false); }
    },
    decode() {
        const input = document.getElementById('base64-input').value;
        if (!input) { ITTools.UI.showResult('base64-result', 'Please enter base64', false); return; }
        try {
            const decoded = decodeURIComponent(escape(atob(input.replace(/-/g, '+').replace(/_/g, '/'))));
            const escaped = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            ITTools.UI.showResult('base64-result', `<strong>Decoded:</strong><br><pre style="white-space:pre-wrap;word-break:break-all;">${escaped}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${decoded.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('base64-result', 'Invalid base64 input', false); }
    },
    encodeUrl() {
        const input = document.getElementById('base64-input').value;
        if (!input) { ITTools.UI.showResult('base64-result', 'Please enter text', false); return; }
        const encoded = btoa(unescape(encodeURIComponent(input))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        ITTools.UI.showResult('base64-result', `<strong>URL-Safe Encoded:</strong><br><code style="word-break:break-all;">${encoded}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${encoded}')">Copy</button>`, true);
    }
};

// ============================================
// URL Encoder/Decoder
// ============================================
ITTools.Tools.Registry.register('url-encoder', {
    name: 'URL Encoder/Decoder',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">URL Encoder/Decoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input:</label>
                        <textarea id="url-encode-input" class="ittools-textarea" rows="4" placeholder="Enter text or URL encoded string..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.UrlEncoder.encode()">Encode</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.UrlEncoder.decode()">Decode</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.UrlEncoder.encodeComponent()">Encode Component</button>
                    </div>
                    <div id="url-encode-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UrlEncoder = {
    encode() {
        const input = document.getElementById('url-encode-input').value;
        if (!input) { ITTools.UI.showResult('url-encode-result', 'Please enter text', false); return; }
        const encoded = encodeURI(input);
        ITTools.UI.showResult('url-encode-result', `<strong>Encoded:</strong><br><code style="word-break:break-all;">${encoded}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${encoded.replace(/'/g, "\\'")}')">Copy</button>`, true);
    },
    decode() {
        const input = document.getElementById('url-encode-input').value;
        if (!input) { ITTools.UI.showResult('url-encode-result', 'Please enter encoded URL', false); return; }
        try {
            const decoded = decodeURIComponent(input);
            const escaped = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            ITTools.UI.showResult('url-encode-result', `<strong>Decoded:</strong><br><pre style="white-space:pre-wrap;">${escaped}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${decoded.replace(/`/g, '\\`')}\`)">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('url-encode-result', 'Invalid URL encoded input', false); }
    },
    encodeComponent() {
        const input = document.getElementById('url-encode-input').value;
        if (!input) { ITTools.UI.showResult('url-encode-result', 'Please enter text', false); return; }
        const encoded = encodeURIComponent(input);
        ITTools.UI.showResult('url-encode-result', `<strong>Encoded Component:</strong><br><code style="word-break:break-all;">${encoded}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${encoded.replace(/'/g, "\\'")}')">Copy</button>`, true);
    }
};

// ============================================
// HTML Encoder
// ============================================
ITTools.Tools.Registry.register('html-encoder', {
    name: 'HTML Entities Encoder',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTML Entities Encoder/Decoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input:</label>
                        <textarea id="html-encode-input" class="ittools-textarea" rows="4" placeholder="Enter HTML or encoded entities..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.HtmlEncoder.encode()">Encode</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.HtmlEncoder.decode()">Decode</button>
                    </div>
                    <div id="html-encode-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HtmlEncoder = {
    encode() {
        const input = document.getElementById('html-encode-input').value;
        if (!input) { ITTools.UI.showResult('html-encode-result', 'Please enter text', false); return; }
        const encoded = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        ITTools.UI.showResult('html-encode-result', `<strong>Encoded:</strong><br><pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;">${encoded.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${encoded.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">Copy</button>`, true);
    },
    decode() {
        const input = document.getElementById('html-encode-input').value;
        if (!input) { ITTools.UI.showResult('html-encode-result', 'Please enter encoded HTML', false); return; }
        const textarea = document.createElement('textarea');
        textarea.innerHTML = input;
        const decoded = textarea.value;
        const escaped = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        ITTools.UI.showResult('html-encode-result', `<strong>Decoded:</strong><br><pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;">${escaped}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${decoded.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">Copy</button>`, true);
    }
};

// ============================================
// NATO Alphabet Converter
// ============================================
ITTools.Tools.Registry.register('nato-converter', {
    name: 'Text to NATO Alphabet',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">NATO Phonetic Alphabet Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="nato-input" class="ittools-textarea" rows="3" placeholder="Enter text to convert..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.NatoConverter.convert()">Convert to NATO</button>
                    </div>
                    <div id="nato-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.NatoConverter = {
    alphabet: {
        'A': 'Alfa', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
        'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel', 'I': 'India', 'J': 'Juliet',
        'K': 'Kilo', 'L': 'Lima', 'M': 'Mike', 'N': 'November', 'O': 'Oscar',
        'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
        'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee',
        'Z': 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three',
        '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
    },
    convert() {
        const input = document.getElementById('nato-input').value.toUpperCase();
        if (!input) { ITTools.UI.showResult('nato-result', 'Please enter text', false); return; }
        const result = input.split('').map(char => {
            if (char === ' ') return '<span style="color:#999;">(space)</span>';
            return this.alphabet[char] || `<span style="color:#dc3545;">[${char}]</span>`;
        }).join(' ');
        ITTools.UI.showResult('nato-result', `<div style="font-size:16px;line-height:2;">${result}</div>`, true);
    }
};

// ============================================
// Timestamp Converter
// ============================================
ITTools.Tools.Registry.register('timestamp-converter', {
    name: 'Timestamp Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Unix Timestamp Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Current Timestamp:</label>
                        <div style="font-size:24px;font-weight:bold;color:#667eea;" id="current-timestamp">${Math.floor(Date.now()/1000)}</div>
                        <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.TimestampConverter.copyNow()">Copy</button>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Unix Timestamp (seconds):</label>
                        <input type="number" id="timestamp-input" class="ittools-input" placeholder="1699999999">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Or Date/Time:</label>
                        <input type="datetime-local" id="datetime-input" class="ittools-input">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TimestampConverter.toDate()">Timestamp to Date</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.TimestampConverter.toTimestamp()">Date to Timestamp</button>
                    </div>
                    <div id="timestamp-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TimestampConverter = {
    copyNow() {
        const ts = Math.floor(Date.now()/1000);
        ITTools.UI.copyToClipboard(ts.toString());
    },
    toDate() {
        const ts = parseInt(document.getElementById('timestamp-input').value);
        if (!ts) { ITTools.UI.showResult('timestamp-result', 'Please enter timestamp', false); return; }
        const date = new Date(ts * 1000);
        const html = `
            <div style="display:grid;gap:10px;">
                <div><strong>Local:</strong> ${date.toLocaleString()}</div>
                <div><strong>UTC:</strong> ${date.toUTCString()}</div>
                <div><strong>ISO:</strong> ${date.toISOString()}</div>
                <div><strong>Relative:</strong> ${this.relative(date)}</div>
            </div>
        `;
        ITTools.UI.showResult('timestamp-result', html, true);
    },
    toTimestamp() {
        const dt = document.getElementById('datetime-input').value;
        if (!dt) { ITTools.UI.showResult('timestamp-result', 'Please select date/time', false); return; }
        const ts = Math.floor(new Date(dt).getTime() / 1000);
        ITTools.UI.showResult('timestamp-result', `<strong>Unix Timestamp:</strong> <code style="font-size:20px;">${ts}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${ts}')">Copy</button>`, true);
    },
    relative(date) {
        const diff = Date.now() - date.getTime();
        const abs = Math.abs(diff);
        const future = diff < 0;
        const units = [
            { name: 'year', ms: 31536000000 },
            { name: 'month', ms: 2592000000 },
            { name: 'day', ms: 86400000 },
            { name: 'hour', ms: 3600000 },
            { name: 'minute', ms: 60000 },
            { name: 'second', ms: 1000 }
        ];
        for (const unit of units) {
            if (abs >= unit.ms) {
                const val = Math.floor(abs / unit.ms);
                return future ? `in ${val} ${unit.name}${val>1?'s':''}` : `${val} ${unit.name}${val>1?'s':''} ago`;
            }
        }
        return 'just now';
    }
};

setInterval(() => {
    const el = document.getElementById('current-timestamp');
    if (el) el.textContent = Math.floor(Date.now()/1000);
}, 1000);

// ============================================
// Text Diff
// ============================================
ITTools.Tools.Registry.register('text-diff', {
    name: 'Text Diff',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text Diff Comparison</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Original Text:</label>
                            <textarea id="diff-original" class="ittools-textarea" rows="8" placeholder="Original text..."></textarea>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Modified Text:</label>
                            <textarea id="diff-modified" class="ittools-textarea" rows="8" placeholder="Modified text..."></textarea>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TextDiff.compare()">Compare</button>
                    </div>
                    <div id="diff-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TextDiff = {
    compare() {
        const original = document.getElementById('diff-original').value.split('\n');
        const modified = document.getElementById('diff-modified').value.split('\n');
        const maxLen = Math.max(original.length, modified.length);
        let html = '<div style="font-family:monospace;background:#f8f9fa;padding:10px;border-radius:4px;max-height:400px;overflow:auto;">';
        for (let i = 0; i < maxLen; i++) {
            const orig = original[i] || '';
            const mod = modified[i] || '';
            if (orig === mod) {
                html += `<div style="padding:2px 5px;">${i+1}: ${this.escape(orig) || '&nbsp;'}</div>`;
            } else if (!orig) {
                html += `<div style="background:#d4edda;padding:2px 5px;"><span style="color:#28a745;">+</span> ${i+1}: ${this.escape(mod)}</div>`;
            } else if (!mod) {
                html += `<div style="background:#f8d7da;padding:2px 5px;"><span style="color:#dc3545;">-</span> ${i+1}: ${this.escape(orig)}</div>`;
            } else {
                html += `<div style="background:#f8d7da;padding:2px 5px;"><span style="color:#dc3545;">-</span> ${i+1}: ${this.escape(orig)}</div>`;
                html += `<div style="background:#d4edda;padding:2px 5px;"><span style="color:#28a745;">+</span> ${i+1}: ${this.escape(mod)}</div>`;
            }
        }
        html += '</div>';
        const stats = `<div style="margin-bottom:10px;"><strong>Lines:</strong> Original: ${original.length}, Modified: ${modified.length}</div>`;
        ITTools.UI.showResult('diff-result', stats + html, true);
    },
    escape(str) { return str.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
};

// ============================================
// Text Stats
// ============================================
ITTools.Tools.Registry.register('text-stats', {
    name: 'Text Statistics',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text Statistics</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="text-stats-input" class="ittools-textarea" rows="6" placeholder="Enter text to analyze..." oninput="ITTools.Implementations.TextStats.analyze()"></textarea>
                    </div>
                    <div id="text-stats-result" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TextStats = {
    analyze() {
        const text = document.getElementById('text-stats-input').value;
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, '').length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim()).length;
        const lines = text.split('\n').length;
        const readingTime = Math.ceil(words / 200);
        const speakingTime = Math.ceil(words / 150);
        const html = `
            <div style="background:#667eea;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${chars}</div><div>Characters</div></div>
            <div style="background:#28a745;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${charsNoSpace}</div><div>Chars (no space)</div></div>
            <div style="background:#17a2b8;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${words}</div><div>Words</div></div>
            <div style="background:#ffc107;color:#333;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${sentences}</div><div>Sentences</div></div>
            <div style="background:#6c757d;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${paragraphs}</div><div>Paragraphs</div></div>
            <div style="background:#fd7e14;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${lines}</div><div>Lines</div></div>
            <div style="background:#e83e8c;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${readingTime}</div><div>Min to Read</div></div>
            <div style="background:#6f42c1;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${speakingTime}</div><div>Min to Speak</div></div>
        `;
        document.getElementById('text-stats-result').innerHTML = html;
    }
};

// ============================================
// Lorem Ipsum Generator
// ============================================
ITTools.Tools.Registry.register('lorem-generator', {
    name: 'Lorem Ipsum Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Lorem Ipsum Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Amount:</label>
                            <input type="number" id="lorem-amount" class="ittools-input" value="3" min="1" max="100">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Type:</label>
                            <select id="lorem-type" class="ittools-input">
                                <option value="paragraphs">Paragraphs</option>
                                <option value="sentences">Sentences</option>
                                <option value="words">Words</option>
                            </select>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.LoremGenerator.generate()">Generate</button>
                    </div>
                    <div id="lorem-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.LoremGenerator = {
    words: ['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit','voluptate','velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt','mollit','anim','id','est','laborum'],
    getWord() { return this.words[Math.floor(Math.random() * this.words.length)]; },
    getSentence() {
        const len = 8 + Math.floor(Math.random() * 10);
        let sentence = Array.from({length: len}, () => this.getWord()).join(' ');
        return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
    },
    getParagraph() { return Array.from({length: 4 + Math.floor(Math.random() * 4)}, () => this.getSentence()).join(' '); },
    generate() {
        const amount = parseInt(document.getElementById('lorem-amount').value) || 3;
        const type = document.getElementById('lorem-type').value;
        let result = '';
        if (type === 'paragraphs') result = Array.from({length: amount}, () => this.getParagraph()).join('\n\n');
        else if (type === 'sentences') result = Array.from({length: amount}, () => this.getSentence()).join(' ');
        else result = Array.from({length: amount}, () => this.getWord()).join(' ');
        ITTools.UI.showResult('lorem-result', `<pre style="white-space:pre-wrap;background:#f8f9fa;padding:15px;border-radius:5px;">${result}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g, '\\`')}\`)">Copy</button>`, true);
    }
};

console.log('ITTools Batch 7 loaded (ascii-binary, base64-encoder, url-encoder, html-encoder, nato-converter, timestamp-converter, text-diff, text-stats, lorem-generator)');
