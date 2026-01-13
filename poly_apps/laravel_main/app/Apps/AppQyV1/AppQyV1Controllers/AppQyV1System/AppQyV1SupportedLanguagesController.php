<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use App\Traits\ApiResponse;

/**
 * 支持的语言列表控制器
 * 重构: 使用 AppQyV1LanguageConfigService 统一语言配置
 * 添加缓存: 24小时缓存语言列表
 *
 * ========================================
 * Edge-TTS 语言支持说明
 * ========================================
 *
 * 本控制器返回的语言列表基于 Microsoft Edge-TTS 服务。
 * Edge-TTS 是 Microsoft Azure 认知服务的一部分，提供高质量的神经网络语音合成。
 *
 * 数据来源: AppQyV1LanguageConfigService (统一配置服务)
 * Edge-TTS 仓库: https://github.com/rany2/edge-tts
 * 官方文档: https://docs.microsoft.com/azure/cognitive-services/speech-service/language-support
 *
 * 语音标识符格式: {locale}-{region}-{voiceName}Neural
 * 示例: 'zh-CN-XiaoxiaoNeural' (中文-中国-晓晓神经语音)
 *
 * 虽然语言列表是硬编码的，但严格遵循 Edge-TTS 官方规范。
 * 如需更新语言列表，请确保与 Edge-TTS 最新版本同步。
 */
class AppQyV1SupportedLanguagesController extends Controller
{
    use ApiResponse;

    /**
     * DEPRECATED: 旧的语言配置数组
     * 保留用于向后兼容，但应使用 AppQyV1LanguageConfigService
     *
     * 注意: 此数组中的 voice_id 与 Edge-TTS 官方保持一致
     * 请勿随意修改 voice_id，否则会导致 TTS 服务调用失败
     */
    private static $languages_DEPRECATED = [
        'af' => ['name' => 'Afrikaans', 'native_name' => 'Afrikaans', 'voice_id' => 'af-ZA-AdriNeural', 'icon' => 'flag-za'],
        'am' => ['name' => 'Amharic', 'native_name' => 'አማርኛ', 'voice_id' => 'am-ET-MekdesNeural', 'icon' => 'flag-et'],
        'ar' => ['name' => 'Arabic', 'native_name' => 'العربية', 'voice_id' => 'ar-EG-SalmaNeural', 'icon' => 'flag-sa'],
        'as' => ['name' => 'Assamese', 'native_name' => 'অসমীয়া', 'voice_id' => 'as-IN-YashicaNeural', 'icon' => 'flag-in'],
        'az' => ['name' => 'Azerbaijani', 'native_name' => 'Azərbaycan', 'voice_id' => 'az-AZ-BanuNeural', 'icon' => 'flag-az'],
        'bg' => ['name' => 'Bulgarian', 'native_name' => 'Български', 'voice_id' => 'bg-BG-KalinaNeural', 'icon' => 'flag-bg'],
        'bn' => ['name' => 'Bengali', 'native_name' => 'বাংলা', 'voice_id' => 'bn-IN-TanishaaNeural', 'icon' => 'flag-bd'],
        'bs' => ['name' => 'Bosnian', 'native_name' => 'Bosanski', 'voice_id' => 'bs-BA-VesnaNeural', 'icon' => 'flag-ba'],
        'ca' => ['name' => 'Catalan', 'native_name' => 'Català', 'voice_id' => 'ca-ES-AlbaNeural', 'icon' => 'flag-es'],
        'cs' => ['name' => 'Czech', 'native_name' => 'Čeština', 'voice_id' => 'cs-CZ-VlastaNeural', 'icon' => 'flag-cz'],
        'cy' => ['name' => 'Welsh', 'native_name' => 'Cymraeg', 'voice_id' => 'cy-GB-NiaNeural', 'icon' => 'flag-gb'],
        'da' => ['name' => 'Danish', 'native_name' => 'Dansk', 'voice_id' => 'da-DK-ChristelNeural', 'icon' => 'flag-dk'],
        'de' => ['name' => 'German', 'native_name' => 'Deutsch', 'voice_id' => 'de-DE-KatjaNeural', 'icon' => 'flag-de'],
        'el' => ['name' => 'Greek', 'native_name' => 'Ελληνικά', 'voice_id' => 'el-GR-AthinaNeural', 'icon' => 'flag-gr'],
        'en' => ['name' => 'English', 'native_name' => 'English', 'voice_id' => 'en-US-JennyNeural', 'icon' => 'flag-us'],
        'es' => ['name' => 'Spanish', 'native_name' => 'Español', 'voice_id' => 'es-ES-ElviraNeural', 'icon' => 'flag-es'],
        'et' => ['name' => 'Estonian', 'native_name' => 'Eesti', 'voice_id' => 'et-EE-AnuNeural', 'icon' => 'flag-ee'],
        'eu' => ['name' => 'Basque', 'native_name' => 'Euskara', 'voice_id' => 'eu-ES-AinhoaNeural', 'icon' => 'flag-es'],
        'fa' => ['name' => 'Persian', 'native_name' => 'فارسی', 'voice_id' => 'fa-IR-DilaraNeural', 'icon' => 'flag-ir'],
        'fi' => ['name' => 'Finnish', 'native_name' => 'Suomi', 'voice_id' => 'fi-FI-NooraNeural', 'icon' => 'flag-fi'],
        'fil' => ['name' => 'Filipino', 'native_name' => 'Filipino', 'voice_id' => 'fil-PH-BlessicaNeural', 'icon' => 'flag-ph'],
        'fr' => ['name' => 'French', 'native_name' => 'Français', 'voice_id' => 'fr-FR-DeniseNeural', 'icon' => 'flag-fr'],
        'ga' => ['name' => 'Irish', 'native_name' => 'Gaeilge', 'voice_id' => 'ga-IE-OrlaNeural', 'icon' => 'flag-ie'],
        'gl' => ['name' => 'Galician', 'native_name' => 'Galego', 'voice_id' => 'gl-ES-SabelaNeural', 'icon' => 'flag-es'],
        'gu' => ['name' => 'Gujarati', 'native_name' => 'ગુજરાતી', 'voice_id' => 'gu-IN-DhwaniNeural', 'icon' => 'flag-in'],
        'he' => ['name' => 'Hebrew', 'native_name' => 'עברית', 'voice_id' => 'he-IL-HilaNeural', 'icon' => 'flag-il'],
        'hi' => ['name' => 'Hindi', 'native_name' => 'हिन्दी', 'voice_id' => 'hi-IN-SwaraNeural', 'icon' => 'flag-in'],
        'hr' => ['name' => 'Croatian', 'native_name' => 'Hrvatski', 'voice_id' => 'hr-HR-GabrijelaNeural', 'icon' => 'flag-hr'],
        'hu' => ['name' => 'Hungarian', 'native_name' => 'Magyar', 'voice_id' => 'hu-HU-NoemiNeural', 'icon' => 'flag-hu'],
        'hy' => ['name' => 'Armenian', 'native_name' => 'Հայերեն', 'voice_id' => 'hy-AM-AnahitNeural', 'icon' => 'flag-am'],
        'id' => ['name' => 'Indonesian', 'native_name' => 'Bahasa Indonesia', 'voice_id' => 'id-ID-GadisNeural', 'icon' => 'flag-id'],
        'is' => ['name' => 'Icelandic', 'native_name' => 'Íslenska', 'voice_id' => 'is-IS-GudrunNeural', 'icon' => 'flag-is'],
        'it' => ['name' => 'Italian', 'native_name' => 'Italiano', 'voice_id' => 'it-IT-ElsaNeural', 'icon' => 'flag-it'],
        'ja' => ['name' => 'Japanese', 'native_name' => '日本語', 'voice_id' => 'ja-JP-NanamiNeural', 'icon' => 'flag-jp'],
        'jv' => ['name' => 'Javanese', 'native_name' => 'Basa Jawa', 'voice_id' => 'jv-ID-SitiNeural', 'icon' => 'flag-id'],
        'ka' => ['name' => 'Georgian', 'native_name' => 'ქართული', 'voice_id' => 'ka-GE-EkaNeural', 'icon' => 'flag-ge'],
        'kk' => ['name' => 'Kazakh', 'native_name' => 'Қазақ', 'voice_id' => 'kk-KZ-AigulNeural', 'icon' => 'flag-kz'],
        'km' => ['name' => 'Khmer', 'native_name' => 'ខ្មែរ', 'voice_id' => 'km-KH-SreymomNeural', 'icon' => 'flag-kh'],
        'kn' => ['name' => 'Kannada', 'native_name' => 'ಕನ್ನಡ', 'voice_id' => 'kn-IN-SapnaNeural', 'icon' => 'flag-in'],
        'ko' => ['name' => 'Korean', 'native_name' => '한국어', 'voice_id' => 'ko-KR-SunHiNeural', 'icon' => 'flag-kr'],
        'lo' => ['name' => 'Lao', 'native_name' => 'ລາວ', 'voice_id' => 'lo-LA-KeomanyNeural', 'icon' => 'flag-la'],
        'lt' => ['name' => 'Lithuanian', 'native_name' => 'Lietuvių', 'voice_id' => 'lt-LT-OnaNeural', 'icon' => 'flag-lt'],
        'lv' => ['name' => 'Latvian', 'native_name' => 'Latviešu', 'voice_id' => 'lv-LV-EveritaNeural', 'icon' => 'flag-lv'],
        'mk' => ['name' => 'Macedonian', 'native_name' => 'Македонски', 'voice_id' => 'mk-MK-MarijaNeural', 'icon' => 'flag-mk'],
        'ml' => ['name' => 'Malayalam', 'native_name' => 'മലയാളം', 'voice_id' => 'ml-IN-SobhanaNeural', 'icon' => 'flag-in'],
        'mn' => ['name' => 'Mongolian', 'native_name' => 'Монгол', 'voice_id' => 'mn-MN-YesuiNeural', 'icon' => 'flag-mn'],
        'mr' => ['name' => 'Marathi', 'native_name' => 'मराठी', 'voice_id' => 'mr-IN-AarohiNeural', 'icon' => 'flag-in'],
        'ms' => ['name' => 'Malay', 'native_name' => 'Bahasa Melayu', 'voice_id' => 'ms-MY-YasminNeural', 'icon' => 'flag-my'],
        'mt' => ['name' => 'Maltese', 'native_name' => 'Malti', 'voice_id' => 'mt-MT-GraceNeural', 'icon' => 'flag-mt'],
        'my' => ['name' => 'Myanmar', 'native_name' => 'မြန်မာ', 'voice_id' => 'my-MM-NilarNeural', 'icon' => 'flag-mm'],
        'nb' => ['name' => 'Norwegian Bokmål', 'native_name' => 'Norsk Bokmål', 'voice_id' => 'nb-NO-IselinNeural', 'icon' => 'flag-no'],
        'ne' => ['name' => 'Nepali', 'native_name' => 'नेपाली', 'voice_id' => 'ne-NP-HemkalaNeural', 'icon' => 'flag-np'],
        'nl' => ['name' => 'Dutch', 'native_name' => 'Nederlands', 'voice_id' => 'nl-NL-ColetteNeural', 'icon' => 'flag-nl'],
        'or' => ['name' => 'Odia', 'native_name' => 'ଓଡ଼ିଆ', 'voice_id' => 'or-IN-SubhasiniNeural', 'icon' => 'flag-in'],
        'pa' => ['name' => 'Punjabi', 'native_name' => 'ਪੰਜਾਬੀ', 'voice_id' => 'pa-IN-VaaniNeural', 'icon' => 'flag-in'],
        'pl' => ['name' => 'Polish', 'native_name' => 'Polski', 'voice_id' => 'pl-PL-ZofiaNeural', 'icon' => 'flag-pl'],
        'ps' => ['name' => 'Pashto', 'native_name' => 'پښتو', 'voice_id' => 'ps-AF-LatifaNeural', 'icon' => 'flag-af'],
        'pt' => ['name' => 'Portuguese', 'native_name' => 'Português', 'voice_id' => 'pt-BR-FranciscaNeural', 'icon' => 'flag-pt'],
        'ro' => ['name' => 'Romanian', 'native_name' => 'Română', 'voice_id' => 'ro-RO-AlinaNeural', 'icon' => 'flag-ro'],
        'ru' => ['name' => 'Russian', 'native_name' => 'Русский', 'voice_id' => 'ru-RU-SvetlanaNeural', 'icon' => 'flag-ru'],
        'si' => ['name' => 'Sinhala', 'native_name' => 'සිංහල', 'voice_id' => 'si-LK-ThiliniNeural', 'icon' => 'flag-lk'],
        'sk' => ['name' => 'Slovak', 'native_name' => 'Slovenčina', 'voice_id' => 'sk-SK-ViktoriaNeural', 'icon' => 'flag-sk'],
        'sl' => ['name' => 'Slovenian', 'native_name' => 'Slovenščina', 'voice_id' => 'sl-SI-PetraNeural', 'icon' => 'flag-si'],
        'so' => ['name' => 'Somali', 'native_name' => 'Soomaali', 'voice_id' => 'so-SO-UbaxNeural', 'icon' => 'flag-so'],
        'sq' => ['name' => 'Albanian', 'native_name' => 'Shqip', 'voice_id' => 'sq-AL-AnilaNeural', 'icon' => 'flag-al'],
        'sr' => ['name' => 'Serbian', 'native_name' => 'Српски', 'voice_id' => 'sr-RS-SophieNeural', 'icon' => 'flag-rs'],
        'su' => ['name' => 'Sundanese', 'native_name' => 'Basa Sunda', 'voice_id' => 'su-ID-TutiNeural', 'icon' => 'flag-id'],
        'sv' => ['name' => 'Swedish', 'native_name' => 'Svenska', 'voice_id' => 'sv-SE-HilleviNeural', 'icon' => 'flag-se'],
        'sw' => ['name' => 'Swahili', 'native_name' => 'Kiswahili', 'voice_id' => 'sw-TZ-RehemaNeural', 'icon' => 'flag-tz'],
        'ta' => ['name' => 'Tamil', 'native_name' => 'தமிழ்', 'voice_id' => 'ta-IN-PallaviNeural', 'icon' => 'flag-in'],
        'te' => ['name' => 'Telugu', 'native_name' => 'తెలుగు', 'voice_id' => 'te-IN-ShrutiNeural', 'icon' => 'flag-in'],
        'th' => ['name' => 'Thai', 'native_name' => 'ไทย', 'voice_id' => 'th-TH-PremwadeeNeural', 'icon' => 'flag-th'],
        'tr' => ['name' => 'Turkish', 'native_name' => 'Türkçe', 'voice_id' => 'tr-TR-EmelNeural', 'icon' => 'flag-tr'],
        'uk' => ['name' => 'Ukrainian', 'native_name' => 'Українська', 'voice_id' => 'uk-UA-PolinaNeural', 'icon' => 'flag-ua'],
        'ur' => ['name' => 'Urdu', 'native_name' => 'اردو', 'voice_id' => 'ur-PK-UzmaNeural', 'icon' => 'flag-pk'],
        'uz' => ['name' => 'Uzbek', 'native_name' => 'Oʻzbek', 'voice_id' => 'uz-UZ-MadinaNeural', 'icon' => 'flag-uz'],
        'vi' => ['name' => 'Vietnamese', 'native_name' => 'Tiếng Việt', 'voice_id' => 'vi-VN-HoaiMyNeural', 'icon' => 'flag-vn'],
        'wuu' => ['name' => 'Wu Chinese', 'native_name' => '吴语', 'voice_id' => 'wuu-CN-XiaotongNeural', 'icon' => 'flag-cn'],
        'yue' => ['name' => 'Cantonese', 'native_name' => '粤语', 'voice_id' => 'yue-CN-XiaoMinNeural', 'icon' => 'flag-cn'],
        'zh' => ['name' => 'Chinese', 'native_name' => '中文', 'voice_id' => 'zh-CN-XiaoxiaoNeural', 'icon' => 'flag-cn'],
        'zu' => ['name' => 'Zulu', 'native_name' => 'isiZulu', 'voice_id' => 'zu-ZA-ThandoNeural', 'icon' => 'flag-za'],
    ];

    /**
     * 获取所有支持的语言 (静态方法)
     * 使用新的 AppQyV1LanguageConfigService
     */
    public static function getSupportedLanguagesStatic(): array
    {
        return AppQyV1LanguageConfigService::getTTSLanguages();
    }

    /**
     * 获取所有支持的语言列表 (API端点)
     * 添加24小时缓存
     */
    public function getSupportedLanguages(Request $request): JsonResponse
    {
        $languages = Cache::remember('appqyv1_supported_languages', now()->addHours(24), function () {
            $allLanguages = AppQyV1LanguageConfigService::getTTSLanguages();
            $result = [];

            foreach ($allLanguages as $code => $info) {
                $result[] = [
                    'code' => $code,
                    'name' => $info['name'] ?? '',
                    'native_name' => $info['native_name'] ?? '',
                    'voice_id' => $info['voice_id'] ?? '',
                    'icon' => $info['flag_icon'] ?? '',
                    'has_tts' => true,
                ];
            }

            return $result;
        });

        // Return array directly - unified format for frontend data centers
        // Frontend expects: {success: true, data: SupportedLanguage[]}
        return $this->success($languages, 'Supported languages retrieved successfully');
    }

    /**
     * 根据语言代码获取单个语言信息
     * 使用 AppQyV1LanguageConfigService
     */
    public function getLanguageByCode(Request $request, string $code): JsonResponse
    {
        $info = AppQyV1LanguageConfigService::getLanguageInfo($code);

        if (!$info) {
            return $this->notFound('Language not found');
        }

        return $this->success([
            'code' => $code,
            'name' => $info['name'] ?? '',
            'native_name' => $info['native_name'] ?? '',
            'voice_id' => $info['voice_id'] ?? '',
            'icon' => $info['flag_icon'] ?? '',
            'has_tts' => $info['supports_tts'] ?? false,
        ], 'Language information retrieved successfully');
    }
}

