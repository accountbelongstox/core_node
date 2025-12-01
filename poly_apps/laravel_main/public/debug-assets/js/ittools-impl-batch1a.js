// ============================================
// NAMESPACE: ITTools.Implementations.Batch1a
// FILE: ittools-impl-batch1a.js  
// PURPOSE: Batch 1a - ASCII Art & Unit Converter (2/5 tools)
// ============================================

// ============================================
// ASCII Art Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('ascii-art', {
    name: 'ASCII Art Generator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">ASCII Art Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text:</label>
                        <input type="text" id="ascii-text" class="ittools-input" placeholder="Hello" maxlength="20">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Font Style:</label>
                        <select id="ascii-font" class="ittools-input">
                            <option value="block">Block</option>
                            <option value="banner">Banner</option>
                            <option value="simple">Simple</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ASCIIArt.generate()">
                            🎨 Generate ASCII Art
                        </button>
                    </div>
                    <div id="ascii-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ASCIIArt = {
    fonts: {
        block: {
            'A': ['  ████  ', ' ██  ██ ', '████████', '██    ██', '██    ██'],
            'B': ['███████ ', '##    ██', '███████ ', '██    ██', '███████ '],
            'C': [' ██████ ', '██      ', '██      ', '██      ', ' ██████ '],
            'D': ['███████ ', '██    ██', '██    ██', '██    ██', '███████ '],
            'E': ['████████', '██      ', '██████  ', '██      ', '████████'],
            'F': ['████████', '██      ', '██████  ', '██      ', '██      '],
            'G': [' ██████ ', '##      ', '██  ████', '██    ██', ' ██████ '],
            'H': ['██    ██', '██    ██', '████████', '##    ██', '██    ██'],
            'I': ['████████', '   ██   ', '   ██   ', '   ██   ', '████████'],
            'J': ['████████', '     ██ ', '     ██ ', '██   ██ ', ' █████  '],
            'K': ['██   ██ ', '##  ██  ', '█████   ', '██  ██  ', '██   ██ '],
            'L': ['██      ', '##      ', '██      ', '##      ', '████████'],
            'M': ['███  ███', '████████', '## ██ ██', '██    ██', '██    ██'],
            'N': ['██    ██', '###   ██', '####  ██', '## ██ ██', '##   ███'],
            'O': [' ██████ ', '##    ██', '##    ██', '##    ██', ' ██████ '],
            'P': ['███████ ', '##    ██', '███████ ', '##      ', '██      '],
            'Q': [' ██████ ', '##    ██', '##    ██', '##  ████', ' #### ██'],
            'R': ['███████ ', '##    ██', '███████ ', '##   ██ ', '##    ██'],
            'S': [' ███████', '##      ', ' ██████ ', '      ██', '███████ '],
            'T': ['████████', '   ██   ', '   ██   ', '   ██   ', '   ██   '],
            'U': ['██    ██', '##    ██', '##    ██', '##    ██', ' ██████ '],
            'V': ['██    ██', '##    ██', '##    ██', ' ##  ██ ', '  ████  '],
            'W': ['██    ██', '##    ██', '## ██ ██', '████████', '###  ███'],
            'X': ['██    ██', ' ##  ██ ', '  ████  ', ' ##  ██ ', '##    ██'],
            'Y': ['██    ██', ' ##  ██ ', '  ████  ', '   ██   ', '   ██   '],
            'Z': ['████████', '    ##  ', '   ██   ', '  ##    ', '████████'],
            '0': [' ██████ ', '##    ██', '##    ██', '##    ██', ' ██████ '],
            '1': ['   ██   ', '  ###   ', '   ██   ', '   ██   ', '████████'],
            '2': [' ██████ ', '##    ██', '   ███  ', '  ##    ', '████████'],
            '3': [' ██████ ', '##    ██', '   ███  ', '##    ██', ' ██████ '],
            '4': ['██   ██ ', '##   ██ ', '████████', '     ## ', '     ██ '],
            '5': ['████████', '##      ', '███████ ', '      ██', '███████ '],
            '6': [' ██████ ', '##      ', '███████ ', '##    ██', ' ██████ '],
            '7': ['████████', '     ## ', '    ██  ', '   ██   ', '  ##    '],
            '8': [' ██████ ', '##    ██', ' ██████ ', '##    ██', ' ██████ '],
            '9': [' ██████ ', '##    ██', ' ███████', '      ██', ' ██████ '],
            ' ': ['        ', '        ', '        ', '        ', '        '],
            '!': ['   ██   ', '   ██   ', '   ██   ', '        ', '   ██   ']
        }
    },
    
    generate() {
        const text = document.getElementById('ascii-text').value.toUpperCase();
        const font = document.getElementById('ascii-font').value;
        
        if (!text) {
            ITTools.UI.showResult('ascii-result', 'Please enter text', false);
            return;
        }
        
        let lines = ['', '', '', '', ''];
        const chars = text.split('');
        
        chars.forEach(char => {
            const charArt = this.fonts.block[char] || this.fonts.block[' '];
            for (let i = 0; i < 5; i++) {
                lines[i] += charArt[i] + ' ';
            }
        });
        
        const art = lines.join('\n');
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>ASCII Art:</strong>
                <pre style="background: #2c3e50; color: #00ff00; padding: 20px; border-radius: 5px; font-family: monospace; font-size: 12px; overflow-x: auto; line-height: 1.2;">${art}</pre>
                <button onclick="ITTools.UI.copyToClipboard(\`${art.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('ascii-result', html, true);
    }
};

// ============================================
// Unit Converter Advanced (Client-side)
// ============================================
ITTools.Tools.Registry.register('unit-converter-advanced', {
    name: 'Unit Converter',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Advanced Unit Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Category:</label>
                        <select id="unit-category" class="ittools-input" onchange="ITTools.Implementations.UnitConverter.updateUnits()">
                            <option value="length">Length</option>
                            <option value="weight">Weight</option>
                            <option value="temperature">Temperature</option>
                            <option value="volume">Volume</option>
                            <option value="time">Time</option>
                            <option value="speed">Speed</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From:</label>
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                            <input type="number" id="unit-value" class="ittools-input" placeholder="Enter value" oninput="ITTools.Implementations.UnitConverter.convert()">
                            <select id="unit-from" class="ittools-input" onchange="ITTools.Implementations.UnitConverter.convert()"></select>
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">To:</label>
                        <select id="unit-to" class="ittools-input" onchange="ITTools.Implementations.UnitConverter.convert()"></select>
                    </div>
                    <div id="unit-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UnitConverter = {
    units: {
        length: {
            'mm': { name: 'Millimeter', toBase: 0.001 },
            'cm': { name: 'Centimeter', toBase: 0.01 },
            'm': { name: 'Meter', toBase: 1 },
            'km': { name: 'Kilometer', toBase: 1000 },
            'in': { name: 'Inch', toBase: 0.0254 },
            'ft': { name: 'Foot', toBase: 0.3048 },
            'yd': { name: 'Yard', toBase: 0.9144 },
            'mi': { name: 'Mile', toBase: 1609.344 }
        },
        weight: {
            'mg': { name: 'Milligram', toBase: 0.001 },
            'g': { name: 'Gram', toBase: 1 },
            'kg': { name: 'Kilogram', toBase: 1000 },
            'oz': { name: 'Ounce', toBase: 28.3495 },
            'lb': { name: 'Pound', toBase: 453.592 },
            'ton': { name: 'Ton', toBase: 907185 }
        },
        temperature: {
            'c': { name: 'Celsius' },
            'f': { name: 'Fahrenheit' },
            'k': { name: 'Kelvin' }
        },
        volume: {
            'ml': { name: 'Milliliter', toBase: 0.001 },
            'l': { name: 'Liter', toBase: 1 },
            'gal': { name: 'Gallon (US)', toBase: 3.78541 },
            'qt': { name: 'Quart', toBase: 0.946353 },
            'pt': { name: 'Pint', toBase: 0.473176 },
            'cup': { name: 'Cup', toBase: 0.236588 }
        },
        time: {
            'ms': { name: 'Millisecond', toBase: 0.001 },
            's': { name: 'Second', toBase: 1 },
            'min': { name: 'Minute', toBase: 60 },
            'h': { name: 'Hour', toBase: 3600 },
            'd': { name: 'Day', toBase: 86400 },
            'wk': { name: 'Week', toBase: 604800 }
        },
        speed: {
            'mps': { name: 'm/s', toBase: 1 },
            'kph': { name: 'km/h', toBase: 0.277778 },
            'mph': { name: 'mph', toBase: 0.44704 },
            'fps': { name: 'ft/s', toBase: 0.3048 },
            'knot': { name: 'Knot', toBase: 0.514444 }
        }
    },
    
    updateUnits() {
        const category = document.getElementById('unit-category').value;
        const units = this.units[category];
        
        const fromSelect = document.getElementById('unit-from');
        const toSelect = document.getElementById('unit-to');
        
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';
        
        Object.entries(units).forEach(([key, unit]) => {
            fromSelect.innerHTML += `<option value="${key}">${unit.name}</option>`;
            toSelect.innerHTML += `<option value="${key}">${unit.name}</option>`;
        });
        
        this.convert();
    },
    
    convert() {
        const value = parseFloat(document.getElementById('unit-value').value);
        const category = document.getElementById('unit-category').value;
        const from = document.getElementById('unit-from').value;
        const to = document.getElementById('unit-to').value;
        
        if (!value && value !== 0) {
            document.getElementById('unit-result').style.display = 'none';
            return;
        }
        
        let result;
        
        if (category === 'temperature') {
            result = this.convertTemperature(value, from, to);
        } else {
            const fromUnit = this.units[category][from];
            const toUnit = this.units[category][to];
            const baseValue = value * fromUnit.toBase;
            result = baseValue / toUnit.toBase;
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Result</div>
                    <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">${result.toFixed(6)}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${this.units[category][to].name}</div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('unit-result', html, true);
    },
    
    convertTemperature(value, from, to) {
        let celsius;
        
        if (from === 'c') celsius = value;
        else if (from === 'f') celsius = (value - 32) * 5/9;
        else if (from === 'k') celsius = value - 273.15;
        
        if (to === 'c') return celsius;
        if (to === 'f') return celsius * 9/5 + 32;
        if (to === 'k') return celsius + 273.15;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('unit-from')) {
        ITTools.Implementations.UnitConverter.updateUnits();
    }
});

console.log('ITTools Batch 1a Implementations loaded');
