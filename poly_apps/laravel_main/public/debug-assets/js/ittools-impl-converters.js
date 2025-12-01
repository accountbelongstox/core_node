// ============================================
// NAMESPACE: ITTools.Implementations.Converters
// FILE: ittools-impl-converters.js  
// PURPOSE: Converter tool implementations
// ============================================

// ============================================
// Base Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('base-converter', {
    name: 'Base Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Integer Base Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Number:</label>
                        <input type="text" id="base-input" class="ittools-input" placeholder="Enter number">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From Base (2-36):</label>
                        <input type="number" id="base-from" class="ittools-input" value="10" min="2" max="36">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">To Base (2-36):</label>
                        <input type="number" id="base-to" class="ittools-input" value="16" min="2" max="36">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BaseConverter.convert()">
                            🔄 Convert
                        </button>
                    </div>
                    <div id="base-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BaseConverter = {
    convert() {
        const input = document.getElementById('base-input').value;
        const fromBase = parseInt(document.getElementById('base-from').value);
        const toBase = parseInt(document.getElementById('base-to').value);
        
        if (!input) {
            ITTools.UI.showResult('base-result', 'Please enter a number', false);
            return;
        }
        
        try {
            const result = ITTools.ClientTools.Math.convertBase(input, fromBase, toBase);
            ITTools.UI.showResult('base-result', `Result: ${result}`, true);
        } catch (error) {
            ITTools.UI.showResult('base-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Roman Numeral Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('roman-converter', {
    name: 'Roman Numeral Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Roman Numeral Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input:</label>
                        <input type="text" id="roman-input" class="ittools-input" placeholder="42 or XLII">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.RomanConverter.convert()">
                            🔄 Convert
                        </button>
                    </div>
                    <div id="roman-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RomanConverter = {
    convert() {
        const input = document.getElementById('roman-input').value.trim();
        
        if (!input) {
            ITTools.UI.showResult('roman-result', 'Please enter a number or roman numeral', false);
            return;
        }
        
        if (/^\d+$/.test(input)) {
            const result = this.toRoman(parseInt(input));
            ITTools.UI.showResult('roman-result', `Roman: ${result}`, true);
        } else {
            const result = this.fromRoman(input.toUpperCase());
            ITTools.UI.showResult('roman-result', `Number: ${result}`, true);
        }
    },
    
    toRoman(num) {
        const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
        let result = '';
        for (const [val, letter] of map) {
            while (num >= val) {
                result += letter;
                num -= val;
            }
        }
        return result;
    },
    
    fromRoman(str) {
        const map = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let result = 0;
        for (let i = 0; i < str.length;) {
            if (i + 1 < str.length && map[str.substring(i, i + 2)]) {
                result += map[str.substring(i, i + 2)];
                i += 2;
            } else {
                result += map[str[i]];
                i++;
            }
        }
        return result;
    }
};

// ============================================
// JSON ⇄ YAML Converter
// ============================================
ITTools.Tools.Registry.register('json-yaml-converter', {
    name: 'JSON ⇄ YAML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON ⇄ YAML Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-tabs">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.JSONYAMLConverter.switchTab('json-to-yaml')">JSON → YAML</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.JSONYAMLConverter.switchTab('yaml-to-json')">YAML → JSON</button>
                    </div>
                    
                    <div id="json-to-yaml-tab" class="converter-tab-content">
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON Input:</label>
                            <textarea id="json-to-yaml-input" class="ittools-textarea" rows="10" placeholder='{"key": "value"}'></textarea>
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONYAMLConverter.jsonToYaml()">
                                → Convert to YAML
                            </button>
                        </div>
                        <div id="json-to-yaml-result" class="ittools-result" style="display: none;"></div>
                    </div>
                    
                    <div id="yaml-to-json-tab" class="converter-tab-content" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">YAML Input:</label>
                            <textarea id="yaml-to-json-input" class="ittools-textarea" rows="10" placeholder="key: value"></textarea>
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONYAMLConverter.yamlToJson()">
                                → Convert to JSON
                            </button>
                        </div>
                        <div id="yaml-to-json-result" class="ittools-result" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JSONYAMLConverter = {
    switchTab(tab) {
        document.querySelectorAll('.converter-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'json-to-yaml') {
            document.getElementById('json-to-yaml-tab').style.display = 'block';
            event.target.classList.add('active');
        } else {
            document.getElementById('yaml-to-json-tab').style.display = 'block';
            event.target.classList.add('active');
        }
    },
    
    async jsonToYaml() {
        const input = document.getElementById('json-to-yaml-input').value;
        
        if (!input) {
            ITTools.UI.showResult('json-to-yaml-result', 'Please enter JSON', false);
            return;
        }
        
        ITTools.UI.showLoading('json-to-yaml-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/json-to-yaml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('json-to-yaml-result', 
                    `<strong>YAML Output:</strong><br>
                    <textarea class="ittools-textarea" rows="10" readonly>${result.data.yaml}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.yaml.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('json-to-yaml-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('json-to-yaml-result', 'Error: ' + error.message, false);
        }
    },
    
    async yamlToJson() {
        const input = document.getElementById('yaml-to-json-input').value;
        
        if (!input) {
            ITTools.UI.showResult('yaml-to-json-result', 'Please enter YAML', false);
            return;
        }
        
        ITTools.UI.showLoading('yaml-to-json-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/yaml-to-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                const formatted = JSON.stringify(result.data.json, null, 2);
                ITTools.UI.showResult('yaml-to-json-result', 
                    `<strong>JSON Output:</strong><br>
                    <textarea class="ittools-textarea" rows="10" readonly>${formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('yaml-to-json-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('yaml-to-json-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Temperature Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('temperature-converter', {
    name: 'Temperature Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Temperature Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Temperature Value:</label>
                        <input type="number" id="temp-value" class="ittools-input" placeholder="Enter temperature" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From:</label>
                        <select id="temp-from" class="ittools-input">
                            <option value="celsius">Celsius (°C)</option>
                            <option value="fahrenheit">Fahrenheit (°F)</option>
                            <option value="kelvin">Kelvin (K)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TemperatureConverter.convert()">
                            🌡️ Convert
                        </button>
                    </div>
                    <div id="temp-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TemperatureConverter = {
    convert() {
        const value = parseFloat(document.getElementById('temp-value').value);
        const from = document.getElementById('temp-from').value;
        
        if (isNaN(value)) {
            ITTools.UI.showResult('temp-result', 'Please enter a valid temperature', false);
            return;
        }
        
        let celsius, fahrenheit, kelvin;
        
        if (from === 'celsius') {
            celsius = value;
            fahrenheit = (value * 9/5) + 32;
            kelvin = value + 273.15;
        } else if (from === 'fahrenheit') {
            celsius = (value - 32) * 5/9;
            fahrenheit = value;
            kelvin = celsius + 273.15;
        } else {
            celsius = value - 273.15;
            fahrenheit = (celsius * 9/5) + 32;
            kelvin = value;
        }
        
        const html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Celsius</div>
                    <div style="font-size: 24px; font-weight: bold; color: #007bff;">${celsius.toFixed(2)}°C</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Fahrenheit</div>
                    <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${fahrenheit.toFixed(2)}°F</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Kelvin</div>
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${kelvin.toFixed(2)}K</div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('temp-result', html, true);
    }
};

// ============================================
// Markdown to HTML
// ============================================
ITTools.Tools.Registry.register('markdown-to-html', {
    name: 'Markdown → HTML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Markdown to HTML Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Markdown Input:</label>
                        <textarea id="markdown-input" class="ittools-textarea" rows="10" placeholder="# Hello World"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.MarkdownToHTML.convert()">
                            → Convert to HTML
                        </button>
                    </div>
                    <div id="markdown-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MarkdownToHTML = {
    async convert() {
        const input = document.getElementById('markdown-input').value;
        
        if (!input) {
            ITTools.UI.showResult('markdown-result', 'Please enter Markdown', false);
            return;
        }
        
        ITTools.UI.showLoading('markdown-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/markdown/to-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('markdown-result', 
                    `<strong>HTML Output:</strong><br>
                    <textarea class="ittools-textarea" rows="10" readonly>${result.data.html}</textarea>
                    <h4 style="margin-top: 20px; color: #667eea;">Preview:</h4>
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: white; margin-top: 10px;">
                        ${result.data.html}
                    </div>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.html.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy HTML</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('markdown-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('markdown-result', 'Error: ' + error.message, false);
        }
    }
};

console.log('ITTools Converter Implementations loaded');
