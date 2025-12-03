// ============================================
// NAMESPACE: ITTools.Implementations.Text
// FILE: ittools-impl-text.js  
// PURPOSE: Text tool implementations
// ============================================

// ============================================
// String Obfuscator
// ============================================
ITTools.Implementations.StringObfuscator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/string-obfuscator.html',

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

            if (action.dataset.action === 'obfuscate') {
                this.obfuscate();
            }
        });
    },

    obfuscate() {
        const input = document.querySelector('[data-input="obfuscate-input"]').value;
        const method = document.querySelector('[data-input="obfuscate-method"]').value;
        const resultDiv = document.getElementById('obfuscate-result');
        
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
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const methodLabel = document.createElement('div');
        methodLabel.className = 'text-result-method';
        methodLabel.textContent = `Method: ${methodName}`;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'ittools-textarea';
        textarea.rows = 8;
        textarea.readOnly = true;
        textarea.value = result;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ittools-btn ittools-btn-sm text-result-copy-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(result).then(() => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => {
                    copyBtn.textContent = '📋 Copy';
                }, 2000);
            });
        });
        
        resultDiv.appendChild(methodLabel);
        resultDiv.appendChild(textarea);
        resultDiv.appendChild(copyBtn);
    }
};

ITTools.Tools.Registry.register('string-obfuscator', {
    name: 'String Obfuscator',
    category: 'text',
    render: ITTools.Implementations.StringObfuscator.render.bind(ITTools.Implementations.StringObfuscator),
    init: ITTools.Implementations.StringObfuscator.init.bind(ITTools.Implementations.StringObfuscator)
});

// ============================================
// Numeronym Generator
// ============================================
ITTools.Implementations.NumeronymGenerator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/numeronym-generator.html',

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

            if (action.dataset.action === 'generate-numeronym') {
                this.generate();
            }

            if (action.dataset.action === 'copy-numeronym') {
                const numeronym = action.dataset.numeronym;
                navigator.clipboard.writeText(numeronym).then(() => {
                    action.textContent = '✓';
                    setTimeout(() => {
                        action.textContent = '📋';
                    }, 2000);
                });
            }
        });
    },

    generate() {
        const input = document.querySelector('[data-input="numeronym-input"]').value;
        const resultDiv = document.getElementById('numeronym-result');
        
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
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'text-result-method';
        header.textContent = `${results.length} Numeronym(s) Generated:`;
        resultDiv.appendChild(header);
        
        const container = document.createElement('div');
        container.className = 'text-result-content';
        
        for (const { word, numeronym, count } of results) {
            const item = document.createElement('div');
            item.className = 'numeronym-item';
            
            const left = document.createElement('div');
            const wordSpan = document.createElement('span');
            wordSpan.className = 'numeronym-word';
            wordSpan.textContent = word;
            
            const arrow = document.createElement('span');
            arrow.className = 'numeronym-arrow';
            arrow.textContent = '→';
            
            const resultSpan = document.createElement('span');
            resultSpan.className = 'numeronym-result';
            resultSpan.textContent = numeronym;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'numeronym-count';
            countSpan.textContent = `(${count} chars)`;
            
            left.appendChild(wordSpan);
            left.appendChild(arrow);
            left.appendChild(resultSpan);
            left.appendChild(countSpan);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'ittools-btn ittools-btn-sm numeronym-copy-btn';
            copyBtn.textContent = '📋';
            copyBtn.dataset.action = 'copy-numeronym';
            copyBtn.dataset.numeronym = numeronym;
            
            item.appendChild(left);
            item.appendChild(copyBtn);
            container.appendChild(item);
        }
        
        resultDiv.appendChild(container);
    }
};

ITTools.Tools.Registry.register('numeronym-generator', {
    name: 'Numeronym Generator',
    category: 'text',
    render: ITTools.Implementations.NumeronymGenerator.render.bind(ITTools.Implementations.NumeronymGenerator),
    init: ITTools.Implementations.NumeronymGenerator.init.bind(ITTools.Implementations.NumeronymGenerator)
});

console.log('ITTools Text Implementations loaded');
