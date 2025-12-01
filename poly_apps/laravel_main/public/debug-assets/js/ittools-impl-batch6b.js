// ============================================
// NAMESPACE: ITTools.Implementations.Batch6b
// FILE: ittools-impl-batch6b.js
// PURPOSE: Color tools part 2
// ============================================

ITTools.Tools.Registry.register('hex-rgb-converter', {
    name: 'HEX to RGB Converter',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HEX ⇄ RGB Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">HEX Color:</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="hex-input" class="ittools-input" placeholder="#FF5733" value="#FF5733">
                            <input type="color" id="hex-picker" value="#FF5733" onchange="document.getElementById('hex-input').value = this.value; ITTools.Implementations.HexRGB.convert()">
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.HexRGB.convert()">
                            🎨 Convert
                        </button>
                    </div>
                    <div id="hex-rgb-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HexRGB = {
    convert() {
        let hex = document.getElementById('hex-input').value.replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
            ITTools.UI.showResult('hex-rgb-result', 'Invalid HEX color', false);
            return;
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #${hex}; height: 80px; border-radius: 5px; margin-bottom: 15px;"></div>
                <div style="display: grid; gap: 10px;">
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>RGB:</strong> rgb(${r}, ${g}, ${b})</div>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>HEX:</strong> #${hex.toUpperCase()}</div>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>HSL:</strong> ${this.rgbToHsl(r, g, b)}</div>
                </div>
            </div>
        `;
        ITTools.UI.showResult('hex-rgb-result', html, true);
    },
    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
};

// ============================================
// Gradient Generator
// ============================================
ITTools.Tools.Registry.register('gradient-generator', {
    name: 'Gradient Generator',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">CSS Gradient Generator</div>
                <div class="ittools-card-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Color 1:</label>
                            <input type="color" id="grad-color1" class="ittools-input" value="#667eea" onchange="ITTools.Implementations.GradientGen.generate()">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Color 2:</label>
                            <input type="color" id="grad-color2" class="ittools-input" value="#764ba2" onchange="ITTools.Implementations.GradientGen.generate()">
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Direction:</label>
                        <select id="grad-direction" class="ittools-input" onchange="ITTools.Implementations.GradientGen.generate()">
                            <option value="to right">→ Left to Right</option>
                            <option value="to left">← Right to Left</option>
                            <option value="to bottom">↓ Top to Bottom</option>
                            <option value="to top">↑ Bottom to Top</option>
                            <option value="135deg" selected>↘ Diagonal</option>
                        </select>
                    </div>
                    <div id="grad-result" class="ittools-result" style="display: block;"></div>
                </div>
            </div>
        `;
    },
    init() { ITTools.Implementations.GradientGen.generate(); }
});

ITTools.Implementations.GradientGen = {
    generate() {
        const c1 = document.getElementById('grad-color1').value;
        const c2 = document.getElementById('grad-color2').value;
        const dir = document.getElementById('grad-direction').value;
        const css = `linear-gradient(${dir}, ${c1}, ${c2})`;
        const html = `
            <div style="height: 100px; border-radius: 5px; background: ${css}; margin-bottom: 15px;"></div>
            <div style="background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 13px;">
                background: ${css};
            </div>
            <button onclick="ITTools.UI.copyToClipboard('background: ${css};')" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy CSS</button>
        `;
        ITTools.UI.showResult('grad-result', html, true);
    }
};

// ============================================
// Contrast Checker
// ============================================
ITTools.Tools.Registry.register('contrast-checker', {
    name: 'Contrast Checker',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Color Contrast Checker (WCAG)</div>
                <div class="ittools-card-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Text Color:</label>
                            <input type="color" id="contrast-fg" class="ittools-input" value="#000000" onchange="ITTools.Implementations.ContrastChecker.check()">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Background Color:</label>
                            <input type="color" id="contrast-bg" class="ittools-input" value="#ffffff" onchange="ITTools.Implementations.ContrastChecker.check()">
                        </div>
                    </div>
                    <div id="contrast-result" class="ittools-result" style="display: block;"></div>
                </div>
            </div>
        `;
    },
    init() { ITTools.Implementations.ContrastChecker.check(); }
});

ITTools.Implementations.ContrastChecker = {
    getLuminance(hex) {
        const rgb = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
        const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    check() {
        const fg = document.getElementById('contrast-fg').value;
        const bg = document.getElementById('contrast-bg').value;
        const l1 = this.getLuminance(fg);
        const l2 = this.getLuminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const aaLarge = ratio >= 3 ? '✅' : '❌';
        const aa = ratio >= 4.5 ? '✅' : '❌';
        const aaa = ratio >= 7 ? '✅' : '❌';
        const html = `
            <div style="background: ${bg}; color: ${fg}; padding: 30px; border-radius: 5px; text-align: center; margin-bottom: 15px;">
                <div style="font-size: 24px; font-weight: bold;">Sample Text</div>
                <div>The quick brown fox jumps over the lazy dog</div>
            </div>
            <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px; text-align: center; margin-bottom: 15px;">
                <div style="font-size: 14px;">Contrast Ratio</div>
                <div style="font-size: 36px; font-weight: bold;">${ratio.toFixed(2)}:1</div>
            </div>
            <div style="display: grid; gap: 10px;">
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">${aaLarge} WCAG AA Large Text (3:1)</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">${aa} WCAG AA Normal Text (4.5:1)</div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">${aaa} WCAG AAA Normal Text (7:1)</div>
            </div>
        `;
        ITTools.UI.showResult('contrast-result', html, true);
    }
};

// ============================================
// Palette Generator
// ============================================
ITTools.Tools.Registry.register('palette-generator', {
    name: 'Color Palette Generator',
    category: 'color',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Color Palette Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Base Color:</label>
                        <input type="color" id="palette-base" class="ittools-input" value="#667eea">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PaletteGen.generate()">
                            🎨 Generate Palette
                        </button>
                    </div>
                    <div id="palette-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PaletteGen = {
    generate() {
        const base = document.getElementById('palette-base').value;
        const colors = this.generatePalette(base);
        let html = '<div style="margin-top: 15px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;">';
        colors.forEach(c => {
            html += `<div style="background: ${c}; height: 60px; border-radius: 5px; cursor: pointer;" onclick="ITTools.UI.copyToClipboard('${c}')" title="Click to copy"></div>`;
        });
        html += '</div><div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-top: 5px; font-size: 11px; text-align: center;">';
        colors.forEach(c => html += `<div>${c}</div>`);
        html += '</div>';
        ITTools.UI.showResult('palette-result', html, true);
    },
    generatePalette(hex) {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        const palette = [];
        for (let i = -2; i <= 2; i++) {
            const factor = 1 + i * 0.2;
            const nr = Math.min(255, Math.max(0, Math.round(r * factor)));
            const ng = Math.min(255, Math.max(0, Math.round(g * factor)));
            const nb = Math.min(255, Math.max(0, Math.round(b * factor)));
            palette.push('#' + [nr, ng, nb].map(x => x.toString(16).padStart(2, '0')).join(''));
        }
        return palette;
    }
};

console.log('ITTools Batch 6 Implementations loaded');
