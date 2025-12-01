// ============================================
// NAMESPACE: ITTools.Implementations.Batch12
// FILE: ittools-impl-batch12.js
// PURPOSE: OG Meta, SVG Placeholder, Emoji, MIME types
// ============================================

// ============================================
// Open Graph Meta Generator
// ============================================
ITTools.Tools.Registry.register('og-meta', {
    name: 'Open Graph Meta',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Open Graph Meta Tag Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Title:</label>
                            <input type="text" id="og-title" class="ittools-input" placeholder="Page Title" oninput="ITTools.Implementations.OgMeta.generate()">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Site Name:</label>
                            <input type="text" id="og-site" class="ittools-input" placeholder="My Website" oninput="ITTools.Implementations.OgMeta.generate()">
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Description:</label>
                        <textarea id="og-desc" class="ittools-textarea" rows="2" placeholder="Page description..." oninput="ITTools.Implementations.OgMeta.generate()"></textarea>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">URL:</label>
                            <input type="url" id="og-url" class="ittools-input" placeholder="https://example.com/page" oninput="ITTools.Implementations.OgMeta.generate()">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Image URL:</label>
                            <input type="url" id="og-image" class="ittools-input" placeholder="https://example.com/image.jpg" oninput="ITTools.Implementations.OgMeta.generate()">
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Generated Meta Tags:</label>
                        <textarea id="og-output" class="ittools-textarea" rows="10" readonly style="background:#f8f9fa;font-family:monospace;"></textarea>
                    </div>
                    <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(document.getElementById('og-output').value)">Copy Tags</button>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.OgMeta = {
    generate() {
        const title = document.getElementById('og-title').value;
        const site = document.getElementById('og-site').value;
        const desc = document.getElementById('og-desc').value;
        const url = document.getElementById('og-url').value;
        const image = document.getElementById('og-image').value;
        let tags = '<!-- Open Graph / Facebook -->\n';
        tags += '<meta property="og:type" content="website">\n';
        if (title) tags += `<meta property="og:title" content="${title}">\n`;
        if (desc) tags += `<meta property="og:description" content="${desc}">\n`;
        if (url) tags += `<meta property="og:url" content="${url}">\n`;
        if (site) tags += `<meta property="og:site_name" content="${site}">\n`;
        if (image) tags += `<meta property="og:image" content="${image}">\n`;
        tags += '\n<!-- Twitter -->\n';
        tags += '<meta name="twitter:card" content="summary_large_image">\n';
        if (title) tags += `<meta name="twitter:title" content="${title}">\n`;
        if (desc) tags += `<meta name="twitter:description" content="${desc}">\n`;
        if (image) tags += `<meta name="twitter:image" content="${image}">\n`;
        document.getElementById('og-output').value = tags;
    }
};

// ============================================
// SVG Placeholder Generator
// ============================================
ITTools.Tools.Registry.register('svg-placeholder', {
    name: 'SVG Placeholder',
    category: 'generator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">SVG Placeholder Image Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Width:</label>
                            <input type="number" id="svg-width" class="ittools-input" value="400">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Height:</label>
                            <input type="number" id="svg-height" class="ittools-input" value="300">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">BG Color:</label>
                            <input type="color" id="svg-bg" class="ittools-input" value="#cccccc" style="height:38px;">
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Text Color:</label>
                            <input type="color" id="svg-text" class="ittools-input" value="#666666" style="height:38px;">
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Custom Text (optional):</label>
                        <input type="text" id="svg-label" class="ittools-input" placeholder="Leave empty for dimensions">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.SvgPlaceholder.generate()">Generate SVG</button>
                    </div>
                    <div id="svg-preview" style="text-align:center;margin-top:15px;"></div>
                    <div id="svg-output" style="margin-top:15px;display:none;">
                        <label class="ittools-label">SVG Code:</label>
                        <textarea id="svg-code" class="ittools-textarea" rows="4" readonly style="background:#f8f9fa;font-family:monospace;"></textarea>
                        <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(document.getElementById('svg-code').value)" style="margin-top:5px;">Copy SVG</button>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.SvgPlaceholder = {
    generate() {
        const w = document.getElementById('svg-width').value || 400;
        const h = document.getElementById('svg-height').value || 300;
        const bg = document.getElementById('svg-bg').value;
        const text = document.getElementById('svg-text').value;
        const label = document.getElementById('svg-label').value || `${w}×${h}`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect fill="${bg}" width="${w}" height="${h}"/><text fill="${text}" font-family="sans-serif" font-size="${Math.min(w,h)/8}" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${label}</text></svg>`;
        document.getElementById('svg-preview').innerHTML = svg;
        document.getElementById('svg-code').value = svg;
        document.getElementById('svg-output').style.display = 'block';
    }
};

// ============================================
// Emoji Picker
// ============================================
ITTools.Tools.Registry.register('emoji-picker', {
    name: 'Emoji Picker',
    category: 'text',
    render() {
        const categories = {
            'Smileys': '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺😚😙🥲😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁☹😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠💩🤡👹👺👻👽👾🤖',
            'Gestures': '👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆🖕👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍💅🤳💪🦾🦿🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👁👅👄',
            'People': '👶🧒👦👧🧑👱👨🧔👩🧓👴👵🙍🙎🙅🙆💁🙋🧏🙇🤦🤷👮🕵💂🥷👷🤴👸👳👲🧕🤵👰🤰🤱👼🎅🤶🦸🦹🧙🧚🧛🧜🧝🧞🧟💆💇🚶🧍🧎🏃💃🕺🕴👯🧖🧗🤸🏌🏇⛷🏂🏋🤼🤽🤾🤺⛹🏊🚣🧘🛀🛌',
            'Nature': '🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🪱🐛🦋🐌🐞🐜🪰🪲🪳🦟🦗🕷🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🦬🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐈🪶🐓🦃🦤🦚🦜🦢🦩🕊🐇🦝🦨🦡🦫🦦🦥🐁🐀🐿🦔🐾🐉🐲🌵🎄🌲🌳🌴🪵🌱🌿☘🍀🎍🪴🎋🍃🍂🍁🍄🐚🪨🌾💐🌷🌹🥀🪻🪷🌺🌸🌼🌻🌞🌝🌛🌜🌚🌕🌖🌗🌘🌑🌒🌓🌔🌙🌎🌍🌏🪐💫⭐🌟✨⚡☄💥🔥🌪🌈☀🌤⛅🌥☁🌦🌧⛈🌩🌨❄☃⛄🌬💨💧💦🫧☔☂🌊🌫',
            'Food': '🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🫐🥝🍅🫒🥥🥑🍆🥔🥕🌽🌶🫑🥒🥬🥦🧄🧅🍄🥜🫘🌰🍞🥐🥖🫓🥨🥯🥞🧇🧀🍖🍗🥩🥓🍔🍟🍕🌭🥪🌮🌯🫔🥙🧆🥚🍳🥘🍲🫕🥣🥗🍿🧈🧂🥫🍱🍘🍙🍚🍛🍜🍝🍠🍢🍣🍤🍥🥮🍡🥟🥠🥡🦀🦞🦐🦑🦪🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🍼🥛☕🫖🍵🍶🍾🍷🍸🍹🍺🍻🥂🥃🫗🥤🧋🧃🧉🧊🥢🍽🍴🥄🔪🫙🏺',
            'Activities': '⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿⛷🏂🪂🏋🤼🤸🤺⛹🏌🏇🧘🏄🏊🤽🚣🧗🚵🚴🏆🥇🥈🥉🏅🎖🏵🎗🎫🎟🎪🤹🎭🩰🎨🎬🎤🎧🎼🎹🥁🪘🎷🎺🎸🪕🎻🎲♟🎯🎳🎮🎰🧩',
            'Objects': '⌚📱📲💻⌨🖥🖨🖱🖲🕹🗜💽💾💿📀📼📷📸📹🎥📽🎞📞☎📟📠📺📻🎙🎚🎛🧭⏱⏲⏰🕰⌛⏳📡🔋🔌💡🔦🕯🪔🧯🛢💸💵💴💶💷🪙💰💳💎⚖🪜🧰🪛🔧🔨⚒🛠⛏🪚🔩⚙🪤🧱⛓🪝🧲🔫💣🧨🪓🔪🗡⚔🛡🚬⚰🪦⚱🏺🔮📿🧿💈⚗🔭🔬🕳🩹🩺💊💉🩸🧬🦠🧫🧪🌡🧹🪠🧺🧻🚽🚰🚿🛁🛀🧼🪥🪒🧽🪣🧴🛎🔑🗝🚪🪑🛋🛏🛌🧸🪆🖼🪞🪟🛍🛒🎁🎈🎏🎀🪄🪅🎊🎉🎎🏮🎐🧧✉📩📨📧💌📥📤📦🏷🪧📪📫📬📭📮📯📜📃📄📑🧾📊📈📉🗒🗓📆📅🗑📇🗃🗳🗄📋📁📂🗂🗞📰📓📔📒📕📗📘📙📚📖🔖🧷🔗📎🖇📐📏🧮📌📍✂🖊🖋✒🖌🖍📝✏🔍🔎🔏🔐🔒🔓'
        };
        let html = '<div class="ittools-form-group"><label class="ittools-label">Selected:</label><input type="text" id="emoji-selected" class="ittools-input" readonly style="font-size:24px;"><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(document.getElementById(\'emoji-selected\').value)" style="margin-left:5px;">Copy</button></div>';
        for (const [cat, emojis] of Object.entries(categories)) {
            html += `<div style="margin-bottom:15px;"><strong>${cat}</strong><div style="line-height:2;">${[...emojis].map(e => `<span style="cursor:pointer;font-size:24px;padding:2px;" onclick="document.getElementById('emoji-selected').value+='${e}'">${e}</span>`).join('')}</div></div>`;
        }
        return `<div class="ittools-card"><div class="ittools-card-header">Emoji Picker</div><div class="ittools-card-body" style="max-height:500px;overflow:auto;">${html}</div></div>`;
    }
});

// ============================================
// MIME Types Reference
// ============================================
ITTools.Tools.Registry.register('mime-types', {
    name: 'MIME Types',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">MIME Types Reference</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Search:</label>
                        <input type="text" id="mime-search" class="ittools-input" placeholder="Search by extension or type..." oninput="ITTools.Implementations.MimeTypes.search()">
                    </div>
                    <div id="mime-list" style="max-height:400px;overflow:auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.MimeTypes = {
    types: {
        'html': 'text/html', 'htm': 'text/html', 'css': 'text/css', 'js': 'application/javascript',
        'json': 'application/json', 'xml': 'application/xml', 'txt': 'text/plain', 'csv': 'text/csv',
        'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'zip': 'application/zip', 'rar': 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar', 'gz': 'application/gzip',
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
        'svg': 'image/svg+xml', 'ico': 'image/x-icon', 'bmp': 'image/bmp', 'tiff': 'image/tiff',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac', 'aac': 'audio/aac',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime', 'mkv': 'video/x-matroska',
        'ttf': 'font/ttf', 'otf': 'font/otf', 'woff': 'font/woff', 'woff2': 'font/woff2',
        'php': 'application/x-httpd-php', 'py': 'text/x-python', 'java': 'text/x-java-source',
        'c': 'text/x-c', 'cpp': 'text/x-c++', 'h': 'text/x-c', 'sh': 'application/x-sh',
        'yaml': 'text/yaml', 'yml': 'text/yaml', 'md': 'text/markdown', 'sql': 'application/sql'
    },
    search() {
        const q = document.getElementById('mime-search').value.toLowerCase();
        const filtered = Object.entries(this.types).filter(([ext, mime]) => ext.includes(q) || mime.includes(q));
        this.render(filtered);
    },
    render(items = null) {
        const list = items || Object.entries(this.types);
        const html = list.map(([ext, mime]) => `
            <div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee;">
                <code style="background:#e9ecef;padding:2px 8px;border-radius:3px;">.${ext}</code>
                <span style="color:#666;">${mime}</span>
                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${mime}')" style="padding:2px 8px;">Copy</button>
            </div>
        `).join('');
        document.getElementById('mime-list').innerHTML = html || '<p style="text-align:center;color:#666;padding:20px;">No results</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('mime-list');
    if (el) ITTools.Implementations.MimeTypes.render();
});

console.log('ITTools Batch 12 loaded (og-meta, svg-placeholder, emoji-picker, mime-types)');
