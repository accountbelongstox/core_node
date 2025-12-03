// ============================================
// NAMESPACE: ITTools.Implementations.Generators
// FILE: ittools-impl-generators.js  
// PURPOSE: Generator tool implementations (QR Code, WiFi, Ports)
// NOTE: Additional generators in ittools-impl-generators-2.js
// ============================================

// ============================================
// QR Code Generator
// ============================================
ITTools.Implementations.QRCodeGenerator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/qr-code-generator.html',

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

            if (action.dataset.action === 'generate-qr') {
                this.generate();
            }
        });
    },

    async generate() {
        const text = document.querySelector('[data-input="qr-text-input"]').value.trim();
        const size = document.querySelector('[data-input="qr-size"]').value;
        const resultDiv = document.getElementById('qr-code-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const loading = document.createElement('p');
        loading.className = 'generator-result-loading';
        loading.textContent = 'Generating QR Code...';
        resultDiv.appendChild(loading);
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/qr-code/generate', 'POST', { 
            text, 
            size: parseInt(size) 
        }, { includeAuth: false });
        
        resultDiv.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = result.data.qr_code;
        img.alt = 'QR Code';
        img.className = 'generator-result-image';
        
        const info = document.createElement('p');
        info.className = 'generator-result-info';
        info.textContent = `Size: ${result.data.size}x${result.data.size}`;
        
        resultDiv.appendChild(img);
        resultDiv.appendChild(info);
    }
};

ITTools.Tools.Registry.register('qr-code-generator', {
    name: 'QR Code Generator',
    category: 'generator',
    render: ITTools.Implementations.QRCodeGenerator.render.bind(ITTools.Implementations.QRCodeGenerator),
    init: ITTools.Implementations.QRCodeGenerator.init.bind(ITTools.Implementations.QRCodeGenerator)
});

// ============================================
// WiFi QR Code Generator
// ============================================
ITTools.Implementations.WiFiQRGenerator = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/wifi-qr-generator.html',

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

            if (action.dataset.action === 'generate-wifi-qr') {
                this.generate();
            }
        });
    },

    async generate() {
        const ssid = document.querySelector('[data-input="wifi-ssid"]').value.trim();
        const password = document.querySelector('[data-input="wifi-password"]').value;
        const security = document.querySelector('[data-input="wifi-security"]').value;
        const resultDiv = document.getElementById('wifi-qr-result');
        
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('hidden');
        
        const loading = document.createElement('p');
        loading.className = 'generator-result-loading';
        loading.textContent = 'Generating WiFi QR Code...';
        resultDiv.appendChild(loading);
        
        const result = await apiClientInstance.json('/api/ittools/v1/web/wifi-qr-code/generate', 'POST', { 
            ssid, 
            password, 
            security 
        }, { includeAuth: false });
        
        resultDiv.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = result.data.qr_code;
        img.alt = 'WiFi QR Code';
        img.className = 'generator-result-image';
        
        const info1 = document.createElement('p');
        info1.className = 'generator-result-info';
        info1.textContent = `Scan to connect to: ${result.data.ssid}`;
        
        const info2 = document.createElement('p');
        info2.className = 'generator-result-info-small';
        info2.textContent = `Security: ${result.data.security || 'Open'}`;
        
        resultDiv.appendChild(img);
        resultDiv.appendChild(info1);
        resultDiv.appendChild(info2);
    }
};

ITTools.Tools.Registry.register('wifi-qr-generator', {
    name: 'WiFi QR Code',
    category: 'generator',
    render: ITTools.Implementations.WiFiQRGenerator.render.bind(ITTools.Implementations.WiFiQRGenerator),
    init: ITTools.Implementations.WiFiQRGenerator.init.bind(ITTools.Implementations.WiFiQRGenerator)
});

console.log('ITTools Generator Implementations loaded');
