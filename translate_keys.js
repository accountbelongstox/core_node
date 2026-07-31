const fs = require('fs');
const path = require('path');

// We will use a simple fetch to a free translation API or just use the installed module if it works in CommonJS
// Wait, @vitalets/google-translate-api is ESM only in recent versions. Let's check.
// If it's ESM, we can use dynamic import.

async function translateText(text, targetLang) {
    try {
        const { translate } = await import('@vitalets/google-translate-api');
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e) {
        console.error('Translation error:', e);
        return text; // fallback to original
    }
}

async function main() {
    const localesDir = path.join(__dirname, 'apps', 'mcp-chrome', 'app', 'chrome-extension', '_locales');
    const enPath = path.join(localesDir, 'en', 'messages.json');
    const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

    const langs = {
        'de': 'de',
        'ja': 'ja',
        'ko': 'ko',
        'zh_TW': 'zh-TW'
    };

    for (const [lang, gLang] of Object.entries(langs)) {
        console.log(`Processing ${lang}...`);
        const langPath = path.join(localesDir, lang, 'messages.json');
        let langData = {};
        try {
            langData = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
        } catch (e) {
            console.error(`Could not read ${langPath}`);
            continue;
        }

        let missingCount = 0;
        for (const [key, value] of Object.entries(enData)) {
            if (!langData[key]) {
                missingCount++;
                const originalText = value.message;
                // Translate the message
                // Note: we should preserve placeholders like $1, $PORT$, etc.
                // Google translate might mess them up, but let's try.
                console.log(`Translating ${key} to ${lang}...`);
                const translatedText = await translateText(originalText, gLang);

                langData[key] = {
                    message: translatedText
                };
                if (value.description) {
                    langData[key].description = value.description;
                }
                if (value.placeholders) {
                    langData[key].placeholders = value.placeholders;
                }

                // Sleep a bit to avoid rate limits
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (missingCount > 0) {
            fs.writeFileSync(langPath, JSON.stringify(langData, null, 2), 'utf-8');
            console.log(`Updated ${lang} with ${missingCount} new keys.`);
        } else {
            console.log(`${lang} is already up to date.`);
        }
    }
}

main().catch(console.error);
