// ============================================
// NAMESPACE: ITTools.Implementations.Batch15
// FILE: ittools-impl-batch15.js
// PURPOSE: Image/PDF tools, remaining items
// ============================================

// ============================================
// Barcode Generator
// ============================================
ITTools.Tools.Registry.register('barcode-generator', {
    name: 'Barcode Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Barcode Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text/Code:</label>
                        <input type="text" id="barcode-input" class="ittools-input" placeholder="Enter text or number...">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Barcode Type:</label>
                        <select id="barcode-type" class="ittools-input">
                            <option value="128">Code 128</option>
                            <option value="39">Code 39</option>
                            <option value="ean13">EAN-13</option>
                            <option value="upc">UPC-A</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BarcodeGenerator.generate()">Generate Barcode</button>
                    </div>
                    <div id="barcode-result" class="ittools-result" style="display: none;"></div>
                    <p style="color:#666;font-size:12px;margin-top:10px;">Note: For full barcode support, integrate a barcode library like JsBarcode.</p>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BarcodeGenerator = {
    generate() {
        const text = document.getElementById('barcode-input').value.trim();
        const type = document.getElementById('barcode-type').value;
        if (!text) { ITTools.UI.showResult('barcode-result', 'Please enter text', false); return; }
        const apiUrl = `https://barcodeapi.org/api/${type}/${encodeURIComponent(text)}`;
        ITTools.UI.showResult('barcode-result', `
            <div style="text-align:center;background:#fff;padding:20px;border-radius:5px;">
                <img src="${apiUrl}" alt="Barcode" style="max-width:100%;">
                <br><br>
                <a href="${apiUrl}" download="barcode.png" class="ittools-btn ittools-btn-sm">Download</a>
            </div>
        `, true);
    }
};

// ============================================
// Basic Auth Generator
// ============================================
ITTools.Tools.Registry.register('basic-auth-generator', {
    name: 'Basic Auth Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTTP Basic Auth Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Username:</label>
                            <input type="text" id="basic-user" class="ittools-input" placeholder="username" oninput="ITTools.Implementations.BasicAuth.generate()">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Password:</label>
                            <input type="text" id="basic-pass" class="ittools-input" placeholder="password" oninput="ITTools.Implementations.BasicAuth.generate()">
                        </div>
                    </div>
                    <div id="basic-auth-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BasicAuth = {
    generate() {
        const user = document.getElementById('basic-user').value;
        const pass = document.getElementById('basic-pass').value;
        if (!user && !pass) { document.getElementById('basic-auth-result').innerHTML = ''; return; }
        const encoded = btoa(`${user}:${pass}`);
        const header = `Authorization: Basic ${encoded}`;
        document.getElementById('basic-auth-result').innerHTML = `
            <div style="display:grid;gap:10px;">
                <div style="background:#f8f9fa;padding:15px;border-radius:5px;">
                    <strong>Base64 Encoded:</strong><br>
                    <code style="word-break:break-all;">${encoded}</code>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${encoded}')" style="margin-left:10px;">Copy</button>
                </div>
                <div style="background:#667eea;color:white;padding:15px;border-radius:5px;">
                    <strong>HTTP Header:</strong><br>
                    <code style="word-break:break-all;">${header}</code>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${header}')" style="margin-left:10px;background:rgba(255,255,255,0.2);border:none;">Copy</button>
                </div>
            </div>
        `;
    }
};

// ============================================
// Image tools placeholders (require backend)
// ============================================
ITTools.Tools.Registry.register('image-converter', {
    name: 'Image Converter',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Format Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-conv-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Convert To:</label>
                        <select id="img-conv-format" class="ittools-input">
                            <option value="png">PNG</option>
                            <option value="jpeg">JPEG</option>
                            <option value="webp">WebP</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageConverter.convert()">Convert</button>
                    </div>
                    <div id="img-conv-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageConverter = {
    convert() {
        const file = document.getElementById('img-conv-file').files[0];
        const format = document.getElementById('img-conv-format').value;
        if (!file) { ITTools.UI.showResult('img-conv-result', 'Please select an image', false); return; }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
            const dataUrl = canvas.toDataURL(mimeType, 0.9);
            ITTools.UI.showResult('img-conv-result', `
                <div style="text-align:center;">
                    <img src="${dataUrl}" style="max-width:300px;border:1px solid #ddd;border-radius:5px;">
                    <br><br>
                    <a href="${dataUrl}" download="converted.${format}" class="ittools-btn ittools-btn-primary">Download ${format.toUpperCase()}</a>
                </div>
            `, true);
        };
        img.src = URL.createObjectURL(file);
    }
};

ITTools.Tools.Registry.register('image-resizer', {
    name: 'Image Resizer',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Resizer</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-resize-file" class="ittools-input" accept="image/*" onchange="ITTools.Implementations.ImageResizer.preview()">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Width:</label>
                            <input type="number" id="img-resize-w" class="ittools-input" placeholder="800">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Height:</label>
                            <input type="number" id="img-resize-h" class="ittools-input" placeholder="600">
                        </div>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label><input type="checkbox" id="img-resize-aspect" checked> Maintain aspect ratio</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageResizer.resize()">Resize</button>
                    </div>
                    <div id="img-resize-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageResizer = {
    originalWidth: 0, originalHeight: 0,
    preview() {
        const file = document.getElementById('img-resize-file').files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            this.originalWidth = img.width;
            this.originalHeight = img.height;
            document.getElementById('img-resize-w').placeholder = img.width;
            document.getElementById('img-resize-h').placeholder = img.height;
        };
        img.src = URL.createObjectURL(file);
    },
    resize() {
        const file = document.getElementById('img-resize-file').files[0];
        if (!file) { ITTools.UI.showResult('img-resize-result', 'Please select an image', false); return; }
        let width = parseInt(document.getElementById('img-resize-w').value) || this.originalWidth;
        let height = parseInt(document.getElementById('img-resize-h').value) || this.originalHeight;
        const maintainAspect = document.getElementById('img-resize-aspect').checked;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            if (maintainAspect && document.getElementById('img-resize-w').value) {
                height = Math.round(img.height * (width / img.width));
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            ITTools.UI.showResult('img-resize-result', `
                <div style="text-align:center;">
                    <p>Original: ${img.width}x${img.height} → New: ${width}x${height}</p>
                    <img src="${dataUrl}" style="max-width:300px;border:1px solid #ddd;border-radius:5px;">
                    <br><br>
                    <a href="${dataUrl}" download="resized.png" class="ittools-btn ittools-btn-primary">Download</a>
                </div>
            `, true);
        };
        img.src = URL.createObjectURL(file);
    }
};

ITTools.Tools.Registry.register('image-rotator', {
    name: 'Image Rotator/Flipper',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Rotator / Flipper</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-rotate-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn" onclick="ITTools.Implementations.ImageRotator.transform(90)">Rotate 90°</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.ImageRotator.transform(180)">Rotate 180°</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.ImageRotator.transform(270)">Rotate 270°</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.ImageRotator.flip('h')">Flip Horizontal</button>
                        <button class="ittools-btn" onclick="ITTools.Implementations.ImageRotator.flip('v')">Flip Vertical</button>
                    </div>
                    <div id="img-rotate-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageRotator = {
    transform(angle) {
        const file = document.getElementById('img-rotate-file').files[0];
        if (!file) { ITTools.UI.showResult('img-rotate-result', 'Please select an image', false); return; }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            const rad = angle * Math.PI / 180;
            if (angle === 90 || angle === 270) { canvas.width = img.height; canvas.height = img.width; }
            else { canvas.width = img.width; canvas.height = img.height; }
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            const dataUrl = canvas.toDataURL('image/png');
            ITTools.UI.showResult('img-rotate-result', `<div style="text-align:center;"><img src="${dataUrl}" style="max-width:300px;border:1px solid #ddd;border-radius:5px;"><br><br><a href="${dataUrl}" download="rotated.png" class="ittools-btn ittools-btn-primary">Download</a></div>`, true);
        };
        img.src = URL.createObjectURL(file);
    },
    flip(dir) {
        const file = document.getElementById('img-rotate-file').files[0];
        if (!file) { ITTools.UI.showResult('img-rotate-result', 'Please select an image', false); return; }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width; canvas.height = img.height;
            if (dir === 'h') { ctx.scale(-1, 1); ctx.drawImage(img, -img.width, 0); }
            else { ctx.scale(1, -1); ctx.drawImage(img, 0, -img.height); }
            const dataUrl = canvas.toDataURL('image/png');
            ITTools.UI.showResult('img-rotate-result', `<div style="text-align:center;"><img src="${dataUrl}" style="max-width:300px;border:1px solid #ddd;border-radius:5px;"><br><br><a href="${dataUrl}" download="flipped.png" class="ittools-btn ittools-btn-primary">Download</a></div>`, true);
        };
        img.src = URL.createObjectURL(file);
    }
};

ITTools.Tools.Registry.register('color-picker-image', {
    name: 'Color Picker from Image',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Color Picker from Image</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="color-pick-file" class="ittools-input" accept="image/*" onchange="ITTools.Implementations.ColorPicker.load()">
                    </div>
                    <div id="color-pick-canvas-wrap" style="margin-top:15px;display:none;">
                        <p style="color:#666;font-size:12px;margin-bottom:10px;">Click on image to pick color</p>
                        <canvas id="color-pick-canvas" style="max-width:100%;cursor:crosshair;border:1px solid #ddd;"></canvas>
                    </div>
                    <div id="color-pick-result" style="margin-top:15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ColorPicker = {
    canvas: null, ctx: null,
    load() {
        const file = document.getElementById('color-pick-file').files[0];
        if (!file) return;
        this.canvas = document.getElementById('color-pick-canvas');
        this.ctx = this.canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
            document.getElementById('color-pick-canvas-wrap').style.display = 'block';
            this.canvas.onclick = (e) => this.pick(e);
        };
        img.src = URL.createObjectURL(file);
    },
    pick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * (this.canvas.width / rect.width));
        const y = Math.floor((e.clientY - rect.top) * (this.canvas.height / rect.height));
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
        const rgb = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        document.getElementById('color-pick-result').innerHTML = `
            <div style="display:grid;grid-template-columns:60px 1fr;gap:10px;align-items:center;">
                <div style="width:60px;height:60px;background:${hex};border-radius:5px;border:1px solid #ddd;"></div>
                <div>
                    <div style="margin-bottom:5px;"><strong>HEX:</strong> ${hex} <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${hex}')">Copy</button></div>
                    <div><strong>RGB:</strong> ${rgb} <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${rgb}')">Copy</button></div>
                </div>
            </div>
        `;
    }
};

// ============================================
// PDF tools placeholders (require backend)
// ============================================
const pdfPlaceholder = (title) => `
    <div class="ittools-card">
        <div class="ittools-card-header">${title}</div>
        <div class="ittools-card-body">
            <div style="background:#fff3cd;padding:20px;border-radius:5px;text-align:center;">
                <p style="font-size:48px;margin-bottom:10px;">📄</p>
                <p><strong>${title}</strong></p>
                <p style="color:#666;margin-top:10px;">This tool requires backend processing for PDF manipulation.</p>
                <p style="color:#666;">Use a library like pdf-lib, pdfjs, or server-side tools.</p>
            </div>
        </div>
    </div>
`;

ITTools.Tools.Registry.register('pdf-merger', { name: 'PDF Merger', category: 'pdf', render() { return pdfPlaceholder('PDF Merger'); } });
ITTools.Tools.Registry.register('pdf-compressor', { name: 'PDF Compressor', category: 'pdf', render() { return pdfPlaceholder('PDF Compressor'); } });
ITTools.Tools.Registry.register('pdf-password', { name: 'PDF Password Protector', category: 'pdf', render() { return pdfPlaceholder('PDF Password Protector'); } });
ITTools.Tools.Registry.register('pdf-rotate', { name: 'PDF Page Rotator', category: 'pdf', render() { return pdfPlaceholder('PDF Page Rotator'); } });
ITTools.Tools.Registry.register('meta-analyzer', { name: 'Meta Tag Analyzer', category: 'seo', render() { return pdfPlaceholder('Meta Tag Analyzer (requires URL fetch)'); } });

console.log('ITTools Batch 15 loaded (barcode-generator, basic-auth-generator, image tools, pdf placeholders)');
