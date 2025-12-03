// ============================================
// NAMESPACE: ITTools.Implementations.Batch10
// FILE: ittools-impl-batch10.js  
// PURPOSE: Password, word counter, percentage tools
// ============================================

// ============================================
// Password Generator Advanced
// ============================================
ITTools.Tools.Registry.register('password-generator-advanced', {
    name: 'Password Generator',
    category: 'utility',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Password Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Length: <span id="pwd-len-display">16</span></label>
                            <input type="range" id="pwd-length" min="8" max="64" value="16" oninput="document.getElementById('pwd-len-display').textContent=this.value" style="width:100%;">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Quantity:</label>
                            <input type="number" id="pwd-quantity" class="ittools-input" value="5" min="1" max="20">
                        </div>
                    </div>
                    <div style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:15px;">
                        <label><input type="checkbox" id="pwd-upper" checked> Uppercase (A-Z)</label>
                        <label><input type="checkbox" id="pwd-lower" checked> Lowercase (a-z)</label>
                        <label><input type="checkbox" id="pwd-numbers" checked> Numbers (0-9)</label>
                        <label><input type="checkbox" id="pwd-symbols" checked> Symbols (!@#$...)</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PasswordGenerator.generate()">Generate Passwords</button>
                    </div>
                    <div id="pwd-gen-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PasswordGenerator = {
    generate() {
        const length = parseInt(document.getElementById('pwd-length').value);
        const quantity = parseInt(document.getElementById('pwd-quantity').value);
        const upper = document.getElementById('pwd-upper').checked;
        const lower = document.getElementById('pwd-lower').checked;
        const numbers = document.getElementById('pwd-numbers').checked;
        const symbols = document.getElementById('pwd-symbols').checked;
        let chars = '';
        if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
        if (numbers) chars += '0123456789';
        if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        if (!chars) { ITTools.UI.showResult('pwd-gen-result', 'Select at least one character type', false); return; }
        const passwords = [];
        for (let i = 0; i < quantity; i++) {
            let pwd = '';
            for (let j = 0; j < length; j++) {
                pwd += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            passwords.push(pwd);
        }
        const html = passwords.map((p, i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8f9fa;border-radius:4px;margin-bottom:5px;">
                <code style="flex:1;font-size:14px;word-break:break-all;">${p}</code>
                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${p}')">Copy</button>
            </div>
        `).join('');
        ITTools.UI.showResult('pwd-gen-result', html, true);
    }
};

// ============================================
// Password Strength Checker
// ============================================
ITTools.Tools.Registry.register('password-strength', {
    name: 'Password Strength Checker',
    category: 'utility',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Password Strength Checker</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Enter Password:</label>
                        <input type="text" id="pwd-check-input" class="ittools-input" placeholder="Enter password to check..." oninput="ITTools.Implementations.PasswordStrength.check()">
                    </div>
                    <div id="pwd-strength-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PasswordStrength = {
    check() {
        const pwd = document.getElementById('pwd-check-input').value;
        if (!pwd) { document.getElementById('pwd-strength-result').innerHTML = ''; return; }
        let score = 0;
        const checks = {
            length8: pwd.length >= 8,
            length12: pwd.length >= 12,
            length16: pwd.length >= 16,
            upper: /[A-Z]/.test(pwd),
            lower: /[a-z]/.test(pwd),
            number: /[0-9]/.test(pwd),
            symbol: /[^A-Za-z0-9]/.test(pwd),
            noRepeat: !/(.)\1{2,}/.test(pwd)
        };
        if (checks.length8) score += 1;
        if (checks.length12) score += 1;
        if (checks.length16) score += 1;
        if (checks.upper) score += 1;
        if (checks.lower) score += 1;
        if (checks.number) score += 1;
        if (checks.symbol) score += 2;
        if (checks.noRepeat) score += 1;
        const levels = [
            { min: 0, label: 'Very Weak', color: '#dc3545' },
            { min: 3, label: 'Weak', color: '#fd7e14' },
            { min: 5, label: 'Fair', color: '#ffc107' },
            { min: 7, label: 'Strong', color: '#28a745' },
            { min: 9, label: 'Very Strong', color: '#20c997' }
        ];
        const level = levels.filter(l => score >= l.min).pop();
        const html = `
            <div style="text-align:center;padding:20px;background:${level.color};color:white;border-radius:5px;margin-bottom:15px;">
                <div style="font-size:24px;font-weight:bold;">${level.label}</div>
                <div>Score: ${score}/9</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="padding:8px;background:${checks.length8?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.length8?'✓':'✗'} 8+ characters</div>
                <div style="padding:8px;background:${checks.length12?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.length12?'✓':'✗'} 12+ characters</div>
                <div style="padding:8px;background:${checks.upper?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.upper?'✓':'✗'} Uppercase</div>
                <div style="padding:8px;background:${checks.lower?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.lower?'✓':'✗'} Lowercase</div>
                <div style="padding:8px;background:${checks.number?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.number?'✓':'✗'} Numbers</div>
                <div style="padding:8px;background:${checks.symbol?'#d4edda':'#f8d7da'};border-radius:4px;">${checks.symbol?'✓':'✗'} Symbols</div>
            </div>
        `;
        document.getElementById('pwd-strength-result').innerHTML = html;
    }
};

// ============================================
// Word Counter (SEO)
// ============================================
ITTools.Tools.Registry.register('word-counter-seo', {
    name: 'Word Counter (SEO)',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">SEO Word Counter & Analyzer</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Enter Content:</label>
                        <textarea id="seo-word-input" class="ittools-textarea" rows="8" placeholder="Paste your content here..." oninput="ITTools.Implementations.WordCounterSeo.analyze()"></textarea>
                    </div>
                    <div id="seo-word-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.WordCounterSeo = {
    analyze() {
        const text = document.getElementById('seo-word-input').value;
        if (!text.trim()) { document.getElementById('seo-word-result').innerHTML = ''; return; }
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, '').length;
        const words = text.trim().split(/\s+/).filter(w => w).length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim()).length;
        const readTime = Math.ceil(words / 200);
        const avgWordLen = charsNoSpace / words || 0;
        const wordFreq = {};
        text.toLowerCase().match(/\b[a-z]{3,}\b/g)?.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);
        const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:15px;">
                <div style="background:#667eea;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${words}</div><div>Words</div></div>
                <div style="background:#28a745;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${chars}</div><div>Characters</div></div>
                <div style="background:#17a2b8;color:white;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${sentences}</div><div>Sentences</div></div>
                <div style="background:#ffc107;color:#333;padding:15px;border-radius:5px;text-align:center;"><div style="font-size:24px;font-weight:bold;">${readTime}</div><div>Min Read</div></div>
            </div>
            <div style="background:#f8f9fa;padding:15px;border-radius:5px;">
                <strong>Top Keywords:</strong>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                    ${topWords.map(([w, c]) => `<span style="background:#e9ecef;padding:4px 10px;border-radius:20px;">${w} <strong>(${c})</strong></span>`).join('')}
                </div>
            </div>
        `;
        document.getElementById('seo-word-result').innerHTML = html;
    }
};

// ============================================
// Word Counter (Blog)
// ============================================
ITTools.Tools.Registry.register('word-counter-blog', {
    name: 'Word Counter (Blog)',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Blog Word Counter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Enter Blog Content:</label>
                        <textarea id="blog-word-input" class="ittools-textarea" rows="8" placeholder="Paste your blog content..." oninput="ITTools.Implementations.WordCounterBlog.analyze()"></textarea>
                    </div>
                    <div id="blog-word-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.WordCounterBlog = {
    analyze() {
        const text = document.getElementById('blog-word-input').value;
        if (!text.trim()) { document.getElementById('blog-word-result').innerHTML = ''; return; }
        const words = text.trim().split(/\s+/).filter(w => w).length;
        const chars = text.length;
        const readTime = Math.ceil(words / 200);
        const speakTime = Math.ceil(words / 150);
        let seoTip = 'Consider adding more content for better SEO';
        let tipColor = '#dc3545';
        if (words >= 300) { seoTip = 'Good length for a short post'; tipColor = '#ffc107'; }
        if (words >= 600) { seoTip = 'Great length for blog posts'; tipColor = '#28a745'; }
        if (words >= 1500) { seoTip = 'Excellent in-depth content'; tipColor = '#20c997'; }
        const html = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;">
                <div style="background:#667eea;color:white;padding:20px;border-radius:5px;text-align:center;"><div style="font-size:32px;font-weight:bold;">${words}</div><div>Words</div></div>
                <div style="background:#28a745;color:white;padding:20px;border-radius:5px;text-align:center;"><div style="font-size:32px;font-weight:bold;">${readTime}</div><div>Min to Read</div></div>
                <div style="background:#17a2b8;color:white;padding:20px;border-radius:5px;text-align:center;"><div style="font-size:32px;font-weight:bold;">${speakTime}</div><div>Min to Speak</div></div>
            </div>
            <div style="background:${tipColor};color:white;padding:15px;border-radius:5px;text-align:center;">
                <strong>SEO Tip:</strong> ${seoTip}
            </div>
        `;
        document.getElementById('blog-word-result').innerHTML = html;
    }
};

// ============================================
// Percentage Calculator (Basic)
// ============================================
ITTools.Tools.Registry.register('percentage-calc', {
    name: 'Percentage Calculator',
    category: 'math',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Percentage Calculator</div>
                <div class="ittools-card-body">
                    <div style="background:#f8f9fa;padding:15px;border-radius:5px;margin-bottom:15px;">
                        <strong>What is</strong>
                        <input type="number" id="pct-what" class="ittools-input" style="width:80px;display:inline-block;" placeholder="X">
                        <strong>% of</strong>
                        <input type="number" id="pct-of" class="ittools-input" style="width:80px;display:inline-block;" placeholder="Y">
                        <strong>?</strong>
                        <button class="ittools-btn ittools-btn-sm ittools-btn-primary" onclick="ITTools.Implementations.PercentageCalc.whatIsXPercent()">Calculate</button>
                        <span id="pct-result-1" style="margin-left:10px;font-weight:bold;color:#667eea;"></span>
                    </div>
                    <div style="background:#f8f9fa;padding:15px;border-radius:5px;margin-bottom:15px;">
                        <input type="number" id="pct-num" class="ittools-input" style="width:80px;display:inline-block;" placeholder="X">
                        <strong>is what % of</strong>
                        <input type="number" id="pct-total" class="ittools-input" style="width:80px;display:inline-block;" placeholder="Y">
                        <strong>?</strong>
                        <button class="ittools-btn ittools-btn-sm ittools-btn-primary" onclick="ITTools.Implementations.PercentageCalc.xIsWhatPercent()">Calculate</button>
                        <span id="pct-result-2" style="margin-left:10px;font-weight:bold;color:#667eea;"></span>
                    </div>
                    <div style="background:#f8f9fa;padding:15px;border-radius:5px;">
                        <input type="number" id="pct-change-from" class="ittools-input" style="width:80px;display:inline-block;" placeholder="From">
                        <strong>to</strong>
                        <input type="number" id="pct-change-to" class="ittools-input" style="width:80px;display:inline-block;" placeholder="To">
                        <strong>= ?% change</strong>
                        <button class="ittools-btn ittools-btn-sm ittools-btn-primary" onclick="ITTools.Implementations.PercentageCalc.percentChange()">Calculate</button>
                        <span id="pct-result-3" style="margin-left:10px;font-weight:bold;color:#667eea;"></span>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PercentageCalc = {
    whatIsXPercent() {
        const x = parseFloat(document.getElementById('pct-what').value);
        const y = parseFloat(document.getElementById('pct-of').value);
        if (isNaN(x) || isNaN(y)) return;
        document.getElementById('pct-result-1').textContent = '= ' + (x * y / 100).toFixed(2);
    },
    xIsWhatPercent() {
        const x = parseFloat(document.getElementById('pct-num').value);
        const y = parseFloat(document.getElementById('pct-total').value);
        if (isNaN(x) || isNaN(y) || y === 0) return;
        document.getElementById('pct-result-2').textContent = '= ' + (x / y * 100).toFixed(2) + '%';
    },
    percentChange() {
        const from = parseFloat(document.getElementById('pct-change-from').value);
        const to = parseFloat(document.getElementById('pct-change-to').value);
        if (isNaN(from) || isNaN(to) || from === 0) return;
        const change = ((to - from) / from * 100).toFixed(2);
        const sign = change >= 0 ? '+' : '';
        document.getElementById('pct-result-3').textContent = '= ' + sign + change + '%';
    }
};

// ============================================
// Unit Converter (Basic)
// ============================================
ITTools.Tools.Registry.register('unit-converter', {
    name: 'Unit Converter',
    category: 'math',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Quick Unit Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Category:</label>
                        <select id="unit-category" class="ittools-input" onchange="ITTools.Implementations.UnitConverter.updateUnits()">
                            <option value="length">Length</option>
                            <option value="weight">Weight</option>
                            <option value="temperature">Temperature</option>
                            <option value="data">Data Storage</option>
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">From:</label>
                            <input type="number" id="unit-from-val" class="ittools-input" placeholder="Value" oninput="ITTools.Implementations.UnitConverter.convert()">
                            <select id="unit-from" class="ittools-input" style="margin-top:5px;" onchange="ITTools.Implementations.UnitConverter.convert()"></select>
                        </div>
                        <span style="padding:10px;font-size:20px;">=</span>
                        <div class="ittools-form-group">
                            <label class="ittools-label">To:</label>
                            <input type="number" id="unit-to-val" class="ittools-input" readonly style="background:#f8f9fa;">
                            <select id="unit-to" class="ittools-input" style="margin-top:5px;" onchange="ITTools.Implementations.UnitConverter.convert()"></select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UnitConverter = {
    units: {
        length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 },
        weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, t: 1000 },
        temperature: { c: 'c', f: 'f', k: 'k' },
        data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }
    },
    updateUnits() {
        const cat = document.getElementById('unit-category').value;
        const keys = Object.keys(this.units[cat]);
        const options = keys.map(k => `<option value="${k}">${k}</option>`).join('');
        document.getElementById('unit-from').innerHTML = options;
        document.getElementById('unit-to').innerHTML = options;
        if (keys.length > 1) document.getElementById('unit-to').selectedIndex = 1;
        this.convert();
    },
    convert() {
        const cat = document.getElementById('unit-category').value;
        const fromVal = parseFloat(document.getElementById('unit-from-val').value);
        const fromUnit = document.getElementById('unit-from').value;
        const toUnit = document.getElementById('unit-to').value;
        if (isNaN(fromVal)) { document.getElementById('unit-to-val').value = ''; return; }
        let result;
        if (cat === 'temperature') {
            result = this.convertTemp(fromVal, fromUnit, toUnit);
        } else {
            const base = fromVal * this.units[cat][fromUnit];
            result = base / this.units[cat][toUnit];
        }
        document.getElementById('unit-to-val').value = result.toPrecision(6);
    },
    convertTemp(val, from, to) {
        let celsius;
        if (from === 'c') celsius = val;
        else if (from === 'f') celsius = (val - 32) * 5/9;
        else celsius = val - 273.15;
        if (to === 'c') return celsius;
        if (to === 'f') return celsius * 9/5 + 32;
        return celsius + 273.15;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ITTools.Implementations.UnitConverter.updateUnits();
});

console.log('ITTools Batch 10 loaded (password-generator-advanced, password-strength, word-counter-seo, word-counter-blog, percentage-calc, unit-converter)');
