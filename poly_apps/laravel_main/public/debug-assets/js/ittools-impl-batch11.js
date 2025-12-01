// ============================================
// NAMESPACE: ITTools.Implementations.Batch11
// FILE: ittools-impl-batch11.js
// PURPOSE: QR Scanner, Keyword tools, JSON converters
// ============================================

// ============================================
// QR Scanner
// ============================================
ITTools.Tools.Registry.register('qr-scanner', {
    name: 'QR Code Scanner',
    category: 'utility',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">QR Code Scanner</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload QR Code Image:</label>
                        <input type="file" id="qr-scan-file" class="ittools-input" accept="image/*" onchange="ITTools.Implementations.QrScanner.scan(this)">
                    </div>
                    <div id="qr-scan-preview" style="margin:15px 0;text-align:center;"></div>
                    <div id="qr-scan-result" class="ittools-result" style="display: none;"></div>
                    <p style="color:#666;font-size:12px;margin-top:10px;">Note: Uses external API for QR decoding. For privacy, use client-side libraries in production.</p>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QrScanner = {
    scan(input) {
        const file = input.files[0];
        if (!file) return;
        const preview = document.getElementById('qr-scan-preview');
        preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width:200px;border:1px solid #ddd;border-radius:5px;">';
        const formData = new FormData();
        formData.append('file', file);
        ITTools.UI.showResult('qr-scan-result', 'Scanning...', true);
        fetch('https://api.qrserver.com/v1/read-qr-code/', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                const result = data[0]?.symbol[0];
                if (result?.data) {
                    ITTools.UI.showResult('qr-scan-result', `<strong>Decoded:</strong><br><code style="word-break:break-all;background:#f8f9fa;padding:10px;display:block;border-radius:4px;">${result.data}</code><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.data.replace(/`/g,'\\`')}\`)" style="margin-top:10px;">Copy</button>`, true);
                } else {
                    ITTools.UI.showResult('qr-scan-result', 'Could not decode QR code', false);
                }
            })
            .catch(e => ITTools.UI.showResult('qr-scan-result', 'Error scanning: ' + e.message, false));
    }
};

// ============================================
// Keyword Density Checker
// ============================================
ITTools.Tools.Registry.register('keyword-density', {
    name: 'Keyword Density Checker',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Keyword Density Checker</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Content:</label>
                        <textarea id="kw-density-input" class="ittools-textarea" rows="6" placeholder="Paste your content here..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.KeywordDensity.analyze()">Analyze</button>
                    </div>
                    <div id="kw-density-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.KeywordDensity = {
    analyze() {
        const text = document.getElementById('kw-density-input').value.toLowerCase();
        if (!text.trim()) { ITTools.UI.showResult('kw-density-result', 'Please enter content', false); return; }
        const words = text.match(/\b[a-z]{2,}\b/g) || [];
        const totalWords = words.length;
        const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'is', 'are', 'was', 'were', 'been']);
        const freq = {};
        words.filter(w => !stopWords.has(w)).forEach(w => freq[w] = (freq[w] || 0) + 1);
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
        const html = `
            <div style="margin-bottom:15px;"><strong>Total Words:</strong> ${totalWords}</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#667eea;color:white;"><th style="padding:10px;text-align:left;">Keyword</th><th style="padding:10px;">Count</th><th style="padding:10px;">Density</th></tr></thead>
                <tbody>
                    ${sorted.map(([w, c]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${w}</td><td style="padding:8px;text-align:center;">${c}</td><td style="padding:8px;text-align:center;">${(c/totalWords*100).toFixed(2)}%</td></tr>`).join('')}
                </tbody>
            </table>
        `;
        ITTools.UI.showResult('kw-density-result', html, true);
    }
};

// ============================================
// Keyword Density Tool (duplicate menu item)
// ============================================
ITTools.Tools.Registry.register('keyword-density-tool', {
    name: 'Keyword Density Checker',
    category: 'seo',
    render() { return ITTools.Tools.Registry.get('keyword-density').render(); }
});

// ============================================
// JSON to YAML
// ============================================
ITTools.Tools.Registry.register('json-yaml', {
    name: 'JSON to YAML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON ⇄ YAML Converter</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON:</label>
                            <textarea id="json-yaml-json" class="ittools-textarea" rows="10" placeholder='{"key": "value"}'></textarea>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">YAML:</label>
                            <textarea id="json-yaml-yaml" class="ittools-textarea" rows="10" placeholder="key: value"></textarea>
                        </div>
                    </div>
                    <div class="ittools-btn-group" style="justify-content:center;">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JsonYaml.toYaml()">JSON → YAML</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.JsonYaml.toJson()">YAML → JSON</button>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JsonYaml = {
    toYaml() {
        const json = document.getElementById('json-yaml-json').value;
        try {
            const obj = JSON.parse(json);
            document.getElementById('json-yaml-yaml').value = this.objToYaml(obj, 0);
        } catch (e) { alert('Invalid JSON: ' + e.message); }
    },
    toJson() {
        const yaml = document.getElementById('json-yaml-yaml').value;
        try {
            const obj = this.yamlToObj(yaml);
            document.getElementById('json-yaml-json').value = JSON.stringify(obj, null, 2);
        } catch (e) { alert('Invalid YAML: ' + e.message); }
    },
    objToYaml(obj, indent) {
        const spaces = '  '.repeat(indent);
        if (Array.isArray(obj)) {
            return obj.map(item => spaces + '- ' + (typeof item === 'object' ? '\n' + this.objToYaml(item, indent + 1) : item)).join('\n');
        }
        return Object.entries(obj).map(([k, v]) => {
            if (typeof v === 'object' && v !== null) return spaces + k + ':\n' + this.objToYaml(v, indent + 1);
            return spaces + k + ': ' + (typeof v === 'string' && v.includes(':') ? '"' + v + '"' : v);
        }).join('\n');
    },
    yamlToObj(yaml) {
        const result = {};
        const lines = yaml.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        lines.forEach(line => {
            const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
            if (match) {
                const [, , key, value] = match;
                result[key.trim()] = value.trim() || null;
            }
        });
        return result;
    }
};

// ============================================
// JSON to XML
// ============================================
ITTools.Tools.Registry.register('json-xml', {
    name: 'JSON to XML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON ⇄ XML Converter</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON:</label>
                            <textarea id="json-xml-json" class="ittools-textarea" rows="10" placeholder='{"key": "value"}'></textarea>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">XML:</label>
                            <textarea id="json-xml-xml" class="ittools-textarea" rows="10" placeholder="<root><key>value</key></root>"></textarea>
                        </div>
                    </div>
                    <div class="ittools-btn-group" style="justify-content:center;">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JsonXml.toXml()">JSON → XML</button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.JsonXml.toJson()">XML → JSON</button>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JsonXml = {
    toXml() {
        const json = document.getElementById('json-xml-json').value;
        try {
            const obj = JSON.parse(json);
            const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n' + this.objToXml(obj, 1) + '</root>';
            document.getElementById('json-xml-xml').value = xml;
        } catch (e) { alert('Invalid JSON: ' + e.message); }
    },
    toJson() {
        const xml = document.getElementById('json-xml-xml').value;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const obj = this.xmlToObj(doc.documentElement);
            document.getElementById('json-xml-json').value = JSON.stringify(obj, null, 2);
        } catch (e) { alert('Invalid XML: ' + e.message); }
    },
    objToXml(obj, indent) {
        const spaces = '  '.repeat(indent);
        return Object.entries(obj).map(([k, v]) => {
            if (Array.isArray(v)) return v.map(item => spaces + `<${k}>${typeof item === 'object' ? '\n' + this.objToXml(item, indent+1) + spaces : item}</${k}>`).join('\n');
            if (typeof v === 'object' && v !== null) return spaces + `<${k}>\n${this.objToXml(v, indent+1)}${spaces}</${k}>`;
            return spaces + `<${k}>${v}</${k}>`;
        }).join('\n') + '\n';
    },
    xmlToObj(node) {
        const obj = {};
        for (const child of node.children) {
            const key = child.tagName;
            const value = child.children.length ? this.xmlToObj(child) : child.textContent;
            if (obj[key]) {
                if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
                obj[key].push(value);
            } else obj[key] = value;
        }
        return obj;
    }
};

// ============================================
// Markdown to HTML
// ============================================
ITTools.Tools.Registry.register('markdown-html', {
    name: 'Markdown to HTML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Markdown to HTML Converter</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Markdown:</label>
                            <textarea id="md-html-md" class="ittools-textarea" rows="10" placeholder="# Heading\n\n**Bold** and *italic*" oninput="ITTools.Implementations.MarkdownHtml.convert()"></textarea>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">HTML Output:</label>
                            <textarea id="md-html-html" class="ittools-textarea" rows="10" readonly style="background:#f8f9fa;"></textarea>
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Preview:</label>
                        <div id="md-html-preview" style="background:#f8f9fa;padding:15px;border-radius:5px;min-height:100px;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MarkdownHtml = {
    convert() {
        let md = document.getElementById('md-html-md').value;
        let html = md
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';
        document.getElementById('md-html-html').value = html;
        document.getElementById('md-html-preview').innerHTML = html;
    }
};

// ============================================
// Random Port Generator
// ============================================
ITTools.Tools.Registry.register('random-port', {
    name: 'Random Port',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Random Port Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Min Port:</label>
                            <input type="number" id="port-min" class="ittools-input" value="1024" min="1" max="65535">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Max Port:</label>
                            <input type="number" id="port-max" class="ittools-input" value="65535" min="1" max="65535">
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.RandomPort.generate()">Generate Port</button>
                    </div>
                    <div id="port-result" style="text-align:center;margin-top:20px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RandomPort = {
    generate() {
        const min = parseInt(document.getElementById('port-min').value) || 1024;
        const max = parseInt(document.getElementById('port-max').value) || 65535;
        const port = Math.floor(Math.random() * (max - min + 1)) + min;
        document.getElementById('port-result').innerHTML = `
            <div style="font-size:48px;font-weight:bold;color:#667eea;">${port}</div>
            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${port}')" style="margin-top:10px;">Copy</button>
        `;
    }
};

console.log('ITTools Batch 11 loaded (qr-scanner, keyword-density, keyword-density-tool, json-yaml, json-xml, markdown-html, random-port)');
