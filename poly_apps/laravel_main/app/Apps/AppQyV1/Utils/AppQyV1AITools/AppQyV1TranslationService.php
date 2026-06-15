<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use App\Services\OpenRouterClient;
use App\Services\DeepSeekClient;
use App\Services\GeminiClient;
use App\Services\Translation\TranslationConstants;
use App\CallPycoreUtils\PycoreTranslatorUtil;
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
    
    const LANGUAGE_PROMPT_TEMPLATES = [
        'en' => ['translation' => 'English Translation: {translation}', 'words' => 'English Words: {word} [{phonetic}]'],
        'lo' => ['translation' => 'ການແປພາສາລາວ: {ການແປ}', 'words' => 'ຄຳສັບລາວ: {ຄຳ} [{ການອອກສຽງ}]'],
        'ja' => ['translation' => '日本語訳：{翻訳}', 'words' => '日本語単語：{単語} [{読み方}]'],
        'vi' => ['translation' => 'Bản dịch tiếng Việt: {bản dịch}', 'words' => 'Từ vựng tiếng Việt: {từ} [{phiên âm}]'],
        'zh' => ['translation' => '中文翻译：{翻译内容}', 'words' => '中文词汇：{词语} [{拼音}]'],
        'ko' => ['translation' => '한국어 번역: {번역}', 'words' => '한국어 단어: {단어} [{발음}]'],
        'th' => ['translation' => 'การแปลภาษาไทย: {คำแปล}', 'words' => 'คำศัพท์ไทย: {คำ} [{การออกเสียง}]'],
        'es' => ['translation' => 'Traducción al español: {traducción}', 'words' => 'Palabras en español: {palabra} [{fonética}]'],
        'fr' => ['translation' => 'Traduction française: {traduction}', 'words' => 'Mots français: {mot} [{phonétique}]'],
        'de' => ['translation' => 'Deutsche Übersetzung: {Übersetzung}', 'words' => 'Deutsche Wörter: {Wort} [{Aussprache}]'],
        'ru' => ['translation' => 'Русский перевод: {перевод}', 'words' => 'Русские слова: {слово} [{произношение}]'],
    ];
    
    public function getLanguageTemplates(): array
    {
        $templates = [];
        
        foreach (self::LANGUAGE_PROMPT_TEMPLATES as $langCode => $template) {
            $templates[$langCode] = [
                'name' => self::LANGUAGES[$langCode] ?? $langCode,
                'translation' => $template['translation'],
                'words' => $template['words'],
            ];
        }
        
        return $templates;
    }
    
    public function __construct()
    {
        $this->openrouterClient = new OpenRouterClient();
        $this->deepseekClient = new DeepSeekClient();
        $this->geminiClient = new GeminiClient();
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
    
    /**
     * Translate with graceful multi-provider fallback.
     *
     * Tries each provider in the configured chain (config('AppQyV1.ai.fallback_chain'),
     * default openrouter -> gemini -> deepseek -> google) until one returns a
     * usable translation. Caching and the per-provider cache key are preserved
     * (the cache is keyed by the provider that actually produced the result).
     *
     * The final "google" link delegates to pycore (PycoreTranslatorUtil), so a
     * translation still completes when every direct LLM key is down/over-quota —
     * this is the robustness guarantee for weak servers. Providers without a key
     * configured are skipped (they never count as a "failure").
     *
     * @param array<int,string>|null $chain Optional explicit provider order.
     * @return array Same shape as translate(); includes 'provider' (the winner)
     *               and 'attempts' (per-provider attempt log).
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

        $attempts = [];

        foreach ($chain as $provider) {
            $provider = trim((string) $provider);
            if ($provider === '') {
                continue;
            }

            // Skip providers with no key configured (the google/pycore link has
            // no local key requirement and is always attempted if reached).
            if (!$this->isProviderConfigured($provider)) {
                $attempts[] = ['provider' => $provider, 'status' => 'skipped', 'reason' => 'not_configured'];
                continue;
            }

            $model = $modelOverrides[$provider] ?? null;

            try {
                $result = $provider === 'google'
                    ? $this->translateViaGoogle($text, $langCode, $type, $useCache)
                    : $this->translate($text, $langCode, $type, $model, $provider, $useCache);
            } catch (\Throwable $e) {
                $attempts[] = ['provider' => $provider, 'status' => 'error', 'reason' => $e->getMessage()];
                Log::warning('[AppQyV1Translation] Provider threw, falling back', [
                    'provider' => $provider,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            if (($result['success'] ?? false) === true && trim((string) ($result['translation'] ?? '')) !== '') {
                $result['attempts'] = $attempts;
                $result['provider'] = $result['provider'] ?? $provider;
                return $result;
            }

            $attempts[] = [
                'provider' => $provider,
                'status' => 'failed',
                'reason' => $result['error'] ?? 'empty_translation',
            ];
            Log::info('[AppQyV1Translation] Provider failed, trying next', [
                'provider' => $provider,
                'reason' => $result['error'] ?? 'empty_translation',
            ]);
        }

        return [
            'success' => false,
            'error' => 'All translation providers failed or are unconfigured',
            'attempts' => $attempts,
        ];
    }

    /**
     * Final-fallback translation via pycore Google translator.
     *
     * Delegates to PycoreTranslatorUtil (which calls pycore over RPC). Returns
     * the same shape as translate() so the fallback chain is uniform.
     */
    private function translateViaGoogle(
        string $text,
        string $langCode,
        string $type,
        bool $useCache
    ): array {
        $response = PycoreTranslatorUtil::translateSingle($text, 'auto', $langCode, $useCache);

        if (!is_array($response) || isset($response['error'])) {
            return [
                'success' => false,
                'error' => is_array($response) ? ($response['error'] ?? 'pycore translate failed') : 'pycore unreachable',
            ];
        }

        $translation = $response['translated_text']
            ?? $response['translation']
            ?? $response['text']
            ?? '';

        if (trim((string) $translation) === '') {
            return ['success' => false, 'error' => 'pycore returned empty translation'];
        }

        return [
            'success' => true,
            'translation' => trim((string) $translation),
            'source_text' => $text,
            'target_language' => $langCode,
            'type' => $type,
            'provider' => 'google',
            'model' => 'pycore-google',
            'cached' => false,
        ];
    }

    /**
     * Whether a provider has a usable key configured (google needs none — it is
     * the pycore delegate). Used to skip dead links in the fallback chain.
     */
    private function isProviderConfigured(string $provider): bool
    {
        switch ($provider) {
            case 'google':
                return true;
            case 'gemini':
                return $this->geminiClient->hasApiKey();
            case 'deepseek':
                return $this->deepseekClient->hasApiKey();
            case 'openrouter':
                return $this->openrouterClient->hasApiKey();
            default:
                return false;
        }
    }

    /**
     * Probe every direct AI provider for the AI status endpoint.
     *
     * Returns the pycore ai_probe contract:
     *   { providers: [ { name, configured, available, key_masked, models,
     *                     error, latency_ms } ] }
     * so the Laravel status payload aligns field-for-field with pycore's
     * /api/local/ai/probe and the desktop UI can consume either.
     */
    public function probeProviders(): array
    {
        $providers = [];

        // OpenRouter
        $orKey = $this->resolveProviderKey('openrouter');
        $orProbe = $this->openrouterClient->probe();
        $providers[] = $this->buildProbeEntry('openrouter', $orKey, $orProbe);

        // Gemini
        $gKey = $this->resolveProviderKey('gemini');
        $gProbe = $this->geminiClient->probe();
        $providers[] = $this->buildProbeEntry('gemini', $gKey, $gProbe);

        // DeepSeek
        $dKey = $this->resolveProviderKey('deepseek');
        $dProbe = $this->deepseekClient->probe();
        $providers[] = $this->buildProbeEntry('deepseek', $dKey, $dProbe);

        return ['providers' => $providers];
    }

    private function buildProbeEntry(string $name, string $key, array $probe): array
    {
        $configured = $key !== '';
        return [
            'name' => $name,
            'configured' => $configured,
            'available' => (bool) ($probe['available'] ?? false),
            'key_masked' => $this->maskKey($key),
            'models' => $probe['models'] ?? [],
            'error' => $probe['error'] ?? ($configured ? null : 'No API key configured'),
            'latency_ms' => $probe['latency_ms'] ?? null,
        ];
    }

    /**
     * Resolve the raw key a client uses, for masking only (never returned whole).
     * Mirrors each client's own lookup order.
     */
    private function resolveProviderKey(string $provider): string
    {
        $reader = \App\Helpers\GlobalSecretReader::class;
        switch ($provider) {
            case 'openrouter':
                return $reader::getSecretContent('OPENROUTER_API_KEY_1')
                    ?: $reader::getSecretContent('OPENROUTER_API_KEY');
            case 'gemini':
                return $reader::getSecretContent('GOOGLE_API_KEY_1')
                    ?: $reader::getSecretContent('GOOGLE_API_KEY_2');
            case 'deepseek':
                return $reader::getSecretContent('DEEPSEEK_API_KEY_1')
                    ?: $reader::getSecretContent('DEEPSEEK_API_KEY')
                    ?: $reader::getSecretContent('OPENROUTER_API_KEY_2');
            default:
                return '';
        }
    }

    /**
     * Mask a secret as first4 + ellipsis + last4 (matches pycore ai_probe).
     */
    private function maskKey(string $key): ?string
    {
        $key = trim($key);
        if ($key === '') {
            return null;
        }
        if (strlen($key) <= 8) {
            return '…';
        }
        return substr($key, 0, 4) . '…' . substr($key, -4);
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

    /**
     * Live one-shot chat against a single provider/model (dashboard "test" panel).
     *
     * Reuses the private callAIProvider dispatch (no duplicated switch). Never
     * throws — every failure is captured and returned in the result array so the
     * no-auth /ai/test endpoint can surface it verbatim. Timing is measured around
     * the provider call only.
     *
     * @return array{success:bool,provider:string,model:?string,response?:string,error?:string,latency_ms:float}
     */
    public function chatOnce(string $provider, ?string $model, string $prompt): array
    {
        if (!in_array($provider, ['openrouter', 'gemini', 'deepseek'], true)) {
            return ['success' => false, 'error' => 'unknown provider'];
        }

        $prompt = trim($prompt) !== '' ? $prompt : 'Reply with the single word: ok';

        $start = microtime(true);
        try {
            $text = $this->callAIProvider($provider, $model, $prompt);
            $ms = (microtime(true) - $start) * 1000;
            return [
                'success' => true,
                'provider' => $provider,
                'model' => $model,
                'response' => $text,
                'latency_ms' => round($ms, 1),
            ];
        } catch (\Throwable $e) {
            $ms = (microtime(true) - $start) * 1000;
            return [
                'success' => false,
                'provider' => $provider,
                'model' => $model,
                'error' => $e->getMessage(),
                'latency_ms' => round($ms, 1),
            ];
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
