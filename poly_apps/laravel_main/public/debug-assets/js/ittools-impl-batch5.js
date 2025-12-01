// ============================================
// NAMESPACE: ITTools.Implementations.Batch5
// FILE: ittools-impl-batch5.js  
// PURPOSE: Batch 5 - Validation & Data Tools (3/3 tools)
// ============================================

// ============================================
// Phone Parser (Client-side basic implementation)
// ============================================
ITTools.Tools.Registry.register('phone-parser', {
    name: 'Phone Number Parser',
    category: 'data',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Phone Number Parser & Formatter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Phone Number:</label>
                        <input type="text" id="phone-input" class="ittools-input" placeholder="+1 (555) 123-4567 or 5551234567">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Country Code (if not included):</label>
                        <select id="phone-country" class="ittools-input">
                            <option value="+1">+1 (USA/Canada)</option>
                            <option value="+44">+44 (UK)</option>
                            <option value="+86">+86 (China)</option>
                            <option value="+81">+81 (Japan)</option>
                            <option value="+49">+49 (Germany)</option>
                            <option value="+33">+33 (France)</option>
                            <option value="+61">+61 (Australia)</option>
                            <option value="+91">+91 (India)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PhoneParser.parse()">
                            📱 Parse Phone Number
                        </button>
                    </div>
                    <div id="phone-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PhoneParser = {
    parse() {
        let phone = document.getElementById('phone-input').value.trim();
        const country = document.getElementById('phone-country').value;
        
        if (!phone) {
            ITTools.UI.showResult('phone-result', 'Please enter a phone number', false);
            return;
        }
        
        const digitsOnly = phone.replace(/\D/g, '');
        
        let hasCountryCode = phone.startsWith('+') || digitsOnly.length > 10;
        let countryCode = country;
        let nationalNumber = digitsOnly;
        
        if (hasCountryCode && phone.startsWith('+')) {
            const match = phone.match(/^\+(\d{1,3})/);
            if (match) {
                countryCode = '+' + match[1];
                nationalNumber = digitsOnly.substring(match[1].length);
            }
        } else if (digitsOnly.length > 10) {
            countryCode = '+' + digitsOnly.substring(0, digitsOnly.length - 10);
            nationalNumber = digitsOnly.substring(digitsOnly.length - 10);
        }
        
        let formatted = '';
        if (nationalNumber.length === 10) {
            formatted = `(${nationalNumber.substring(0, 3)}) ${nationalNumber.substring(3, 6)}-${nationalNumber.substring(6)}`;
        } else if (nationalNumber.length === 7) {
            formatted = `${nationalNumber.substring(0, 3)}-${nationalNumber.substring(3)}`;
        } else {
            formatted = nationalNumber;
        }
        
        const e164 = countryCode + nationalNumber;
        const international = `${countryCode} ${formatted}`;
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="display: grid; gap: 10px;">
                    <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px;">
                        <strong>E.164 Format:</strong><br>
                        <span style="font-size: 20px; font-family: monospace;">${e164}</span>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>International:</strong> ${international}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>National:</strong> ${formatted}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Country Code:</strong> ${countryCode}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Digits Only:</strong> ${nationalNumber}
                    </div>
                </div>
                <small style="color: #666; display: block; margin-top: 10px;">⚠️ Basic parser. For full validation, use libphonenumber library.</small>
            </div>
        `;
        
        ITTools.UI.showResult('phone-result', html, true);
    }
};

// ============================================
// IBAN Validator (Client-side)
// ============================================
ITTools.Tools.Registry.register('iban-validator', {
    name: 'IBAN Validator',
    category: 'data',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">IBAN Validator & Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">IBAN:</label>
                        <input type="text" id="iban-input" class="ittools-input" placeholder="DE89 3704 0044 0532 0130 00">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.IBANValidator.validate()">
                            ✅ Validate IBAN
                        </button>
                    </div>
                    <div id="iban-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.IBANValidator = {
    countries: {
        'DE': { name: 'Germany', length: 22 },
        'GB': { name: 'United Kingdom', length: 22 },
        'FR': { name: 'France', length: 27 },
        'ES': { name: 'Spain', length: 24 },
        'IT': { name: 'Italy', length: 27 },
        'NL': { name: 'Netherlands', length: 18 },
        'BE': { name: 'Belgium', length: 16 },
        'AT': { name: 'Austria', length: 20 },
        'CH': { name: 'Switzerland', length: 21 },
        'PL': { name: 'Poland', length: 28 }
    },
    
    validate() {
        let iban = document.getElementById('iban-input').value.trim().toUpperCase().replace(/\s/g, '');
        
        if (!iban) {
            ITTools.UI.showResult('iban-result', 'Please enter an IBAN', false);
            return;
        }
        
        if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) {
            ITTools.UI.showResult('iban-result', 'Invalid IBAN format', false);
            return;
        }
        
        const countryCode = iban.substring(0, 2);
        const checkDigits = iban.substring(2, 4);
        const bban = iban.substring(4);
        
        const countryInfo = this.countries[countryCode];
        let lengthValid = true;
        
        if (countryInfo && iban.length !== countryInfo.length) {
            lengthValid = false;
        }
        
        const rearranged = bban + countryCode + checkDigits;
        let numeric = '';
        for (let char of rearranged) {
            if (char >= 'A' && char <= 'Z') {
                numeric += (char.charCodeAt(0) - 55).toString();
            } else {
                numeric += char;
            }
        }
        
        let remainder = 0;
        for (let i = 0; i < numeric.length; i += 7) {
            const chunk = remainder + numeric.substring(i, i + 7);
            remainder = parseInt(chunk) % 97;
        }
        
        const isValid = remainder === 1 && lengthValid;
        
        const formatted = iban.match(/.{1,4}/g).join(' ');
        
        const html = isValid ? `
            <div style="margin-top: 15px;">
                <div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 5px; text-align: center;">
                    <span style="font-size: 48px;">✅</span>
                    <div style="font-size: 20px; font-weight: bold; margin-top: 10px;">Valid IBAN</div>
                </div>
                <div style="display: grid; gap: 10px; margin-top: 15px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Formatted:</strong> ${formatted}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Country:</strong> ${countryInfo ? countryInfo.name : countryCode} (${countryCode})
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Check Digits:</strong> ${checkDigits}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>BBAN:</strong> ${bban}
                    </div>
                </div>
            </div>
        ` : `
            <div style="margin-top: 15px;">
                <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; text-align: center;">
                    <span style="font-size: 48px;">❌</span>
                    <div style="font-size: 20px; font-weight: bold; margin-top: 10px;">Invalid IBAN</div>
                    ${!lengthValid ? '<div style="margin-top: 10px;">Wrong length for country ' + countryCode + '</div>' : ''}
                    ${remainder !== 1 ? '<div style="margin-top: 10px;">Check digit validation failed</div>' : ''}
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('iban-result', html, true);
    }
};

// ============================================
// Email Normalizer (Client-side)
// ============================================
ITTools.Tools.Registry.register('email-normalizer', {
    name: 'Email Normalizer',
    category: 'data',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Email Address Normalizer</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Email Address:</label>
                        <input type="text" id="email-input" class="ittools-input" placeholder="John.Doe+newsletter@Gmail.com">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Options:</label>
                        <div style="display: grid; gap: 8px;">
                            <label><input type="checkbox" id="email-lowercase" checked> Lowercase entire email</label>
                            <label><input type="checkbox" id="email-remove-plus" checked> Remove plus addressing (user+tag → user)</label>
                            <label><input type="checkbox" id="email-remove-dots"> Remove dots from local part (Gmail style)</label>
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.EmailNormalizer.normalize()">
                            📧 Normalize Email
                        </button>
                    </div>
                    <div id="email-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.EmailNormalizer = {
    normalize() {
        const email = document.getElementById('email-input').value.trim();
        const lowercase = document.getElementById('email-lowercase').checked;
        const removePlus = document.getElementById('email-remove-plus').checked;
        const removeDots = document.getElementById('email-remove-dots').checked;
        
        if (!email) {
            ITTools.UI.showResult('email-result', 'Please enter an email address', false);
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            ITTools.UI.showResult('email-result', 'Invalid email format', false);
            return;
        }
        
        let [localPart, domain] = email.split('@');
        
        if (removePlus && localPart.includes('+')) {
            localPart = localPart.split('+')[0];
        }
        
        if (removeDots) {
            localPart = localPart.replace(/\./g, '');
        }
        
        let normalized = `${localPart}@${domain}`;
        
        if (lowercase) {
            normalized = normalized.toLowerCase();
        }
        
        const isGmail = domain.toLowerCase() === 'gmail.com' || domain.toLowerCase() === 'googlemail.com';
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px;">
                    <strong>Normalized Email:</strong><br>
                    <span style="font-size: 20px; font-family: monospace;">${normalized}</span>
                </div>
                <div style="display: grid; gap: 10px; margin-top: 15px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Original:</strong> ${email}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Local Part:</strong> ${localPart}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Domain:</strong> ${lowercase ? domain.toLowerCase() : domain}
                    </div>
                    ${isGmail ? `
                    <div style="background: #e3f2fd; color: #1565c0; padding: 15px; border-radius: 5px;">
                        <strong>📌 Gmail detected:</strong> Gmail ignores dots in local part and supports + addressing
                    </div>
                    ` : ''}
                </div>
                <button onclick="ITTools.UI.copyToClipboard('${normalized}')" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('email-result', html, true);
    }
};

console.log('ITTools Batch 5 Implementations loaded');
