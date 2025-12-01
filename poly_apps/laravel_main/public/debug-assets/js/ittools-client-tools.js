// ============================================
// NAMESPACE: ITTools.ClientTools
// FILE: ittools-client-tools.js
// PURPOSE: Client-side only tools (no backend needed)
// ============================================

ITTools.ClientTools = {
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Base64
    // ============================================
    Base64: {
        encode(text) {
            try {
                return btoa(unescape(encodeURIComponent(text)));
            } catch (e) {
                throw new Error('Failed to encode: ' + e.message);
            }
        },
        
        decode(text) {
            try {
                return decodeURIComponent(escape(atob(text)));
            } catch (e) {
                throw new Error('Failed to decode: ' + e.message);
            }
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.URL
    // ============================================
    URL: {
        encode(text) {
            return encodeURIComponent(text);
        },
        
        decode(text) {
            return decodeURIComponent(text);
        },
        
        parse(url) {
            try {
                const parsed = new URL(url);
                const params = {};
                parsed.searchParams.forEach((value, key) => {
                    params[key] = value;
                });
                
                return {
                    protocol: parsed.protocol,
                    hostname: parsed.hostname,
                    port: parsed.port,
                    pathname: parsed.pathname,
                    search: parsed.search,
                    hash: parsed.hash,
                    params: params
                };
            } catch (e) {
                throw new Error('Invalid URL: ' + e.message);
            }
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.HTML
    // ============================================
    HTML: {
        encode(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        decode(text) {
            const div = document.createElement('div');
            div.innerHTML = text;
            return div.textContent;
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.JSON
    // ============================================
    JSON: {
        format(jsonText, indent = 2) {
            const parsed = JSON.parse(jsonText);
            return indent === 0 ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent);
        },
        
        validate(jsonText) {
            try {
                JSON.parse(jsonText);
                return { valid: true };
            } catch (e) {
                return { valid: false, error: e.message };
            }
        },
        
        minify(jsonText) {
            return JSON.stringify(JSON.parse(jsonText));
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Text
    // ============================================
    Text: {
        statistics(text) {
            const lines = text.split('\n');
            const words = text.trim().split(/\s+/).filter(w => w.length > 0);
            const chars = text.length;
            const charsNoSpaces = text.replace(/\s/g, '').length;
            
            return {
                characters: chars,
                characters_no_spaces: charsNoSpaces,
                words: words.length,
                lines: lines.length,
                sentences: (text.match(/[.!?]+/g) || []).length,
                paragraphs: text.split(/\n\n+/).filter(p => p.trim()).length
            };
        },
        
        diff(text1, text2) {
            const lines1 = text1.split('\n');
            const lines2 = text2.split('\n');
            const maxLen = Math.max(lines1.length, lines2.length);
            const diffs = [];
            
            for (let i = 0; i < maxLen; i++) {
                const line1 = lines1[i] || '';
                const line2 = lines2[i] || '';
                
                if (line1 !== line2) {
                    diffs.push({
                        line: i + 1,
                        old: line1,
                        new: line2,
                        type: !line1 ? 'added' : !line2 ? 'removed' : 'modified'
                    });
                }
            }
            
            return diffs;
        },
        
        loremIpsum(paragraphs = 3) {
            const lorem = [
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
                "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
                "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium."
            ];
            
            const result = [];
            for (let i = 0; i < paragraphs; i++) {
                result.push(lorem[i % lorem.length]);
            }
            
            return result.join('\n\n');
        },
        
        toNato(text) {
            const nato = {
                'a': 'Alpha', 'b': 'Bravo', 'c': 'Charlie', 'd': 'Delta', 'e': 'Echo',
                'f': 'Foxtrot', 'g': 'Golf', 'h': 'Hotel', 'i': 'India', 'j': 'Juliett',
                'k': 'Kilo', 'l': 'Lima', 'm': 'Mike', 'n': 'November', 'o': 'Oscar',
                'p': 'Papa', 'q': 'Quebec', 'r': 'Romeo', 's': 'Sierra', 't': 'Tango',
                'u': 'Uniform', 'v': 'Victor', 'w': 'Whiskey', 'x': 'X-ray', 'y': 'Yankee',
                'z': 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
                '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
            };
            
            return text.toLowerCase().split('').map(c => nato[c] || c).join(' ');
        },
        
        toBinary(text) {
            return text.split('').map(c => {
                return c.charCodeAt(0).toString(2).padStart(8, '0');
            }).join(' ');
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Timestamp
    // ============================================
    Timestamp: {
        current() {
            return Math.floor(Date.now() / 1000);
        },
        
        toDate(timestamp) {
            const date = new Date(timestamp * 1000);
            return {
                iso: date.toISOString(),
                local: date.toLocaleString(),
                utc: date.toUTCString(),
                date: date.toLocaleDateString(),
                time: date.toLocaleTimeString()
            };
        },
        
        fromDate(dateString) {
            return Math.floor(new Date(dateString).getTime() / 1000);
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Math
    // ============================================
    Math: {
        evaluate(expression) {
            try {
                const result = Function('"use strict"; return (' + expression + ')')();
                return { result: result, valid: true };
            } catch (e) {
                return { result: null, valid: false, error: e.message };
            }
        },
        
        percentage(value, total) {
            return (value / total * 100).toFixed(2);
        },
        
        convertBase(number, fromBase, toBase) {
            return parseInt(number, fromBase).toString(toBase).toUpperCase();
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Regex
    // ============================================
    Regex: {
        test(pattern, text, flags = '') {
            try {
                const regex = new RegExp(pattern, flags);
                const matches = text.match(regex);
                const allMatches = [];
                
                if (flags.includes('g')) {
                    let match;
                    const globalRegex = new RegExp(pattern, flags);
                    while ((match = globalRegex.exec(text)) !== null) {
                        allMatches.push({
                            match: match[0],
                            index: match.index,
                            groups: match.slice(1)
                        });
                    }
                }
                
                return {
                    matches: matches !== null,
                    result: matches,
                    all_matches: allMatches,
                    count: allMatches.length || (matches ? 1 : 0)
                };
            } catch (e) {
                return { matches: false, error: e.message };
            }
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.ClientTools.Misc
    // ============================================
    Misc: {
        randomPort() {
            return Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
        },
        
        chmodCalculator(permissions) {
            const values = { r: 4, w: 2, x: 1 };
            let result = 0;
            
            ['r', 'w', 'x'].forEach((perm, i) => {
                if (permissions.includes(perm)) {
                    result += values[perm];
                }
            });
            
            return result;
        },
        
        deviceInfo() {
            return {
                user_agent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screen_width: screen.width,
                screen_height: screen.height,
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                color_depth: screen.colorDepth,
                pixel_ratio: window.devicePixelRatio,
                online: navigator.onLine,
                cookies_enabled: navigator.cookieEnabled
            };
        }
    }
};

console.log('ITTools Client Tools loaded');
