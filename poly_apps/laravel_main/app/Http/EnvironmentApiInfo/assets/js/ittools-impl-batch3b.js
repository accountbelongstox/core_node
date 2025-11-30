// ============================================
// NAMESPACE: ITTools.Implementations.Batch3b
// FILE: ittools-impl-batch3b.js  
// PURPOSE: Batch 3b - Color Blindness & PDF Tools (3/5 tools)
// ============================================

// ============================================
// Color Blindness Simulator (Client-side)
// ============================================
ITTools.Tools.Registry.register('color-blindness-simulator', {
    name: 'Color Blindness Simulator',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Color Blindness Simulator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Color (HEX):</label>
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px;">
                            <input type="text" id="cb-color" class="ittools-input" placeholder="#FF5733" value="#FF5733" oninput="ITTools.Implementations.ColorBlindness.updatePicker()">
                            <input type="color" id="cb-color-picker" value="#FF5733" onchange="ITTools.Implementations.ColorBlindness.updateHex()">
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ColorBlindness.simulate()">
                            👁️ Simulate Color Blindness
                        </button>
                    </div>
                    <div id="cb-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ColorBlindness = {
    updateHex() {
        document.getElementById('cb-color').value = document.getElementById('cb-color-picker').value;
        this.simulate();
    },
    
    updatePicker() {
        const hex = document.getElementById('cb-color').value;
        if (/^#[0-9A-F]{6}$/i.test(hex)) {
            document.getElementById('cb-color-picker').value = hex;
        }
    },
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
    },
    
    simulateProtanopia(r, g, b) {
        return {
            r: 0.567 * r + 0.433 * g,
            g: 0.558 * r + 0.442 * g,
            b: 0.242 * g + 0.758 * b
        };
    },
    
    simulateDeuteranopia(r, g, b) {
        return {
            r: 0.625 * r + 0.375 * g,
            g: 0.700 * r + 0.300 * g,
            b: 0.300 * g + 0.700 * b
        };
    },
    
    simulateTritanopia(r, g, b) {
        return {
            r: 0.950 * r + 0.050 * g,
            g: 0.433 * g + 0.567 * b,
            b: 0.475 * g + 0.525 * b
        };
    },
    
    simulate() {
        const hex = document.getElementById('cb-color').value;
        const rgb = this.hexToRgb(hex);
        
        if (!rgb) {
            ITTools.UI.showResult('cb-result', 'Invalid color format. Use HEX format like #FF5733', false);
            return;
        }
        
        const protanopia = this.simulateProtanopia(rgb.r, rgb.g, rgb.b);
        const deuteranopia = this.simulateDeuteranopia(rgb.r, rgb.g, rgb.b);
        const tritanopia = this.simulateTritanopia(rgb.r, rgb.g, rgb.b);
        
        const protanopiaHex = this.rgbToHex(protanopia.r, protanopia.g, protanopia.b);
        const deuteranopiaHex = this.rgbToHex(deuteranopia.r, deuteranopia.g, deuteranopia.b);
        const tritanopiaHex = this.rgbToHex(tritanopia.r, tritanopia.g, tritanopia.b);
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div style="text-align: center;">
                        <div style="background: ${hex}; height: 100px; border-radius: 5px; border: 2px solid #ddd;"></div>
                        <strong style="margin-top: 10px; display: block;">Normal Vision</strong>
                        <code>${hex}</code>
                    </div>
                    <div style="text-align: center;">
                        <div style="background: ${protanopiaHex}; height: 100px; border-radius: 5px; border: 2px solid #ddd;"></div>
                        <strong style="margin-top: 10px; display: block;">Protanopia</strong>
                        <code>${protanopiaHex}</code>
                        <small style="display: block; color: #666;">Red-blind (1% males)</small>
                    </div>
                    <div style="text-align: center;">
                        <div style="background: ${deuteranopiaHex}; height: 100px; border-radius: 5px; border: 2px solid #ddd;"></div>
                        <strong style="margin-top: 10px; display: block;">Deuteranopia</strong>
                        <code>${deuteranopiaHex}</code>
                        <small style="display: block; color: #666;">Green-blind (1% males)</small>
                    </div>
                    <div style="text-align: center;">
                        <div style="background: ${tritanopiaHex}; height: 100px; border-radius: 5px; border: 2px solid #ddd;"></div>
                        <strong style="margin-top: 10px; display: block;">Tritanopia</strong>
                        <code>${tritanopiaHex}</code>
                        <small style="display: block; color: #666;">Blue-blind (rare)</small>
                    </div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('cb-result', html, true);
    }
};

// ============================================
// PDF to JPG/PNG (Backend required placeholder)
// ============================================
ITTools.Tools.Registry.register('pdf-to-image', {
    name: 'PDF to JPG/PNG',
    category: 'pdf',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">PDF to Image Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload PDF:</label>
                        <input type="file" id="pdf-file" class="ittools-input" accept=".pdf">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Output Format:</label>
                        <select id="pdf-format" class="ittools-input">
                            <option value="jpg">JPG</option>
                            <option value="png">PNG</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Quality (JPG only):</label>
                        <input type="range" id="pdf-quality" class="ittools-input" min="1" max="100" value="90" oninput="document.getElementById('pdf-quality-value').textContent = this.value + '%'">
                        <span id="pdf-quality-value">90%</span>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PDFToImage.convert()">
                            🖼️ Convert PDF to Images
                        </button>
                    </div>
                    <div id="pdf-image-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PDFToImage = {
    convert() {
        const file = document.getElementById('pdf-file').files[0];
        
        if (!file) {
            ITTools.UI.showResult('pdf-image-result', 'Please select a PDF file', false);
            return;
        }
        
        const html = `
            <div style="margin-top: 15px; background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px;">
                <strong>⚠️ Backend Required</strong><br>
                PDF to Image conversion requires server-side processing.<br><br>
                <strong>Required Libraries:</strong><br>
                • Imagick (PHP)<br>
                • pdf2image (Python)<br>
                • Ghostscript<br><br>
                <strong>Selected File:</strong><br>
                📄 ${file.name}<br>
                📊 Size: ${(file.size / 1024).toFixed(2)} KB<br>
                📅 Modified: ${file.lastModifiedDate.toLocaleDateString()}
            </div>
        `;
        
        ITTools.UI.showResult('pdf-image-result', html, true);
    }
};

// ============================================
// Image to PDF (Backend required placeholder)
// ============================================
ITTools.Tools.Registry.register('image-to-pdf', {
    name: 'Image to PDF',
    category: 'pdf',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image to PDF Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Images:</label>
                        <input type="file" id="image-files" class="ittools-input" accept="image/*" multiple>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Page Size:</label>
                        <select id="pdf-page-size" class="ittools-input">
                            <option value="a4">A4 (210 x 297 mm)</option>
                            <option value="letter">Letter (215.9 x 279.4 mm)</option>
                            <option value="legal">Legal (215.9 x 355.6 mm)</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Orientation:</label>
                        <select id="pdf-orientation" class="ittools-input">
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageToPDF.convert()">
                            📄 Convert to PDF
                        </button>
                    </div>
                    <div id="image-pdf-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageToPDF = {
    convert() {
        const files = document.getElementById('image-files').files;
        
        if (files.length === 0) {
            ITTools.UI.showResult('image-pdf-result', 'Please select at least one image', false);
            return;
        }
        
        let fileList = '<ul style="margin: 10px 0;">';
        for (let i = 0; i < files.length; i++) {
            fileList += `<li>📷 ${files[i].name} (${(files[i].size / 1024).toFixed(2)} KB)</li>`;
        }
        fileList += '</ul>';
        
        const html = `
            <div style="margin-top: 15px; background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px;">
                <strong>⚠️ Library/Backend Required</strong><br>
                Image to PDF conversion can be implemented with:<br><br>
                <strong>Option 1 - Client-side:</strong><br>
                • jsPDF library<br>
                • Add: <code>&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"&gt;&lt;/script&gt;</code><br><br>
                <strong>Option 2 - Server-side:</strong><br>
                • Imagick (PHP)<br>
                • PIL/Pillow (Python)<br><br>
                <strong>Selected ${files.length} image(s):</strong>
                ${fileList}
            </div>
        `;
        
        ITTools.UI.showResult('image-pdf-result', html, true);
    }
};

console.log('ITTools Batch 3b Implementations loaded');
