// ============================================
// NAMESPACE: ITTools.Implementations.Text
// FILE: ittools-impl-text.js  
// PURPOSE: Text tool implementations
// ============================================

// ============================================
// Emoji Picker
// ============================================
ITTools.Tools.Registry.register('emoji-picker', {
    name: 'Emoji Picker',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Emoji Picker</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search Emoji:</label>
                        <input type="text" id="emoji-search" class="ittools-input" placeholder="Search emoji..." oninput="ITTools.Implementations.EmojiPicker.search()">
                    </div>
                    <div id="emoji-result" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; margin-top: 15px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.EmojiPicker = {
    emojis: {
        '😀': 'grinning face smile happy',
        '😁': 'beaming face smile happy',
        '😂': 'tears joy laughing crying',
        '😃': 'grinning face smile happy',
        '😄': 'grinning face smile happy',
        '😅': 'grinning face sweat smile',
        '😆': 'grinning face smile laugh',
        '😇': 'smiling face halo angel',
        '😈': 'smiling face horns devil',
        '😉': 'winking face wink',
        '😊': 'smiling face smile happy',
        '😋': 'face savoring food yummy',
        '😌': 'relieved face calm',
        '😍': 'smiling face heart eyes love',
        '😎': 'smiling face sunglasses cool',
        '😏': 'smirking face smirk',
        '😐': 'neutral face meh',
        '😑': 'expressionless face blank',
        '😒': 'unamused face annoyed',
        '😓': 'downcast face sweat sad',
        '😔': 'pensive face sad',
        '😕': 'confused face',
        '😖': 'confounded face frustrated',
        '😗': 'kissing face kiss',
        '😘': 'face blowing kiss love',
        '😙': 'kissing face smile',
        '😚': 'kissing face closed eyes',
        '😛': 'face tongue stuck out',
        '😜': 'winking face tongue',
        '😝': 'squinting face tongue',
        '😞': 'disappointed face sad',
        '😟': 'worried face concern',
        '😠': 'angry face mad',
        '😡': 'pouting face angry rage',
        '😢': 'crying face tears sad',
        '😣': 'persevering face struggle',
        '😤': 'face steam from nose triumph',
        '😥': 'sad but relieved face',
        '😦': 'frowning face mouth open',
        '😧': 'anguished face scared',
        '😨': 'fearful face scared',
        '😩': 'weary face tired exhausted',
        '😪': 'sleepy face tired',
        '😫': 'tired face exhausted',
        '😬': 'grimacing face awkward',
        '😭': 'loudly crying face tears',
        '😮': 'face mouth open surprised',
        '😯': 'hushed face surprised',
        '😰': 'anxious face sweat worried',
        '😱': 'face screaming fear scared',
        '😲': 'astonished face shocked',
        '😳': 'flushed face embarrassed',
        '😴': 'sleeping face zzz',
        '😵': 'dizzy face confused',
        '😶': 'face without mouth silent',
        '😷': 'face medical mask sick',
        '🙁': 'slightly frowning face sad',
        '🙂': 'slightly smiling face happy',
        '🙃': 'upside down face silly',
        '🙄': 'face rolling eyes annoyed',
        '🤐': 'zipper mouth face secret',
        '🤑': 'money mouth face rich',
        '🤒': 'face thermometer sick',
        '🤓': 'nerd face glasses geek',
        '🤔': 'thinking face hmm',
        '🤕': 'face head bandage injured',
        '🤖': 'robot face bot',
        '🤗': 'hugging face hug',
        '🤘': 'sign of horns rock',
        '❤️': 'red heart love',
        '💙': 'blue heart love',
        '💚': 'green heart love',
        '💛': 'yellow heart love',
        '💜': 'purple heart love',
        '🖤': 'black heart love',
        '💔': 'broken heart sad',
        '💕': 'two hearts love',
        '💖': 'sparkling heart love',
        '💗': 'growing heart love',
        '💘': 'heart arrow love cupid',
        '💝': 'heart gift box love',
        '💞': 'revolving hearts love',
        '💟': 'heart decoration love',
        '💢': 'anger symbol angry',
        '💣': 'bomb explosive',
        '💤': 'zzz sleep',
        '💥': 'collision boom',
        '💦': 'sweat droplets water',
        '💨': 'dashing away fast',
        '💩': 'pile of poo poop',
        '💪': 'flexed biceps strong',
        '💫': 'dizzy stars',
        '💬': 'speech balloon talk',
        '💭': 'thought balloon thinking',
        '💯': 'hundred points perfect',
        '🔥': 'fire hot flame',
        '⭐': 'star rating',
        '✨': 'sparkles magic shine',
        '✅': 'check mark button done',
        '❌': 'cross mark wrong',
        '⚠️': 'warning sign alert',
        '🎉': 'party popper celebrate',
        '🎊': 'confetti ball party',
        '🎁': 'wrapped gift present',
        '🎈': 'balloon party',
        '👍': 'thumbs up good',
        '👎': 'thumbs down bad',
        '👏': 'clapping hands applause',
        '👋': 'waving hand hello',
        '🙏': 'folded hands pray thank',
        '💰': 'money bag rich',
        '💵': 'dollar banknote money',
        '💎': 'gem stone diamond',
        '🔔': 'bell notification',
        '🔕': 'bell slash mute',
        '📢': 'loudspeaker announce',
        '📣': 'megaphone announce',
        '📱': 'mobile phone smartphone',
        '💻': 'laptop computer',
        '⌨️': 'keyboard typing',
        '🖥️': 'desktop computer',
        '🖨️': 'printer print',
        '🖱️': 'computer mouse',
        '📧': 'email mail',
        '📨': 'incoming envelope mail',
        '📩': 'envelope arrow mail',
        '📮': 'postbox mail',
        '📬': 'open mailbox',
        '📭': 'mailbox no mail',
        '📫': 'closed mailbox',
        '📪': 'closed mailbox lowered',
        '🔒': 'locked security',
        '🔓': 'unlocked open',
        '🔐': 'locked key security',
        '🔑': 'key unlock',
        '🔍': 'magnifying glass search',
        '🔎': 'magnifying glass right search',
        '💡': 'light bulb idea',
        '🔦': 'flashlight light',
        '🕯️': 'candle light',
        '🔋': 'battery power',
        '🔌': 'electric plug power',
        '💾': 'floppy disk save',
        '💿': 'optical disc cd',
        '📀': 'dvd disc',
        '📁': 'file folder directory',
        '📂': 'open file folder',
        '📅': 'calendar date',
        '📆': 'tear-off calendar',
        '📌': 'pushpin pin',
        '📍': 'round pushpin location',
        '✏️': 'pencil write edit',
        '✒️': 'pen write',
        '🖊️': 'pen write',
        '🖋️': 'fountain pen write',
        '📝': 'memo note write',
        '📄': 'page document',
        '📃': 'page curl document',
        '📋': 'clipboard copy',
        '📊': 'bar chart graph',
        '📈': 'chart increasing graph',
        '📉': 'chart decreasing graph',
        '🗂️': 'card index dividers',
        '🗃️': 'card file box',
        '🗄️': 'file cabinet',
        '📦': 'package box parcel',
        '📧': 'email mail',
        '🌍': 'globe europe africa world',
        '🌎': 'globe americas world',
        '🌏': 'globe asia world',
        '🌐': 'globe meridians world web',
        '🗺️': 'world map',
        '🧭': 'compass navigation',
        '🏠': 'house home',
        '🏡': 'house garden home',
        '🏢': 'office building',
        '🏣': 'japanese post office',
        '🏤': 'post office',
        '🏥': 'hospital medical',
        '🏦': 'bank money',
        '🏧': 'atm money',
        '🏨': 'hotel lodging',
        '🏩': 'love hotel',
        '🏪': 'convenience store shop',
        '🏫': 'school education',
        '🏬': 'department store shopping',
        '🏭': 'factory industry',
        '⚡': 'high voltage electricity',
        '🔥': 'fire hot',
        '💧': 'droplet water',
        '🌊': 'water wave ocean',
        '☀️': 'sun sunny',
        '🌤️': 'sun behind small cloud',
        '⛅': 'sun behind cloud',
        '🌥️': 'sun behind large cloud',
        '☁️': 'cloud cloudy',
        '🌦️': 'sun behind rain cloud',
        '🌧️': 'cloud rain rainy',
        '⛈️': 'cloud lightning thunder',
        '🌩️': 'cloud lightning',
        '🌨️': 'cloud snow snowy',
        '❄️': 'snowflake snow cold',
        '⛄': 'snowman without snow',
        '☃️': 'snowman snow',
        '🌬️': 'wind face blowing',
        '💨': 'dashing away fast wind',
        '🌪️': 'tornado cyclone',
        '🌫️': 'fog foggy',
        '🌈': 'rainbow colorful',
        '⚽': 'soccer ball football',
        '🏀': 'basketball',
        '🏈': 'american football',
        '⚾': 'baseball',
        '🎾': 'tennis',
        '🏐': 'volleyball',
        '🏉': 'rugby football',
        '🎱': 'pool 8 ball billiards',
        '🏓': 'ping pong table tennis',
        '🏸': 'badminton',
        '🥊': 'boxing glove',
        '🎯': 'direct hit target bullseye',
        '⛳': 'flag in hole golf',
        '🏆': 'trophy winner champion',
        '🥇': 'gold medal first place',
        '🥈': 'silver medal second place',
        '🥉': 'bronze medal third place',
        '🎖️': 'military medal',
        '🏅': 'sports medal',
        '🎗️': 'reminder ribbon',
        '🎵': 'musical note music',
        '🎶': 'musical notes music',
        '🎤': 'microphone singing',
        '🎧': 'headphone music',
        '🎼': 'musical score music',
        '🎹': 'musical keyboard piano',
        '🥁': 'drum music',
        '🎷': 'saxophone music',
        '🎺': 'trumpet music',
        '🎸': 'guitar music',
        '🎻': 'violin music'
    },
    
    search() {
        const query = document.getElementById('emoji-search').value.toLowerCase();
        const filtered = Object.entries(this.emojis).filter(([emoji, keywords]) => 
            keywords.toLowerCase().includes(query) || emoji.includes(query)
        );
        
        if (filtered.length === 0) {
            document.getElementById('emoji-result').innerHTML = '<p style="text-align: center; color: #999; padding: 20px; grid-column: 1/-1;">No matching emojis</p>';
            return;
        }
        
        const html = filtered.map(([emoji, keywords]) => `
            <div onclick="ITTools.Implementations.EmojiPicker.copy('${emoji}')" style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; font-size: 32px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.2)'; this.style.background='#667eea';" onmouseout="this.style.transform='scale(1)'; this.style.background='#f8f9fa';" title="${keywords}">
                ${emoji}
            </div>
        `).join('');
        
        document.getElementById('emoji-result').innerHTML = html;
    },
    
    copy(emoji) {
        ITTools.UI.copyToClipboard(emoji);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('emoji-result')) {
        ITTools.Implementations.EmojiPicker.search();
    }
});

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
                        <label class="ittools-label">Input String:</label>
                        <textarea id="obfuscate-input" class="ittools-textarea" rows="6" placeholder="Hello World"></textarea>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Obfuscation Method:</label>
                        <select id="obfuscate-method" class="ittools-input">
                            <option value="hex">Hex Encoding</option>
                            <option value="unicode">Unicode Escape</option>
                            <option value="binary">Binary</option>
                            <option value="reverse">Reverse + Base64</option>
                        </select>
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
    obfuscate() {
        const input = document.getElementById('obfuscate-input').value;
        const method = document.getElementById('obfuscate-method').value;
        
        if (!input) {
            ITTools.UI.showResult('obfuscate-result', 'Please enter a string', false);
            return;
        }
        
        let result = '';
        let methodName = '';
        
        switch(method) {
            case 'hex':
                result = Array.from(input).map(char => '\\x' + char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                methodName = 'Hex Encoding';
                break;
            case 'unicode':
                result = Array.from(input).map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
                methodName = 'Unicode Escape';
                break;
            case 'binary':
                result = Array.from(input).map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
                methodName = 'Binary';
                break;
            case 'reverse':
                const reversed = input.split('').reverse().join('');
                result = btoa(reversed);
                methodName = 'Reverse + Base64';
                break;
        }
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>Method: ${methodName}</strong><br>
                <textarea class="ittools-textarea" rows="8" readonly>${result}</textarea>
                <button onclick="ITTools.UI.copyToClipboard(\`${result.replace(/`/g, '\\`')}\`)" class="ittools-btn ittools-btn-sm" style="margin-top: 10px;">📋 Copy</button>
            </div>
        `;
        
        ITTools.UI.showResult('obfuscate-result', html, true);
    }
};

// ============================================
// Numeronym Generator
// ============================================
ITTools.Tools.Registry.register('numeronym-generator', {
    name: 'Numeronym Generator',
    category: 'text',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Numeronym Generator (i18n → i12n)</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Input Text:</label>
                        <textarea id="numeronym-input" class="ittools-textarea" rows="6" placeholder="internationalization&#10;localization&#10;accessibility"></textarea>
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
        const input = document.getElementById('numeronym-input').value;
        
        if (!input) {
            ITTools.UI.showResult('numeronym-result', 'Please enter text', false);
            return;
        }
        
        const lines = input.split('\n').filter(line => line.trim());
        const results = lines.map(word => {
            const trimmed = word.trim();
            if (trimmed.length <= 3) {
                return { word: trimmed, numeronym: trimmed, count: 0 };
            }
            const first = trimmed[0];
            const last = trimmed[trimmed.length - 1];
            const count = trimmed.length - 2;
            const numeronym = `${first}${count}${last}`;
            return { word: trimmed, numeronym, count };
        });
        
        const html = `
            <div style="margin-top: 15px;">
                <strong>${results.length} Numeronym(s) Generated:</strong>
                <div style="margin-top: 15px;">
                    ${results.map(({ word, numeronym, count }) => `
                        <div style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: #666;">${word}</span>
                                <span style="margin: 0 10px;">→</span>
                                <span style="font-weight: bold; color: #667eea;">${numeronym}</span>
                                <span style="margin-left: 10px; font-size: 12px; color: #999;">(${count} chars)</span>
                            </div>
                            <button onclick="ITTools.UI.copyToClipboard('${numeronym}')" class="ittools-btn ittools-btn-sm">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('numeronym-result', html, true);
    }
};

console.log('ITTools Text Implementations loaded');
