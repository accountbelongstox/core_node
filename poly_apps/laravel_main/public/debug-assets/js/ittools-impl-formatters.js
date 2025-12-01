// ============================================
// NAMESPACE: ITTools.Implementations.Formatters
// FILE: ittools-impl-formatters.js  
// PURPOSE: Formatter tool implementations
// ============================================

// ============================================
// XML Formatter
// ============================================
ITTools.Tools.Registry.register('xml-formatter', {
    name: 'XML Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">XML Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">XML Input:</label>
                        <textarea id="xml-input" class="ittools-textarea" rows="10" placeholder="<root><item>value</item></root>"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.XMLFormatter.format()">
                            ✨ Format XML
                        </button>
                    </div>
                    <div id="xml-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.XMLFormatter = {
    async format() {
        const input = document.getElementById('xml-input').value;
        
        if (!input) {
            ITTools.UI.showResult('xml-result', 'Please enter XML', false);
            return;
        }
        
        ITTools.UI.showLoading('xml-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/xml/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('xml-result', 
                    `<strong>Formatted XML:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('xml-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('xml-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// YAML Formatter
// ============================================
ITTools.Tools.Registry.register('yaml-formatter', {
    name: 'YAML Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">YAML Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">YAML Input:</label>
                        <textarea id="yaml-format-input" class="ittools-textarea" rows="10" placeholder="key: value"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.YAMLFormatter.format()">
                            ✨ Format YAML
                        </button>
                    </div>
                    <div id="yaml-format-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.YAMLFormatter = {
    async format() {
        const input = document.getElementById('yaml-format-input').value;
        
        if (!input) {
            ITTools.UI.showResult('yaml-format-result', 'Please enter YAML', false);
            return;
        }
        
        ITTools.UI.showLoading('yaml-format-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/yaml/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('yaml-format-result', 
                    `<strong>Formatted YAML:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('yaml-format-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('yaml-format-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// SQL Formatter
// ============================================
ITTools.Tools.Registry.register('sql-formatter', {
    name: 'SQL Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">SQL Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">SQL Input:</label>
                        <textarea id="sql-input" class="ittools-textarea" rows="10" placeholder="SELECT * FROM users WHERE id=1"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.SQLFormatter.format()">
                            ✨ Format SQL
                        </button>
                    </div>
                    <div id="sql-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.SQLFormatter = {
    async format() {
        const input = document.getElementById('sql-input').value;
        
        if (!input) {
            ITTools.UI.showResult('sql-result', 'Please enter SQL', false);
            return;
        }
        
        ITTools.UI.showLoading('sql-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/sql/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('sql-result', 
                    `<strong>Formatted SQL:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('sql-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('sql-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// HTML Formatter (Client-side)
// ============================================
ITTools.Tools.Registry.register('html-formatter', {
    name: 'HTML Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTML Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">HTML Input:</label>
                        <textarea id="html-input" class="ittools-textarea" rows="10" placeholder="<html><head></head><body></body></html>"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.HTMLFormatter.format()">
                            ✨ Format HTML
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.HTMLFormatter.minify()">
                            🗜️ Minify HTML
                        </button>
                    </div>
                    <div id="html-format-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HTMLFormatter = {
    format() {
        const input = document.getElementById('html-input').value;
        
        if (!input) {
            ITTools.UI.showResult('html-format-result', 'Please enter HTML', false);
            return;
        }
        
        try {
            let formatted = this.beautifyHTML(input);
            
            ITTools.UI.showResult('html-format-result', 
                `<strong>Formatted HTML:</strong><br>
                <textarea class="ittools-textarea" rows="15" readonly>${formatted}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                true);
        } catch (error) {
            ITTools.UI.showResult('html-format-result', 'Error: ' + error.message, false);
        }
    },
    
    minify() {
        const input = document.getElementById('html-input').value;
        
        if (!input) {
            ITTools.UI.showResult('html-format-result', 'Please enter HTML', false);
            return;
        }
        
        const minified = input.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
        
        ITTools.UI.showResult('html-format-result', 
            `<strong>Minified HTML:</strong><br>
            <textarea class="ittools-textarea" rows="8" readonly>${minified}</textarea>
            <button onclick="ITTools.UI.copyToClipboard(\`${minified.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
            true);
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
    }
};

// ============================================
// CSS Formatter (Client-side)
// ============================================
ITTools.Tools.Registry.register('css-formatter', {
    name: 'CSS Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">CSS Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">CSS Input:</label>
                        <textarea id="css-input" class="ittools-textarea" rows="10" placeholder="body{margin:0;padding:0}"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.CSSFormatter.format()">
                            ✨ Format CSS
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.CSSFormatter.minify()">
                            🗜️ Minify CSS
                        </button>
                    </div>
                    <div id="css-format-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.CSSFormatter = {
    format() {
        const input = document.getElementById('css-input').value;
        
        if (!input) {
            ITTools.UI.showResult('css-format-result', 'Please enter CSS', false);
            return;
        }
        
        try {
            let formatted = input
                .replace(/\s*\{\s*/g, ' {\n  ')
                .replace(/\s*\}\s*/g, '\n}\n\n')
                .replace(/\s*;\s*/g, ';\n  ')
                .replace(/\s*,\s*/g, ', ')
                .replace(/\s*:\s*/g, ': ')
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .trim();
            
            ITTools.UI.showResult('css-format-result', 
                `<strong>Formatted CSS:</strong><br>
                <textarea class="ittools-textarea" rows="15" readonly>${formatted}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                true);
        } catch (error) {
            ITTools.UI.showResult('css-format-result', 'Error: ' + error.message, false);
        }
    },
    
    minify() {
        const input = document.getElementById('css-input').value;
        
        if (!input) {
            ITTools.UI.showResult('css-format-result', 'Please enter CSS', false);
            return;
        }
        
        const minified = input
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}:;,])\s*/g, '$1')
            .trim();
        
        ITTools.UI.showResult('css-format-result', 
            `<strong>Minified CSS:</strong><br>
            <textarea class="ittools-textarea" rows="8" readonly>${minified}</textarea>
            <button onclick="ITTools.UI.copyToClipboard(\`${minified.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
            true);
    }
};

console.log('ITTools Formatter Implementations loaded');
