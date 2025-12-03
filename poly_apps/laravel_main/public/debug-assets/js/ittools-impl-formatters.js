// ============================================
// NAMESPACE: ITTools.Implementations.Formatters
// FILE: ittools-impl-formatters.js  
// PURPOSE: Formatter tool implementations
// ============================================

// ============================================
// XML Formatter
// ============================================
ITTools.Implementations.XMLFormatter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/xml-formatter.html',

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

            if (action.dataset.action === 'format-xml') {
                this.format();
            } else if (action.dataset.action === 'copy-xml') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    async format() {
        const input = document.querySelector('[data-input="xml-input"]').value;
        const resultDiv = document.getElementById('xml-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Formatting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/xml/format', 'POST', { 
            xml: input 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Formatted XML:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 15;
        textarea.readOnly = true;
        textarea.value = result.data.formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-xml';
        copyBtn.dataset.content = result.data.formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('xml-formatter', {
    name: 'XML Formatter',
    category: 'formatter',
    render: ITTools.Implementations.XMLFormatter.render.bind(ITTools.Implementations.XMLFormatter),
    init: ITTools.Implementations.XMLFormatter.init.bind(ITTools.Implementations.XMLFormatter)
});

// ============================================
// YAML Formatter
// ============================================
ITTools.Implementations.YAMLFormatter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/yaml-formatter.html',

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

            if (action.dataset.action === 'format-yaml') {
                this.format();
            } else if (action.dataset.action === 'copy-yaml') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    async format() {
        const input = document.querySelector('[data-input="yaml-input"]').value;
        const resultDiv = document.getElementById('yaml-format-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Formatting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/yaml/format', 'POST', { 
            yaml: input 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Formatted YAML:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 15;
        textarea.readOnly = true;
        textarea.value = result.data.formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-yaml';
        copyBtn.dataset.content = result.data.formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('yaml-formatter', {
    name: 'YAML Formatter',
    category: 'formatter',
    render: ITTools.Implementations.YAMLFormatter.render.bind(ITTools.Implementations.YAMLFormatter),
    init: ITTools.Implementations.YAMLFormatter.init.bind(ITTools.Implementations.YAMLFormatter)
});

// ============================================
// SQL Formatter
// ============================================
ITTools.Implementations.SQLFormatter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/sql-formatter.html',

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

            if (action.dataset.action === 'format-sql') {
                this.format();
            } else if (action.dataset.action === 'copy-sql') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    async format() {
        const input = document.querySelector('[data-input="sql-input"]').value;
        const resultDiv = document.getElementById('sql-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        resultDiv.textContent = 'Formatting...';
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/sql/format', 'POST', { 
            sql: input 
        });
        
        resultDiv.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Formatted SQL:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 15;
        textarea.readOnly = true;
        textarea.value = result.data.formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-sql';
        copyBtn.dataset.content = result.data.formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(result.data.formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('sql-formatter', {
    name: 'SQL Formatter',
    category: 'formatter',
    render: ITTools.Implementations.SQLFormatter.render.bind(ITTools.Implementations.SQLFormatter),
    init: ITTools.Implementations.SQLFormatter.init.bind(ITTools.Implementations.SQLFormatter)
});

// ============================================
// HTML Formatter (Client-side)
// ============================================
ITTools.Implementations.HTMLFormatter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/html-formatter.html',

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

            if (action.dataset.action === 'format-html') {
                this.format();
            } else if (action.dataset.action === 'minify-html') {
                this.minify();
            } else if (action.dataset.action === 'copy-html') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    format() {
        const input = document.querySelector('[data-input="html-input"]').value;
        const resultDiv = document.getElementById('html-format-result');
        
        const formatted = this.beautifyHTML(input);
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Formatted HTML:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 15;
        textarea.readOnly = true;
        textarea.value = formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-html';
        copyBtn.dataset.content = formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },
    
    minify() {
        const input = document.querySelector('[data-input="html-input"]').value;
        const resultDiv = document.getElementById('html-format-result');
        
        const minified = input.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Minified HTML:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 8;
        textarea.readOnly = true;
        textarea.value = minified;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-html';
        copyBtn.dataset.content = minified;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(minified);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },
    
    beautifyHTML(html) {
        let formatted = '';
        let indent = 0;
        const tab = '  ';
        
        html.split(/>\s*</).forEach((node, index) => {
            if (index > 0) formatted += '>';
            if (index < html.split(/>\s*</).length - 1) formatted += '\n';
            
            if (/^\/\w/.test(node)) {
                indent--;
            }
            
            formatted += tab.repeat(Math.max(0, indent)) + '<' + node;
            
            if (!/^(br|hr|img|input|link|meta|!|area|base|col|command|embed|keygen|param|source|track|wbr)/.test(node) && !/\/$/.test(node)) {
                if (!/^\//.test(node)) {
                    indent++;
                }
            }
        });
        
        return formatted.trim();
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('html-formatter', {
    name: 'HTML Formatter',
    category: 'formatter',
    render: ITTools.Implementations.HTMLFormatter.render.bind(ITTools.Implementations.HTMLFormatter),
    init: ITTools.Implementations.HTMLFormatter.init.bind(ITTools.Implementations.HTMLFormatter)
});

// ============================================
// CSS Formatter (Client-side)
// ============================================
ITTools.Implementations.CSSFormatter = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/css-formatter.html',

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

            if (action.dataset.action === 'format-css') {
                this.format();
            } else if (action.dataset.action === 'minify-css') {
                this.minify();
            } else if (action.dataset.action === 'copy-css') {
                this.copyToClipboard(action.dataset.content);
            }
        });
    },

    format() {
        const input = document.querySelector('[data-input="css-input"]').value;
        const resultDiv = document.getElementById('css-format-result');
        
        const formatted = input
            .replace(/\s*\{\s*/g, ' {\n  ')
            .replace(/\s*\}\s*/g, '\n}\n\n')
            .replace(/\s*;\s*/g, ';\n  ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*:\s*/g, ': ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Formatted CSS:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 15;
        textarea.readOnly = true;
        textarea.value = formatted;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-css';
        copyBtn.dataset.content = formatted;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(formatted);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },
    
    minify() {
        const input = document.querySelector('[data-input="css-input"]').value;
        const resultDiv = document.getElementById('css-format-result');
        
        const minified = input
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}:;,])\s*/g, '$1')
            .trim();
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'formatter-result-header';
        header.textContent = 'Minified CSS:';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea formatter-result-textarea';
        textarea.rows = 8;
        textarea.readOnly = true;
        textarea.value = minified;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm formatter-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.dataset.action = 'copy-css';
        copyBtn.dataset.content = minified;
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(minified);
        });
        
        resultDiv.appendChild(header);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    },

    async copyToClipboard(text) {
        await navigator.clipboard.writeText(text);
    }
};

ITTools.Tools.Registry.register('css-formatter', {
    name: 'CSS Formatter',
    category: 'formatter',
    render: ITTools.Implementations.CSSFormatter.render.bind(ITTools.Implementations.CSSFormatter),
    init: ITTools.Implementations.CSSFormatter.init.bind(ITTools.Implementations.CSSFormatter)
});

console.log('ITTools Formatter Implementations loaded');
