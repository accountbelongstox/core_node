// ============================================
// NAMESPACE: ITTools.Implementations.Batch13
// FILE: ittools-impl-batch13.js
// PURPOSE: Query String Parser, Mime Types
// ============================================

// ============================================
// Query String Parser
// ============================================
ITTools.Tools.Registry.register('query-string-parser', {
    name: 'Query String Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Query String Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Query String or Full URL:</label>
                        <input type="text" id="qs-input" class="ittools-input" placeholder="?foo=bar&baz=qux or https://example.com?foo=bar" oninput="ITTools.Implementations.QueryStringParser.parse()">
                    </div>
                    <div id="qs-result" style="margin-top:15px;"></div>
                    <hr style="margin:20px 0;">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Build Query String:</label>
                        <div id="qs-builder">
                            <div style="display:flex;gap:10px;margin-bottom:10px;">
                                <input type="text" class="ittools-input qs-key" placeholder="Key" style="flex:1;">
                                <input type="text" class="ittools-input qs-val" placeholder="Value" style="flex:1;">
                                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.QueryStringParser.addRow()">+</button>
                            </div>
                        </div>
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QueryStringParser.build()">Build</button>
                    </div>
                    <div id="qs-built" class="ittools-result" style="display:none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QueryStringParser = {
    parse() {
        let input = document.getElementById('qs-input').value.trim();
        if (!input) { document.getElementById('qs-result').innerHTML = ''; return; }
        if (input.includes('?')) input = input.split('?')[1];
        if (input.includes('#')) input = input.split('#')[0];
        const params = new URLSearchParams(input);
        const entries = [...params.entries()];
        if (!entries.length) { document.getElementById('qs-result').innerHTML = '<span style="color:#666;">No parameters found</span>'; return; }
        const html = `
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#667eea;color:white;"><th style="padding:10px;text-align:left;">Key</th><th style="padding:10px;text-align:left;">Value</th></tr></thead>
                <tbody>${entries.map(([k, v]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><code>${k}</code></td><td style="padding:8px;">${v}</td></tr>`).join('')}</tbody>
            </table>
        `;
        document.getElementById('qs-result').innerHTML = html;
    },
    addRow() {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;';
        row.innerHTML = '<input type="text" class="ittools-input qs-key" placeholder="Key" style="flex:1;"><input type="text" class="ittools-input qs-val" placeholder="Value" style="flex:1;"><button class="ittools-btn ittools-btn-sm" onclick="this.parentElement.remove()">-</button>';
        document.getElementById('qs-builder').appendChild(row);
    },
    build() {
        const keys = document.querySelectorAll('.qs-key');
        const vals = document.querySelectorAll('.qs-val');
        const params = new URLSearchParams();
        keys.forEach((k, i) => { if (k.value.trim()) params.append(k.value.trim(), vals[i].value); });
        const qs = params.toString();
        ITTools.UI.showResult('qs-built', `<code style="word-break:break-all;">?${qs}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('?${qs}')" style="margin-top:10px;">Copy</button>`, true);
    }
};

console.log('ITTools Batch 13 loaded (query-string-parser)');
