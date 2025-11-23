<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use App\Services\OpenRouterClient;
use App\Services\DeepSeekClient;
use App\Services\GeminiClient;
use Illuminate\Support\Facades\Log;

class AppQyV1TranslationService
{
    private $openrouterClient;
    private $deepseekClient;
    private $geminiClient;
    
    const TRANSLATION_PROMPTS = [
        'general' => <<<'XML'
<task>Translate the following text to {target_language}. Provide only the translation without any explanations.</task>
<text>{text}</text>
XML,
        
        'professional' => <<<'XML'
<task>Translate the following text to {target_language} in a professional and formal tone. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'casual' => <<<'XML'
<task>Translate the following text to {target_language} in a casual and friendly tone. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'technical' => <<<'XML'
<task>Translate the following technical documentation to {target_language}. Preserve all technical terms, code snippets, and formatting. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'literary' => <<<'XML'
<task>Translate the following text to {target_language} while preserving the literary style, tone, and emotional nuances. Provide only the translation.</task>
<text>{text}</text>
XML,
    ];
    
    const LANGUAGES = [
        'af' => 'Afrikaans', 'am' => 'Amharic', 'ar' => 'Arabic', 'as' => 'Assamese',
        'az' => 'Azerbaijani', 'bg' => 'Bulgarian', 'bn' => 'Bengali', 'bs' => 'Bosnian',
        'ca' => 'Catalan', 'cs' => 'Czech', 'cy' => 'Welsh', 'da' => 'Danish',
        'de' => 'German', 'el' => 'Greek', 'en' => 'English', 'es' => 'Spanish',
        'et' => 'Estonian', 'eu' => 'Basque', 'fa' => 'Persian', 'fi' => 'Finnish',
        'fil' => 'Filipino', 'fr' => 'French', 'ga' => 'Irish', 'gl' => 'Galician',
        'gu' => 'Gujarati', 'he' => 'Hebrew', 'hi' => 'Hindi', 'hr' => 'Croatian',
        'hu' => 'Hungarian', 'hy' => 'Armenian', 'id' => 'Indonesian', 'is' => 'Icelandic',
        'it' => 'Italian', 'ja' => 'Japanese', 'jv' => 'Javanese', 'ka' => 'Georgian',
        'kk' => 'Kazakh', 'km' => 'Khmer', 'kn' => 'Kannada', 'ko' => 'Korean',
        'lo' => 'Lao', 'lt' => 'Lithuanian', 'lv' => 'Latvian', 'mk' => 'Macedonian',
        'ml' => 'Malayalam', 'mn' => 'Mongolian', 'mr' => 'Marathi', 'ms' => 'Malay',
        'mt' => 'Maltese', 'my' => 'Myanmar', 'nb' => 'Norwegian', 'ne' => 'Nepali',
        'nl' => 'Dutch', 'or' => 'Odia', 'pa' => 'Punjabi', 'pl' => 'Polish',
        'ps' => 'Pashto', 'pt' => 'Portuguese', 'ro' => 'Romanian', 'ru' => 'Russian',
        'si' => 'Sinhala', 'sk' => 'Slovak', 'sl' => 'Slovenian', 'so' => 'Somali',
        'sq' => 'Albanian', 'sr' => 'Serbian', 'su' => 'Sundanese', 'sv' => 'Swedish',
        'sw' => 'Swahili', 'ta' => 'Tamil', 'te' => 'Telugu', 'th' => 'Thai',
        'tr' => 'Turkish', 'uk' => 'Ukrainian', 'ur' => 'Urdu', 'uz' => 'Uzbek',
        'vi' => 'Vietnamese', 'wuu' => 'Wu Chinese', 'yue' => 'Cantonese', 'zh' => 'Chinese',
        'zu' => 'Zulu'
    ];
    
    public function __construct()
    {
        $this->openrouterClient = new OpenRouterClient();
        $this->deepseekClient = new DeepSeekClient();
        $this->geminiClient = new GeminiClient();
    }
    
    public function translate(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        string $provider = 'openrouter',
        bool $useCache = true
    ): array {
        $langCode = strtolower($targetLanguage);
        
        if (!isset(self::LANGUAGES[$langCode])) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $targetLanguage,
            ];
        }
        
        if ($useCache) {
            $cached = $this->getCachedTranslation($text, $langCode, $type, $provider, $model);
            if ($cached) {
                return $cached;
            }
        }
        
        $prompt = $this->buildPrompt($text, self::LANGUAGES[$langCode], $type);
        
        try {
            $response = $this->callAIProvider($provider, $model, $prompt);
            
            $result = [
                'success' => true,
                'translation' => trim($response),
                'source_text' => $text,
                'target_language' => $langCode,
                'type' => $type,
                'provider' => $provider,
                'model' => $model,
                'cached' => false,
            ];
            
            $this->cacheTranslation($text, $langCode, $type, $provider, $model, $result);
            
            return $result;
            
        } catch (\Exception $e) {
            Log::error('[AppQyV1Translation] Error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    
    private function buildPrompt(string $text, string $targetLanguage, string $type): string
    {
        $template = self::TRANSLATION_PROMPTS[$type] ?? self::TRANSLATION_PROMPTS['general'];
        
        return str_replace(
            ['{text}', '{target_language}'],
            [$text, $targetLanguage],
            $template
        );
    }
    
    private function callAIProvider(string $provider, ?string $model, string $prompt): string
    {
        switch ($provider) {
            case 'deepseek':
                return $this->deepseekClient->chat($prompt, $model);
            case 'gemini':
                return $this->geminiClient->chat($prompt, $model);
            case 'openrouter':
            default:
                return $this->openrouterClient->chat($prompt, $model);
        }
    }
    
    private function getCachedTranslation(
        string $text,
        string $langCode,
        string $type,
        string $provider,
        ?string $model
    ): ?array {
        $md5 = md5($text);
        
        $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $md5);
        
        if (!$entry || !$entry->translations) {
            return null;
        }
        
        $cacheKey = "{$type}:{$provider}:" . ($model ?? 'default');
        
        if (isset($entry->translations[$cacheKey])) {
            $cached = $entry->translations[$cacheKey];
            
            $entry->incrementQueryCount();
            
            return [
                'success' => true,
                'translation' => $cached['text'],
                'source_text' => $text,
                'target_language' => $langCode,
                'type' => $type,
                'provider' => $provider,
                'model' => $model,
                'cached' => true,
                'cached_at' => $cached['updated_at'] ?? null,
            ];
        }
        
        return null;
    }
    
    private function cacheTranslation(
        string $text,
        string $langCode,
        string $type,
        string $provider,
        ?string $model,
        array $result
    ): void {
        $md5 = md5($text);
        $cacheKey = "{$type}:{$provider}:" . ($model ?? 'default');
        
        $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $md5);
        
        $translations = $entry ? ($entry->translations ?? []) : [];
        $translations[$cacheKey] = [
            'text' => $result['translation'],
            'updated_at' => now()->toDateTimeString(),
        ];
        
        AppQyV1MultiLangDictionaryModel::createOrUpdate($langCode, [
            'content' => $text,
            'md5' => $md5,
            'translations' => $translations,
            'has_translation' => true,
            'translation_provider' => $provider . ':' . ($model ?? 'default'),
        ]);
    }
    
    public function getAvailableLanguages(): array
    {
        return self::LANGUAGES;
    }
    
    public function getAvailableTypes(): array
    {
        return array_keys(self::TRANSLATION_PROMPTS);
    }
}
