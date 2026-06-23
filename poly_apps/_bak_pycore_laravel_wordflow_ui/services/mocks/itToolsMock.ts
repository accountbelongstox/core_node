
export const itToolsMock = {
    handle: async (path: string, payload: any) => {
        // --- Crypto ---
        if (path.includes('/crypto/hash')) {
            return { algorithm: payload.algorithm, hash: `mock_hash_${Math.random().toString(36).substr(2)}` };
        }
        if (path.includes('/crypto/bcrypt/hash')) {
            return { hash: `$2y$10$mockbcrypt${Math.random().toString(36).substr(2)}` };
        }
        if (path.includes('/crypto/bcrypt/verify')) {
            return { valid: true };
        }
        if (path.includes('/crypto/uuid/generate')) {
             const uuids = Array.from({length: payload.count || 1}, () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }));
            return { uuids };
        }
        if (path.includes('/crypto/ulid/generate')) {
            return { ulids: [`01ARZ3NDEKTSV4RRFFQ69G5FAV`] };
        }
        if (path.includes('/crypto/basic-auth')) {
            return { header: 'Authorization', value: `Basic ${btoa(payload.username + ':' + payload.password)}` };
        }
        if (path.includes('/crypto/hmac')) {
            return { hmac: `hmac_${payload.algorithm}_signature_mock`, algorithm: payload.algorithm };
        }
        if (path.includes('/crypto/rsa/generate')) {
            return { privateKey: "-----BEGIN PRIVATE KEY-----...", publicKey: "-----BEGIN PUBLIC KEY-----...", keySize: payload.key_size || 2048 };
        }
        if (path.includes('/crypto/bip39/generate')) {
            return { mnemonics: ["abandon amount liar ..."], strength: payload.strength || 128 };
        }
        if (path.includes('/crypto/otp/generate')) {
            return { otp: "123456", secret: "MOCKSECRET", expiresIn: 25 };
        }
        if (path.includes('/crypto/otp/verify')) {
            return { valid: payload.otp === "123456" };
        }
        if (path.includes('/crypto/encrypt')) {
            return { encrypted: "mock_encrypted_data", algorithm: payload.algorithm || 'aes-256-cbc' };
        }
        if (path.includes('/crypto/decrypt')) {
            return { decrypted: "mock_decrypted_data", algorithm: payload.algorithm || 'aes-256-cbc' };
        }
        if (path.includes('/crypto/password/analyze')) {
            return { 
                length: payload.password?.length || 0,
                score: 'Strong', 
                entropy: 75,
                suggestions: ['Good job!'] 
            };
        }
        if (path.includes('/crypto/token/generate')) {
            return { tokens: [`mock_token_${Math.random().toString(36).substr(2)}`] };
        }

        // --- Converter ---
        if (path.includes('/converter/base64/encode')) return { encoded: btoa(payload.text || '') };
        if (path.includes('/converter/base64/decode')) {
            try { return { decoded: atob(payload.encoded || '') }; } 
            catch { return { error: "Invalid Base64" }; }
        }
        if (path.includes('/converter/case')) {
            const t = payload.text || '';
            return { 
                camelCase: t.toLowerCase(), 
                UPPERCASE: t.toUpperCase(), 
                snake_case: t.replace(/ /g, '_').toLowerCase() 
            };
        }
        if (path.includes('/converter/url/encode')) return { encoded: encodeURIComponent(payload.url || '') };
        if (path.includes('/converter/url/decode')) return { decoded: decodeURIComponent(payload.encoded || '') };
        if (path.includes('/converter/json-to-yaml')) return { yaml: "mock: yaml\nkey: value" };
        if (path.includes('/converter/yaml-to-json')) return { json: JSON.stringify({mock: 'json'}) };
        if (path.includes('/converter/temperature')) {
            const val = parseFloat(payload.value);
            return { celsius: val, fahrenheit: val * 1.8 + 32, kelvin: val + 273.15 };
        }
        if (path.includes('/converter/roman/to-arabic')) return { arabic: 2025 };
        if (path.includes('/converter/datetime')) return { 
            iso8601: new Date().toISOString(), 
            unix: Math.floor(Date.now()/1000),
            date: new Date().toDateString()
        };

        // --- Web ---
        if (path.includes('/web/json/prettify')) {
             try { return { prettified: JSON.stringify(JSON.parse(payload.json), null, Number(payload.indent || 2)) }; }
             catch { return { error: "Invalid JSON" }; }
        }
        if (path.includes('/web/json/minify')) return { minified: "{}" };
        if (path.includes('/web/jwt/parse')) return { header: {}, payload: { sub: 'mock' }, signature: '...' };
        if (path.includes('/web/markdown/to-html')) return { html: `<h1>${payload.markdown}</h1>` };
        if (path.includes('/web/qr-code/generate')) {
            return { qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=${payload.size || 300}x${payload.size || 300}&data=${encodeURIComponent(payload.text || 'Mock')}` };
        }
        if (path.includes('/web/wifi-qr-code/generate')) {
             return { qrCodeUrl: "data:image/png;base64,mockwifi...", wifiString: `WIFI:S:${payload.ssid};...` };
        }
        if (path.includes('/web/sql/format')) {
            return { formatted: (payload.sql || '').replace(/SELECT/i, '\nSELECT').replace(/FROM/i, '\nFROM') };
        }
        if (path.includes('/web/xml/format')) return { formatted: "<mock>xml</mock>" };
        if (path.includes('/web/yaml/format')) return { formatted: "mock: yaml" };

        // --- Advanced ---
        if (path.includes('/advanced/image/compress')) {
            return { 
                image_data: "data:image/png;base64,mock...", 
                compression_ratio: "50%",
                original_size_readable: "2 MB",
                compressed_size_readable: "1 MB"
            };
        }
        if (path.includes('/advanced/image/crop')) return { image_data: "data:image/png;base64,mockcrop..." };
        if (path.includes('/advanced/pdf/split')) return { files: [{data: 'mockpdf...', pages: '1'}] };

        return null;
    }
};
