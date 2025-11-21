// ============================================
// NAMESPACE: ITTools.Implementations.Generators
// FILE: ittools-impl-generators.js  
// PURPOSE: Generator tool implementations (QR Code, WiFi, Ports)
// NOTE: Additional generators in ittools-impl-generators-2.js
// ============================================

// ============================================
// QR Code Generator
// ============================================
ITTools.Tools.Registry.register('qr-code-generator', {
    name: 'QR Code Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">QR Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text/URL:</label>
                        <textarea id="qr-text-input" class="ittools-textarea" rows="4" placeholder="Enter text or URL"></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Size:</label>
                        <select id="qr-size" class="ittools-input">
                            <option value="200">Small (200x200)</option>
                            <option value="300" selected>Medium (300x300)</option>
                            <option value="500">Large (500x500)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QRCodeGenerator.generate()">
                            📱 Generate QR Code
                        </button>
                    </div>
                    <div id="qr-code-result" style="margin-top: 20px; text-align: center;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QRCodeGenerator = {
    async generate() {
        const text = document.getElementById('qr-text-input').value.trim();
        const size = document.getElementById('qr-size').value;
        
        if (!text) {
            document.getElementById('qr-code-result').innerHTML = '<p style="color: #dc3545;">Please enter text</p>';
            return;
        }
        
        document.getElementById('qr-code-result').innerHTML = '<p>Generating QR Code...</p>';
        
        try {
            const response = await fetch('/api/ittools/v1/web/qr-code/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, size: parseInt(size) })
            });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('qr-code-result').innerHTML = `
                    <img src="${result.data.qr_code}" alt="QR Code" style="max-width: 100%; border: 1px solid #ddd; border-radius: 5px; padding: 10px; background: white;">
                    <p style="margin-top: 10px; color: #666;">Size: ${result.data.size}x${result.data.size}</p>
                `;
            } else {
                document.getElementById('qr-code-result').innerHTML = `<p style="color: #dc3545;">Error: ${result.message}</p>`;
            }
        } catch (error) {
            document.getElementById('qr-code-result').innerHTML = `<p style="color: #dc3545;">Error: ${error.message}</p>`;
        }
    }
};

// ============================================
// WiFi QR Code Generator
// ============================================
ITTools.Tools.Registry.register('wifi-qr-generator', {
    name: 'WiFi QR Code',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">WiFi QR Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">SSID (Network Name):</label>
                        <input type="text" id="wifi-ssid" class="ittools-input" placeholder="MyWiFiNetwork">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Password:</label>
                        <input type="text" id="wifi-password" class="ittools-input" placeholder="password123">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Security Type:</label>
                        <select id="wifi-security" class="ittools-input">
                            <option value="WPA">WPA/WPA2</option>
                            <option value="WEP">WEP</option>
                            <option value="">None (Open)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.WiFiQRGenerator.generate()">
                            📶 Generate WiFi QR Code
                        </button>
                    </div>
                    <div id="wifi-qr-result" style="margin-top: 20px; text-align: center;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.WiFiQRGenerator = {
    async generate() {
        const ssid = document.getElementById('wifi-ssid').value.trim();
        const password = document.getElementById('wifi-password').value;
        const security = document.getElementById('wifi-security').value;
        
        if (!ssid) {
            document.getElementById('wifi-qr-result').innerHTML = '<p style="color: #dc3545;">Please enter SSID</p>';
            return;
        }
        
        document.getElementById('wifi-qr-result').innerHTML = '<p>Generating WiFi QR Code...</p>';
        
        try {
            const response = await fetch('/api/ittools/v1/web/wifi-qr-code/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid, password, security })
            });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('wifi-qr-result').innerHTML = `
                    <img src="${result.data.qr_code}" alt="WiFi QR Code" style="max-width: 100%; border: 1px solid #ddd; border-radius: 5px; padding: 10px; background: white;">
                    <p style="margin-top: 10px; color: #666;">Scan to connect to: ${result.data.ssid}</p>
                    <p style="color: #666; font-size: 12px;">Security: ${result.data.security || 'Open'}</p>
                `;
            } else {
                document.getElementById('wifi-qr-result').innerHTML = `<p style="color: #dc3545;">Error: ${result.message}</p>`;
            }
        } catch (error) {
            document.getElementById('wifi-qr-result').innerHTML = `<p style="color: #dc3545;">Error: ${error.message}</p>`;
        }
    }
};

// ============================================
// Random Port Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('random-port', {
    name: 'Random Port Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Random Port Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Port Range:</label>
                        <select id="port-range" class="ittools-input">
                            <option value="user">User Ports (1024-49151)</option>
                            <option value="dynamic" selected>Dynamic Ports (49152-65535)</option>
                            <option value="all">All Non-System (1024-65535)</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Number of Ports:</label>
                        <input type="number" id="port-count" class="ittools-input" value="5" min="1" max="20">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.RandomPort.generate()">
                            🎲 Generate Ports
                        </button>
                    </div>
                    <div id="port-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RandomPort = {
    generate() {
        const range = document.getElementById('port-range').value;
        const count = parseInt(document.getElementById('port-count').value);
        
        let min, max;
        if (range === 'user') {
            min = 1024;
            max = 49151;
        } else if (range === 'dynamic') {
            min = 49152;
            max = 65535;
        } else {
            min = 1024;
            max = 65535;
        }
        
        const ports = [];
        for (let i = 0; i < count; i++) {
            ports.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>${count} Random Port(s):</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-top: 15px;">
                    ${ports.map(port => `
                        <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px; text-align: center; font-size: 20px; font-weight: bold;">
                            ${port}
                        </div>
                    `).join('')}
                </div>
                <button onclick="ITTools.UI.copyToClipboard('${ports.join(', ')}')" class="ittools-btn ittools-btn-sm" style="margin-top: 15px;">📋 Copy All</button>
            </div>
        `;
        
        ITTools.UI.showResult('port-result', html, true);
    }
};

console.log('ITTools Generator Implementations loaded');
