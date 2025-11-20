// ============================================
// NAMESPACE: ITTools.Implementations
// FILE: ittools-implementations.js  
// PURPOSE: Batch tool implementations
// ============================================

// ============================================
// Image Compressor
// ============================================
ITTools.Tools.Registry.register('image-compressor', {
    name: 'Image Compressor',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Compressor</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-compress-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Quality (1-100):</label>
                        <input type="range" id="img-compress-quality" min="1" max="100" value="85" 
                               oninput="document.getElementById('quality-value').textContent=this.value">
                        <span id="quality-value">85</span>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageCompressor.compress()">
                            🗜️ Compress
                        </button>
                    </div>
                    <div id="img-compress-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// Image Cropper
// ============================================
ITTools.Tools.Registry.register('image-cropper', {
    name: 'Image Cropper',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Cropper</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-crop-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">X Position:</label>
                        <input type="number" id="img-crop-x" class="ittools-input" value="0">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Y Position:</label>
                        <input type="number" id="img-crop-y" class="ittools-input" value="0">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Width:</label>
                        <input type="number" id="img-crop-width" class="ittools-input" value="200">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Height:</label>
                        <input type="number" id="img-crop-height" class="ittools-input" value="200">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageCropper.crop()">
                            ✂️ Crop
                        </button>
                    </div>
                    <div id="img-crop-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// Base Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('base-converter', {
    name: 'Base Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Integer Base Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Number:</label>
                        <input type="text" id="base-input" class="ittools-input" placeholder="Enter number">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From Base (2-36):</label>
                        <input type="number" id="base-from" class="ittools-input" value="10" min="2" max="36">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">To Base (2-36):</label>
                        <input type="number" id="base-to" class="ittools-input" value="16" min="2" max="36">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BaseConverter.convert()">
                            🔄 Convert
                        </button>
                    </div>
                    <div id="base-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// Roman Numeral Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('roman-converter', {
    name: 'Roman Numeral Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Roman Numeral Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input:</label>
                        <input type="text" id="roman-input" class="ittools-input" placeholder="42 or XLII">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.RomanConverter.convert()">
                            🔄 Convert
                        </button>
                    </div>
                    <div id="roman-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// Emoji Picker (Client-side)
// ============================================
ITTools.Tools.Registry.register('emoji-picker', {
    name: 'Emoji Picker',
    category: 'text',
    render() {
        const emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😶‍🌫️','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','��','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Emoji Picker</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search:</label>
                        <input type="text" id="emoji-search" class="ittools-input" placeholder="Search emojis..." 
                               oninput="ITTools.Implementations.EmojiPicker.search(this.value)">
                    </div>
                    <div id="emoji-grid" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; margin-top: 15px;">
                        ${emojis.map(e => `<span style="font-size: 24px; cursor: pointer; padding: 5px; text-align: center;" 
                                                 onclick="ITTools.Implementations.EmojiPicker.copy('${e}')" title="Click to copy">${e}</span>`).join('')}
                    </div>
                    <div id="emoji-result" class="ittools-result" style="display: none; margin-top: 15px;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// QR Code Generator (Client-side using library)
// ============================================
ITTools.Tools.Registry.register('qr-generator', {
    name: 'QR Code Generator',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">QR Code Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text/URL:</label>
                        <textarea id="qr-text" class="ittools-textarea" placeholder="Enter text or URL"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QRGenerator.generate()">
                            📱 Generate QR Code
                        </button>
                    </div>
                    <div id="qr-result" style="margin-top: 15px; text-align: center;"></div>
                </div>
            </div>
        `;
    }
});

// ============================================
// Implementations
// ============================================
ITTools.Implementations = {
    ImageCompressor: {
        async compress() {
            const fileInput = document.getElementById('img-compress-file');
            const quality = document.getElementById('img-compress-quality').value;
            
            if (!fileInput.files[0]) {
                ITTools.UI.showResult('img-compress-result', 'Please select an image', false);
                return;
            }
            
            ITTools.UI.showLoading('img-compress-result', 'Compressing...');
            
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('quality', quality);
            
            try {
                const response = await fetch('/api/ittools/v1/advanced/image/compress', {
                    method: 'POST', body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    const d = result.data;
                    ITTools.UI.showResult('img-compress-result', 
                        `Compressed: ${d.original_size_readable} → ${d.compressed_size_readable} (${d.compression_ratio} saved)`, true);
                } else {
                    ITTools.UI.showResult('img-compress-result', 'Error: ' + result.message, false);
                }
            } catch (error) {
                ITTools.UI.showResult('img-compress-result', 'Error: ' + error.message, false);
            }
        }
    },
    
    ImageCropper: {
        async crop() {
            const fileInput = document.getElementById('img-crop-file');
            const x = document.getElementById('img-crop-x').value;
            const y = document.getElementById('img-crop-y').value;
            const width = document.getElementById('img-crop-width').value;
            const height = document.getElementById('img-crop-height').value;
            
            if (!fileInput.files[0]) {
                ITTools.UI.showResult('img-crop-result', 'Please select an image', false);
                return;
            }
            
            ITTools.UI.showLoading('img-crop-result', 'Cropping...');
            
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('x', x);
            formData.append('y', y);
            formData.append('width', width);
            formData.append('height', height);
            
            try {
                const response = await fetch('/api/ittools/v1/advanced/image/crop', {
                    method: 'POST', body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    ITTools.UI.showResult('img-crop-result', `Cropped successfully (${width}x${height})`, true);
                } else {
                    ITTools.UI.showResult('img-crop-result', 'Error: ' + result.message, false);
                }
            } catch (error) {
                ITTools.UI.showResult('img-crop-result', 'Error: ' + error.message, false);
            }
        }
    },
    
    BaseConverter: {
        convert() {
            const input = document.getElementById('base-input').value;
            const fromBase = parseInt(document.getElementById('base-from').value);
            const toBase = parseInt(document.getElementById('base-to').value);
            
            if (!input) {
                ITTools.UI.showResult('base-result', 'Please enter a number', false);
                return;
            }
            
            try {
                const result = ITTools.ClientTools.Math.convertBase(input, fromBase, toBase);
                ITTools.UI.showResult('base-result', `Result: ${result}`, true);
            } catch (error) {
                ITTools.UI.showResult('base-result', 'Error: ' + error.message, false);
            }
        }
    },
    
    RomanConverter: {
        convert() {
            const input = document.getElementById('roman-input').value.trim();
            
            if (!input) {
                ITTools.UI.showResult('roman-result', 'Please enter a number or roman numeral', false);
                return;
            }
            
            if (/^\d+$/.test(input)) {
                const result = this.toRoman(parseInt(input));
                ITTools.UI.showResult('roman-result', `Roman: ${result}`, true);
            } else {
                const result = this.fromRoman(input.toUpperCase());
                ITTools.UI.showResult('roman-result', `Number: ${result}`, true);
            }
        },
        
        toRoman(num) {
            const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
            let result = '';
            for (const [val, letter] of map) {
                while (num >= val) {
                    result += letter;
                    num -= val;
                }
            }
            return result;
        },
        
        fromRoman(str) {
            const map = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
            let result = 0;
            for (let i = 0; i < str.length;) {
                if (i + 1 < str.length && map[str.substring(i, i + 2)]) {
                    result += map[str.substring(i, i + 2)];
                    i += 2;
                } else {
                    result += map[str[i]];
                    i++;
                }
            }
            return result;
        }
    },
    
    EmojiPicker: {
        copy(emoji) {
            ITTools.UI.copyToClipboard(emoji);
            ITTools.UI.showResult('emoji-result', `Copied: ${emoji}`, true);
        },
        
        search(query) {
            console.log('Emoji search:', query);
        }
    },
    
    QRGenerator: {
        generate() {
            const text = document.getElementById('qr-text').value;
            
            if (!text) {
                document.getElementById('qr-result').innerHTML = '<p style="color: #dc3545;">Please enter text</p>';
                return;
            }
            
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, size, size);
            
            ctx.fillStyle = 'black';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('QR Code', size/2, size/2 - 10);
            ctx.fillText('(Placeholder)', size/2, size/2 + 10);
            
            document.getElementById('qr-result').innerHTML = `
                <p style="color: #666; font-size: 12px;">QR Code generation requires external library</p>
                <p style="color: #666; font-size: 12px;">Text: ${text}</p>
            `;
        }
    }
};

// ============================================
// Bcrypt Tool
// ============================================
ITTools.Tools.Registry.register('bcrypt-tool', {
    name: 'Bcrypt Hash & Verify',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Bcrypt Hash & Verify</div>
                <div class="ittools-card-body">
                    <div class="ittools-tabs">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.BcryptTool.switchTab('hash')">Hash</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.BcryptTool.switchTab('verify')">Verify</button>
                    </div>
                    
                    <div id="bcrypt-hash-tab" class="bcrypt-tab-content">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Password:</label>
                            <input type="text" id="bcrypt-password" class="ittools-input" placeholder="Enter password to hash">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Rounds (4-31):</label>
                            <input type="number" id="bcrypt-rounds" class="ittools-input" value="10" min="4" max="31">
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BcryptTool.hash()">
                                🔐 Generate Hash
                            </button>
                        </div>
                        <div id="bcrypt-hash-result" class="ittools-result" style="display: none;"></div>
                    </div>
                    
                    <div id="bcrypt-verify-tab" class="bcrypt-tab-content" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Password:</label>
                            <input type="text" id="bcrypt-verify-password" class="ittools-input" placeholder="Enter password">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Hash:</label>
                            <input type="text" id="bcrypt-verify-hash" class="ittools-input" placeholder="Enter bcrypt hash">
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BcryptTool.verify()">
                                ✓ Verify Password
                            </button>
                        </div>
                        <div id="bcrypt-verify-result" class="ittools-result" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BcryptTool = {
    switchTab(tab) {
        document.querySelectorAll('.bcrypt-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'hash') {
            document.getElementById('bcrypt-hash-tab').style.display = 'block';
            event.target.classList.add('active');
        } else {
            document.getElementById('bcrypt-verify-tab').style.display = 'block';
            event.target.classList.add('active');
        }
    },
    
    async hash() {
        const password = document.getElementById('bcrypt-password').value;
        const rounds = document.getElementById('bcrypt-rounds').value;
        
        if (!password) {
            ITTools.UI.showResult('bcrypt-hash-result', 'Please enter a password', false);
            return;
        }
        
        ITTools.UI.showLoading('bcrypt-hash-result', 'Generating hash...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bcrypt/hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, rounds: parseInt(rounds) })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('bcrypt-hash-result', 
                    `<strong>Bcrypt Hash:</strong><br><code style="word-break: break-all;">${result.data.hash}</code>
                    <button onclick="ITTools.UI.copyToClipboard('${result.data.hash}')" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('bcrypt-hash-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bcrypt-hash-result', 'Error: ' + error.message, false);
        }
    },
    
    async verify() {
        const password = document.getElementById('bcrypt-verify-password').value;
        const hash = document.getElementById('bcrypt-verify-hash').value;
        
        if (!password || !hash) {
            ITTools.UI.showResult('bcrypt-verify-result', 'Please enter both password and hash', false);
            return;
        }
        
        ITTools.UI.showLoading('bcrypt-verify-result', 'Verifying...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bcrypt/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, hash })
            });
            const result = await response.json();
            
            if (result.success) {
                const valid = result.data.valid;
                ITTools.UI.showResult('bcrypt-verify-result', 
                    valid ? '✅ Password matches hash!' : '❌ Password does NOT match hash', 
                    valid);
            } else {
                ITTools.UI.showResult('bcrypt-verify-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bcrypt-verify-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// ULID Generator
// ============================================
ITTools.Tools.Registry.register('ulid-generator', {
    name: 'ULID Generator',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">ULID Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Number of ULIDs:</label>
                        <input type="number" id="ulid-count" class="ittools-input" value="5" min="1" max="100">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ULIDGenerator.generate()">
                            🆔 Generate ULIDs
                        </button>
                    </div>
                    <div id="ulid-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ULIDGenerator = {
    async generate() {
        const count = document.getElementById('ulid-count').value;
        
        ITTools.UI.showLoading('ulid-result', 'Generating ULIDs...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/ulid/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(count) })
            });
            const result = await response.json();
            
            if (result.success) {
                const ulids = result.data.ulids;
                const html = `<strong>${ulids.length} ULID(s) Generated:</strong><br>` +
                    ulids.map(ulid => `<code>${ulid}</code> <button onclick="ITTools.UI.copyToClipboard('${ulid}')" class="ittools-btn ittools-btn-sm">📋</button>`).join('<br>');
                ITTools.UI.showResult('ulid-result', html, true);
            } else {
                ITTools.UI.showResult('ulid-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('ulid-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// BIP39 Generator
// ============================================
ITTools.Tools.Registry.register('bip39-generator', {
    name: 'BIP39 Passphrase',
    category: 'crypto',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">BIP39 Mnemonic Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Word Count:</label>
                        <select id="bip39-words" class="ittools-input">
                            <option value="12">12 words</option>
                            <option value="15">15 words</option>
                            <option value="18">18 words</option>
                            <option value="21">21 words</option>
                            <option value="24">24 words</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BIP39Generator.generate()">
                            🔑 Generate Mnemonic
                        </button>
                    </div>
                    <div id="bip39-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BIP39Generator = {
    async generate() {
        const wordCount = document.getElementById('bip39-words').value;
        
        ITTools.UI.showLoading('bip39-result', 'Generating mnemonic...');
        
        try {
            const response = await fetch('/api/ittools/v1/crypto/bip39/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: parseInt(wordCount) })
            });
            const result = await response.json();
            
            if (result.success) {
                const mnemonic = result.data.mnemonic;
                ITTools.UI.showResult('bip39-result', 
                    `<strong>BIP39 Mnemonic (${wordCount} words):</strong><br>
                    <code style="display: block; padding: 15px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">${mnemonic}</code>
                    <button onclick="ITTools.UI.copyToClipboard('${mnemonic}')" class="ittools-btn ittools-btn-sm">📋 Copy</button>
                    <p style="color: #dc3545; font-size: 12px; margin-top: 10px;">⚠️ Store this safely! Never share your mnemonic phrase.</p>`, 
                    true);
            } else {
                ITTools.UI.showResult('bip39-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('bip39-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// JSON ⇄ YAML Converter
// ============================================
ITTools.Tools.Registry.register('json-yaml-converter', {
    name: 'JSON ⇄ YAML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON ⇄ YAML Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-tabs">
                        <button class="ittools-tab active" onclick="ITTools.Implementations.JSONYAMLConverter.switchTab('json-to-yaml')">JSON → YAML</button>
                        <button class="ittools-tab" onclick="ITTools.Implementations.JSONYAMLConverter.switchTab('yaml-to-json')">YAML → JSON</button>
                    </div>
                    
                    <div id="json-to-yaml-tab" class="converter-tab-content">
                        <div class="ittools-form-group">
                            <label class="ittools-label">JSON Input:</label>
                            <textarea id="json-to-yaml-input" class="ittools-textarea" rows="10" placeholder='{"key": "value"}'></textarea>
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONYAMLConverter.jsonToYaml()">
                                → Convert to YAML
                            </button>
                        </div>
                        <div id="json-to-yaml-result" class="ittools-result" style="display: none;"></div>
                    </div>
                    
                    <div id="yaml-to-json-tab" class="converter-tab-content" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">YAML Input:</label>
                            <textarea id="yaml-to-json-input" class="ittools-textarea" rows="10" placeholder="key: value"></textarea>
                        </div>
                        <div class="ittools-btn-group">
                            <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONYAMLConverter.yamlToJson()">
                                → Convert to JSON
                            </button>
                        </div>
                        <div id="yaml-to-json-result" class="ittools-result" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JSONYAMLConverter = {
    switchTab(tab) {
        document.querySelectorAll('.converter-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.ittools-tab').forEach(el => el.classList.remove('active'));
        
        if (tab === 'json-to-yaml') {
            document.getElementById('json-to-yaml-tab').style.display = 'block';
            event.target.classList.add('active');
        } else {
            document.getElementById('yaml-to-json-tab').style.display = 'block';
            event.target.classList.add('active');
        }
    },
    
    async jsonToYaml() {
        const input = document.getElementById('json-to-yaml-input').value;
        
        if (!input) {
            ITTools.UI.showResult('json-to-yaml-result', 'Please enter JSON', false);
            return;
        }
        
        ITTools.UI.showLoading('json-to-yaml-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/json-to-yaml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('json-to-yaml-result', 
                    `<strong>YAML Output:</strong><br>
                    <textarea class="ittools-textarea" rows="10" readonly>${result.data.yaml}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.yaml.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('json-to-yaml-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('json-to-yaml-result', 'Error: ' + error.message, false);
        }
    },
    
    async yamlToJson() {
        const input = document.getElementById('yaml-to-json-input').value;
        
        if (!input) {
            ITTools.UI.showResult('yaml-to-json-result', 'Please enter YAML', false);
            return;
        }
        
        ITTools.UI.showLoading('yaml-to-json-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/yaml-to-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                const formatted = JSON.stringify(result.data.json, null, 2);
                ITTools.UI.showResult('yaml-to-json-result', 
                    `<strong>JSON Output:</strong><br>
                    <textarea class="ittools-textarea" rows="10" readonly>${formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('yaml-to-json-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('yaml-to-json-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Temperature Converter (Client-side)
// ============================================
ITTools.Tools.Registry.register('temperature-converter', {
    name: 'Temperature Converter',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Temperature Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Temperature Value:</label>
                        <input type="number" id="temp-value" class="ittools-input" placeholder="Enter temperature" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">From:</label>
                        <select id="temp-from" class="ittools-input">
                            <option value="celsius">Celsius (°C)</option>
                            <option value="fahrenheit">Fahrenheit (°F)</option>
                            <option value="kelvin">Kelvin (K)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.TemperatureConverter.convert()">
                            🌡️ Convert
                        </button>
                    </div>
                    <div id="temp-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.TemperatureConverter = {
    convert() {
        const value = parseFloat(document.getElementById('temp-value').value);
        const from = document.getElementById('temp-from').value;
        
        if (isNaN(value)) {
            ITTools.UI.showResult('temp-result', 'Please enter a valid temperature', false);
            return;
        }
        
        let celsius, fahrenheit, kelvin;
        
        if (from === 'celsius') {
            celsius = value;
            fahrenheit = (value * 9/5) + 32;
            kelvin = value + 273.15;
        } else if (from === 'fahrenheit') {
            celsius = (value - 32) * 5/9;
            fahrenheit = value;
            kelvin = celsius + 273.15;
        } else {
            celsius = value - 273.15;
            fahrenheit = (celsius * 9/5) + 32;
            kelvin = value;
        }
        
        const html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Celsius</div>
                    <div style="font-size: 24px; font-weight: bold; color: #007bff;">${celsius.toFixed(2)}°C</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Fahrenheit</div>
                    <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${fahrenheit.toFixed(2)}°F</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 12px; color: #666;">Kelvin</div>
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${kelvin.toFixed(2)}K</div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('temp-result', html, true);
    }
};

// ============================================
// JWT Parser
// ============================================
ITTools.Tools.Registry.register('jwt-parser', {
    name: 'JWT Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JWT Token Parser & Decoder</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">JWT Token:</label>
                        <textarea id="jwt-token" class="ittools-textarea" rows="6" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JWTParser.parse()">
                            🔍 Decode JWT
                        </button>
                    </div>
                    <div id="jwt-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JWTParser = {
    async parse() {
        const token = document.getElementById('jwt-token').value.trim();
        
        if (!token) {
            ITTools.UI.showResult('jwt-result', 'Please enter a JWT token', false);
            return;
        }
        
        ITTools.UI.showLoading('jwt-result', 'Parsing JWT...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/jwt/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success) {
                const data = result.data;
                const html = `
                    <div style="margin-top: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">📋 Header</h4>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.header, null, 2)}</pre>
                        
                        <h4 style="color: #667eea; margin: 15px 0 10px;">📦 Payload</h4>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.payload, null, 2)}</pre>
                        
                        <h4 style="color: #667eea; margin: 15px 0 10px;">🔐 Signature</h4>
                        <code style="display: block; background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all;">${data.signature}</code>
                        
                        ${data.exp_human ? `<p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">⏰ Expires: ${data.exp_human}</p>` : ''}
                        ${data.iat_human ? `<p style="margin-top: 10px; padding: 10px; background: #d1ecf1; border-radius: 5px;">📅 Issued: ${data.iat_human}</p>` : ''}
                    </div>
                `;
                ITTools.UI.showResult('jwt-result', html, true);
            } else {
                ITTools.UI.showResult('jwt-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('jwt-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// XML Formatter
// ============================================
ITTools.Tools.Registry.register('xml-formatter', {
    name: 'XML Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">XML Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">XML Input:</label>
                        <textarea id="xml-input" class="ittools-textarea" rows="10" placeholder="<root><item>value</item></root>"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.XMLFormatter.format()">
                            ✨ Format XML
                        </button>
                    </div>
                    <div id="xml-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.XMLFormatter = {
    async format() {
        const input = document.getElementById('xml-input').value;
        
        if (!input) {
            ITTools.UI.showResult('xml-result', 'Please enter XML', false);
            return;
        }
        
        ITTools.UI.showLoading('xml-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/xml/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('xml-result', 
                    `<strong>Formatted XML:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('xml-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('xml-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// YAML Formatter
// ============================================
ITTools.Tools.Registry.register('yaml-formatter', {
    name: 'YAML Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">YAML Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">YAML Input:</label>
                        <textarea id="yaml-format-input" class="ittools-textarea" rows="10" placeholder="key: value"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.YAMLFormatter.format()">
                            ✨ Format YAML
                        </button>
                    </div>
                    <div id="yaml-format-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.YAMLFormatter = {
    async format() {
        const input = document.getElementById('yaml-format-input').value;
        
        if (!input) {
            ITTools.UI.showResult('yaml-format-result', 'Please enter YAML', false);
            return;
        }
        
        ITTools.UI.showLoading('yaml-format-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/yaml/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('yaml-format-result', 
                    `<strong>Formatted YAML:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('yaml-format-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('yaml-format-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// SQL Formatter
// ============================================
ITTools.Tools.Registry.register('sql-formatter', {
    name: 'SQL Formatter',
    category: 'formatter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">SQL Formatter & Beautifier</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">SQL Input:</label>
                        <textarea id="sql-input" class="ittools-textarea" rows="10" placeholder="SELECT * FROM users WHERE id=1"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.SQLFormatter.format()">
                            ✨ Format SQL
                        </button>
                    </div>
                    <div id="sql-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.SQLFormatter = {
    async format() {
        const input = document.getElementById('sql-input').value;
        
        if (!input) {
            ITTools.UI.showResult('sql-result', 'Please enter SQL', false);
            return;
        }
        
        ITTools.UI.showLoading('sql-result', 'Formatting...');
        
        try {
            const response = await fetch('/api/ittools/v1/web/sql/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('sql-result', 
                    `<strong>Formatted SQL:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('sql-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('sql-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// User Agent Parser
// ============================================
ITTools.Tools.Registry.register('user-agent-parser', {
    name: 'User Agent Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">User Agent Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">User Agent String:</label>
                        <textarea id="ua-input" class="ittools-textarea" rows="4" placeholder="Mozilla/5.0..."></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.UserAgentParser.parse()">
                            🔍 Parse User Agent
                        </button>
                        <button class="ittools-btn ittools-btn-secondary" onclick="ITTools.Implementations.UserAgentParser.useCurrent()">
                            📱 Use Current Browser
                        </button>
                    </div>
                    <div id="ua-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.UserAgentParser = {
    useCurrent() {
        document.getElementById('ua-input').value = navigator.userAgent;
        this.parse();
    },
    
    async parse() {
        const userAgent = document.getElementById('ua-input').value.trim();
        
        if (!userAgent) {
            ITTools.UI.showResult('ua-result', 'Please enter a user agent string', false);
            return;
        }
        
        ITTools.UI.showLoading('ua-result', 'Parsing...');
        
        try {
            const response = await fetch('/api/ittools/v1/network/user-agent/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_agent: userAgent })
            });
            const result = await response.json();
            
            if (result.success) {
                const data = result.data;
                const html = `
                    <div style="margin-top: 15px; display: grid; gap: 15px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>🖥️ Browser:</strong> ${data.browser || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>📱 Platform:</strong> ${data.platform || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>🔢 Version:</strong> ${data.version || 'Unknown'}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                            <strong>📲 Device:</strong> ${data.device || 'Desktop'}
                        </div>
                    </div>
                `;
                ITTools.UI.showResult('ua-result', html, true);
            } else {
                ITTools.UI.showResult('ua-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('ua-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Chmod Calculator (Client-side)
// ============================================
ITTools.Tools.Registry.register('chmod-calculator', {
    name: 'Chmod Calculator',
    category: 'development',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Chmod Permission Calculator</div>
                <div class="ittools-card-body">
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Owner</h4>
                        <label><input type="checkbox" id="chmod-owner-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label><br>
                        <label><input type="checkbox" id="chmod-owner-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label><br>
                        <label><input type="checkbox" id="chmod-owner-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Group</h4>
                        <label><input type="checkbox" id="chmod-group-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label><br>
                        <label><input type="checkbox" id="chmod-group-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label><br>
                        <label><input type="checkbox" id="chmod-group-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Others</h4>
                        <label><input type="checkbox" id="chmod-others-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label><br>
                        <label><input type="checkbox" id="chmod-others-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label><br>
                        <label><input type="checkbox" id="chmod-others-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                    </div>
                    <div id="chmod-result" style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 5px; text-align: center;">
                        <div style="font-size: 48px; font-weight: bold; color: #667eea;">000</div>
                        <div style="margin-top: 10px; color: #666;">---------</div>
                        <code style="display: block; margin-top: 10px; font-size: 14px;">chmod 000 filename</code>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ChmodCalculator = {
    calculate() {
        const owner = (document.getElementById('chmod-owner-r').checked ? 4 : 0) +
                     (document.getElementById('chmod-owner-w').checked ? 2 : 0) +
                     (document.getElementById('chmod-owner-x').checked ? 1 : 0);
        const group = (document.getElementById('chmod-group-r').checked ? 4 : 0) +
                     (document.getElementById('chmod-group-w').checked ? 2 : 0) +
                     (document.getElementById('chmod-group-x').checked ? 1 : 0);
        const others = (document.getElementById('chmod-others-r').checked ? 4 : 0) +
                      (document.getElementById('chmod-others-w').checked ? 2 : 0) +
                      (document.getElementById('chmod-others-x').checked ? 1 : 0);
        
        const numeric = `${owner}${group}${others}`;
        const symbolic = this.toSymbolic(owner, group, others);
        
        document.getElementById('chmod-result').innerHTML = `
            <div style="font-size: 48px; font-weight: bold; color: #667eea;">${numeric}</div>
            <div style="margin-top: 10px; color: #666; font-size: 24px;">${symbolic}</div>
            <code style="display: block; margin-top: 10px; font-size: 14px;">chmod ${numeric} filename</code>
        `;
    },
    
    toSymbolic(owner, group, others) {
        const convert = (val) => {
            let result = '';
            result += (val & 4) ? 'r' : '-';
            result += (val & 2) ? 'w' : '-';
            result += (val & 1) ? 'x' : '-';
            return result;
        };
        return convert(owner) + convert(group) + convert(others);
    }
};

// ============================================
// QR Code Generator (Using API)
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
// JSON to XML Converter
// ============================================
ITTools.Tools.Registry.register('json-to-xml', {
    name: 'JSON → XML',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">JSON to XML Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">JSON Input:</label>
                        <textarea id="json-to-xml-input" class="ittools-textarea" rows="10" placeholder='{"key": "value"}'></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.JSONToXML.convert()">
                            → Convert to XML
                        </button>
                    </div>
                    <div id="json-to-xml-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.JSONToXML = {
    async convert() {
        const input = document.getElementById('json-to-xml-input').value;
        
        if (!input) {
            ITTools.UI.showResult('json-to-xml-result', 'Please enter JSON', false);
            return;
        }
        
        ITTools.UI.showLoading('json-to-xml-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/json-to-xml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('json-to-xml-result', 
                    `<strong>XML Output:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${result.data.xml}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.xml.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('json-to-xml-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('json-to-xml-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// XML to JSON Converter
// ============================================
ITTools.Tools.Registry.register('xml-to-json', {
    name: 'XML → JSON',
    category: 'converter',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">XML to JSON Converter</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">XML Input:</label>
                        <textarea id="xml-to-json-input" class="ittools-textarea" rows="10" placeholder="<root><item>value</item></root>"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.XMLToJSON.convert()">
                            → Convert to JSON
                        </button>
                    </div>
                    <div id="xml-to-json-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.XMLToJSON = {
    async convert() {
        const input = document.getElementById('xml-to-json-input').value;
        
        if (!input) {
            ITTools.UI.showResult('xml-to-json-result', 'Please enter XML', false);
            return;
        }
        
        ITTools.UI.showLoading('xml-to-json-result', 'Converting...');
        
        try {
            const response = await fetch('/api/ittools/v1/converter/xml-to-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xml: input })
            });
            const result = await response.json();
            
            if (result.success) {
                const formatted = JSON.stringify(result.data.json, null, 2);
                ITTools.UI.showResult('xml-to-json-result', 
                    `<strong>JSON Output:</strong><br>
                    <textarea class="ittools-textarea" rows="15" readonly>${formatted}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${formatted.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('xml-to-json-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('xml-to-json-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// String Obfuscator
// ============================================
ITTools.Tools.Registry.register('string-obfuscator', {
    name: 'String Obfuscator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">String Obfuscator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Text to Obfuscate:</label>
                        <textarea id="obfuscate-input" class="ittools-textarea" rows="6" placeholder="Enter text to obfuscate"></textarea>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.StringObfuscator.obfuscate()">
                            🔒 Obfuscate
                        </button>
                    </div>
                    <div id="obfuscate-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.StringObfuscator = {
    async obfuscate() {
        const input = document.getElementById('obfuscate-input').value;
        
        if (!input) {
            ITTools.UI.showResult('obfuscate-result', 'Please enter text', false);
            return;
        }
        
        ITTools.UI.showLoading('obfuscate-result', 'Obfuscating...');
        
        try {
            const response = await fetch('/api/ittools/v1/text/obfuscate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: input })
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('obfuscate-result', 
                    `<strong>Obfuscated Text:</strong><br>
                    <textarea class="ittools-textarea" rows="6" readonly>${result.data.obfuscated}</textarea>
                    <button onclick="ITTools.UI.copyToClipboard(\`${result.data.obfuscated.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>`, 
                    true);
            } else {
                ITTools.UI.showResult('obfuscate-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('obfuscate-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Numeronym Generator (Client-side)
// ============================================
ITTools.Tools.Registry.register('numeronym-generator', {
    name: 'Numeronym Generator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Numeronym Generator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Word/Phrase:</label>
                        <input type="text" id="numeronym-input" class="ittools-input" placeholder="internationalization">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.NumeronymGenerator.generate()">
                            🔢 Generate Numeronym
                        </button>
                    </div>
                    <div id="numeronym-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.NumeronymGenerator = {
    generate() {
        const input = document.getElementById('numeronym-input').value.trim();
        
        if (!input) {
            ITTools.UI.showResult('numeronym-result', 'Please enter a word', false);
            return;
        }
        
        const word = input.replace(/\s+/g, '');
        
        if (word.length < 3) {
            ITTools.UI.showResult('numeronym-result', 'Word must be at least 3 characters long', false);
            return;
        }
        
        const numeronym = word[0] + (word.length - 2) + word[word.length - 1];
        const examples = [
            'internationalization → i18n',
            'localization → l10n',
            'accessibility → a11y',
            'Kubernetes → k8s'
        ];
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 14px; opacity: 0.9;">${input}</div>
                    <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">${numeronym}</div>
                    <div style="font-size: 12px; opacity: 0.8;">First letter + ${word.length - 2} middle characters + Last letter</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <strong>Common Examples:</strong><br>
                    ${examples.map(ex => `<div style="margin-top: 5px;">• ${ex}</div>`).join('')}
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('numeronym-result', html, true);
    }
};

// ============================================
// HTTP Status Codes (Client-side)
// ============================================
ITTools.Tools.Registry.register('http-status-codes', {
    name: 'HTTP Status Codes',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">HTTP Status Codes Reference</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search Status Code:</label>
                        <input type="text" id="http-status-search" class="ittools-input" placeholder="200, 404, or 'Not Found'" oninput="ITTools.Implementations.HTTPStatusCodes.search()">
                    </div>
                    <div id="http-status-result" style="max-height: 500px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.HTTPStatusCodes = {
    codes: {
        '100': 'Continue',
        '101': 'Switching Protocols',
        '200': 'OK',
        '201': 'Created',
        '202': 'Accepted',
        '204': 'No Content',
        '301': 'Moved Permanently',
        '302': 'Found',
        '304': 'Not Modified',
        '400': 'Bad Request',
        '401': 'Unauthorized',
        '403': 'Forbidden',
        '404': 'Not Found',
        '405': 'Method Not Allowed',
        '409': 'Conflict',
        '410': 'Gone',
        '429': 'Too Many Requests',
        '500': 'Internal Server Error',
        '501': 'Not Implemented',
        '502': 'Bad Gateway',
        '503': 'Service Unavailable',
        '504': 'Gateway Timeout'
    },
    
    search() {
        const query = document.getElementById('http-status-search').value.toLowerCase();
        const filtered = Object.entries(this.codes).filter(([code, desc]) => 
            code.includes(query) || desc.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            document.getElementById('http-status-result').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No matching status codes</p>';
            return;
        }
        
        const html = filtered.map(([code, desc]) => {
            const category = code[0] === '1' ? 'Informational' :
                           code[0] === '2' ? 'Success' :
                           code[0] === '3' ? 'Redirection' :
                           code[0] === '4' ? 'Client Error' :
                           'Server Error';
            const color = code[0] === '2' ? '#28a745' :
                        code[0] === '3' ? '#17a2b8' :
                        code[0] === '4' ? '#ffc107' :
                        code[0] === '5' ? '#dc3545' : '#6c757d';
            
            return `
                <div style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid ${color};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 24px; font-weight: bold; color: ${color};">${code}</span>
                            <span style="margin-left: 15px; font-size: 16px;">${desc}</span>
                        </div>
                        <span style="background: ${color}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">${category}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('http-status-result').innerHTML = html;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('http-status-result')) {
        ITTools.Implementations.HTTPStatusCodes.search();
    }
});

console.log('ITTools Implementations loaded');
