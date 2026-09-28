<?php

namespace App\Services;

use App\Services\Translation\TranslationPromptCatalog;
use App\CallPycoreUtils\PycoreTranslatorUtil;
use App\Utils\SecretStore;
use Illuminate\Support\Facades\Log;

/**
 * Canonical translation service (main layer).
 *
 * Owns all provider invocation (OpenRouter / DeepSeek / Gemini and the pycore
 * Google bridge), prompt building, batching, multi-provider fallback chains and
 * provider probing. App layers (e.g. AppQyV1) delegate here and only add
 * app-specific glue such as dictionary-table persistence.
 */
class TranslationService
{
    private $openrouterClient;
    private $deepseekClient;
    private $geminiClient;
    
    public function __construct(?OpenRouterClient $openrouterClient = null, ?DeepSeekClient $deepseekClient = null, ?GeminiClient $geminiClient = null)
    {
        $this->openrouterClient = $openrouterClient ?? new OpenRouterClient();
        $this->deepseekClient = $deepseekClient ?? new DeepSeekClient();
        $this->geminiClient = $geminiClient ?? new GeminiClient();
    }
    
    public function translate(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        string $provider = 'openrouter',
        int $timeout = 300
    ): array {
if (!isset(TranslationPromptCatalog::TRANSLATION_PROMPTS[$type])) {
            return [
                'success' => false,
                'error' => 'Invalid translation type: ' . $type,
            ];
        }
        
        $languageName = TranslationPromptCatalog::LANGUAGES[$targetLanguage] ?? $targetLanguage;
        
        $prompt = str_replace(
            ['{target_language}', '{text}'],
            [$languageName, $text],
            TranslationPromptCatalog::TRANSLATION_PROMPTS[$type]
        );
        
        $client = match($provider) {
            'deepseek' => $this->deepseekClient,
            'gemini' => $this->geminiClient,
            default => $this->openrouterClient,
        };
        
        $defaultModel = match($provider) {
            'deepseek' => 'deepseek-chat',
            'gemini' => 'gemini-2.5-flash',
            default => 'free',
        };
        
        $result = $client->chat(
            prompt: $prompt,
            model: $model ?? $defaultModel,
            timeout: $timeout
        );
        
        if (str_starts_with($result, 'Error:')) {
            return [
                'success' => false,
                'error' => $result,
            ];
        }
        
        return [
            'success' => true,
            'source_text' => $text,
            'target_language' => $languageName,
            'translation_type' => $type,
            'translated_text' => trim($result),
            'model_used' => $model ?? 'free',
        ];
    }
    
    /**
     * Single-provider translation with the normalized result shape
     * ('translation' key). Provider 'google' delegates to the pycore
     * translator bridge; every other provider goes through callAIProvider.
     * $targetLanguage accepts a language code (resolved through LANGUAGES) or
     * an already-resolved language name.
     */
    public function translateViaProvider(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        string $provider = 'openrouter',
        bool $useCache = true
    ): array {
        if ($provider === 'google') {
            return $this->translateViaGoogle($text, $targetLanguage, $type, $useCache);
        }

        $languageName = TranslationPromptCatalog::LANGUAGES[$targetLanguage] ?? $targetLanguage;

        // 'learning' carries a {format_instructions} placeholder that only the
        // multi-language prompt builder fills; fall back like the simple
        // prompt builder always did.
        $promptType = $type;
        if (!isset(TranslationPromptCatalog::TRANSLATION_PROMPTS[$promptType]) || $promptType === 'learning') {
            $promptType = 'general';
        }

        $prompt = str_replace(
            ['{target_language}', '{text}'],
            [$languageName, $text],
            TranslationPromptCatalog::TRANSLATION_PROMPTS[$promptType]
        );

        try {
            $response = $this->callAIProvider($provider, $model, $prompt);
        } catch (\Throwable $e) {
            Log::error('[TranslationService] Provider error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'provider' => $provider,
                'model' => $model,
            ];
        }

        return [
            'success' => true,
            'translation' => trim($response),
            'source_text' => $text,
            'target_language' => $targetLanguage,
            'type' => $type,
            'provider' => $provider,
            'model' => $model,
        ];
    }

    /**
     * Translate with graceful multi-provider fallback.
     *
     * Tries each provider in $chain (default openrouter -> gemini -> deepseek
     * -> google) until one returns a usable translation. Providers without a
     * key configured are skipped (they never count as a "failure"). The final
     * "google" link delegates to pycore, so a translation still completes when
     * every direct LLM key is down or over-quota — the robustness guarantee
     * for weak servers.
     *
     * @param array<int,string>|null $chain Optional explicit provider order.
     * @param array<string,string>|null $modelOverrides Per-provider model map.
     * @return array Same shape as translateViaProvider(), plus 'attempts'
     *               (per-provider attempt log) and the winning 'provider'.
     */
    public function translateWithFallback(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?array $chain = null,
        ?array $modelOverrides = null
    ): array {
        $chain = $chain ?? ['openrouter', 'gemini', 'deepseek', 'google'];
        $modelOverrides = $modelOverrides ?? [];

        $attempts = [];

        foreach ($chain as $provider) {
            $provider = trim((string) $provider);
            if ($provider === '') {
                continue;
            }

            if (!$this->isProviderConfigured($provider)) {
                $attempts[] = ['provider' => $provider, 'status' => 'skipped', 'reason' => 'not_configured'];
                continue;
            }

            $model = $modelOverrides[$provider] ?? null;

            try {
                $result = $this->translateViaProvider($text, $targetLanguage, $type, $model, $provider);
            } catch (\Throwable $e) {
                $attempts[] = ['provider' => $provider, 'status' => 'error', 'reason' => $e->getMessage()];
                Log::warning('[TranslationService] Provider threw, falling back', [
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
            Log::info('[TranslationService] Provider failed, trying next', [
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
     * Final-fallback translation via the pycore Google translator bridge.
     * Returns the same shape as translateViaProvider() so the fallback chain
     * is uniform.
     */
    private function translateViaGoogle(
        string $text,
        string $targetLanguage,
        string $type,
        bool $useCache
    ): array {
        $response = PycoreTranslatorUtil::translateSingle($text, 'auto', $targetLanguage, $useCache);

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
            'target_language' => $targetLanguage,
            'type' => $type,
            'provider' => 'google',
            'model' => 'pycore-google',
        ];
    }

    /**
     * Dispatch a prompt to a single AI provider client.
     */
    public function callAIProvider(string $provider, ?string $model, string $prompt): string
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
     * Whether a provider has a usable key configured (google needs none — it
     * is the pycore delegate). Used to skip dead links in the fallback chain.
     */
    public function isProviderConfigured(string $provider): bool
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

        $orKey = $this->resolveProviderKey('openrouter');
        $orProbe = $this->openrouterClient->probe();
        $providers[] = $this->buildProbeEntry('openrouter', $orKey, $orProbe);

        $gKey = $this->resolveProviderKey('gemini');
        $gProbe = $this->geminiClient->probe();
        $providers[] = $this->buildProbeEntry('gemini', $gKey, $gProbe);

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
            'key_masked' => SecretStore::maskForDisplay($key),
            'models' => $probe['models'] ?? [],
            'error' => $probe['error'] ?? ($configured ? null : 'No API key configured'),
            'latency_ms' => $probe['latency_ms'] ?? null,
        ];
    }

    /**
     * Resolve the raw key a client uses, for masking only (never returned
     * whole). Mirrors each client's own lookup order.
     */
    private function resolveProviderKey(string $provider): string
    {
        switch ($provider) {
            case 'openrouter':
                return SecretStore::get('OPENROUTER_API_KEY_1')
                    ?: SecretStore::get('OPENROUTER_API_KEY');
            case 'gemini':
                return SecretStore::get('GOOGLE_API_KEY_1')
                    ?: SecretStore::get('GOOGLE_API_KEY_2');
            case 'deepseek':
                return SecretStore::get('DEEPSEEK_API_KEY_1')
                    ?: SecretStore::get('DEEPSEEK_API_KEY')
                    ?: SecretStore::get('OPENROUTER_API_KEY_2');
            default:
                return '';
        }
    }

    /**
     * Live one-shot chat against a single provider/model (dashboard "test"
     * panel). Never throws — every failure is captured and returned in the
     * result array so a no-auth endpoint can surface it verbatim.
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

    /**
     * Google (pycore) single-word translation — the folded-in provider
     * capability of the removed Process-based Google translator service, now
     * routed through the canonical PycoreTranslatorUtil bridge instead of a
     * Process-spawned inline Python snippet.
     */
    public function googleTranslateWord(string $word, string $srcLang = 'en', string $destLang = 'zh-CN'): ?array
    {
        $response = PycoreTranslatorUtil::translateSingle($word, $srcLang, $destLang, false);

        if (!is_array($response) || isset($response['error'])) {
            Log::error('[TranslationService] Google word translation failed', [
                'word' => $word,
                'response' => $response,
            ]);
            return null;
        }

        return [
            'original' => $response['original_text'] ?? $word,
            'translation' => $response['translated_text'] ?? null,
            'pronunciation' => $response['pronunciation'] ?? null,
            'src_lang' => $response['src_lang'] ?? $srcLang,
            'dest_lang' => $response['dest_lang'] ?? $destLang,
        ];
    }

    /**
     * Google (pycore) batch word translation. Returns one entry per input
     * word (null on failure), mirroring the removed Process-based batch
     * contract.
     */
    public function googleTranslateBatch(array $words, string $srcLang = 'en', string $destLang = 'zh-CN'): array
    {
        if (empty($words)) {
            return [];
        }

        $response = PycoreTranslatorUtil::translateBatch($words, $srcLang, [$destLang], false);

        if (!is_array($response)) {
            return array_fill(0, count($words), null);
        }

        $results = [];
        foreach (array_values($words) as $index => $word) {
            $entry = $response[$index][0] ?? null;

            if (!is_array($entry) || isset($entry['error'])) {
                $results[] = null;
                continue;
            }

            $results[] = [
                'original' => $entry['original_text'] ?? $word,
                'translation' => $entry['translated_text'] ?? null,
                'pronunciation' => $entry['pronunciation'] ?? null,
                'src_lang' => $entry['src_lang'] ?? $srcLang,
                'dest_lang' => $entry['dest_lang'] ?? $destLang,
                'error' => null,
            ];
        }

        return $results;
    }

    /**
     * ASCII word sanity check (folded in from the removed Process-based
     * Google translator service).
     */
    public function isWordValid(string $word): bool
    {
        if (strlen($word) < 2 || strlen($word) > 50) {
            return false;
        }

        if (!preg_match('/^[a-zA-Z\-\']+$/', $word)) {
            return false;
        }

        return true;
    }

    public function batchTranslate(
        array $texts,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        string $provider = 'openrouter'
    ): array {
        $results = [];
        
        foreach ($texts as $index => $text) {
            $results[$index] = $this->translate($text, $targetLanguage, $type, $model, $provider);
        }
        
        return $results;
    }
    
    public function detectAndTranslate(
        string $text,
        string $targetLanguage,
        ?string $model = null,
        string $provider = 'openrouter'
    ): array {
        return $this->translate($text, $targetLanguage, 'multilingual_detect', $model, $provider);
    }
    
    public function getAvailableLanguages(): array
    {
        return TranslationPromptCatalog::LANGUAGES;
    }
    
    public function getAvailableTypes(): array
    {
        return array_keys(TranslationPromptCatalog::TRANSLATION_PROMPTS);
    }
    
    public function getLanguageTemplates(): array
    {
        $templates = [];
        
        foreach (TranslationPromptCatalog::LANGUAGE_PROMPT_TEMPLATES as $langCode => $template) {
            $templates[$langCode] = [
                'name' => TranslationPromptCatalog::LANGUAGES[$langCode] ?? $langCode,
                'translation' => $template['translation'],
                'words' => $template['words'],
            ];
        }
        
        return $templates;
    }
    
    public function buildPrompt(
        string $text,
        string $targetLanguage,
        array $options = []
    ): string {
        return $this->buildMultiLanguagePrompt($text, [$targetLanguage], $options);
    }
    
    public function buildMultiLanguagePrompt(
        string $text,
        array $targetLanguages,
        array $options = []
    ): string {
        $formatInstructions = [];
        
        foreach ($targetLanguages as $langCode) {
            $template = TranslationPromptCatalog::LANGUAGE_PROMPT_TEMPLATES[$langCode] ?? null;
            
            if ($template) {
                $formatInstructions[] = $template['translation'];
                $formatInstructions[] = $template['words'];
            } else {
                $languageName = TranslationPromptCatalog::LANGUAGES[$langCode] ?? $langCode;
                $formatInstructions[] = "{$languageName} Translation: {translation}";
                $formatInstructions[] = "{$languageName} Words: {word} [{phonetic}], {word} [{phonetic}]";
            }
            
            $formatInstructions[] = '';
        }
        
        $prompt = str_replace(
            ['{text}', '{format_instructions}'],
            [$text, implode("\n", $formatInstructions)],
            TranslationPromptCatalog::TRANSLATION_PROMPTS['learning']
        );
        
        return $prompt;
    }
    
    public function translateForLearning(
        string $text,
        array $targetLanguages,
        array $options = [],
        ?string $model = null,
        string $provider = 'openrouter',
        bool $generateAudio = false,
        string $translationMethod = 'ai',
        int $timeout = 300
    ): array {
        if ($translationMethod === 'google') {
            return $this->translateForLearningWithGoogle($text, $targetLanguages, $generateAudio);
        }
        
        $prompt = $this->buildMultiLanguagePrompt($text, $targetLanguages, $options);
        
        $client = match($provider) {
            'deepseek' => $this->deepseekClient,
            'gemini' => $this->geminiClient,
            default => $this->openrouterClient,
        };
        
        $defaultModel = match($provider) {
            'deepseek' => 'deepseek-chat',
            'gemini' => 'gemini-2.5-flash',
            default => 'free',
        };
        
        $actualModel = $model ?? $defaultModel;
        
        $result = $client->chat(
            prompt: $prompt,
            model: $actualModel,
            timeout: $timeout
        );
        
        if (str_starts_with($result, 'Error:')) {
            return [
                'success' => false,
                'error' => $result,
                'model_requested' => $actualModel,
                'source_text' => $text,
            ];
        }
        
        $allTranslations = [];
        
        foreach ($targetLanguages as $langCode) {
            $allTranslations[] = [
                'language' => TranslationPromptCatalog::LANGUAGES[$langCode] ?? $langCode,
                'lang_code' => $langCode,
                'model_requested' => $actualModel,
            ];
        }
        
        if ($generateAudio) {
            $this->initiateTTSGeneration($text, $allTranslations, $targetLanguages);
        }
        
        return [
            'success' => true,
            'source_text' => $text,
            'target_languages' => array_map(fn($code) => TranslationPromptCatalog::LANGUAGES[$code] ?? $code, $targetLanguages),
            'options' => $options,
            'translations' => $allTranslations,
            'raw_response' => $result,
            'model_used' => $actualModel,
            'audio_generation' => $generateAudio,
            'prompt_used' => $prompt,
        ];
    }
    
    private function translateForLearningWithGoogle(
        string $text,
        array $targetLanguages,
        bool $generateAudio = false
    ): array {
        $googleResults = PycoreTranslatorUtil::translateBatch(
            [$text],
            'auto',
            $targetLanguages,
            true
        );
        
        if (isset($googleResults['error'])) {
            return [
                'success' => false,
                'error' => $googleResults['error'],
                'error_details' => $googleResults['details'] ?? null,
                'translation_method' => 'google',
            ];
        }
        
        if (!$googleResults || !is_array($googleResults)) {
            return [
                'success' => false,
                'error' => 'Google Translate returned invalid data format',
                'raw_response' => $googleResults,
                'translation_method' => 'google',
            ];
        }
        
        $translations = [];
        $errors = [];
        
        foreach ($googleResults as $index => $result) {
            if (isset($result['error'])) {
                $errors[] = [
                    'index' => $index,
                    'language' => $targetLanguages[$index] ?? 'unknown',
                    'error' => $result['error'],
                ];
                continue;
            }
            
            if (!isset($result['translated_text'])) {
                $errors[] = [
                    'index' => $index,
                    'language' => $targetLanguages[$index] ?? 'unknown',
                    'error' => 'Missing translated_text field',
                    'result' => $result,
                ];
                continue;
            }
            
            $langCode = $result['dest_lang'] ?? 'unknown';
            $translation = [
                'language' => TranslationPromptCatalog::LANGUAGES[$langCode] ?? $langCode,
                'translation' => $result['translated_text'],
            ];
            
            if (isset($result['pronunciation']) && !empty($result['pronunciation'])) {
                $translation['phonetics'] = $result['pronunciation'];
            }
            
            $translation['letters'] = $this->extractLetters($result['translated_text']);
            
            $translations[] = $translation;
        }
        
        if (empty($translations) && !empty($errors)) {
            return [
                'success' => false,
                'error' => 'All translations failed',
                'translation_errors' => $errors,
                'translation_method' => 'google',
            ];
        }
        
        if ($generateAudio) {
            $this->initiateTTSGeneration($text, $translations, $targetLanguages);
        }
        
        $result = [
            'success' => true,
            'source_text' => $text,
            'target_languages' => array_map(fn($code) => TranslationPromptCatalog::LANGUAGES[$code] ?? $code, $targetLanguages),
            'translations' => $translations,
            'translation_method' => 'google',
            'audio_generation' => $generateAudio,
        ];
        
        if (!empty($errors)) {
            $result['partial_errors'] = $errors;
        }
        
        return $result;
    }
    
    private function extractLetters(string $text): array
    {
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        $uniqueChars = array_unique($chars);
        
        $letters = [];
        foreach ($uniqueChars as $char) {
            if (trim($char) !== '' && !preg_match('/[\s\p{P}]/u', $char)) {
                $letters[] = [
                    'letter' => $char,
                    'phonetic' => ''
                ];
            }
        }
        
        return $letters;
    }
    
    private function initiateTTSGeneration(string $sourceText, array $translations, array $targetLangCodes): void
    {
        $ttsService = new \App\Services\EdgeTTS\EdgeTTSService();
        
        foreach ($translations as $idx => $trans) {
            $langCode = $targetLangCodes[$idx] ?? null;
            if (!$langCode) continue;
            
            if (isset($trans['translation'])) {
                $ttsService->generateAudio($trans['translation'], $langCode, 'sentence');
            }
            
            if (isset($trans['words']) && is_array($trans['words'])) {
                foreach ($trans['words'] as $wordData) {
                    if (isset($wordData['word'])) {
                        $ttsService->generateAudio($wordData['word'], $langCode, 'word');
                    }
                }
            }
            
            if (isset($trans['letters']) && is_array($trans['letters'])) {
                foreach ($trans['letters'] as $letterData) {
                    if (isset($letterData['letter'])) {
                        $ttsService->generateAudio($letterData['letter'], $langCode, 'letter');
                    }
                }
            }
        }
    }
}
