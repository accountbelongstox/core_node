// ============================================
// NAMESPACE: ITTools.Implementations.Batch8
// FILE: ittools-impl-batch8.js
// PURPOSE: Text tools, formatters, generators
// ============================================

// ============================================
// Text Sorter
// ============================================
ITTools.Tools.Registry.register('text-sorter', {
    name: 'Text Sorter',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text/Line Sorter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input (one item per line):</label>
                        <textarea id="sorter-input" class="ittools-textarea" rows="8" placeholder="Enter lines to sort..."></textarea>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                        <label><input type="radio" name="sort-order" value="asc" checked> Ascending</label>
                        <label><input type="radio" name="sort-order" value="desc"> Descending</label>
                        <label><input type="checkbox" id="sort-ignore-case"> Ignore Case</label>
                        <label><input type="checkbox" id="sort-numeric"> Numeric Sort</label>
                        <label><input type="checkbox" id="sort-unique"> Remove Duplicates</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TextSorter.sort()">Sort</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.TextSorter.shuffle()">Shuffle</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.TextSorter.reverse()">Reverse</button>
                    </div>
                    <div id="sorter-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TextSorter = {
    sort() {
        let lines = document.getElementById('sorter-input').value.split('\n').filter(l => l.trim());
        if (!lines.length) { ITTools.UI.showResult('sorter-result', 'Please enter text', false); return; }
        const order = document.querySelector('input[name="sort-order"]:checked').value;
        const ignoreCase = document.getElementById('sort-ignore-case').checked;
        const numeric = document.getElementById('sort-numeric').checked;
        const unique = document.getElementById('sort-unique').checked;
        if (unique) lines = [...new Set(lines)];
        lines.sort((a, b) => {
            let va = ignoreCase ? a.toLowerCase() : a;
            let vb = ignoreCase ? b.toLowerCase() : b;
            if (numeric) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
            return order === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
        this.showResult(lines);
    },
    shuffle() {
        let lines = document.getElementById('sorter-input').value.split('\n').filter(l => l.trim());
        for (let i = lines.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lines[i], lines[j]] = [lines[j], lines[i]];
        }
        this.showResult(lines);
    },
    reverse() {
        const lines = document.getElementById('sorter-input').value.split('\n').filter(l => l.trim()).reverse();
        this.showResult(lines);
    },
    showResult(lines) {
        const result = lines.join('\n');
        ITTools.UI.showResult('sorter-result', `<pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;max-height:300px;overflow:auto;">${result.replace(/</g,'&lt;')}</pre><div style="margin-top:10px;"><strong>${lines.length} lines</strong> <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">Copy</button></div>`, true);
    }
};

// ============================================
// Text Reverser
// ============================================
ITTools.Tools.Registry.register('text-reverser', {
    name: 'Text Reverser',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Text Reverser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="reverser-input" class="ittools-textarea" rows="4" placeholder="Enter text to reverse..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TextReverser.reverseAll()">Reverse All</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.TextReverser.reverseWords()">Reverse Words</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.TextReverser.reverseLines()">Reverse Lines</button>
                    </div>
                    <div id="reverser-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TextReverser = {
    reverseAll() {
        const input = document.getElementById('reverser-input').value;
        if (!input) { ITTools.UI.showResult('reverser-result', 'Please enter text', false); return; }
        const result = input.split('').reverse().join('');
        this.showResult(result, 'Reversed');
    },
    reverseWords() {
        const input = document.getElementById('reverser-input').value;
        if (!input) { ITTools.UI.showResult('reverser-result', 'Please enter text', false); return; }
        const result = input.split(/\s+/).reverse().join(' ');
        this.showResult(result, 'Words Reversed');
    },
    reverseLines() {
        const input = document.getElementById('reverser-input').value;
        if (!input) { ITTools.UI.showResult('reverser-result', 'Please enter text', false); return; }
        const result = input.split('\n').reverse().join('\n');
        this.showResult(result, 'Lines Reversed');
    },
    showResult(result, label) {
        ITTools.UI.showResult('reverser-result', `<strong>${label}:</strong><br><pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;">${result.replace(/</g,'&lt;')}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">Copy</button>`, true);
    }
};

// ============================================
// Duplicate Line Remover
// ============================================
ITTools.Tools.Registry.register('duplicate-remover', {
    name: 'Remove Duplicate Lines',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Remove Duplicate Lines</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input (one item per line):</label>
                        <textarea id="dedup-input" class="ittools-textarea" rows="8" placeholder="Enter lines..."></textarea>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label><input type="checkbox" id="dedup-ignore-case"> Ignore Case</label>
                        <label style="margin-left:15px;"><input type="checkbox" id="dedup-trim"> Trim Whitespace</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.DuplicateRemover.remove()">Remove Duplicates</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.DuplicateRemover.showDuplicates()">Show Duplicates Only</button>
                    </div>
                    <div id="dedup-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.DuplicateRemover = {
    remove() {
        let lines = document.getElementById('dedup-input').value.split('\n');
        const ignoreCase = document.getElementById('dedup-ignore-case').checked;
        const trim = document.getElementById('dedup-trim').checked;
        const originalCount = lines.length;
        const seen = new Set();
        const unique = [];
        for (let line of lines) {
            let key = trim ? line.trim() : line;
            if (ignoreCase) key = key.toLowerCase();
            if (!seen.has(key)) { seen.add(key); unique.push(trim ? line.trim() : line); }
        }
        const removed = originalCount - unique.length;
        const result = unique.join('\n');
        ITTools.UI.showResult('dedup-result', `<div style="margin-bottom:10px;"><strong>Original:</strong> ${originalCount} lines | <strong>Unique:</strong> ${unique.length} lines | <strong>Removed:</strong> ${removed} duplicates</div><pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;max-height:300px;overflow:auto;">${result.replace(/</g,'&lt;')}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">Copy</button>`, true);
    },
    showDuplicates() {
        let lines = document.getElementById('dedup-input').value.split('\n');
        const ignoreCase = document.getElementById('dedup-ignore-case').checked;
        const trim = document.getElementById('dedup-trim').checked;
        const count = {};
        for (let line of lines) {
            let key = trim ? line.trim() : line;
            if (ignoreCase) key = key.toLowerCase();
            count[key] = (count[key] || 0) + 1;
        }
        const duplicates = Object.entries(count).filter(([k, v]) => v > 1).map(([k, v]) => `${k} (${v}x)`);
        if (!duplicates.length) { ITTools.UI.showResult('dedup-result', 'No duplicates found', true); return; }
        ITTools.UI.showResult('dedup-result', `<strong>Duplicates found:</strong><br><pre style="white-space:pre-wrap;background:#fff3cd;padding:10px;border-radius:4px;">${duplicates.join('\n').replace(/</g,'&lt;')}</pre>`, true);
    }
};

// ============================================
// JSON Formatter
// ============================================
ITTools.Tools.Registry.register('json-formatter', {
    name: 'JSON Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON Formatter/Validator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input JSON:</label>
                        <textarea id="json-format-input" class="ittools-textarea" rows="8" placeholder='{"key": "value"}'></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JsonFormatter.format()">Format</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.JsonFormatter.minify()">Minify</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.JsonFormatter.validate()">Validate</button>
                    </div>
                    <div id="json-format-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JsonFormatter = {
    format() {
        const input = document.getElementById('json-format-input').value;
        if (!input.trim()) { ITTools.UI.showResult('json-format-result', 'Please enter JSON', false); return; }
        try {
            const formatted = JSON.stringify(JSON.parse(input), null, 2);
            ITTools.UI.showResult('json-format-result', `<pre style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;max-height:400px;overflow:auto;">${formatted.replace(/</g,'&lt;')}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('json-format-result', 'Invalid JSON: ' + e.message, false); }
    },
    minify() {
        const input = document.getElementById('json-format-input').value;
        if (!input.trim()) { ITTools.UI.showResult('json-format-result', 'Please enter JSON', false); return; }
        try {
            const minified = JSON.stringify(JSON.parse(input));
            ITTools.UI.showResult('json-format-result', `<pre style="white-space:pre-wrap;word-break:break-all;background:#f8f9fa;padding:10px;border-radius:4px;">${minified.replace(/</g,'&lt;')}</pre><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(\`${minified.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">Copy</button>`, true);
        } catch (e) { ITTools.UI.showResult('json-format-result', 'Invalid JSON: ' + e.message, false); }
    },
    validate() {
        const input = document.getElementById('json-format-input').value;
        if (!input.trim()) { ITTools.UI.showResult('json-format-result', 'Please enter JSON', false); return; }
        try {
            const parsed = JSON.parse(input);
            const type = Array.isArray(parsed) ? 'Array' : typeof parsed;
            const keys = type === 'object' ? Object.keys(parsed).length : (type === 'Array' ? parsed.length : 'N/A');
            ITTools.UI.showResult('json-format-result', `<span style="color:#28a745;font-weight:bold;">Valid JSON</span><br><strong>Type:</strong> ${type}<br><strong>Keys/Items:</strong> ${keys}`, true);
        } catch (e) { ITTools.UI.showResult('json-format-result', `<span style="color:#dc3545;font-weight:bold;">Invalid JSON</span><br>${e.message}`, false); }
    }
};

// ============================================
// Number to Words
// ============================================
ITTools.Tools.Registry.register('number-to-words', {
    name: 'Number to Words',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Number to Words Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Enter Number:</label>
                        <input type="text" id="num-words-input" class="ittools-input" placeholder="12345" oninput="ITTools.Implementations.NumberToWords.convert()">
                    </div>
                    <div id="num-words-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.NumberToWords = {
    ones: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'],
    tens: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
    scales: ['', 'thousand', 'million', 'billion', 'trillion'],
    convert() {
        let input = document.getElementById('num-words-input').value.replace(/,/g, '').trim();
        if (!input) { document.getElementById('num-words-result').style.display = 'none'; return; }
        const num = parseInt(input);
        if (isNaN(num)) { ITTools.UI.showResult('num-words-result', 'Invalid number', false); return; }
        if (num === 0) { ITTools.UI.showResult('num-words-result', '<strong>Zero</strong>', true); return; }
        const words = this.toWords(Math.abs(num));
        const result = (num < 0 ? 'negative ' : '') + words;
        ITTools.UI.showResult('num-words-result', `<strong style="font-size:18px;text-transform:capitalize;">${result}</strong><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${result}')">Copy</button>`, true);
    },
    toWords(n) {
        if (n < 20) return this.ones[n];
        if (n < 100) return this.tens[Math.floor(n/10)] + (n % 10 ? '-' + this.ones[n % 10] : '');
        if (n < 1000) return this.ones[Math.floor(n/100)] + ' hundred' + (n % 100 ? ' ' + this.toWords(n % 100) : '');
        for (let i = this.scales.length - 1; i >= 1; i--) {
            const scale = Math.pow(1000, i);
            if (n >= scale) return this.toWords(Math.floor(n/scale)) + ' ' + this.scales[i] + (n % scale ? ' ' + this.toWords(n % scale) : '');
        }
        return '';
    }
};

// ============================================
// Timezone Converter
// ============================================
ITTools.Tools.Registry.register('timezone-converter', {
    name: 'Time Zone Converter',
    category: 'converter',
    render() {
        const zones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland'];
        const options = zones.map(z => `<option value="${z}">${z}</option>`).join('');
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Time Zone Converter</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">From Timezone:</label>
                            <select id="tz-from" class="ittools-input">${options}</select>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">To Timezone:</label>
                            <select id="tz-to" class="ittools-input"><option value="Asia/Shanghai">Asia/Shanghai</option>${options}</select>
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Date/Time:</label>
                        <input type="datetime-local" id="tz-datetime" class="ittools-input">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TimezoneConverter.convert()">Convert</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.TimezoneConverter.useNow()">Use Current Time</button>
                    </div>
                    <div id="tz-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TimezoneConverter = {
    useNow() {
        const now = new Date();
        document.getElementById('tz-datetime').value = now.toISOString().slice(0, 16);
        this.convert();
    },
    convert() {
        const dt = document.getElementById('tz-datetime').value;
        if (!dt) { ITTools.UI.showResult('tz-result', 'Please select date/time', false); return; }
        const fromTz = document.getElementById('tz-from').value;
        const toTz = document.getElementById('tz-to').value;
        try {
            const date = new Date(dt);
            const fromStr = date.toLocaleString('en-US', { timeZone: fromTz, dateStyle: 'full', timeStyle: 'long' });
            const toStr = date.toLocaleString('en-US', { timeZone: toTz, dateStyle: 'full', timeStyle: 'long' });
            ITTools.UI.showResult('tz-result', `
                <div style="display:grid;gap:15px;">
                    <div style="background:#f8f9fa;padding:15px;border-radius:5px;"><strong>${fromTz}:</strong><br>${fromStr}</div>
                    <div style="background:#667eea;color:white;padding:15px;border-radius:5px;"><strong>${toTz}:</strong><br>${toStr}</div>
                </div>
            `, true);
        } catch (e) { ITTools.UI.showResult('tz-result', 'Conversion error: ' + e.message, false); }
    }
};

// ============================================
// Math Evaluator
// ============================================
ITTools.Tools.Registry.register('math-evaluator', {
    name: 'Math Evaluator',
    category: 'math',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Math Expression Evaluator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Expression:</label>
                        <input type="text" id="math-expr" class="ittools-input" placeholder="2 + 2 * 3, sqrt(16), sin(PI/2)" oninput="ITTools.Implementations.MathEvaluator.evaluate()">
                    </div>
                    <div id="math-result" style="font-size:32px;font-weight:bold;color:#667eea;text-align:center;padding:20px;"></div>
                    <div style="background:#f8f9fa;padding:10px;border-radius:5px;font-size:12px;">
                        <strong>Supported:</strong> +, -, *, /, ^, %, sqrt(), sin(), cos(), tan(), log(), abs(), round(), floor(), ceil(), PI, E
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MathEvaluator = {
    evaluate() {
        let expr = document.getElementById('math-expr').value.trim();
        if (!expr) { document.getElementById('math-result').textContent = ''; return; }
        try {
            expr = expr.replace(/PI/gi, Math.PI).replace(/E/gi, Math.E)
                .replace(/sqrt\(/gi, 'Math.sqrt(').replace(/sin\(/gi, 'Math.sin(')
                .replace(/cos\(/gi, 'Math.cos(').replace(/tan\(/gi, 'Math.tan(')
                .replace(/log\(/gi, 'Math.log(').replace(/abs\(/gi, 'Math.abs(')
                .replace(/round\(/gi, 'Math.round(').replace(/floor\(/gi, 'Math.floor(')
                .replace(/ceil\(/gi, 'Math.ceil(').replace(/\^/g, '**');
            if (!/^[\d\s+\-*/%().Math\w]+$/.test(expr)) throw new Error('Invalid characters');
            const result = new Function('return ' + expr)();
            document.getElementById('math-result').innerHTML = `= ${result} <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${result}')" style="font-size:12px;">Copy</button>`;
        } catch (e) {
            document.getElementById('math-result').innerHTML = '<span style="color:#dc3545;font-size:16px;">Invalid expression</span>';
        }
    }
};

console.log('ITTools Batch 8 loaded (text-sorter, text-reverser, duplicate-remover, json-formatter, number-to-words, timezone-converter, math-evaluator)');
