// ============================================
// NAMESPACE: ITTools.Implementations.Text
// FILE: ittools-impl-text.js  
// PURPOSE: Text tool implementations
// ============================================

// ============================================
// String Obfuscator
// ============================================
ITTools.Tools.Registry.register('string-obfuscator', {
    name: 'String Obfuscator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">String Obfuscator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input String:</label>
                        <textarea id="obfuscate-input" class="ittools-textarea" rows="6" placeholder="Hello World"></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Obfuscation Method:</label>
                        <select id="obfuscate-method" class="ittools-input">
                            <option value="hex">Hex Encoding</option>
                            <option value="unicode">Unicode Escape</option>
                            <option value="binary">Binary</option>
                            <option value="reverse">Reverse + Base64</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.StringObfuscator.obfuscate()">
                            🔒 Obfuscate
                        </button>
                    </div>
                    <div id="obfuscate-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.StringObfuscator = {
    obfuscate() {
        const input = document.getElementById('obfuscate-input').value;
        const method = document.getElementById('obfuscate-method').value;
        
        if (!input) {
            ITTools.UI.showResult('obfuscate-result', 'Please enter a string', false);
            return;
        }
        
        let result = '';
        let methodName = '';
        
        switch(method) {
            case 'hex':
                result = Array.from(input).map(char => '\\x' + char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                methodName = 'Hex Encoding';
                break;
            case 'unicode':
                result = Array.from(input).map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
                methodName = 'Unicode Escape';
                break;
            case 'binary':
                result = Array.from(input).map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
                methodName = 'Binary';
                break;
            case 'reverse':
                const reversed = input.split('').reverse().join('');
                result = btoa(reversed);
                methodName = 'Reverse + Base64';
                break;
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Method: ${methodName}</strong><br>
                <textarea class="ittools-textarea" rows="8" readonly>${result}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('obfuscate-result', html, true);
    }
};

// ============================================
// Numeronym Generator
// ============================================
ITTools.Tools.Registry.register('numeronym-generator', {
    name: 'Numeronym Generator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Numeronym Generator (i18n → i12n)</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="numeronym-input" class="ittools-textarea" rows="6" placeholder="internationalization&#10;localization&#10;accessibility"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.NumeronymGenerator.generate()">
                            🔢 Generate Numeronym
                        </button>
                    </div>
                    <div id="numeronym-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.NumeronymGenerator = {
    generate() {
        const input = document.getElementById('numeronym-input').value;
        
        if (!input) {
            ITTools.UI.showResult('numeronym-result', 'Please enter text', false);
            return;
        }
        
        const lines = input.split('\n').filter(line => line.trim());
        const results = lines.map(word => {
            const trimmed = word.trim();
            if (trimmed.length <= 3) {
                return { word: trimmed, numeronym: trimmed, count: 0 };
            }
            const first = trimmed[0];
            const last = trimmed[trimmed.length - 1];
            const count = trimmed.length - 2;
            const numeronym = `${first}${count}${last}`;
            return { word: trimmed, numeronym, count };
        });
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>${results.length} Numeronym(s) Generated:</strong>
                <div style="margin-top: 15px;">
                    ${results.map(({ word, numeronym, count }) => `
                        <div style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: #666;">${word}</span>
                                <span style="margin: 0 10px;">→</span>
                                <span style="font-weight: bold; color: #667eea;">${numeronym}</span>
                                <span style="margin-left: 10px; font-size: 12px; color: #999;">(${count} chars)</span>
                            </div>
                            <button onclick="ITTools.UI.copyToClipboard('${numeronym}')" class="ittools-btn ittools-btn-sm">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('numeronym-result', html, true);
    }
};

console.log('ITTools Text Implementations loaded');
