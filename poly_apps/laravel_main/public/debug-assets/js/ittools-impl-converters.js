// ============================================
// NAMESPACE: ITTools.Implementations.Converters
// FILE: ittools-impl-converters.js  
// PURPOSE: Converter tool implementations
// ============================================

// ============================================
// Base Converter (Client-side)
// ============================================
ITTools.Implementations.BaseConverter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/base-converter.html',

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

            if (action.dataset.action === 'convert-base') {
                this.convert();
            }
        });
    },

    convert() {
        const input = document.querySelector('[data-input="base-input"]').value;
        const fromBase = parseInt(document.querySelector('[data-input="base-from"]').value);
        const toBase = parseInt(document.querySelector('[data-input="base-to"]').value);
        const resultDiv = document.getElementById('base-result');
        
        const result = ITTools.ClientTools.Math.convertBase(input, fromBase, toBase);
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = `Result: ${result}`;
    }
};

ITTools.Tools.Registry.register('base-converter', {
    name: 'Base Converter',
    category: 'converter',
    render: ITTools.Implementations.BaseConverter.render.bind(ITTools.Implementations.BaseConverter),
    init: ITTools.Implementations.BaseConverter.init.bind(ITTools.Implementations.BaseConverter)
});

// ============================================
// Roman Numeral Converter (Client-side)
// ============================================
ITTools.Implementations.RomanConverter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/roman-converter.html',

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

            if (action.dataset.action === 'convert-roman') {
                this.convert();
            }
        });
    },

    convert() {
        const input = document.querySelector('[data-input="roman-input"]').value.trim();
        const resultDiv = document.getElementById('roman-result');
        
        let result;
        if (/^\d+$/.test(input)) {
            result = `Roman: ${this.toRoman(parseInt(input))}`;
        } else {
            result = `Number: ${this.fromRoman(input.toUpperCase())}`;
        }
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = result;
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

ITTools.Tools.Registry.register('roman-converter', {
    name: 'Roman Numeral Converter',
    category: 'converter',
    render: ITTools.Implementations.RomanConverter.render.bind(ITTools.Implementations.RomanConverter),
    init: ITTools.Implementations.RomanConverter.init.bind(ITTools.Implementations.RomanConverter)
});

// ============================================
// JSON ⇄ YAML Converter
// ============================================
ITTools.Implementations.JSONYAMLConverter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/json-yaml-converter.html',

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
            } else if (actionName === 'json-to-yaml') {
                this.jsonToYaml();
            } else if (actionName === 'yaml-to-json') {
                this.yamlToJson();
            } else if (actionName === 'copy-json-yaml') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    switchTab(tab, button) {
        document.querySelectorAll('.converter-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'json-to-yaml') {
            document.getElementById('json-to-yaml-tab').classList.remove('hidden');
        } else {
            document.getElementById('yaml-to-json-tab').classList.remove('hidden');
        }
        button.classList.add('active');
    },
    
    async jsonToYaml() {
        const input = document.querySelector('[data-input="json-to-yaml-input"]').value;
        const resultDiv = document.getElementById('json-to-yaml-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Converting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/converter/json-to-yaml', 'POST', { 
            json: input 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'converter-result-header';
        header.textContent = 'YAML Output:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea converter-result-textarea';
        textarea.rows = 10;
        textarea.readOnly = true;
        textarea.value = result.data.yaml;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm converter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-json-yaml';
        copyBtn.dataset.content = result.data.yaml;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.yaml);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },
    
    async yamlToJson() {
        const input = document.querySelector('[data-input="yaml-to-json-input"]').value;
        const resultDiv = document.getElementById('yaml-to-json-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Converting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/converter/yaml-to-json', 'POST', { 
            yaml: input 
        });
        
        const formatted = JSON.stringify(result.data.json, null, 2);
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'converter-result-header';
        header.textContent = 'JSON Output:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea converter-result-textarea';
        textarea.rows = 10;
        textarea.readOnly = true;
        textarea.value = formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm converter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-json-yaml';
        copyBtn.dataset.content = formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('json-yaml-converter', {
    name: 'JSON ⇄ YAML',
    category: 'converter',
    render: ITTools.Implementations.JSONYAMLConverter.render.bind(ITTools.Implementations.JSONYAMLConverter),
    init: ITTools.Implementations.JSONYAMLConverter.init.bind(ITTools.Implementations.JSONYAMLConverter)
});

// ============================================
// Temperature Converter (Client-side)
// ============================================
ITTools.Implementations.TemperatureConverter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/temperature-converter.html',

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

            if (action.dataset.action === 'convert-temperature') {
                this.convert();
            }
        });
    },

    convert() {
        const value = parseFloat(document.querySelector('[data-input="temp-value"]').value);
        const from = document.querySelector('[data-input="temp-from"]').value;
        const resultDiv = document.getElementById('temp-result');
        
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
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const grid = document.createElement('div');
        grid.className = 'temp-result-grid';
        
        const celsiusItem = this.createTempItem('Celsius', celsius.toFixed(2) + '°C', 'temp-result-celsius');
        const fahrenheitItem = this.createTempItem('Fahrenheit', fahrenheit.toFixed(2) + '°F', 'temp-result-fahrenheit');
        const kelvinItem = this.createTempItem('Kelvin', kelvin.toFixed(2) + 'K', 'temp-result-kelvin');
        
        grid.appendChild(celsiusItem);
        grid.appendChild(fahrenheitItem);
        grid.appendChild(kelvinItem);
        
        resultDiv.appendChild(grid);
    },

    createTempItem(label, value, colorClass) {
        const item = document.createElement('div');
        item.className = 'temp-result-item';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'temp-result-label';
        labelDiv.textContent = label;
        
        const valueDiv = document.createElement('div');
        valueDiv.className = `temp-result-value ${colorClass}`;
        valueDiv.textContent = value;
        
        item.appendChild(labelDiv);
        item.appendChild(valueDiv);
        
        return item;
    }
};

ITTools.Tools.Registry.register('temperature-converter', {
    name: 'Temperature Converter',
    category: 'converter',
    render: ITTools.Implementations.TemperatureConverter.render.bind(ITTools.Implementations.TemperatureConverter),
    init: ITTools.Implementations.TemperatureConverter.init.bind(ITTools.Implementations.TemperatureConverter)
});

// ============================================
// Markdown to HTML
// ============================================
ITTools.Implementations.MarkdownToHTML = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/markdown-to-html.html',

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

            if (action.dataset.action === 'convert-markdown') {
                this.convert();
            } else if (action.dataset.action === 'copy-markdown') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    async convert() {
        const input = document.querySelector('[data-input="markdown-input"]').value;
        const resultDiv = document.getElementById('markdown-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Converting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/markdown/to-html', 'POST', { 
            markdown: input 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'converter-result-header';
        header.textContent = 'HTML Output:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea converter-result-textarea';
        textarea.rows = 10;
        textarea.readOnly = true;
        textarea.value = result.data.html;
        
        const previewHeader = document.createElement('h4');
        previewHeader.className = 'markdown-preview-header';
        previewHeader.textContent = 'Preview:';
        
        const preview = document.createElement('div');
        preview.className = 'markdown-preview';
        preview.innerHTML = result.data.html;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm converter-result-copy-btn';
        copyBtn.textContent = '📋 Copy HTML';
        copyBtn.dataset.action = 'copy-markdown';
        copyBtn.dataset.content = result.data.html;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.html);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(previewHeader);
        resultDiv.appendChild(preview);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('markdown-to-html', {
    name: 'Markdown → HTML',
    category: 'converter',
    render: ITTools.Implementations.MarkdownToHTML.render.bind(ITTools.Implementations.MarkdownToHTML),
    init: ITTools.Implementations.MarkdownToHTML.init.bind(ITTools.Implementations.MarkdownToHTML)
});

console.log('ITTools Converter Implementations loaded');
