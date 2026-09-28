<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

/**
 * Unified Language Configuration Service
 * Single source of truth for all language configurations, eliminating 7 duplicate definitions
 *
 * ========================================
 * IMPORTANT: Edge-TTS Language Support
 * ========================================
 *
 * This configuration strictly aligns with Microsoft Edge-TTS service.
 * Edge-TTS Repository: https://github.com/rany2/edge-tts
 *
 * Language Code Standards:
 * - code: ISO 639-1 two-letter code (e.g., en, zh, ja)
 * - voice_id: Edge-TTS official voice identifier format: {locale}-{region}-{voiceName}Neural
 *   Examples: 'en-US-JennyNeural', 'zh-CN-XiaoxiaoNeural', 'ja-JP-NanamiNeural'
 *
 * Maintenance Principles:
 * 1. Though hardcoded, must stay synchronized with Edge-TTS official language support
 * 2. voice_id must use valid voice identifiers provided by Edge-TTS
 * 3. Before adding new languages, verify Edge-TTS support for that language and voice
 * 4. When Edge-TTS updates voice list, synchronize this configuration accordingly
 *
 * Data Sources:
 * - Edge-TTS Official Documentation: https://docs.microsoft.com/azure/cognitive-services/speech-service/language-support
 * - Verify via command: edge-tts --list-voices
 *
 * Last Synchronized: 2025-12-20
 * Edge-TTS Version: Compatible with edge-tts >= 6.x
 */
class AppQyV1LanguageConfigService
{
    /**
     * All supported language configurations (single source of truth)
     *
     * Data Structure:
     * - name: English name
     * - native_name: Native language name
     * - zh_name: Chinese name
     * - icon: Emoji icon
     * - color: UI theme color (hexadecimal)
     * - voice_id: Edge-TTS voice identifier (must match Edge-TTS official specs)
     * - flag_icon: Flag icon name (for frontend mapping)
     * - supports_study: Whether supported as study language (9 core languages)
     * - supports_tts: Whether supports Edge-TTS text-to-speech (80+ languages)
     * - supports_dictionary: Whether has offline dictionary support
     *
     * CAUTION: voice_id field strictly follows Edge-TTS naming convention, do not modify arbitrarily
     */
    private const ALL_LANGUAGES = [
        'en' => [
            'name' => 'English',
            'native_name' => 'English',
            'zh_name' => '英语',
            'icon' => '🇺🇸',
            'color' => '#3B82F6',
            'voice_id' => 'en-US-JennyNeural',
            'flag_icon' => 'flag-us',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => true,
        ],
        'zh' => [
            'name' => 'Chinese',
            'native_name' => '中文',
            'zh_name' => '中文',
            'icon' => '🇨🇳',
            'color' => '#EF4444',
            'voice_id' => 'zh-CN-XiaoxiaoNeural',
            'flag_icon' => 'flag-cn',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => true,
        ],
        'ja' => [
            'name' => 'Japanese',
            'native_name' => '日本語',
            'zh_name' => '日语',
            'icon' => '🇯🇵',
            'color' => '#EC4899',
            'voice_id' => 'ja-JP-NanamiNeural',
            'flag_icon' => 'flag-jp',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => true,
        ],
        'ko' => [
            'name' => 'Korean',
            'native_name' => '한국어',
            'zh_name' => '韩语',
            'icon' => '🇰🇷',
            'color' => '#8B5CF6',
            'voice_id' => 'ko-KR-SunHiNeural',
            'flag_icon' => 'flag-kr',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => false,
        ],
        'fr' => [
            'name' => 'French',
            'native_name' => 'Français',
            'zh_name' => '法语',
            'icon' => '🇫🇷',
            'color' => '#06B6D4',
            'voice_id' => 'fr-FR-DeniseNeural',
            'flag_icon' => 'flag-fr',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => false,
        ],
        'de' => [
            'name' => 'German',
            'native_name' => 'Deutsch',
            'zh_name' => '德语',
            'icon' => '🇩🇪',
            'color' => '#F59E0B',
            'voice_id' => 'de-DE-KatjaNeural',
            'flag_icon' => 'flag-de',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => false,
        ],
        'es' => [
            'name' => 'Spanish',
            'native_name' => 'Español',
            'zh_name' => '西班牙语',
            'icon' => '🇪🇸',
            'color' => '#10B981',
            'voice_id' => 'es-ES-ElviraNeural',
            'flag_icon' => 'flag-es',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => false,
        ],
        'vi' => [
            'name' => 'Vietnamese',
            'native_name' => 'Tiếng Việt',
            'zh_name' => '越南语',
            'icon' => '🇻🇳',
            'color' => '#14B8A6',
            'voice_id' => 'vi-VN-HoaiMyNeural',
            'flag_icon' => 'flag-vn',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => true,
        ],
        'lo' => [
            'name' => 'Lao',
            'native_name' => 'ລາວ',
            'zh_name' => '老挝语',
            'icon' => '🇱🇦',
            'color' => '#6366F1',
            'voice_id' => 'lo-LA-ChanthavongNeural',
            'flag_icon' => 'flag-la',
            'supports_study' => true,
            'supports_tts' => true,
            'supports_dictionary' => true,
        ],
        // Other languages supported by EdgeTTS
        'af' => ['name' => 'Afrikaans', 'native_name' => 'Afrikaans', 'zh_name' => '南非荷兰语', 'voice_id' => 'af-ZA-AdriNeural', 'flag_icon' => 'flag-za', 'supports_tts' => true],
        'am' => ['name' => 'Amharic', 'native_name' => 'አማርኛ', 'zh_name' => '阿姆哈拉语', 'voice_id' => 'am-ET-MekdesNeural', 'flag_icon' => 'flag-et', 'supports_tts' => true],
        'ar' => ['name' => 'Arabic', 'native_name' => 'العربية', 'zh_name' => '阿拉伯语', 'voice_id' => 'ar-EG-SalmaNeural', 'flag_icon' => 'flag-sa', 'supports_tts' => true],
        'as' => ['name' => 'Assamese', 'native_name' => 'অসমীয়া', 'zh_name' => '阿萨姆语', 'voice_id' => 'as-IN-YashicaNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'az' => ['name' => 'Azerbaijani', 'native_name' => 'Azərbaycan', 'zh_name' => '阿塞拜疆语', 'voice_id' => 'az-AZ-BanuNeural', 'flag_icon' => 'flag-az', 'supports_tts' => true],
        'bg' => ['name' => 'Bulgarian', 'native_name' => 'Български', 'zh_name' => '保加利亚语', 'voice_id' => 'bg-BG-KalinaNeural', 'flag_icon' => 'flag-bg', 'supports_tts' => true],
        'bn' => ['name' => 'Bengali', 'native_name' => 'বাংলা', 'zh_name' => '孟加拉语', 'voice_id' => 'bn-IN-TanishaaNeural', 'flag_icon' => 'flag-bd', 'supports_tts' => true],
        'bs' => ['name' => 'Bosnian', 'native_name' => 'Bosanski', 'zh_name' => '波斯尼亚语', 'voice_id' => 'bs-BA-VesnaNeural', 'flag_icon' => 'flag-ba', 'supports_tts' => true],
        'ca' => ['name' => 'Catalan', 'native_name' => 'Català', 'zh_name' => '加泰罗尼亚语', 'voice_id' => 'ca-ES-JoanaNeural', 'flag_icon' => 'flag-es', 'supports_tts' => true],
        'cs' => ['name' => 'Czech', 'native_name' => 'Čeština', 'zh_name' => '捷克语', 'voice_id' => 'cs-CZ-VlastaNeural', 'flag_icon' => 'flag-cz', 'supports_tts' => true],
        'cy' => ['name' => 'Welsh', 'native_name' => 'Cymraeg', 'zh_name' => '威尔士语', 'voice_id' => 'cy-GB-NiaNeural', 'flag_icon' => 'flag-gb', 'supports_tts' => true],
        'da' => ['name' => 'Danish', 'native_name' => 'Dansk', 'zh_name' => '丹麦语', 'voice_id' => 'da-DK-ChristelNeural', 'flag_icon' => 'flag-dk', 'supports_tts' => true],
        'el' => ['name' => 'Greek', 'native_name' => 'Ελληνικά', 'zh_name' => '希腊语', 'voice_id' => 'el-GR-AthinaNeural', 'flag_icon' => 'flag-gr', 'supports_tts' => true],
        'et' => ['name' => 'Estonian', 'native_name' => 'Eesti', 'zh_name' => '爱沙尼亚语', 'voice_id' => 'et-EE-AnuNeural', 'flag_icon' => 'flag-ee', 'supports_tts' => true],
        'eu' => ['name' => 'Basque', 'native_name' => 'Euskara', 'zh_name' => '巴斯克语', 'voice_id' => 'eu-ES-AinhoaNeural', 'flag_icon' => 'flag-es', 'supports_tts' => true],
        'fa' => ['name' => 'Persian', 'native_name' => 'فارسی', 'zh_name' => '波斯语', 'voice_id' => 'fa-IR-DilaraNeural', 'flag_icon' => 'flag-ir', 'supports_tts' => true],
        'fi' => ['name' => 'Finnish', 'native_name' => 'Suomi', 'zh_name' => '芬兰语', 'voice_id' => 'fi-FI-NooraNeural', 'flag_icon' => 'flag-fi', 'supports_tts' => true],
        'fil' => ['name' => 'Filipino', 'native_name' => 'Filipino', 'zh_name' => '菲律宾语', 'voice_id' => 'fil-PH-BlessicaNeural', 'flag_icon' => 'flag-ph', 'supports_tts' => true],
        'ga' => ['name' => 'Irish', 'native_name' => 'Gaeilge', 'zh_name' => '爱尔兰语', 'voice_id' => 'ga-IE-OrlaNeural', 'flag_icon' => 'flag-ie', 'supports_tts' => true],
        'gl' => ['name' => 'Galician', 'native_name' => 'Galego', 'zh_name' => '加利西亚语', 'voice_id' => 'gl-ES-SabelaNeural', 'flag_icon' => 'flag-es', 'supports_tts' => true],
        'gu' => ['name' => 'Gujarati', 'native_name' => 'ગુજરાતી', 'zh_name' => '古吉拉特语', 'voice_id' => 'gu-IN-DhwaniNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'he' => ['name' => 'Hebrew', 'native_name' => 'עברית', 'zh_name' => '希伯来语', 'voice_id' => 'he-IL-HilaNeural', 'flag_icon' => 'flag-il', 'supports_tts' => true],
        'hi' => ['name' => 'Hindi', 'native_name' => 'हिन्दी', 'zh_name' => '印地语', 'voice_id' => 'hi-IN-SwaraNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'hr' => ['name' => 'Croatian', 'native_name' => 'Hrvatski', 'zh_name' => '克罗地亚语', 'voice_id' => 'hr-HR-GabrijelaNeural', 'flag_icon' => 'flag-hr', 'supports_tts' => true],
        'hu' => ['name' => 'Hungarian', 'native_name' => 'Magyar', 'zh_name' => '匈牙利语', 'voice_id' => 'hu-HU-NoemiNeural', 'flag_icon' => 'flag-hu', 'supports_tts' => true],
        'hy' => ['name' => 'Armenian', 'native_name' => 'Հայերեն', 'zh_name' => '亚美尼亚语', 'voice_id' => 'hy-AM-AnahitNeural', 'flag_icon' => 'flag-am', 'supports_tts' => true],
        'id' => ['name' => 'Indonesian', 'native_name' => 'Bahasa Indonesia', 'zh_name' => '印尼语', 'voice_id' => 'id-ID-GadisNeural', 'flag_icon' => 'flag-id', 'supports_tts' => true],
        'is' => ['name' => 'Icelandic', 'native_name' => 'Íslenska', 'zh_name' => '冰岛语', 'voice_id' => 'is-IS-GudrunNeural', 'flag_icon' => 'flag-is', 'supports_tts' => true],
        'it' => ['name' => 'Italian', 'native_name' => 'Italiano', 'zh_name' => '意大利语', 'voice_id' => 'it-IT-ElsaNeural', 'flag_icon' => 'flag-it', 'supports_tts' => true],
        'jv' => ['name' => 'Javanese', 'native_name' => 'Basa Jawa', 'zh_name' => '爪哇语', 'voice_id' => 'jv-ID-SitiNeural', 'flag_icon' => 'flag-id', 'supports_tts' => true],
        'ka' => ['name' => 'Georgian', 'native_name' => 'ქართული', 'zh_name' => '格鲁吉亚语', 'voice_id' => 'ka-GE-EkaNeural', 'flag_icon' => 'flag-ge', 'supports_tts' => true],
        'kk' => ['name' => 'Kazakh', 'native_name' => 'Қазақ', 'zh_name' => '哈萨克语', 'voice_id' => 'kk-KZ-AigulNeural', 'flag_icon' => 'flag-kz', 'supports_tts' => true],
        'km' => ['name' => 'Khmer', 'native_name' => 'ខ្មែរ', 'zh_name' => '高棉语', 'voice_id' => 'km-KH-SreymomNeural', 'flag_icon' => 'flag-kh', 'supports_tts' => true],
        'kn' => ['name' => 'Kannada', 'native_name' => 'ಕನ್ನಡ', 'zh_name' => '卡纳达语', 'voice_id' => 'kn-IN-SapnaNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'lt' => ['name' => 'Lithuanian', 'native_name' => 'Lietuvių', 'zh_name' => '立陶宛语', 'voice_id' => 'lt-LT-OnaNeural', 'flag_icon' => 'flag-lt', 'supports_tts' => true],
        'lv' => ['name' => 'Latvian', 'native_name' => 'Latviešu', 'zh_name' => '拉脱维亚语', 'voice_id' => 'lv-LV-EveritaNeural', 'flag_icon' => 'flag-lv', 'supports_tts' => true],
        'mk' => ['name' => 'Macedonian', 'native_name' => 'Македонски', 'zh_name' => '马其顿语', 'voice_id' => 'mk-MK-MarijaNeural', 'flag_icon' => 'flag-mk', 'supports_tts' => true],
        'ml' => ['name' => 'Malayalam', 'native_name' => 'മലയാളം', 'zh_name' => '马拉雅拉姆语', 'voice_id' => 'ml-IN-SobhanaNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'mn' => ['name' => 'Mongolian', 'native_name' => 'Монгол', 'zh_name' => '蒙古语', 'voice_id' => 'mn-MN-YesuiNeural', 'flag_icon' => 'flag-mn', 'supports_tts' => true],
        'mr' => ['name' => 'Marathi', 'native_name' => 'मराठी', 'zh_name' => '马拉地语', 'voice_id' => 'mr-IN-AarohiNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'ms' => ['name' => 'Malay', 'native_name' => 'Bahasa Melayu', 'zh_name' => '马来语', 'voice_id' => 'ms-MY-YasminNeural', 'flag_icon' => 'flag-my', 'supports_tts' => true],
        'mt' => ['name' => 'Maltese', 'native_name' => 'Malti', 'zh_name' => '马耳他语', 'voice_id' => 'mt-MT-GraceNeural', 'flag_icon' => 'flag-mt', 'supports_tts' => true],
        'my' => ['name' => 'Burmese', 'native_name' => 'မြန်မာ', 'zh_name' => '缅甸语', 'voice_id' => 'my-MM-NilarNeural', 'flag_icon' => 'flag-mm', 'supports_tts' => true],
        'nb' => ['name' => 'Norwegian', 'native_name' => 'Norsk', 'zh_name' => '挪威语', 'voice_id' => 'nb-NO-PernilleNeural', 'flag_icon' => 'flag-no', 'supports_tts' => true],
        'ne' => ['name' => 'Nepali', 'native_name' => 'नेपाली', 'zh_name' => '尼泊尔语', 'voice_id' => 'ne-NP-HemkalaNeural', 'flag_icon' => 'flag-np', 'supports_tts' => true],
        'nl' => ['name' => 'Dutch', 'native_name' => 'Nederlands', 'zh_name' => '荷兰语', 'voice_id' => 'nl-NL-ColetteNeural', 'flag_icon' => 'flag-nl', 'supports_tts' => true],
        'pa' => ['name' => 'Punjabi', 'native_name' => 'ਪੰਜਾਬੀ', 'zh_name' => '旁遮普语', 'voice_id' => 'pa-IN-GurvinderNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'pl' => ['name' => 'Polish', 'native_name' => 'Polski', 'zh_name' => '波兰语', 'voice_id' => 'pl-PL-ZofiaNeural', 'flag_icon' => 'flag-pl', 'supports_tts' => true],
        'ps' => ['name' => 'Pashto', 'native_name' => 'پښتو', 'zh_name' => '普什图语', 'voice_id' => 'ps-AF-LatifaNeural', 'flag_icon' => 'flag-af', 'supports_tts' => true],
        'pt' => ['name' => 'Portuguese', 'native_name' => 'Português', 'zh_name' => '葡萄牙语', 'voice_id' => 'pt-BR-FranciscaNeural', 'flag_icon' => 'flag-pt', 'supports_tts' => true],
        'ro' => ['name' => 'Romanian', 'native_name' => 'Română', 'zh_name' => '罗马尼亚语', 'voice_id' => 'ro-RO-AlinaNeural', 'flag_icon' => 'flag-ro', 'supports_tts' => true],
        'ru' => ['name' => 'Russian', 'native_name' => 'Русский', 'zh_name' => '俄语', 'voice_id' => 'ru-RU-SvetlanaNeural', 'flag_icon' => 'flag-ru', 'supports_tts' => true],
        'si' => ['name' => 'Sinhala', 'native_name' => 'සිංහල', 'zh_name' => '僧伽罗语', 'voice_id' => 'si-LK-ThiliniNeural', 'flag_icon' => 'flag-lk', 'supports_tts' => true],
        'sk' => ['name' => 'Slovak', 'native_name' => 'Slovenčina', 'zh_name' => '斯洛伐克语', 'voice_id' => 'sk-SK-ViktoriaNeural', 'flag_icon' => 'flag-sk', 'supports_tts' => true],
        'sl' => ['name' => 'Slovenian', 'native_name' => 'Slovenščina', 'zh_name' => '斯洛文尼亚语', 'voice_id' => 'sl-SI-PetraNeural', 'flag_icon' => 'flag-si', 'supports_tts' => true],
        'so' => ['name' => 'Somali', 'native_name' => 'Soomaali', 'zh_name' => '索马里语', 'voice_id' => 'so-SO-UbaxNeural', 'flag_icon' => 'flag-so', 'supports_tts' => true],
        'sq' => ['name' => 'Albanian', 'native_name' => 'Shqip', 'zh_name' => '阿尔巴尼亚语', 'voice_id' => 'sq-AL-AnilaNeural', 'flag_icon' => 'flag-al', 'supports_tts' => true],
        'sr' => ['name' => 'Serbian', 'native_name' => 'Српски', 'zh_name' => '塞尔维亚语', 'voice_id' => 'sr-RS-SophieNeural', 'flag_icon' => 'flag-rs', 'supports_tts' => true],
        'su' => ['name' => 'Sundanese', 'native_name' => 'Basa Sunda', 'zh_name' => '巽他语', 'voice_id' => 'su-ID-TutiNeural', 'flag_icon' => 'flag-id', 'supports_tts' => true],
        'sv' => ['name' => 'Swedish', 'native_name' => 'Svenska', 'zh_name' => '瑞典语', 'voice_id' => 'sv-SE-SofieNeural', 'flag_icon' => 'flag-se', 'supports_tts' => true],
        'sw' => ['name' => 'Swahili', 'native_name' => 'Kiswahili', 'zh_name' => '斯瓦希里语', 'voice_id' => 'sw-KE-ZuriNeural', 'flag_icon' => 'flag-ke', 'supports_tts' => true],
        'ta' => ['name' => 'Tamil', 'native_name' => 'தமிழ்', 'zh_name' => '泰米尔语', 'voice_id' => 'ta-IN-PallaviNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'te' => ['name' => 'Telugu', 'native_name' => 'తెలుగు', 'zh_name' => '泰卢固语', 'voice_id' => 'te-IN-ShrutiNeural', 'flag_icon' => 'flag-in', 'supports_tts' => true],
        'th' => ['name' => 'Thai', 'native_name' => 'ไทย', 'zh_name' => '泰语', 'voice_id' => 'th-TH-PremwadeeNeural', 'flag_icon' => 'flag-th', 'supports_tts' => true],
        'tr' => ['name' => 'Turkish', 'native_name' => 'Türkçe', 'zh_name' => '土耳其语', 'voice_id' => 'tr-TR-EmelNeural', 'flag_icon' => 'flag-tr', 'supports_tts' => true],
        'uk' => ['name' => 'Ukrainian', 'native_name' => 'Українська', 'zh_name' => '乌克兰语', 'voice_id' => 'uk-UA-PolinaNeural', 'flag_icon' => 'flag-ua', 'supports_tts' => true],
        'ur' => ['name' => 'Urdu', 'native_name' => 'اردو', 'zh_name' => '乌尔都语', 'voice_id' => 'ur-PK-UzmaNeural', 'flag_icon' => 'flag-pk', 'supports_tts' => true],
        'uz' => ['name' => 'Uzbek', 'native_name' => 'O\'zbek', 'zh_name' => '乌兹别克语', 'voice_id' => 'uz-UZ-MadinaNeural', 'flag_icon' => 'flag-uz', 'supports_tts' => true],
        'zu' => ['name' => 'Zulu', 'native_name' => 'isiZulu', 'zh_name' => '祖鲁语', 'voice_id' => 'zu-ZA-ThandoNeural', 'flag_icon' => 'flag-za', 'supports_tts' => true],
    ];

    /**
     * Get all language configurations
     */
    public static function getAll(): array
    {
        return self::ALL_LANGUAGES;
    }

    /**
     * Get languages that support study/learning features
     */
    public static function getStudyLanguages(): array
    {
        return array_filter(self::ALL_LANGUAGES, function ($lang) {
            return $lang['supports_study'] ?? false;
        });
    }

    /**
     * Get languages that support Edge-TTS text-to-speech
     */
    public static function getTTSLanguages(): array
    {
        return array_filter(self::ALL_LANGUAGES, function ($lang) {
            return $lang['supports_tts'] ?? false;
        });
    }

    /**
     * Get languages that have dictionary support
     */
    public static function getDictionaryLanguages(): array
    {
        return array_filter(self::ALL_LANGUAGES, function ($lang) {
            return $lang['supports_dictionary'] ?? false;
        });
    }

    /**
     * Get single language information by code
     */
    public static function getLanguageInfo(string $code): ?array
    {
        return self::ALL_LANGUAGES[$code] ?? null;
    }

    /**
     * Validate if language code is valid
     */
    public static function isValidLanguage(string $code): bool
    {
        return isset(self::ALL_LANGUAGES[$code]);
    }

    /**
     * Validate if language is a study language
     */
    public static function isValidStudyLanguage(string $code): bool
    {
        return isset(self::ALL_LANGUAGES[$code]) && (self::ALL_LANGUAGES[$code]['supports_study'] ?? false);
    }

    /**
     * Get language name (supports multiple locales)
     *
     * @param string $code Language code
     * @param string $locale Locale ('en', 'zh', 'native')
     * @return string|null Language name in requested locale
     */
    public static function getLanguageName(string $code, string $locale = 'en'): ?string
    {
        $info = self::getLanguageInfo($code);
        if (!$info) {
            return null;
        }

        return match ($locale) {
            'zh', 'zh-CN', 'zh_CN' => $info['zh_name'] ?? $info['name'],
            'native' => $info['native_name'] ?? $info['name'],
            default => $info['name'],
        };
    }

    /**
     * Get language emoji icon
     */
    public static function getLanguageIcon(string $code): string
    {
        return self::ALL_LANGUAGES[$code]['icon'] ?? '📚';
    }

    /**
     * Get language UI theme color
     */
    public static function getLanguageColor(string $code): string
    {
        return self::ALL_LANGUAGES[$code]['color'] ?? '#3B82F6';
    }

    /**
     * Get language voice ID for Edge-TTS
     */
    public static function getVoiceId(string $code): ?string
    {
        return self::ALL_LANGUAGES[$code]['voice_id'] ?? null;
    }

    /**
     * Get all Edge-TTS voice mappings (language code => voice_id)
     * This is the single source of truth for Edge-TTS VOICES constant
     * Used by EdgeTTSService and other TTS services
     * 
     * @return array Language code => voice_id mapping
     */
    public static function getTTSVoices(): array
    {
        $voices = [];
        $ttsLanguages = self::getTTSLanguages();
        
        foreach ($ttsLanguages as $code => $lang) {
            if (isset($lang['voice_id'])) {
                $voices[$code] = $lang['voice_id'];
            }
        }
        
        return $voices;
    }

    /**
     * Get Edge-TTS text types
     * Single source of truth for TEXT_TYPES constant
     * 
     * @return array Text types array
     */
    public static function getTTSTextTypes(): array
    {
        return ['sentence', 'word', 'letter'];
    }

    /**
     * Get language flag icon identifier
     */
    public static function getFlagIcon(string $code): ?string
    {
        return self::ALL_LANGUAGES[$code]['flag_icon'] ?? null;
    }

    /**
     * Language name to code mapping (for converting full names to codes)
     */
    private const LANGUAGE_NAME_MAP = [
        'english' => 'en',
        'chinese' => 'zh',
        'japanese' => 'ja',
        'korean' => 'ko',
        'french' => 'fr',
        'german' => 'de',
        'spanish' => 'es',
        'vietnamese' => 'vi',
        'lao' => 'lo',
    ];

    /**
     * Convert language full name to code
     */
    public static function nameToCode(string $name): ?string
    {
        $name = strtolower($name);
        return self::LANGUAGE_NAME_MAP[$name] ?? null;
    }

    /**
     * Normalize any stored language value to its ISO 639-1 code.
     *
     * Accepts both 2-letter codes ('en') and full English names ('english',
     * as stored on vocabulary_libraries.language) and returns the code form.
     * Unknown values are returned lowercased/trimmed as-is so that callers
     * comparing mixed or unexpected data never crash.
     */
    public static function normalizeToCode(string $language): string
    {
        $normalized = strtolower(trim($language));
        if ($normalized === '') {
            return $normalized;
        }

        if (isset(self::ALL_LANGUAGES[$normalized])) {
            return $normalized;
        }

        if (isset(self::LANGUAGE_NAME_MAP[$normalized])) {
            return self::LANGUAGE_NAME_MAP[$normalized];
        }

        foreach (self::ALL_LANGUAGES as $code => $info) {
            if (isset($info['name']) && strtolower($info['name']) === $normalized) {
                return $code;
            }
        }

        return $normalized;
    }

    /**
     * Compare two language values regardless of storage form.
     *
     * Symmetric: a group stored as 'en' matches a library stored as
     * 'english' and vice versa. Unknown values compare as plain
     * lowercased strings.
     */
    public static function languagesMatch(string $first, string $second): bool
    {
        return self::normalizeToCode($first) === self::normalizeToCode($second);
    }

    /**
     * Get list of study language codes
     */
    public static function getStudyLanguageCodes(): array
    {
        return array_keys(self::getStudyLanguages());
    }

    /**
     * Get default group name for a language
     */
    public static function getDefaultGroupName(string $language, string $locale = 'zh'): string
    {
        $name = self::getLanguageName($language, $locale);
        return $name ?? strtoupper($language);
    }
}
