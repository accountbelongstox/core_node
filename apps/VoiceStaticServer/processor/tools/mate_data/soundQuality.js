// Complete voice mapping for all supported languages and regions
const VOICE_MAP = {
    // English voices
    'en-GB': ['en-GB-SoniaNeural', 'en-GB-RyanNeural'],  // British English
    'en-US': ['en-US-JennyNeural', 'en-US-GuyNeural'],   // American English
    'en-AU': ['en-AU-NatashaNeural', 'en-AU-WilliamNeural'],  // Australian English
    'en-CA': ['en-CA-ClaraNeural', 'en-CA-LiamNeural'],  // Canadian English
    'en-HK': ['en-HK-YanNeural', 'en-HK-SamNeural'],  // Hong Kong English
    'en-IN': ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],  // Indian English
    'en-IE': ['en-IE-EmilyNeural', 'en-IE-ConnorNeural'],  // Irish English
    'en-NZ': ['en-NZ-MollyNeural', 'en-NZ-MitchellNeural'],  // New Zealand English
    'en-PH': ['en-PH-RosaNeural', 'en-PH-JamesNeural'],  // Philippine English
    'en-SG': ['en-SG-LunaNeural', 'en-SG-WayneNeural'],  // Singapore English
    'en-ZA': ['en-ZA-LeahNeural', 'en-ZA-LukeNeural'],  // South African English
    
    // Chinese voices
    'zh-CN': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],  // Mainland Chinese
    'zh-TW': ['zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural'],  // Taiwan Chinese
    'zh-HK': ['zh-HK-HiuGaaiNeural', 'zh-HK-WanLungNeural'],  // Hong Kong Chinese
    
    // Arabic voices
    'ar-EG': ['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural'],  // Egyptian Arabic
    'ar-SA': ['ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'],  // Saudi Arabic
    'ar-AE': ['ar-AE-FatimaNeural', 'ar-AE-HamdanNeural'],  // UAE Arabic
    
    // European languages
    'fr-FR': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],  // French
    'de-DE': ['de-DE-KatjaNeural', 'de-DE-ConradNeural'],  // German
    'it-IT': ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],  // Italian
    'es-ES': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],  // Spanish
    'pt-PT': ['pt-PT-RaquelNeural', 'pt-PT-DuarteNeural'],  // Portuguese
    'ru-RU': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],  // Russian
    
    // Asian languages
    'ja-JP': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],  // Japanese
    'ko-KR': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],  // Korean
    'hi-IN': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],  // Hindi
    'th-TH': ['th-TH-PremwadeeNeural', 'th-TH-NiwatNeural'],  // Thai
    'vi-VN': ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'],  // Vietnamese
};

/**
 * Get voice by locale and gender
 * @param {string} locale - Language locale (e.g., 'en-US', 'zh-CN')
 * @param {string} gender - 'female' or 'male'
 * @returns {string|null} Voice name or null if not found
 */
const getVoice = (locale, gender = 'female') => {
    if (!(locale in VOICE_MAP)) {
        return null;
    }
    const index = gender.toLowerCase() === 'female' ? 0 : 1;
    return VOICE_MAP[locale][index];
};

const getEnglishVoice = (gender = 'female') => {
    return getVoice('en-GB', gender);
};

const getAmericanVoice = (gender = 'female') => {
    return getVoice('en-US', gender);
};

const findVoiceByLocale = (TTS_PY_VOICES, locale) => {
    let voices = [];
    for (const voice of TTS_PY_VOICES) {
        if (voice.toLowerCase().startsWith(locale.toLowerCase())) {
            voices.push(voice);
        }
    }
    return voices[Math.floor(Math.random() * voices.length)];
};

const getChineseVoice = (gender = 'female') => {
    return getVoice('zh-CN', gender);
};

const log = require('#@/ncore/utils/logger/index.js');

/**
 * Find and randomly select an American English voice
 * @param {Array} voices - Array of voice objects
 * @returns {Object|null} - Randomly selected US English voice or null
 */
function getAmericanVoices(voices) {
    try {
        if (!Array.isArray(voices)) {
            log.error('Invalid voices array provided');
            return null;
        }

        const usVoices = voices.filter(voice => 
            voice.Locale === 'en-US'
        );

        if (usVoices.length === 0) {
            log.warn('No US English voices found');
            return null;
        }

        // Randomly select one voice
        const randomIndex = Math.floor(Math.random() * usVoices.length);
        return usVoices[randomIndex];

    } catch (error) {
        log.error('Error finding American voice:', error);
        return null;
    }
}

/**
 * Find and randomly select a British English voice
 * @param {Array} voices - Array of voice objects
 * @returns {Object|null} - Randomly selected UK English voice or null
 */
function getBritishVoices(voices) {
    try {
        if (!Array.isArray(voices)) {
            log.error('Invalid voices array provided');
            return null;
        }

        const ukVoices = voices.filter(voice => 
            voice.Locale === 'en-GB'
        );

        if (ukVoices.length === 0) {
            log.warn('No UK English voices found');
            return null;
        }

        // Randomly select one voice
        const randomIndex = Math.floor(Math.random() * ukVoices.length);
        return ukVoices[randomIndex];

    } catch (error) {
        log.error('Error finding British voice:', error);
        return null;
    }
}

/**
 * Get preferred voice by gender
 * @param {Array} voices - Array of voice objects
 * @param {string} gender - Preferred gender ('Male' or 'Female')
 * @returns {Object|null} - Preferred voice or null if not found
 */
function getPreferredVoice(voices, gender = 'Female') {
    try {
        return voices.find(voice => 
            voice.Gender === gender && 
            voice.ShortName.includes('Multilingual')
        ) || voices[0] || null;
    } catch (error) {
        log.error('Error finding preferred voice:', error);
        return null;
    }
}

module.exports = {
    VOICE_MAP,
    getVoice,
    getEnglishVoice,
    getAmericanVoice,
    getChineseVoice,
    getAmericanVoices,
    getBritishVoices,
    getPreferredVoice,
    findVoiceByLocale
}; 