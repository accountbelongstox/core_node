<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\TranslationService;

/**
 * Thin AppQyV1 facade over the canonical main-layer TranslationService.
 *
 * All provider invocation, prompt building, fallback-chain walking and
 * provider probing live in App\Services\TranslationService. What remains here
 * is AppQyV1-specific glue: the per-language dictionary-table translation
 * cache (AppQyV1LangDictionaryModel) and the app language map that the
 * dictionary services resolve language names/codes against.
 */
class AppQyV1TranslationService
{
    private TranslationService $translationService;

    // App language map. Kept app-side (NOT aliased to the main-layer map)
    // because AppQyV1DictionaryService::getLanguageCode reverse-resolves full
    // names through it and the names differ ('my' => 'Myanmar', 'zh' =>
    // 'Chinese' here vs 'Burmese' / 'Chinese (Mandarin)' in the main map).
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
        $this->translationService = new TranslationService();
    }

    public function translateWithModel(
        string $text,
        string $targetLanguage,
        ?string $model = null,
        string $provider = 'openrouter',
        array $options = []
    ): array {
        $type = $options['type'] ?? 'general';
        $useCache = $options['use_cache'] ?? true;

        return $this->translate($text, $targetLanguage, $type, $model, $provider, $useCache);
    }

    /**
     * Translate a single text through one provider, backed by the
     * dictionary-table cache (AppQyV1 glue). Provider invocation itself is
     * delegated to the main-layer TranslationService.
     */
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

        $result = $this->translationService->translateViaProvider($text, $langCode, $type, $model, $provider, $useCache);

        if (($result['success'] ?? false) === true) {
            $result['cached'] = false;
            $this->cacheTranslation($text, $langCode, $type, $provider, $model, $result);
        }

        return $result;
    }

    /**
     * Translate with graceful multi-provider fallback.
     *
     * The chain walk and provider invocation live in the main-layer
     * TranslationService::translateWithFallback; this facade only adds the
     * dictionary cache: a pre-scan over the chain (first provider with a
     * cached entry wins, mirroring the old per-provider lookup) and storing
     * the winning provider's result.
     *
     * @param array<int,string>|null $chain Optional explicit provider order.
     */
    public function translateWithFallback(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?array $chain = null,
        bool $useCache = true
    ): array {
        $langCode = strtolower($targetLanguage);

        if (!isset(self::LANGUAGES[$langCode])) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $targetLanguage,
            ];
        }

        $chain = $chain ?? (array) config('AppQyV1.ai.fallback_chain', ['openrouter', 'gemini', 'deepseek', 'google']);
        $modelOverrides = (array) config('AppQyV1.ai.models', []);

        if ($useCache) {
            foreach ($chain as $provider) {
                $provider = trim((string) $provider);
                if ($provider === '') {
                    continue;
                }

                $cached = $this->getCachedTranslation(
                    $text,
                    $langCode,
                    $type,
                    $provider,
                    $modelOverrides[$provider] ?? null
                );
                if ($cached) {
                    return $cached;
                }
            }
        }

        $result = $this->translationService->translateWithFallback($text, $langCode, $type, $chain, $modelOverrides);

        if (($result['success'] ?? false) === true) {
            $result['cached'] = false;
            $this->cacheTranslation(
                $text,
                $langCode,
                $type,
                $result['provider'] ?? 'unknown',
                $result['model'] ?? null,
                $result
            );
        }

        return $result;
    }

    /**
     * Probe every direct AI provider (pycore ai_probe contract). Pure
     * delegation to the main-layer service.
     */
    public function probeProviders(): array
    {
        return $this->translationService->probeProviders();
    }

    /**
     * Live one-shot chat against a single provider/model (dashboard "test"
     * panel). Pure delegation to the main-layer service.
     */
    public function chatOnce(string $provider, ?string $model, string $prompt): array
    {
        return $this->translationService->chatOnce($provider, $model, $prompt);
    }

    public function getAvailableLanguages(): array
    {
        return self::LANGUAGES;
    }

    public function getAvailableTypes(): array
    {
        return $this->translationService->getAvailableTypes();
    }

    public function getLanguageTemplates(): array
    {
        return $this->translationService->getLanguageTemplates();
    }

    private function getCachedTranslation(
        string $text,
        string $langCode,
        string $type,
        string $provider,
        ?string $model
    ): ?array {
        $md5 = md5($text);

        $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);

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
        $cacheKey = "{$type}:{$provider}:" . ($model ?? 'default');

        $cacheValue = [
            'text' => $result['translation'],
            'updated_at' => now()->toDateTimeString(),
        ];

        AppQyV1LangDictionaryModel::storeTranslationCache(
            $langCode,
            $text,
            $cacheKey,
            $cacheValue,
            $provider . ':' . ($model ?? 'default')
        );
    }
}
