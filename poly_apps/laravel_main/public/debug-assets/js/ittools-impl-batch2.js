// ============================================
// NAMESPACE: ITTools.Implementations.Batch2
// FILE: ittools-impl-batch2.js  
// PURPOSE: Batch 2 - Network & Data Tools (5/5 tools)
// ============================================

// ============================================
// IPv4 Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('ipv4-converter', {
    name: 'IPv4 Converter',
    category: 'network',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">IPv4 Address Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">IP Address (Dotted Decimal):</label>
                        <input type="text" id="ipv4-dotted" class="ittools-input" placeholder="192.168.1.1" value="192.168.1.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Integer (Decimal):</label>
                        <input type="number" id="ipv4-int" class="ittools-input" placeholder="3232235777">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Hexadecimal:</label>
                        <input type="text" id="ipv4-hex" class="ittools-input" placeholder="0xC0A80101">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Binary:</label>
                        <input type="text" id="ipv4-binary" class="ittools-input" placeholder="11000000.10101000.00000001.00000001">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.IPv4Converter.convertFromDotted()">
                            Convert from IP
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.IPv4Converter.convertFromInt()">
                            Convert from Integer
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.IPv4Converter = {
    ipToInt(ip) {
        const parts = ip.split('.').map(p => parseInt(p));
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    },
    
    intToIp(int) {
        return [
            (int >>> 24) & 0xFF,
            (int >>> 16) & 0xFF,
            (int >>> 8) & 0xFF,
            int & 0xFF
        ].join('.');
    },
    
    intToHex(int) {
        return '0x' + int.toString(16).toUpperCase().padStart(8, '0');
    },
    
    intToBinary(int) {
        const parts = [
            ((int >>> 24) & 0xFF).toString(2).padStart(8, '0'),
            ((int >>> 16) & 0xFF).toString(2).padStart(8, '0'),
            ((int >>> 8) & 0xFF).toString(2).padStart(8, '0'),
            (int & 0xFF).toString(2).padStart(8, '0')
        ];
        return parts.join('.');
    },
    
    convertFromDotted() {
        const ip = document.getElementById('ipv4-dotted').value;
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            ITTools.UI.showToast('Invalid IP address format', 'error');
            return;
        }
        
        const int = this.ipToInt(ip);
        document.getElementById('ipv4-int').value = int;
        document.getElementById('ipv4-hex').value = this.intToHex(int);
        document.getElementById('ipv4-binary').value = this.intToBinary(int);
        ITTools.UI.showToast('Converted successfully', 'success');
    },
    
    convertFromInt() {
        const int = parseInt(document.getElementById('ipv4-int').value);
        if (isNaN(int) || int < 0 || int > 4294967295) {
            ITTools.UI.showToast('Invalid integer (must be 0-4294967295)', 'error');
            return;
        }
        
        document.getElementById('ipv4-dotted').value = this.intToIp(int);
        document.getElementById('ipv4-hex').value = this.intToHex(int);
        document.getElementById('ipv4-binary').value = this.intToBinary(int);
        ITTools.UI.showToast('Converted successfully', 'success');
    }
};

// ============================================
// MAC Address Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('mac-generator', {
    name: 'MAC Address Generator',
    category: 'network',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">MAC Address Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Separator:</label>
                        <select id="mac-separator" class="ittools-input">
                            <option value=":">Colon (:)</option>
                            <option value="-">Hyphen (-)</option>
                            <option value="">None</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Case:</label>
                        <select id="mac-case" class="ittools-input">
                            <option value="upper">Uppercase</option>
                            <option value="lower">Lowercase</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Quantity:</label>
                        <input type="number" id="mac-quantity" class="ittools-input" value="1" min="1" max="100">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.MACGenerator.generate()">
                            🎲 Generate MAC Address
                        </button>
                    </div>
                    <div id="mac-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MACGenerator = {
    generate() {
        const separator = document.getElementById('mac-separator').value;
        const caseType = document.getElementById('mac-case').value;
        const quantity = parseInt(document.getElementById('mac-quantity').value);
        
        if (quantity < 1 || quantity > 100) {
            ITTools.UI.showResult('mac-result', 'Quantity must be between 1 and 100', false);
            return;
        }
        
        const macs = [];
        for (let i = 0; i < quantity; i++) {
            let mac = '';
            for (let j = 0; j < 6; j++) {
                const byte = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
                mac += (caseType === 'upper' ? byte.toUpperCase() : byte);
                if (j < 5 && separator) mac += separator;
            }
            macs.push(mac);
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Generated MAC Address${quantity > 1 ? 'es' : ''}:</strong>
                <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; max-height: 300px; overflow-y: auto;">${macs.join('\n')}</pre>
                <button onclick="ITTools.UI.copyToClipboard(\`${macs.join('\\n')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy All</button>
            </div>
        `;
        
        ITTools.UI.showResult('mac-result', html, true);
    }
};

// ============================================
// Docker Run to Compose (Client-side)
// ============================================
ITTools.Tools.Registry.register('docker-run-to-compose', {
    name: 'Docker Run → Compose',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Docker Run to Compose Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Docker Run Command:</label>
                        <textarea id="docker-run-input" class="ittools-input" rows="8" placeholder="docker run -d --name myapp -p 8080:80 -e DB_HOST=localhost nginx:latest"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.DockerConverter.convert()">
                            🐳 Convert to Compose
                        </button>
                    </div>
                    <div id="docker-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.DockerConverter = {
    convert() {
        const input = document.getElementById('docker-run-input').value.trim();
        
        if (!input.startsWith('docker run')) {
            ITTools.UI.showResult('docker-result', 'Command must start with "docker run"', false);
            return;
        }
        
        const service = {
            name: 'app',
            image: '',
            ports: [],
            environment: [],
            volumes: [],
            restart: 'no',
            detach: false
        };
        
        const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            if (part === '--name' && parts[i + 1]) {
                service.name = parts[++i];
            } else if (part === '-d' || part === '--detach') {
                service.detach = true;
            } else if ((part === '-p' || part === '--publish') && parts[i + 1]) {
                service.ports.push(parts[++i]);
            } else if ((part === '-e' || part === '--env') && parts[i + 1]) {
                service.environment.push(parts[++i]);
            } else if ((part === '-v' || part === '--volume') && parts[i + 1]) {
                service.volumes.push(parts[++i]);
            } else if (part === '--restart' && parts[i + 1]) {
                service.restart = parts[++i];
            } else if (!part.startsWith('-') && part !== 'docker' && part !== 'run' && !service.image) {
                service.image = part;
            }
        }
        
        let compose = `version: '3.8'\n\nservices:\n  ${service.name}:\n    image: ${service.image}\n`;
        
        if (service.ports.length > 0) {
            compose += '    ports:\n';
            service.ports.forEach(p => compose += `      - "${p}"\n`);
        }
        
        if (service.environment.length > 0) {
            compose += '    environment:\n';
            service.environment.forEach(e => {
                const [key, val] = e.split('=');
                compose += `      - ${key}=${val || ''}\n`;
            });
        }
        
        if (service.volumes.length > 0) {
            compose += '    volumes:\n';
            service.volumes.forEach(v => compose += `      - ${v}\n`);
        }
        
        if (service.restart !== 'no') {
            compose += `    restart: ${service.restart}\n`;
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Docker Compose YAML:</strong>
                <pre style="background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; font-family: monospace; overflow-x: auto;">${compose}</pre>
                <button onclick="ITTools.UI.copyToClipboard(\`${compose.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('docker-result', html, true);
    }
};

// ============================================
// JSON Diff (Client-side)
// ============================================
ITTools.Tools.Registry.register('json-diff', {
    name: 'JSON Diff',
    category: 'data',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON Diff Viewer</div>
                <div class="ittools-card-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON 1 (Original):</label>
                            <textarea id="json-diff-1" class="ittools-input" rows="12" placeholder='{"name": "John", "age": 30}'></textarea>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON 2 (Modified):</label>
                            <textarea id="json-diff-2" class="ittools-input" rows="12" placeholder='{"name": "Jane", "age": 25}'></textarea>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONDiff.compare()">
                            🔍 Compare JSON
                        </button>
                    </div>
                    <div id="json-diff-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JSONDiff = {
    compare() {
        const json1Str = document.getElementById('json-diff-1').value;
        const json2Str = document.getElementById('json-diff-2').value;
        
        let obj1, obj2;
        try {
            obj1 = JSON.parse(json1Str);
            obj2 = JSON.parse(json2Str);
        } catch (e) {
            ITTools.UI.showResult('json-diff-result', 'Invalid JSON: ' + e.message, false);
            return;
        }
        
        const diffs = this.findDifferences(obj1, obj2);
        
        if (diffs.length === 0) {
            ITTools.UI.showResult('json-diff-result', 
                '<div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 5px;">✅ JSON objects are identical</div>', 
                true);
            return;
        }
        
        let html = '<div style="margin-top: 15px;"><strong>Differences Found:</strong><div style="margin-top: 10px;">';
        
        diffs.forEach(diff => {
            const bgColor = diff.type === 'added' ? '#d4edda' : diff.type === 'removed' ? '#f8d7da' : '#fff3cd';
            const color = diff.type === 'added' ? '#155724' : diff.type === 'removed' ? '#721c24' : '#856404';
            const icon = diff.type === 'added' ? '➕' : diff.type === 'removed' ? '➖' : '🔄';
            
            html += `<div style="background: ${bgColor}; color: ${color}; padding: 10px; margin-bottom: 8px; border-radius: 4px; font-family: monospace; font-size: 13px;">
                ${icon} <strong>${diff.path}</strong><br>
                <span style="margin-left: 20px;">${diff.message}</span>
            </div>`;
        });
        
        html += '</div></div>';
        
        ITTools.UI.showResult('json-diff-result', html, true);
    },
    
    findDifferences(obj1, obj2, path = '') {
        const diffs = [];
        const keys1 = Object.keys(obj1 || {});
        const keys2 = Object.keys(obj2 || {});
        const allKeys = new Set([...keys1, ...keys2]);
        
        allKeys.forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = obj1?.[key];
            const val2 = obj2?.[key];
            
            if (!(key in obj1)) {
                diffs.push({ path: currentPath, type: 'added', message: `Added: ${JSON.stringify(val2)}` });
            } else if (!(key in obj2)) {
                diffs.push({ path: currentPath, type: 'removed', message: `Removed: ${JSON.stringify(val1)}` });
            } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                diffs.push(...this.findDifferences(val1, val2, currentPath));
            } else if (val1 !== val2) {
                diffs.push({ path: currentPath, type: 'changed', message: `${JSON.stringify(val1)} → ${JSON.stringify(val2)}` });
            }
        });
        
        return diffs;
    }
};

// ============================================
// JSON to CSV (Client-side)
// ============================================
ITTools.Tools.Registry.register('json-to-csv', {
    name: 'JSON to CSV',
    category: 'data',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON to CSV Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">JSON Input (Array of Objects):</label>
                        <textarea id="json-csv-input" class="ittools-input" rows="10" placeholder='[{"name":"John","age":30},{"name":"Jane","age":25}]'></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Delimiter:</label>
                        <select id="csv-delimiter" class="ittools-input">
                            <option value=",">Comma (,)</option>
                            <option value=";">Semicolon (;)</option>
                            <option value="|">Pipe (|)</option>
                            <option value="\t">Tab</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONToCSV.convert()">
                            📊 Convert to CSV
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.JSONToCSV.download()">
                            💾 Download CSV
                        </button>
                    </div>
                    <div id="json-csv-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JSONToCSV = {
    lastCSV: '',
    
    convert() {
        const input = document.getElementById('json-csv-input').value;
        const delimiter = document.getElementById('csv-delimiter').value;
        
        let data;
        try {
            data = JSON.parse(input);
        } catch (e) {
            ITTools.UI.showResult('json-csv-result', 'Invalid JSON: ' + e.message, false);
            return;
        }
        
        if (!Array.isArray(data) || data.length === 0) {
            ITTools.UI.showResult('json-csv-result', 'JSON must be a non-empty array of objects', false);
            return;
        }
        
        const headers = Object.keys(data[0]);
        let csv = headers.join(delimiter) + '\n';
        
        data.forEach(row => {
            const values = headers.map(header => {
                let val = row[header] ?? '';
                if (typeof val === 'string' && (val.includes(delimiter) || val.includes('"') || val.includes('\n'))) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += values.join(delimiter) + '\n';
        });
        
        this.lastCSV = csv;
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>CSV Output:</strong>
                <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; max-height: 300px; overflow: auto;">${csv}</pre>
                <button onclick="ITTools.UI.copyToClipboard(\`${csv.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('json-csv-result', html, true);
    },
    
    download() {
        if (!this.lastCSV) {
            ITTools.UI.showToast('Please convert JSON to CSV first', 'error');
            return;
        }
        
        const blob = new Blob([this.lastCSV], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        ITTools.UI.showToast('CSV downloaded successfully', 'success');
    }
};

console.log('ITTools Batch 2 Implementations loaded');
