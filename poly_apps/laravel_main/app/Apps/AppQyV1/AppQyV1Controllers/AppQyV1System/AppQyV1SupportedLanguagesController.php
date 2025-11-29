<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppQyV1SupportedLanguagesController extends Controller
{
    private static $languages = [
        'af' => ['name' => 'Afrikaans', 'native_name' => 'Afrikaans', 'voice_id' => 'af-ZA-AdriNeural'],
        'am' => ['name' => 'Amharic', 'native_name' => 'አማርኛ', 'voice_id' => 'am-ET-MekdesNeural'],
        'ar' => ['name' => 'Arabic', 'native_name' => 'العربية', 'voice_id' => 'ar-EG-SalmaNeural'],
        'as' => ['name' => 'Assamese', 'native_name' => 'অসমীয়া', 'voice_id' => 'as-IN-YashicaNeural'],
        'az' => ['name' => 'Azerbaijani', 'native_name' => 'Azərbaycan', 'voice_id' => 'az-AZ-BanuNeural'],
        'bg' => ['name' => 'Bulgarian', 'native_name' => 'Български', 'voice_id' => 'bg-BG-KalinaNeural'],
        'bn' => ['name' => 'Bengali', 'native_name' => 'বাংলা', 'voice_id' => 'bn-IN-TanishaaNeural'],
        'bs' => ['name' => 'Bosnian', 'native_name' => 'Bosanski', 'voice_id' => 'bs-BA-VesnaNeural'],
        'ca' => ['name' => 'Catalan', 'native_name' => 'Català', 'voice_id' => 'ca-ES-AlbaNeural'],
        'cs' => ['name' => 'Czech', 'native_name' => 'Čeština', 'voice_id' => 'cs-CZ-VlastaNeural'],
        'cy' => ['name' => 'Welsh', 'native_name' => 'Cymraeg', 'voice_id' => 'cy-GB-NiaNeural'],
        'da' => ['name' => 'Danish', 'native_name' => 'Dansk', 'voice_id' => 'da-DK-ChristelNeural'],
        'de' => ['name' => 'German', 'native_name' => 'Deutsch', 'voice_id' => 'de-DE-KatjaNeural'],
        'el' => ['name' => 'Greek', 'native_name' => 'Ελληνικά', 'voice_id' => 'el-GR-AthinaNeural'],
        'en' => ['name' => 'English', 'native_name' => 'English', 'voice_id' => 'en-US-JennyNeural'],
        'es' => ['name' => 'Spanish', 'native_name' => 'Español', 'voice_id' => 'es-ES-ElviraNeural'],
        'et' => ['name' => 'Estonian', 'native_name' => 'Eesti', 'voice_id' => 'et-EE-AnuNeural'],
        'eu' => ['name' => 'Basque', 'native_name' => 'Euskara', 'voice_id' => 'eu-ES-AinhoaNeural'],
        'fa' => ['name' => 'Persian', 'native_name' => 'فارسی', 'voice_id' => 'fa-IR-DilaraNeural'],
        'fi' => ['name' => 'Finnish', 'native_name' => 'Suomi', 'voice_id' => 'fi-FI-NooraNeural'],
        'fil' => ['name' => 'Filipino', 'native_name' => 'Filipino', 'voice_id' => 'fil-PH-BlessicaNeural'],
        'fr' => ['name' => 'French', 'native_name' => 'Français', 'voice_id' => 'fr-FR-DeniseNeural'],
        'ga' => ['name' => 'Irish', 'native_name' => 'Gaeilge', 'voice_id' => 'ga-IE-OrlaNeural'],
        'gl' => ['name' => 'Galician', 'native_name' => 'Galego', 'voice_id' => 'gl-ES-SabelaNeural'],
        'gu' => ['name' => 'Gujarati', 'native_name' => 'ગુજરાતી', 'voice_id' => 'gu-IN-DhwaniNeural'],
        'he' => ['name' => 'Hebrew', 'native_name' => 'עברית', 'voice_id' => 'he-IL-HilaNeural'],
        'hi' => ['name' => 'Hindi', 'native_name' => 'हिन्दी', 'voice_id' => 'hi-IN-SwaraNeural'],
        'hr' => ['name' => 'Croatian', 'native_name' => 'Hrvatski', 'voice_id' => 'hr-HR-GabrijelaNeural'],
        'hu' => ['name' => 'Hungarian', 'native_name' => 'Magyar', 'voice_id' => 'hu-HU-NoemiNeural'],
        'hy' => ['name' => 'Armenian', 'native_name' => 'Հայերեն', 'voice_id' => 'hy-AM-AnahitNeural'],
        'id' => ['name' => 'Indonesian', 'native_name' => 'Bahasa Indonesia', 'voice_id' => 'id-ID-GadisNeural'],
        'is' => ['name' => 'Icelandic', 'native_name' => 'Íslenska', 'voice_id' => 'is-IS-GudrunNeural'],
        'it' => ['name' => 'Italian', 'native_name' => 'Italiano', 'voice_id' => 'it-IT-ElsaNeural'],
        'ja' => ['name' => 'Japanese', 'native_name' => '日本語', 'voice_id' => 'ja-JP-NanamiNeural'],
        'jv' => ['name' => 'Javanese', 'native_name' => 'Basa Jawa', 'voice_id' => 'jv-ID-SitiNeural'],
        'ka' => ['name' => 'Georgian', 'native_name' => 'ქართული', 'voice_id' => 'ka-GE-EkaNeural'],
        'kk' => ['name' => 'Kazakh', 'native_name' => 'Қазақ', 'voice_id' => 'kk-KZ-AigulNeural'],
        'km' => ['name' => 'Khmer', 'native_name' => 'ខ្មែរ', 'voice_id' => 'km-KH-SreymomNeural'],
        'kn' => ['name' => 'Kannada', 'native_name' => 'ಕನ್ನಡ', 'voice_id' => 'kn-IN-SapnaNeural'],
        'ko' => ['name' => 'Korean', 'native_name' => '한국어', 'voice_id' => 'ko-KR-SunHiNeural'],
        'lo' => ['name' => 'Lao', 'native_name' => 'ລາວ', 'voice_id' => 'lo-LA-KeomanyNeural'],
        'lt' => ['name' => 'Lithuanian', 'native_name' => 'Lietuvių', 'voice_id' => 'lt-LT-OnaNeural'],
        'lv' => ['name' => 'Latvian', 'native_name' => 'Latviešu', 'voice_id' => 'lv-LV-EveritaNeural'],
        'mk' => ['name' => 'Macedonian', 'native_name' => 'Македонски', 'voice_id' => 'mk-MK-MarijaNeural'],
        'ml' => ['name' => 'Malayalam', 'native_name' => 'മലയാളം', 'voice_id' => 'ml-IN-SobhanaNeural'],
        'mn' => ['name' => 'Mongolian', 'native_name' => 'Монгол', 'voice_id' => 'mn-MN-YesuiNeural'],
        'mr' => ['name' => 'Marathi', 'native_name' => 'मराठी', 'voice_id' => 'mr-IN-AarohiNeural'],
        'ms' => ['name' => 'Malay', 'native_name' => 'Bahasa Melayu', 'voice_id' => 'ms-MY-YasminNeural'],
        'mt' => ['name' => 'Maltese', 'native_name' => 'Malti', 'voice_id' => 'mt-MT-GraceNeural'],
        'my' => ['name' => 'Myanmar', 'native_name' => 'မြန်မာ', 'voice_id' => 'my-MM-NilarNeural'],
        'nb' => ['name' => 'Norwegian Bokmål', 'native_name' => 'Norsk Bokmål', 'voice_id' => 'nb-NO-IselinNeural'],
        'ne' => ['name' => 'Nepali', 'native_name' => 'नेपाली', 'voice_id' => 'ne-NP-HemkalaNeural'],
        'nl' => ['name' => 'Dutch', 'native_name' => 'Nederlands', 'voice_id' => 'nl-NL-ColetteNeural'],
        'or' => ['name' => 'Odia', 'native_name' => 'ଓଡ଼ିଆ', 'voice_id' => 'or-IN-SubhasiniNeural'],
        'pa' => ['name' => 'Punjabi', 'native_name' => 'ਪੰਜਾਬੀ', 'voice_id' => 'pa-IN-VaaniNeural'],
        'pl' => ['name' => 'Polish', 'native_name' => 'Polski', 'voice_id' => 'pl-PL-ZofiaNeural'],
        'ps' => ['name' => 'Pashto', 'native_name' => 'پښتو', 'voice_id' => 'ps-AF-LatifaNeural'],
        'pt' => ['name' => 'Portuguese', 'native_name' => 'Português', 'voice_id' => 'pt-BR-FranciscaNeural'],
        'ro' => ['name' => 'Romanian', 'native_name' => 'Română', 'voice_id' => 'ro-RO-AlinaNeural'],
        'ru' => ['name' => 'Russian', 'native_name' => 'Русский', 'voice_id' => 'ru-RU-SvetlanaNeural'],
        'si' => ['name' => 'Sinhala', 'native_name' => 'සිංහල', 'voice_id' => 'si-LK-ThiliniNeural'],
        'sk' => ['name' => 'Slovak', 'native_name' => 'Slovenčina', 'voice_id' => 'sk-SK-ViktoriaNeural'],
        'sl' => ['name' => 'Slovenian', 'native_name' => 'Slovenščina', 'voice_id' => 'sl-SI-PetraNeural'],
        'so' => ['name' => 'Somali', 'native_name' => 'Soomaali', 'voice_id' => 'so-SO-UbaxNeural'],
        'sq' => ['name' => 'Albanian', 'native_name' => 'Shqip', 'voice_id' => 'sq-AL-AnilaNeural'],
        'sr' => ['name' => 'Serbian', 'native_name' => 'Српски', 'voice_id' => 'sr-RS-SophieNeural'],
        'su' => ['name' => 'Sundanese', 'native_name' => 'Basa Sunda', 'voice_id' => 'su-ID-TutiNeural'],
        'sv' => ['name' => 'Swedish', 'native_name' => 'Svenska', 'voice_id' => 'sv-SE-HilleviNeural'],
        'sw' => ['name' => 'Swahili', 'native_name' => 'Kiswahili', 'voice_id' => 'sw-TZ-RehemaNeural'],
        'ta' => ['name' => 'Tamil', 'native_name' => 'தமிழ்', 'voice_id' => 'ta-IN-PallaviNeural'],
        'te' => ['name' => 'Telugu', 'native_name' => 'తెలుగు', 'voice_id' => 'te-IN-ShrutiNeural'],
        'th' => ['name' => 'Thai', 'native_name' => 'ไทย', 'voice_id' => 'th-TH-PremwadeeNeural'],
        'tr' => ['name' => 'Turkish', 'native_name' => 'Türkçe', 'voice_id' => 'tr-TR-EmelNeural'],
        'uk' => ['name' => 'Ukrainian', 'native_name' => 'Українська', 'voice_id' => 'uk-UA-PolinaNeural'],
        'ur' => ['name' => 'Urdu', 'native_name' => 'اردو', 'voice_id' => 'ur-PK-UzmaNeural'],
        'uz' => ['name' => 'Uzbek', 'native_name' => 'Oʻzbek', 'voice_id' => 'uz-UZ-MadinaNeural'],
        'vi' => ['name' => 'Vietnamese', 'native_name' => 'Tiếng Việt', 'voice_id' => 'vi-VN-HoaiMyNeural'],
        'wuu' => ['name' => 'Wu Chinese', 'native_name' => '吴语', 'voice_id' => 'wuu-CN-XiaotongNeural'],
        'yue' => ['name' => 'Cantonese', 'native_name' => '粤语', 'voice_id' => 'yue-CN-XiaoMinNeural'],
        'zh' => ['name' => 'Chinese', 'native_name' => '中文', 'voice_id' => 'zh-CN-XiaoxiaoNeural'],
        'zu' => ['name' => 'Zulu', 'native_name' => 'isiZulu', 'voice_id' => 'zu-ZA-ThandoNeural'],
    ];

    public static function getSupportedLanguagesStatic(): array
    {
        return self::$languages;
    }

    public function getSupportedLanguages(Request $request): JsonResponse
    {
        $languages = [];
        
        foreach (self::$languages as $code => $info) {
            $languages[] = [
                'code' => $code,
                'name' => $info['name'],
                'native_name' => $info['native_name'],
                'voice_id' => $info['voice_id'],
                'has_tts' => true,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $languages,
            'total' => count($languages),
        ]);
    }

    public function getLanguageByCode(Request $request, string $code): JsonResponse
    {
        if (!isset(self::$languages[$code])) {
            return response()->json([
                'success' => false,
                'error' => 'Language not found',
            ], 404);
        }

        $info = self::$languages[$code];
        
        return response()->json([
            'success' => true,
            'data' => [
                'code' => $code,
                'name' => $info['name'],
                'native_name' => $info['native_name'],
                'voice_id' => $info['voice_id'],
                'has_tts' => true,
            ],
        ]);
    }
}

