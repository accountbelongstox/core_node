// ============================================
// NAMESPACE: ITTools.Implementations.Batch6
// FILE: ittools-impl-batch6.js  
// PURPOSE: Batch 6 - Calculator & Color Tools (10 tools)
// ============================================

// ============================================
// Age Calculator
// ============================================
ITTools.Tools.Registry.register('age-calculator', {
    name: 'Age Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Age Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Date of Birth:</label>
                        <input type="date" id="age-dob" class="ittools-input">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.AgeCalculator.calculate()">
                            🎂 Calculate Age
                        </button>
                    </div>
                    <div id="age-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.AgeCalculator = {
    calculate() {
        const dob = new Date(document.getElementById('age-dob').value);
        if (isNaN(dob.getTime())) {
            ITTools.UI.showResult('age-result', 'Please select a valid date', false);
            return;
        }
        const today = new Date();
        let years = today.getFullYear() - dob.getFullYear();
        let months = today.getMonth() - dob.getMonth();
        let days = today.getDate() - dob.getDate();
        if (days < 0) { months--; days += 30; }
        if (months < 0) { years--; months += 12; }
        const totalDays = Math.floor((today - dob) / (1000 * 60 * 60 * 24));
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold;">${years}</div>
                    <div>Years Old</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${years}</strong><br>Years
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${months}</strong><br>Months
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${days}</strong><br>Days
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center;">
                    Total: <strong>${totalDays.toLocaleString()}</strong> days lived
                </div>
            </div>
        `;
        ITTools.UI.showResult('age-result', html, true);
    }
};

// ============================================
// BMI Calculator
// ============================================
ITTools.Tools.Registry.register('bmi-calculator', {
    name: 'BMI Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">BMI Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Weight (kg):</label>
                        <input type="number" id="bmi-weight" class="ittools-input" placeholder="70" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Height (cm):</label>
                        <input type="number" id="bmi-height" class="ittools-input" placeholder="175">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BMICalculator.calculate()">
                            ⚖️ Calculate BMI
                        </button>
                    </div>
                    <div id="bmi-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BMICalculator = {
    calculate() {
        const weight = parseFloat(document.getElementById('bmi-weight').value);
        const height = parseFloat(document.getElementById('bmi-height').value) / 100;
        if (!weight || !height) {
            ITTools.UI.showResult('bmi-result', 'Please enter weight and height', false);
            return;
        }
        const bmi = weight / (height * height);
        let category, color;
        if (bmi < 18.5) { category = 'Underweight'; color = '#17a2b8'; }
        else if (bmi < 25) { category = 'Normal'; color = '#28a745'; }
        else if (bmi < 30) { category = 'Overweight'; color = '#ffc107'; }
        else { category = 'Obese'; color = '#dc3545'; }
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: ${color}; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold;">${bmi.toFixed(1)}</div>
                    <div style="font-size: 18px;">${category}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; font-size: 13px;">
                    <strong>BMI Categories:</strong><br>
                    Underweight: &lt; 18.5 | Normal: 18.5-24.9 | Overweight: 25-29.9 | Obese: ≥ 30
                </div>
            </div>
        `;
        ITTools.UI.showResult('bmi-result', html, true);
    }
};

// ============================================
// Loan EMI Calculator
// ============================================
ITTools.Tools.Registry.register('loan-calculator', {
    name: 'Loan EMI Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Loan EMI Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Loan Amount:</label>
                        <input type="number" id="loan-amount" class="ittools-input" placeholder="100000" value="100000">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Interest Rate (% per year):</label>
                        <input type="number" id="loan-rate" class="ittools-input" placeholder="10" value="10" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Loan Term (months):</label>
                        <input type="number" id="loan-term" class="ittools-input" placeholder="12" value="12">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.LoanCalculator.calculate()">
                            💰 Calculate EMI
                        </button>
                    </div>
                    <div id="loan-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.LoanCalculator = {
    calculate() {
        const P = parseFloat(document.getElementById('loan-amount').value);
        const r = parseFloat(document.getElementById('loan-rate').value) / 100 / 12;
        const n = parseInt(document.getElementById('loan-term').value);
        if (!P || !r || !n) {
            ITTools.UI.showResult('loan-result', 'Please fill all fields', false);
            return;
        }
        const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        const totalPayment = emi * n;
        const totalInterest = totalPayment - P;
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px;">Monthly EMI</div>
                    <div style="font-size: 36px; font-weight: bold;">$${emi.toFixed(2)}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Total Payment:</strong><br>$${totalPayment.toFixed(2)}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Total Interest:</strong><br>$${totalInterest.toFixed(2)}
                    </div>
                </div>
            </div>
        `;
        ITTools.UI.showResult('loan-result', html, true);
    }
};

// ============================================
// GST Calculator
// ============================================
ITTools.Tools.Registry.register('gst-calculator', {
    name: 'GST Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">GST Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Amount:</label>
                        <input type="number" id="gst-amount" class="ittools-input" placeholder="1000" value="1000">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">GST Rate (%):</label>
                        <select id="gst-rate" class="ittools-input">
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18" selected>18%</option>
                            <option value="28">28%</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Calculation Type:</label>
                        <select id="gst-type" class="ittools-input">
                            <option value="exclusive">Add GST (Exclusive)</option>
                            <option value="inclusive">Remove GST (Inclusive)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.GSTCalculator.calculate()">
                            🧾 Calculate GST
                        </button>
                    </div>
                    <div id="gst-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.GSTCalculator = {
    calculate() {
        const amount = parseFloat(document.getElementById('gst-amount').value);
        const rate = parseFloat(document.getElementById('gst-rate').value);
        const type = document.getElementById('gst-type').value;
        if (!amount) {
            ITTools.UI.showResult('gst-result', 'Please enter an amount', false);
            return;
        }
        let baseAmount, gstAmount, totalAmount;
        if (type === 'exclusive') {
            baseAmount = amount;
            gstAmount = amount * (rate / 100);
            totalAmount = amount + gstAmount;
        } else {
            totalAmount = amount;
            baseAmount = amount / (1 + rate / 100);
            gstAmount = totalAmount - baseAmount;
        }
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <strong>Base Amount:</strong> $${baseAmount.toFixed(2)}
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px;">
                    <strong>GST (${rate}%):</strong> $${gstAmount.toFixed(2)}
                </div>
                <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px;">
                    <strong>Total Amount:</strong> $${totalAmount.toFixed(2)}
                </div>
            </div>
        `;
        ITTools.UI.showResult('gst-result', html, true);
    }
};

// ============================================
// Percentage Calculator
// ============================================
ITTools.Tools.Registry.register('percentage-calculator', {
    name: 'Percentage Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Percentage Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">What is <input type="number" id="pct-x" style="width: 80px; display: inline;"> % of <input type="number" id="pct-y" style="width: 100px; display: inline;"> ?</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PercentCalc.calculate()">
                            📊 Calculate
                        </button>
                    </div>
                    <div id="pct-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PercentCalc = {
    calculate() {
        const x = parseFloat(document.getElementById('pct-x').value);
        const y = parseFloat(document.getElementById('pct-y').value);
        if (isNaN(x) || isNaN(y)) {
            ITTools.UI.showResult('pct-result', 'Please enter both values', false);
            return;
        }
        const result = (x / 100) * y;
        const html = `
            <div style="margin-top: 15px; background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                <div style="font-size: 14px;">${x}% of ${y} =</div>
                <div style="font-size: 36px; font-weight: bold;">${result.toFixed(2)}</div>
            </div>
        `;
        ITTools.UI.showResult('pct-result', html, true);
    }
};

// ============================================
// HEX to RGB Converter
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
