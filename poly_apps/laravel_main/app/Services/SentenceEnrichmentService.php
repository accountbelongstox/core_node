<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Sentence Enrichment Service
 *
 * Idempotent AI + TTS enrichment pass over the per-language sentence store
 * ({prefix}_sentences_{lang}), covering BOTH subtitle- and book-derived
 * sentences (Books v3 unified model).
 *
 * For each sentence that still needs work it:
 *   1. Calls an LLM ONCE with a structured prompt that returns a strict JSON
 *      object {explanation, grammar, ai_commentary, special_usage} (written in
 *      the sentence's own language where natural).
 *   2. Synthesizes per-sentence TTS audio, stores the mp3 under
 *      PathMapper::getAppQyV1SentenceSoundsDir() keyed by sentence_id, and sets
 *      the `audio` column to the canonical served reference.
 *
 * THE CRITICAL IDEMPOTENCY RULE (identical to MediaIngestService::mergeFill):
 * FILL-MISSING, NEVER CLOBBER. Only currently-empty columns are written; an
 * existing non-empty value is never overwritten. A fully-enriched row is never
 * reprocessed (the selection query skips it), so the pass is resumable and safe
 * to run repeatedly. Each row is wrapped in try/catch so one failure never
 * aborts the batch.
 *
 * Provider selection reuses the SAME pattern as AppQyV1TranslationService:
 * the clients are chosen from the configurable fallback chain
 * (config('AppQyV1.ai.fallback_chain'), default openrouter -> gemini ->
 * deepseek) with per-provider model overrides (config('AppQyV1.ai.models')).
 * No keys are hardcoded; providers without a key configured are skipped.
 */
class SentenceEnrichmentService
{
    /**
     * The four AI detail columns this pass fills (when empty).
     */
    private const AI_FIELDS = ['explanation', 'grammar', 'ai_commentary', 'special_usage'];

    private $openrouterClient;
    private $deepseekClient;
    private $geminiClient;
    private $ttsService;

    public function __construct()
    {
        $this->openrouterClient = new OpenRouterClient();
        $this->deepseekClient = new DeepSeekClient();
        $this->geminiClient = new GeminiClient();
        $this->ttsService = new EdgeTTSService();
    }

    /**
     * Enrich up to $limit sentences that still need AI fields and/or audio.
     *
     * @param int         $limit    Max rows to process this batch.
     * @param string|null $language Optional language filter (matches the
     *                              sentences.language column, e.g. 'english').
     * @return array{
     *   processed:int, enriched:int, remaining:int, errors:array<int,array>
     * }
     */
    public function enrich(int $limit = 50, ?string $language = null): array
    {
        if ($limit < 1) {
            $limit = 1;
        }

        $processed = 0;
        $enriched = 0;
        $errors = [];

        // Sweep the requested language, or every supported per-language table,
        // until the batch limit is filled.
        foreach ($this->languagesFor($language) as $langCode) {
            if ($processed >= $limit) {
                break;
            }
            if (!$this->tableExists($langCode)) {
                continue;
            }

            $remaining = $limit - $processed;
            $rows = LangSentence::rowsNeedingEnrichment($langCode, self::AI_FIELDS, $remaining);

            foreach ($rows as $sentence) {
                $processed++;
                try {
                    if ($this->enrichRow($langCode, $sentence)) {
                        $enriched++;
                    }
                } catch (\Throwable $e) {
                    // One row failing must never abort the batch.
                    $errors[] = [
                        'content_id' => $sentence->content_id,
                        'language' => $langCode,
                        'error' => $e->getMessage(),
                    ];
                    Log::warning('[SentenceEnrichment] Row failed', [
                        'content_id' => $sentence->content_id,
                        'language' => $langCode,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return [
            'processed' => $processed,
            'enriched' => $enriched,
            'remaining' => $this->countRowsNeedingWork($language),
            'errors' => $errors,
        ];
    }

    /**
     * The language codes to operate on: a single requested language (name or
     * code, normalized), or every supported language when null/empty.
     *
     * @return array<int,string>
     */
    private function languagesFor(?string $language): array
    {
        if ($language !== null && trim($language) !== '') {
            return [$this->normalizeLangCode($language)];
        }
        return AppQyV1TableMaps::getSupportedLanguages();
    }

    /** Normalize a language name/code to the per-language table code. */
    private function normalizeLangCode(string $language): string
    {
        $lang = strtolower(trim($language));
        $nameToCode = [
            'english' => 'en',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'chinese' => 'zh',
        ];
        if (isset($nameToCode[$lang])) {
            $lang = $nameToCode[$lang];
        }
        return $lang;
    }

    /** Whether the per-language sentence table for $lang exists. */
    private function tableExists(string $lang): bool
    {
        return LangSentence::tableExists($lang);
    }

    /**
     * Enrich a single sentence row in place (fill-missing, never clobber).
     *
     * @return bool True if any column was actually filled and saved.
     */
    private function enrichRow(string $langCode, LangSentence $sentence): bool
    {
        $changed = false;

        // ---- 1. AI detail fields (only if at least one is still empty) ----
        if ($this->needsAiFields($sentence)) {
            $ai = $this->generateAiFields((string) $sentence->text, $langCode);
            foreach (self::AI_FIELDS as $field) {
                $incoming = $ai[$field] ?? null;
                if ($this->isEmptyValue($incoming)) {
                    continue;
                }
                // No-clobber: only fill when the existing column is empty.
                if (!$this->isEmptyValue($sentence->getAttribute($field))) {
                    continue;
                }
                $sentence->setAttribute($field, $incoming);
                $changed = true;
            }
        }

        // ---- 2. TTS audio (only if currently empty) ----
        if ($this->isEmptyValue($sentence->getAttribute('audio'))) {
            $audioRef = $this->generateAudioReference(
                (string) $sentence->content_id,
                (string) $sentence->text,
                $langCode
            );
            if (!$this->isEmptyValue($audioRef)) {
                $sentence->setAttribute('audio', $audioRef);
                $sentence->setAttribute('has_audio', true);
                $changed = true;
            }
        }

        if ($changed) {
            $sentence->saveRecord();
        }

        return $changed;
    }

    /**
     * Call the LLM once and parse a strict JSON object with the four AI fields.
     *
     * Walks the configured provider fallback chain (reusing the translation
     * service's pattern) until one returns a parseable JSON payload.
     *
     * @return array<string,string> Subset of self::AI_FIELDS (missing on failure).
     */
    private function generateAiFields(string $text, string $language): array
    {
        $languageName = $language !== '' ? $language : 'the source language';
        $prompt = $this->buildPrompt($text, $languageName);

        $chain = (array) config('AppQyV1.ai.fallback_chain', ['openrouter', 'gemini', 'deepseek']);
        $modelOverrides = (array) config('AppQyV1.ai.models', []);

        foreach ($chain as $provider) {
            $provider = trim((string) $provider);
            // The 'google' link is a translation-only pycore delegate; it cannot
            // produce structured enrichment, so it is skipped here.
            if ($provider === '' || $provider === 'google') {
                continue;
            }
            if (!$this->isProviderConfigured($provider)) {
                continue;
            }

            $model = $modelOverrides[$provider] ?? null;

            try {
                $raw = $this->callProvider($provider, $model, $prompt);
            } catch (\Throwable $e) {
                Log::info('[SentenceEnrichment] Provider threw, trying next', [
                    'provider' => $provider,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            // The clients return "Error: ..." (a string) on failure.
            if ($raw === '' || str_starts_with(trim($raw), 'Error:')) {
                continue;
            }

            $parsed = $this->parseJsonFields($raw);
            if (!empty($parsed)) {
                return $parsed;
            }
        }

        return [];
    }

    /**
     * Synthesize TTS audio for a sentence and store it under the sentence-sounds
     * directory keyed by sentence_id. Returns the canonical served reference, or
     * null if audio could not be produced.
     *
     * Reuses EdgeTTSService to do the actual edge-tts synthesis (and its
     * cache), then copies the produced mp3 into
     * PathMapper::getAppQyV1SentenceSoundsDir() under
     * "<langCode>/<content_id>.mp3" (Books v3 §6) so the per-language store has a
     * stable, content-keyed asset. Returns the bare relative reference stored on
     * the audio column ("<langCode>/<content_id>.mp3").
     */
    private function generateAudioReference(string $contentId, string $text, string $language): ?string
    {
        $text = trim($text);
        if ($text === '' || $contentId === '') {
            return null;
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($language !== '' ? $language : 'english');

        $result = $this->ttsService->generateAudio($text, $langCode, 'sentence');
        if (!is_array($result) || ($result['success'] ?? false) !== true) {
            Log::info('[SentenceEnrichment] TTS failed', [
                'content_id' => $contentId,
                'language' => $langCode,
                'error' => $result['error'] ?? 'unknown',
            ]);
            return null;
        }

        // Stable, content-keyed destination under the sentence-sounds dir (§6).
        $relative = $langCode . '/' . $contentId . '.mp3';
        $destPath = rtrim(PathMapper::getAppQyV1SentenceSoundsDir(), '/\\')
            . DIRECTORY_SEPARATOR . $langCode
            . DIRECTORY_SEPARATOR . $contentId . '.mp3';

        // Locate the freshly produced (or cached) source mp3 on disk.
        $sourcePath = $this->ttsService->getAudioPath((string) ($result['audio_path'] ?? ''));
        if ($sourcePath === null || !is_file($sourcePath)) {
            // No readable source file; if the asset is already in place use it.
            if (is_file($destPath) && filesize($destPath) > 0) {
                return $relative;
            }
            return null;
        }

        $destDir = dirname($destPath);
        if (!PathMapper::ensureDirectory($destDir, 0775)) {
            Log::warning('[SentenceEnrichment] Could not create sentence sounds dir', [
                'dir' => $destDir,
            ]);
            return null;
        }

        // Idempotent copy: only place the file if it is not already present.
        if (!is_file($destPath) || filesize($destPath) === 0) {
            if (!@copy($sourcePath, $destPath)) {
                Log::warning('[SentenceEnrichment] Could not copy audio to sentence sounds dir', [
                    'from' => $sourcePath,
                    'to' => $destPath,
                ]);
                return null;
            }
        }

        // Bare relative reference stored on the audio column (Books v3 §6).
        return $relative;
    }

    /**
     * Build the structured enrichment prompt. Asks for STRICT JSON only so the
     * response is machine-parseable; the four fields are written in the
     * sentence's own language where natural.
     */
    private function buildPrompt(string $text, string $languageName): string
    {
        return <<<PROMPT
You are a language-learning assistant. Analyze the following sentence written in {$languageName}.

Sentence:
"""
{$text}
"""

Return ONLY a single minified JSON object (no markdown, no code fences, no extra text) with EXACTLY these string keys:
- "explanation": a clear, concise explanation of the sentence's meaning.
- "grammar": notable grammar points, structures, or tenses used.
- "ai_commentary": brief commentary on tone, register, or context.
- "special_usage": idioms, collocations, or special/colloquial usage (empty string "" if none).

Write the values in {$languageName} where natural. Each value must be a plain string. Output the JSON object and nothing else.
PROMPT;
    }

    /**
     * Parse the LLM response into the four AI fields. Tolerant of stray text and
     * ```json fences around the object.
     *
     * @return array<string,string>
     */
    private function parseJsonFields(string $raw): array
    {
        $raw = trim($raw);

        // Strip ```json ... ``` fences if present.
        if (str_starts_with($raw, '```')) {
            $raw = preg_replace('/^```[a-zA-Z]*\s*/', '', $raw);
            $raw = preg_replace('/\s*```$/', '', (string) $raw);
            $raw = trim((string) $raw);
        }

        // Isolate the outermost JSON object if there is surrounding prose.
        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');
        if ($start === false || $end === false || $end <= $start) {
            return [];
        }
        $json = substr($raw, $start, $end - $start + 1);

        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return [];
        }

        $result = [];
        foreach (self::AI_FIELDS as $field) {
            if (!array_key_exists($field, $decoded)) {
                continue;
            }
            $value = $decoded[$field];
            if (is_array($value)) {
                $value = trim(implode(' ', array_map('strval', $value)));
            } else {
                $value = trim((string) $value);
            }
            if ($value !== '') {
                $result[$field] = $value;
            }
        }

        return $result;
    }

    /**
     * Dispatch a chat() call to the chosen provider. All three clients share the
     * same chat(prompt, model, systemPrompt, extra, timeout): string signature.
     */
    private function callProvider(string $provider, ?string $model, string $prompt): string
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
     * Whether a provider has a usable key configured (mirrors the translation
     * service's isProviderConfigured for the direct LLM providers).
     */
    private function isProviderConfigured(string $provider): bool
    {
        switch ($provider) {
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
     * Whether any of the four AI detail columns is still empty.
     */
    private function needsAiFields(LangSentence $sentence): bool
    {
        foreach (self::AI_FIELDS as $field) {
            if ($this->isEmptyValue($sentence->getAttribute($field))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Count of rows still needing work (post-batch "remaining"), summed across
     * the requested language or every supported per-language table.
     */
    private function countRowsNeedingWork(?string $language): int
    {
        $total = 0;
        foreach ($this->languagesFor($language) as $langCode) {
            if (!$this->tableExists($langCode)) {
                continue;
            }
            $total += LangSentence::countNeedingEnrichment($langCode, self::AI_FIELDS);
        }
        return $total;
    }

    /**
     * Empty test, identical in spirit to MediaIngestService::isEmptyValue for
     * the string/array/null cases the enrichment columns use.
     */
    private function isEmptyValue($value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value) && trim($value) === '') {
            return true;
        }
        if (is_array($value) && count($value) === 0) {
            return true;
        }
        return false;
    }
}
