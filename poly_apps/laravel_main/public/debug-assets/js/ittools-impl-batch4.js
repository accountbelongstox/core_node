// ============================================
// NAMESPACE: ITTools.Implementations.Batch4
// FILE: ittools-impl-batch4.js  
// PURPOSE: Batch 4 - PDF & Calculator Tools (5/5 tools)
// ============================================

// ============================================
// Unlock PDF (Backend required placeholder)
// ============================================
ITTools.Tools.Registry.register('unlock-pdf', {
    name: 'Unlock PDF',
    category: 'pdf',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Unlock PDF (Remove Password)</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Password-Protected PDF:</label>
                        <input type="file" id="unlock-pdf-file" class="ittools-input" accept=".pdf">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">PDF Password:</label>
                        <input type="password" id="unlock-pdf-password" class="ittools-input" placeholder="Enter PDF password">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.UnlockPDF.unlock()">
                            🔓 Unlock PDF
                        </button>
                    </div>
                    <div id="unlock-pdf-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UnlockPDF = {
    unlock() {
        const file = document.getElementById('unlock-pdf-file').files[0];
        const password = document.getElementById('unlock-pdf-password').value;
        
        if (!file) {
            ITTools.UI.showResult('unlock-pdf-result', 'Please select a PDF file', false);
            return;
        }
        
        if (!password) {
            ITTools.UI.showResult('unlock-pdf-result', 'Please enter the PDF password', false);
            return;
        }
        
        const html = `
            <div style="margin-top: 15px; background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px;">
                <strong>⚠️ Backend Required</strong><br>
                PDF unlocking requires server-side processing.<br><br>
                <strong>Required Libraries:</strong><br>
                • QPDF (command line)<br>
                • PyPDF2 (Python)<br>
                • Spatie PDF (Laravel)<br><br>
                <strong>Selected File:</strong> ${file.name}<br>
                <strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB
            </div>
        `;
        
        ITTools.UI.showResult('unlock-pdf-result', html, true);
    }
};

// ============================================
// PDF Watermark (Backend required placeholder)
// ============================================
ITTools.Tools.Registry.register('pdf-watermark', {
    name: 'PDF Watermark',
    category: 'pdf',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Add Watermark to PDF</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload PDF:</label>
                        <input type="file" id="watermark-pdf-file" class="ittools-input" accept=".pdf">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Watermark Text:</label>
                        <input type="text" id="watermark-text" class="ittools-input" placeholder="CONFIDENTIAL" value="CONFIDENTIAL">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Position:</label>
                        <select id="watermark-position" class="ittools-input">
                            <option value="center">Center</option>
                            <option value="diagonal">Diagonal</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Opacity:</label>
                        <input type="range" id="watermark-opacity" min="10" max="100" value="30" oninput="document.getElementById('opacity-value').textContent = this.value + '%'">
                        <span id="opacity-value">30%</span>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PDFWatermark.apply()">
                            💧 Add Watermark
                        </button>
                    </div>
                    <div id="watermark-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PDFWatermark = {
    apply() {
        const file = document.getElementById('watermark-pdf-file').files[0];
        const text = document.getElementById('watermark-text').value;
        
        if (!file) {
            ITTools.UI.showResult('watermark-result', 'Please select a PDF file', false);
            return;
        }
        
        if (!text) {
            ITTools.UI.showResult('watermark-result', 'Please enter watermark text', false);
            return;
        }
        
        const position = document.getElementById('watermark-position').value;
        const opacity = document.getElementById('watermark-opacity').value;
        
        const html = `
            <div style="margin-top: 15px; background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px;">
                <strong>⚠️ Backend Required</strong><br>
                PDF watermarking requires server-side processing.<br><br>
                <strong>Required Libraries:</strong><br>
                • FPDI + FPDF (PHP)<br>
                • PyPDF2 + reportlab (Python)<br>
                • pdf-lib (Node.js)<br><br>
                <strong>Settings:</strong><br>
                📄 File: ${file.name}<br>
                📝 Text: ${text}<br>
                📍 Position: ${position}<br>
                🔍 Opacity: ${opacity}%
            </div>
        `;
        
        ITTools.UI.showResult('watermark-result', html, true);
    }
};

// ============================================
// Currency Converter (Client-side with mock rates)
// ============================================
ITTools.Tools.Registry.register('currency-converter', {
    name: 'Currency Converter',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Currency Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Amount:</label>
                        <input type="number" id="currency-amount" class="ittools-input" value="100" min="0" step="0.01">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From:</label>
                        <select id="currency-from" class="ittools-input">
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="JPY">JPY - Japanese Yen</option>
                            <option value="CNY">CNY - Chinese Yuan</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="CHF">CHF - Swiss Franc</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">To:</label>
                        <select id="currency-to" class="ittools-input">
                            <option value="EUR">EUR - Euro</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="JPY">JPY - Japanese Yen</option>
                            <option value="CNY">CNY - Chinese Yuan</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="CHF">CHF - Swiss Franc</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.CurrencyConverter.convert()">
                            💱 Convert
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.CurrencyConverter.swap()">
                            🔄 Swap
                        </button>
                    </div>
                    <div id="currency-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.CurrencyConverter = {
    rates: {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CNY: 7.24,
        AUD: 1.53,
        CAD: 1.36,
        CHF: 0.88
    },
    
    convert() {
        const amount = parseFloat(document.getElementById('currency-amount').value);
        const from = document.getElementById('currency-from').value;
        const to = document.getElementById('currency-to').value;
        
        if (isNaN(amount) || amount < 0) {
            ITTools.UI.showResult('currency-result', 'Please enter a valid amount', false);
            return;
        }
        
        const inUSD = amount / this.rates[from];
        const result = inUSD * this.rates[to];
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">${amount.toFixed(2)} ${from} =</div>
                    <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">${result.toFixed(2)}</div>
                    <div style="font-size: 18px;">${to}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; font-size: 13px;">
                    <strong>Exchange Rate:</strong> 1 ${from} = ${(this.rates[to] / this.rates[from]).toFixed(4)} ${to}<br>
                    <small style="color: #666;">⚠️ Note: Using demo rates. For real-time rates, integrate with an API like exchangerate-api.com</small>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('currency-result', html, true);
    },
    
    swap() {
        const from = document.getElementById('currency-from');
        const to = document.getElementById('currency-to');
        const temp = from.value;
        from.value = to.value;
        to.value = temp;
        this.convert();
    }
};

// ============================================
// MAC Address Lookup (Client-side with common vendors)
// ============================================
ITTools.Tools.Registry.register('mac-lookup', {
    name: 'MAC Address Lookup',
    category: 'network',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">MAC Address Vendor Lookup</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">MAC Address:</label>
                        <input type="text" id="mac-lookup-input" class="ittools-input" placeholder="00:1A:2B:3C:4D:5E or 001A2B3C4D5E">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.MACLookup.lookup()">
                            🔍 Lookup Vendor
                        </button>
                    </div>
                    <div id="mac-lookup-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MACLookup = {
    vendors: {
        '00:00:0C': 'Cisco Systems',
        '00:1A:2B': 'Ayecom Technology',
        '00:50:56': 'VMware, Inc.',
        '08:00:27': 'Oracle VirtualBox',
        '00:0C:29': 'VMware, Inc.',
        '00:15:5D': 'Microsoft Hyper-V',
        'AC:DE:48': 'Private',
        '00:1B:44': 'SanDisk Corporation',
        '00:25:00': 'Apple, Inc.',
        '3C:D9:2B': 'Hewlett Packard',
        '00:1E:C2': 'Apple, Inc.',
        'F8:FF:C2': 'Apple, Inc.',
        '00:1F:F3': 'Apple, Inc.',
        '00:23:12': 'Apple, Inc.',
        '00:26:BB': 'Apple, Inc.',
        'B8:27:EB': 'Raspberry Pi Foundation',
        'DC:A6:32': 'Raspberry Pi Trading Ltd',
        'E4:5F:01': 'Raspberry Pi Trading Ltd',
        '00:1A:11': 'Google, Inc.',
        '00:1A:6B': 'Universal Global Scientific',
        '00:E0:4C': 'Realtek Semiconductor',
        '40:8D:5C': 'GIGA-BYTE TECHNOLOGY',
        '00:24:1D': 'GIGA-BYTE TECHNOLOGY',
        '18:31:BF': 'ASUSTek COMPUTER INC.',
        '00:26:18': 'ASUSTek COMPUTER INC.'
    },
    
    lookup() {
        let mac = document.getElementById('mac-lookup-input').value.trim().toUpperCase();
        mac = mac.replace(/[^A-F0-9]/g, '');
        
        if (mac.length < 6) {
            ITTools.UI.showResult('mac-lookup-result', 'Please enter a valid MAC address (at least 6 hex characters)', false);
            return;
        }
        
        const oui = mac.substring(0, 6);
        const formatted = oui.match(/.{2}/g).join(':');
        
        let vendor = this.vendors[formatted];
        
        if (!vendor) {
            for (const [prefix, name] of Object.entries(this.vendors)) {
                if (prefix.replace(/:/g, '').startsWith(oui.substring(0, 6))) {
                    vendor = name;
                    break;
                }
            }
        }
        
        const fullMac = mac.padEnd(12, '0').match(/.{2}/g).join(':');
        
        const html = vendor ? `
            <div style="margin-top: 15px;">
                <div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 5px;">
                    <strong>Vendor Found:</strong><br>
                    <span style="font-size: 24px;">${vendor}</span>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <strong>MAC Address:</strong> ${fullMac}<br>
                    <strong>OUI:</strong> ${formatted}<br>
                    <small style="color: #666;">⚠️ Using local database. For complete lookup, integrate with macvendors.com API</small>
                </div>
            </div>
        ` : `
            <div style="margin-top: 15px;">
                <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px;">
                    <strong>Vendor Not Found</strong><br>
                    OUI ${formatted} not in local database
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <small style="color: #666;">For complete lookup, integrate with macvendors.com API</small>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('mac-lookup-result', html, true);
    }
};

// ============================================
// Simple Unit Converter (Duplicate removed - use unit-converter-advanced)
// ============================================
ITTools.Tools.Registry.register('simple-unit-converter', {
    name: 'Quick Unit Converter',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Quick Unit Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Conversion Type:</label>
                        <select id="quick-unit-type" class="ittools-input" onchange="ITTools.Implementations.QuickUnit.updateUI()">
                            <option value="bytes">Bytes (KB/MB/GB/TB)</option>
                            <option value="distance">Distance (km/mi)</option>
                            <option value="area">Area (sqft/sqm)</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Value:</label>
                        <input type="number" id="quick-unit-value" class="ittools-input" value="1024" oninput="ITTools.Implementations.QuickUnit.convert()">
                    </div>
                    <div id="quick-unit-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QuickUnit = {
    updateUI() {
        this.convert();
    },
    
    convert() {
        const type = document.getElementById('quick-unit-type').value;
        const value = parseFloat(document.getElementById('quick-unit-value').value);
        
        if (isNaN(value)) {
            document.getElementById('quick-unit-result').style.display = 'none';
            return;
        }
        
        let html = '<div style="margin-top: 15px; display: grid; gap: 10px;">';
        
        if (type === 'bytes') {
            const units = [
                { name: 'Bytes', factor: 1 },
                { name: 'KB', factor: 1024 },
                { name: 'MB', factor: 1024 * 1024 },
                { name: 'GB', factor: 1024 * 1024 * 1024 },
                { name: 'TB', factor: 1024 * 1024 * 1024 * 1024 }
            ];
            
            units.forEach(unit => {
                const result = value / unit.factor;
                html += `<div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    <strong>${unit.name}:</strong> ${result.toLocaleString(undefined, {maximumFractionDigits: 6})}
                </div>`;
            });
        } else if (type === 'distance') {
            html += `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Kilometers:</strong> ${value.toFixed(4)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Miles:</strong> ${(value * 0.621371).toFixed(4)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Meters:</strong> ${(value * 1000).toFixed(2)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Feet:</strong> ${(value * 3280.84).toFixed(2)}</div>
            `;
        } else if (type === 'area') {
            html += `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Square Feet:</strong> ${value.toFixed(4)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Square Meters:</strong> ${(value * 0.092903).toFixed(4)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Square Yards:</strong> ${(value / 9).toFixed(4)}</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>Acres:</strong> ${(value / 43560).toFixed(6)}</div>
            `;
        }
        
        html += '</div>';
        ITTools.UI.showResult('quick-unit-result', html, true);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    ITTools.Implementations.QuickUnit.convert();
});

console.log('ITTools Batch 4 Implementations loaded');
