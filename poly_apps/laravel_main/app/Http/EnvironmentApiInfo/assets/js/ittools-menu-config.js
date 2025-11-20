// ============================================
// NAMESPACE: ITTools.MenuConfig
// FILE: ittools-menu-config.js
// PURPOSE: Centralized menu configuration
// ============================================

const ITToolsMenuConfig = {
    categories: [
        {
            id: 'image-tools',
            icon: '🖼️',
            label: 'Image Tools',
            tools: [
                { id: 'image-converter', label: 'Image Converter', clientSide: false },
                { id: 'image-compressor', label: 'Image Compressor', clientSide: false },
                { id: 'image-resizer', label: 'Image Resizer', clientSide: false },
                { id: 'image-cropper', label: 'Image Cropper', clientSide: false },
                { id: 'image-rotator', label: 'Image Rotator/Flipper', clientSide: false },
                { id: 'color-picker-image', label: 'Color Picker from Image', clientSide: false }
            ]
        },
        {
            id: 'pdf-tools',
            icon: '📄',
            label: 'PDF & Document Tools',
            tools: [
                { id: 'pdf-merger', label: 'PDF Merger', clientSide: false },
                { id: 'pdf-splitter', label: 'PDF Splitter', clientSide: false },
                { id: 'pdf-compressor', label: 'PDF Compressor', clientSide: false },
                { id: 'pdf-password', label: 'PDF Password Protector', clientSide: false },
                { id: 'pdf-unlock', label: 'Unlock PDF', clientSide: false },
                { id: 'pdf-watermark', label: 'PDF Watermark', clientSide: false },
                { id: 'pdf-rotate', label: 'PDF Page Rotator', clientSide: false },
                { id: 'pdf-to-image', label: 'PDF to JPG/PNG', clientSide: false },
                { id: 'image-to-pdf', label: 'Image to PDF', clientSide: false }
            ]
        },
        {
            id: 'calculator-tools',
            icon: '🧮',
            label: 'Calculator Tools',
            tools: [
                { id: 'age-calculator', label: 'Age Calculator', clientSide: true },
                { id: 'bmi-calculator', label: 'BMI Calculator', clientSide: true },
                { id: 'loan-calculator', label: 'Loan EMI Calculator', clientSide: true },
                { id: 'gst-calculator', label: 'GST Calculator', clientSide: true },
                { id: 'percentage-calculator', label: 'Percentage Calculator', clientSide: true },
                { id: 'number-to-words', label: 'Number to Words', clientSide: true },
                { id: 'unit-converter-advanced', label: 'Unit Converter', clientSide: true },
                { id: 'currency-converter', label: 'Currency Converter', clientSide: false }
            ]
        },
        {
            id: 'color-tools-advanced',
            icon: '🎨',
            label: 'Color Tools',
            tools: [
                { id: 'hex-rgb-converter', label: 'HEX to RGB Converter', clientSide: true },
                { id: 'gradient-generator', label: 'Gradient Generator', clientSide: true },
                { id: 'contrast-checker', label: 'Contrast Checker', clientSide: true },
                { id: 'palette-generator', label: 'Palette Generator', clientSide: true },
                { id: 'color-blindness', label: 'Color Blindness Simulator', clientSide: true }
            ]
        },
        {
            id: 'text-tools-advanced',
            icon: '✍️',
            label: 'Text Tools Advanced',
            tools: [
                { id: 'duplicate-remover', label: 'Remove Duplicate Lines', clientSide: true },
                { id: 'text-sorter', label: 'Text Sorter', clientSide: true },
                { id: 'text-reverser', label: 'Text Reverser', clientSide: true },
                { id: 'word-counter-seo', label: 'Word Counter (SEO)', clientSide: true },
                { id: 'keyword-density', label: 'Keyword Density Checker', clientSide: true },
                { id: 'text-encryptor', label: 'Text Encryptor/Decryptor', clientSide: false }
            ]
        },
        {
            id: 'seo-tools',
            icon: '📈',
            label: 'SEO & Marketing',
            tools: [
                { id: 'meta-analyzer', label: 'Meta Tag Analyzer', clientSide: false },
                { id: 'keyword-density-tool', label: 'Keyword Density Checker', clientSide: true },
                { id: 'word-counter-blog', label: 'Word Counter (Blog)', clientSide: true }
            ]
        },
        {
            id: 'utility-tools-advanced',
            icon: '🔧',
            label: 'Utility Tools',
            tools: [
                { id: 'qr-scanner', label: 'QR Code Scanner', clientSide: true },
                { id: 'barcode-generator', label: 'Barcode Generator', clientSide: false },
                { id: 'timezone-converter', label: 'Time Zone Converter', clientSide: true },
                { id: 'password-generator-advanced', label: 'Password Generator', clientSide: true },
                { id: 'password-strength', label: 'Password Strength Checker', clientSide: true }
            ]
        },
        {
            id: 'crypto-tools',
            icon: '🔐',
            label: 'Crypto & Security',
            tools: [
                { id: 'token-generator', label: 'Token Generator', clientSide: false },
                { id: 'hash-generator', label: 'Hash Generator', clientSide: false },
                { id: 'bcrypt-tool', label: 'Bcrypt Hash/Verify', clientSide: false },
                { id: 'uuid-generator', label: 'UUID Generator', clientSide: false },
                { id: 'ulid-generator', label: 'ULID Generator', clientSide: false },
                { id: 'hmac-generator', label: 'HMAC Generator', clientSide: false },
                { id: 'password-analyzer', label: 'Password Strength Analyzer', clientSide: false },
                { id: 'basic-auth-generator', label: 'Basic Auth Generator', clientSide: false },
                { id: 'bip39-generator', label: 'BIP39 Passphrase', clientSide: false },
                { id: 'rsa-generator', label: 'RSA Key Pair', clientSide: false }
            ]
        },
        {
            id: 'converter-tools',
            icon: '🔄',
            label: 'Converters',
            tools: [
                { id: 'base64-encoder', label: 'Base64 Encoder/Decoder', clientSide: true },
                { id: 'url-encoder', label: 'URL Encoder/Decoder', clientSide: true },
                { id: 'html-encoder', label: 'HTML Entities Encoder', clientSide: true },
                { id: 'case-converter', label: 'Case Converter', clientSide: false },
                { id: 'color-converter', label: 'Color Converter', clientSide: false },
                { id: 'timestamp-converter', label: 'Timestamp Converter', clientSide: true },
                { id: 'base-converter', label: 'Integer Base Converter', clientSide: true },
                { id: 'roman-converter', label: 'Roman Numeral Converter', clientSide: true },
                { id: 'nato-converter', label: 'Text to NATO Alphabet', clientSide: true },
                { id: 'ascii-binary', label: 'Text to ASCII Binary', clientSide: true },
                { id: 'json-yaml', label: 'JSON ⇄ YAML', clientSide: true },
                { id: 'json-xml', label: 'JSON ⇄ XML', clientSide: true },
                { id: 'markdown-html', label: 'Markdown to HTML', clientSide: true }
            ]
        },
        {
            id: 'text-tools',
            icon: '📝',
            label: 'Text Tools',
            tools: [
                { id: 'text-diff', label: 'Text Diff', clientSide: true },
                { id: 'text-stats', label: 'Text Statistics', clientSide: true },
                { id: 'lorem-generator', label: 'Lorem Ipsum Generator', clientSide: true },
                { id: 'slugify', label: 'Slugify String', clientSide: false },
                { id: 'emoji-picker', label: 'Emoji Picker', clientSide: true },
                { id: 'string-obfuscator', label: 'String Obfuscator', clientSide: true },
                { id: 'numeronym-generator', label: 'Numeronym Generator', clientSide: true },
                { id: 'ascii-art', label: 'ASCII Art Generator', clientSide: true }
            ]
        },
        {
            id: 'formatter-tools',
            icon: '✨',
            label: 'Formatters',
            tools: [
                { id: 'json-formatter', label: 'JSON Formatter', clientSide: true },
                { id: 'xml-formatter', label: 'XML Formatter', clientSide: true },
                { id: 'yaml-formatter', label: 'YAML Formatter', clientSide: true },
                { id: 'sql-formatter', label: 'SQL Formatter', clientSide: true },
                { id: 'html-formatter', label: 'HTML Formatter', clientSide: true },
                { id: 'css-formatter', label: 'CSS Formatter', clientSide: true }
            ]
        },
        {
            id: 'web-tools',
            icon: '🌐',
            label: 'Web Tools',
            tools: [
                { id: 'url-parser', label: 'URL Parser', clientSide: true },
                { id: 'query-string-parser', label: 'Query String Parser', clientSide: true },
                { id: 'jwt-parser', label: 'JWT Parser', clientSide: true },
                { id: 'user-agent-parser', label: 'User Agent Parser', clientSide: true },
                { id: 'http-status', label: 'HTTP Status Codes', clientSide: true },
                { id: 'mime-types', label: 'MIME Types', clientSide: true },
                { id: 'device-info', label: 'Device Information', clientSide: true },
                { id: 'keycode-info', label: 'Keycode Info', clientSide: true }
            ]
        },
        {
            id: 'generator-tools',
            icon: '🎲',
            label: 'Generators',
            tools: [
                { id: 'qr-generator', label: 'QR Code Generator', clientSide: true },
                { id: 'wifi-qr', label: 'WiFi QR Code', clientSide: true },
                { id: 'svg-placeholder', label: 'SVG Placeholder', clientSide: true },
                { id: 'random-port', label: 'Random Port', clientSide: true },
                { id: 'crontab-generator', label: 'Crontab Generator', clientSide: true },
                { id: 'og-meta', label: 'Open Graph Meta', clientSide: true },
                { id: 'otp-generator', label: 'OTP Code Generator', clientSide: false }
            ]
        },
        {
            id: 'math-tools',
            icon: '🔢',
            label: 'Math & Calc',
            tools: [
                { id: 'math-evaluator', label: 'Math Evaluator', clientSide: true },
                { id: 'percentage-calc', label: 'Percentage Calculator', clientSide: true },
                { id: 'eta-calculator', label: 'ETA Calculator', clientSide: true },
                { id: 'temperature-converter', label: 'Temperature Converter', clientSide: true },
                { id: 'unit-converter', label: 'Unit Converter', clientSide: true }
            ]
        },
        {
            id: 'network-tools',
            icon: '🌍',
            label: 'Network Tools',
            tools: [
                { id: 'ipv4-subnet', label: 'IPv4 Subnet Calculator', clientSide: true },
                { id: 'ipv4-converter', label: 'IPv4 Converter', clientSide: true },
                { id: 'ipv6-ula', label: 'IPv6 ULA Generator', clientSide: true },
                { id: 'mac-lookup', label: 'MAC Address Lookup', clientSide: false },
                { id: 'mac-generator', label: 'MAC Generator', clientSide: true }
            ]
        },
        {
            id: 'dev-tools',
            icon: '💻',
            label: 'Development',
            tools: [
                { id: 'regex-tester', label: 'Regex Tester', clientSide: true },
                { id: 'regex-cheatsheet', label: 'Regex Cheatsheet', clientSide: true },
                { id: 'git-cheatsheet', label: 'Git Cheatsheet', clientSide: true },
                { id: 'chmod-calculator', label: 'Chmod Calculator', clientSide: true },
                { id: 'docker-converter', label: 'Docker Run → Compose', clientSide: true },
                { id: 'json-diff', label: 'JSON Diff', clientSide: true },
                { id: 'json-csv', label: 'JSON to CSV', clientSide: true }
            ]
        },
        {
            id: 'data-tools',
            icon: '📊',
            label: 'Data Tools',
            tools: [
                { id: 'phone-parser', label: 'Phone Parser', clientSide: true },
                { id: 'iban-validator', label: 'IBAN Validator', clientSide: true },
                { id: 'email-normalizer', label: 'Email Normalizer', clientSide: true }
            ]
        }
    ],
    
    getTool(toolId) {
        for (const category of this.categories) {
            const tool = category.tools.find(t => t.id === toolId);
            if (tool) {
                return { ...tool, categoryId: category.id };
            }
        }
        return null;
    },
    
    getCategory(categoryId) {
        return this.categories.find(c => c.id === categoryId);
    },
    
    getAllTools() {
        return this.categories.flatMap(cat => 
            cat.tools.map(tool => ({ ...tool, categoryId: cat.id }))
        );
    },
    
    renderMenu() {
        return this.categories.map(category => `
            <div class="ittools-menu-group">
                <div class="ittools-menu-group-header" data-group-id="${category.id}">
                    <span>${category.icon} ${category.label}</span>
                    <span class="ittools-menu-toggle">▶</span>
                </div>
                <div class="ittools-submenu" data-submenu-of="${category.id}">
                    ${category.tools.map(tool => `
                        <div class="ittools-submenu-item" data-submenu-id="${tool.id}" ${tool.clientSide ? 'data-client-side="true"' : ''}>
                            ${tool.label}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
};

console.log('ITTools Menu Config loaded:', ITToolsMenuConfig.categories.length, 'categories');
