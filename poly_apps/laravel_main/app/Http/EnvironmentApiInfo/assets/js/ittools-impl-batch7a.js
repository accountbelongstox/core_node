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

console.log('ITTools Batch 7a loaded (ascii-binary, base64-encoder, url-encoder, html-encoder, nato-converter)');
