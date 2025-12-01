// ============================================
// NAMESPACE: ITTools.AdvancedTools
// FILE: ittools-advanced-tools.js
// PURPOSE: Advanced client-side tools (Calculator, Color, Image processing)
// ============================================

ITTools.AdvancedTools = {
    
    // ============================================
    // NAMESPACE: ITTools.AdvancedTools.Calculator
    // ============================================
    Calculator: {
        calculateAge(birthdate) {
            const birth = new Date(birthdate);
            const now = new Date();
            
            let years = now.getFullYear() - birth.getFullYear();
            let months = now.getMonth() - birth.getMonth();
            let days = now.getDate() - birth.getDate();
            
            if (days < 0) {
                months--;
                days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            }
            
            if (months < 0) {
                years--;
                months += 12;
            }
            
            const totalDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
            
            return {
                years,
                months,
                days,
                total_days: totalDays,
                total_weeks: Math.floor(totalDays / 7),
                total_months: (years * 12) + months,
                total_hours: totalDays * 24,
                total_minutes: totalDays * 24 * 60,
                total_seconds: totalDays * 24 * 60 * 60
            };
        },
        
        calculateBMI(weight, height, unit = 'metric') {
            let w = weight;
            let h = height;
            
            if (unit === 'imperial') {
                w = weight * 0.453592;
                h = height * 0.0254;
            } else {
                h = height / 100;
            }
            
            const bmi = w / (h * h);
            
            let category;
            if (bmi < 18.5) category = 'Underweight';
            else if (bmi < 25) category = 'Normal weight';
            else if (bmi < 30) category = 'Overweight';
            else category = 'Obese';
            
            return {
                bmi: bmi.toFixed(2),
                category,
                healthy_range: {
                    min: (18.5 * h * h).toFixed(1),
                    max: (24.9 * h * h).toFixed(1)
                }
            };
        },
        
        calculateLoanEMI(principal, rate, months) {
            const monthlyRate = (rate / 12) / 100;
            let emi;
            
            if (monthlyRate === 0) {
                emi = principal / months;
            } else {
                emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
                      (Math.pow(1 + monthlyRate, months) - 1);
            }
            
            const totalAmount = emi * months;
            const totalInterest = totalAmount - principal;
            
            return {
                emi: emi.toFixed(2),
                total_amount: totalAmount.toFixed(2),
                total_interest: totalInterest.toFixed(2),
                principal,
                interest_rate: rate,
                tenure_months: months
            };
        },
        
        calculateGST(amount, gstRate, operation = 'add') {
            let netAmount, gstAmount, grossAmount;
            
            if (operation === 'add') {
                netAmount = amount;
                gstAmount = (amount * gstRate) / 100;
                grossAmount = amount + gstAmount;
            } else {
                grossAmount = amount;
                netAmount = amount / (1 + (gstRate / 100));
                gstAmount = amount - netAmount;
            }
            
            return {
                net_amount: netAmount.toFixed(2),
                gst_amount: gstAmount.toFixed(2),
                gross_amount: grossAmount.toFixed(2),
                gst_rate: gstRate
            };
        },
        
        percentage(value, total) {
            return {
                percentage: ((value / total) * 100).toFixed(2),
                value,
                total
            };
        },
        
        percentageOf(percentage, total) {
            return {
                value: ((percentage / 100) * total).toFixed(2),
                percentage,
                total
            };
        },
        
        percentageChange(oldValue, newValue) {
            const change = ((newValue - oldValue) / oldValue) * 100;
            return {
                change: change.toFixed(2),
                increase: change > 0,
                old_value: oldValue,
                new_value: newValue
            };
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.AdvancedTools.Color
    // ============================================
    Color: {
        hexToRgb(hex) {
            hex = hex.replace('#', '');
            
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            return { r, g, b, string: `rgb(${r}, ${g}, ${b})` };
        },
        
        rgbToHex(r, g, b) {
            const toHex = (n) => {
                const hex = n.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };
            
            return '#' + toHex(r) + toHex(g) + toHex(b);
        },
        
        rgbToHsl(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            
            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }
            
            return {
                h: Math.round(h * 360),
                s: Math.round(s * 100),
                l: Math.round(l * 100),
                string: `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
            };
        },
        
        hslToRgb(h, s, l) {
            h /= 360;
            s /= 100;
            l /= 100;
            
            let r, g, b;
            
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            
            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255)
            };
        },
        
        generateGradient(color1, color2, steps = 5) {
            const c1 = this.hexToRgb(color1);
            const c2 = this.hexToRgb(color2);
            
            const gradient = [];
            
            for (let i = 0; i <= steps; i++) {
                const ratio = i / steps;
                const r = Math.round(c1.r + ratio * (c2.r - c1.r));
                const g = Math.round(c1.g + ratio * (c2.g - c1.g));
                const b = Math.round(c1.b + ratio * (c2.b - c1.b));
                
                gradient.push({
                    hex: this.rgbToHex(r, g, b),
                    rgb: `rgb(${r}, ${g}, ${b})`,
                    position: (ratio * 100).toFixed(0) + '%'
                });
            }
            
            return gradient;
        },
        
        contrastRatio(hex1, hex2) {
            const getLuminance = (hex) => {
                const rgb = this.hexToRgb(hex);
                const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
                    v /= 255;
                    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            
            const l1 = getLuminance(hex1);
            const l2 = getLuminance(hex2);
            
            const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            
            return {
                ratio: ratio.toFixed(2),
                passes_aa: ratio >= 4.5,
                passes_aaa: ratio >= 7,
                level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail'
            };
        },
        
        generatePalette(baseHex) {
            const rgb = this.hexToRgb(baseHex);
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            
            const palette = {
                base: baseHex,
                lighter: [],
                darker: [],
                complementary: null,
                analogous: [],
                triadic: []
            };
            
            for (let i = 1; i <= 3; i++) {
                const lighterL = Math.min(hsl.l + (i * 15), 95);
                const darkerL = Math.max(hsl.l - (i * 15), 5);
                
                const lighter = this.hslToRgb(hsl.h, hsl.s, lighterL);
                const darker = this.hslToRgb(hsl.h, hsl.s, darkerL);
                
                palette.lighter.push(this.rgbToHex(lighter.r, lighter.g, lighter.b));
                palette.darker.push(this.rgbToHex(darker.r, darker.g, darker.b));
            }
            
            const comp = this.hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
            palette.complementary = this.rgbToHex(comp.r, comp.g, comp.b);
            
            [30, -30].forEach(offset => {
                const analog = this.hslToRgb((hsl.h + offset + 360) % 360, hsl.s, hsl.l);
                palette.analogous.push(this.rgbToHex(analog.r, analog.g, analog.b));
            });
            
            [120, 240].forEach(offset => {
                const tri = this.hslToRgb((hsl.h + offset) % 360, hsl.s, hsl.l);
                palette.triadic.push(this.rgbToHex(tri.r, tri.g, tri.b));
            });
            
            return palette;
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.AdvancedTools.Text
    // ============================================
    TextAdvanced: {
        removeDuplicateLines(text) {
            const lines = text.split('\n');
            const unique = [...new Set(lines)];
            return {
                result: unique.join('\n'),
                original_lines: lines.length,
                unique_lines: unique.length,
                removed: lines.length - unique.length
            };
        },
        
        sortLines(text, method = 'alphabetical') {
            const lines = text.split('\n');
            
            let sorted;
            switch(method) {
                case 'alphabetical':
                    sorted = lines.sort();
                    break;
                case 'reverse':
                    sorted = lines.sort().reverse();
                    break;
                case 'length':
                    sorted = lines.sort((a, b) => a.length - b.length);
                    break;
                case 'random':
                    sorted = lines.sort(() => Math.random() - 0.5);
                    break;
                default:
                    sorted = lines;
            }
            
            return {
                result: sorted.join('\n'),
                method,
                line_count: lines.length
            };
        },
        
        reverseText(text, mode = 'characters') {
            let result;
            
            switch(mode) {
                case 'characters':
                    result = text.split('').reverse().join('');
                    break;
                case 'words':
                    result = text.split(' ').reverse().join(' ');
                    break;
                case 'lines':
                    result = text.split('\n').reverse().join('\n');
                    break;
                default:
                    result = text;
            }
            
            return { result, mode };
        },
        
        keywordDensity(text) {
            const words = text.toLowerCase().match(/\b\w+\b/g) || [];
            const frequency = {};
            
            words.forEach(word => {
                if (word.length > 3) {
                    frequency[word] = (frequency[word] || 0) + 1;
                }
            });
            
            const sorted = Object.entries(frequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20)
                .map(([word, count]) => ({
                    word,
                    count,
                    density: ((count / words.length) * 100).toFixed(2) + '%'
                }));
            
            return {
                total_words: words.length,
                unique_words: Object.keys(frequency).length,
                top_keywords: sorted
            };
        }
    }
};

console.log('ITTools Advanced Tools loaded');
