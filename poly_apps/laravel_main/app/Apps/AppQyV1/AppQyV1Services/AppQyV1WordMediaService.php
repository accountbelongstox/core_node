<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1ImageUrl;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Word resource resolution and queue prioritization.
 *
 * Single source of truth for resolving historical word resources and enqueuing
 * missing translation or pronunciation work.
 *
 * FILE-FIRST: historical image_url and current audio_url values are reported
 * only when their files exist. Single words never create image work.
 *
 * PRIORITY model:
 *   - global_tasks.priority (higher = sooner): PRIORITY_FRONT on bump.
 *   - word_audio: global_tasks.queue_position head ticket.
 */
class AppQyV1WordMediaService
{
    /**
     * Legacy metadata keys inside the translations json that are NOT target
     * translations: the top-level 'word' holds the SOURCE headword, the rest are
     * dictionary metadata. Excluded from every translation scan so the headword
     * never leaks into translations[]. Mirrors
     * AppQyV1WordGroupWordController::TRANSLATION_META_KEYS.
     */
    const TRANSLATION_META_KEYS = [
        'word',
        'word_translation',
        'plural_form',
        'synonyms',
        'synonyms_type',
        'advanced_translate',
        'advanced_translate_type',
        'phonetic_symbol',
        'voice_files',
    ];

    protected AppQyV1AudioGateway $audioGateway;
    protected AppQyV1WordTranslationQueueService $translationQueue;

    public function __construct()
    {
        $this->audioGateway = new AppQyV1AudioGateway();
        $this->translationQueue = app(AppQyV1WordTranslationQueueService::class);
    }

    public function fixWordText(string $md5, string $language, string $cleanedWord): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);

        try {
            $updated = AppQyV1LangDictionaryModel::updateValidWordText($langCode, $md5, $cleanedWord);
            Log::info('[WordMedia] fixWordText applied', [
                'language' => $langCode,
                'md5' => $md5,
                'cleaned_word' => $cleanedWord,
                'updated' => $updated,
            ]);

            return ['success' => true, 'updated' => $updated];
        } catch (\Throwable $exception) {
            Log::warning('[WordMedia] fixWordText failed: ' . $exception->getMessage());

            return [
                'success' => false,
                'message' => 'DB error: ' . $exception->getMessage(),
            ];
        }
    }

    public function missingAudioBatch(string $language, int $limit): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $words = [];

        try {
            $columns = AppQyV1LangDictionaryModel::languageColumnAvailability($langCode, [
                'has_audio',
                'is_valid',
                'tts_status',
                'content',
                'audio_files',
                'tts_files',
            ]);
            $hasHasAudio = $columns['has_audio'];
            $hasIsValid = $columns['is_valid'];
            $hasTtsStatus = $columns['tts_status'];
            $hasContent = $columns['content'];
            $rows = AppQyV1LangDictionaryModel::missingAudioBatchRows($langCode, $limit, $columns);
            if ($hasContent) {
                $rows = (new AppQyV1DictionaryTTSCoordinator())
                    ->filterTrulyMissingWords($langCode, $rows);
            }

            foreach ($rows as $row) {
                $words[] = [
                    'word' => $hasContent ? (string) $row->content : '',
                    'md5' => (string) $row->md5,
                    'language' => $langCode,
                ];
            }
        } catch (\Throwable $exception) {
            Log::warning('[WordMedia] missingAudioBatch failed: ' . $exception->getMessage());

            return [
                'success' => false,
                'error' => 'Internal error: ' . $exception->getMessage(),
                'language' => $langCode,
                'words' => [],
            ];
        }

        return [
            'success' => true,
            'language' => $langCode,
            'count' => count($words),
            'words' => $words,
        ];
    }

    /**
     * Resolve a word's media file-first and queue missing resources.
     *
     * @param string $word           The word text.
     * @param string $language       Source/library language (name or code).
     * @param string|null $targetLang Optional target language for translation.
     * @param bool $bumpFront         True for an active query (move-to-front).
     * @param bool $tryRealPronunciation Retained compatibility flag; request-path
     *                                    pronunciation lookup now belongs to Pycore.
     * @param bool $enqueueMissing    False for read-only aggregate queries.
     * @return array The contract data block:
     *   { word, md5, language, image_url|null, audio_url|null,
     *     image_status, audio_status, translations:[], explanation,
     *     phonetic, us_phonetic, uk_phonetic }
     */
    public function resolve(
        string $word,
        string $language,
        ?string $targetLang = null,
        bool $bumpFront = true,
        ?string $accent = null,
        bool $tryRealPronunciation = true,
        bool $enqueueMissing = true
    ): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $md5 = md5($word);

        $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);

        $imageUrl = $row ? $this->resolveImageUrl($row) : null;
        $audioState = $this->audioGateway->requestWord(
            $word,
            $langCode,
            $accent,
            $enqueueMissing,
            $bumpFront
        );
        $audioPick = [
            'url' => $audioState['audio_url'],
            'accent' => $audioState['audio_accent'],
            'fallback' => $audioState['accent_fallback'],
        ];
        $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
        $audioUrl = $audioPick['url'];
        $audioAccent = $audioPick['accent'];
        $accentFallback = $audioPick['fallback'];

        $hasImage = $imageUrl !== null;
        $hasAudio = $audioUrl !== null;
        // Translation presence for the requested target (when one is supplied).
        $translations = $this->extractTranslations($row);
        $hasTranslation = $this->hasTranslationFor($row, $targetLang);

        $hasTargetLanguage = is_string($targetLang) && trim($targetLang) !== '';
        $needsTranslation = $hasTargetLanguage && !$hasTranslation;

        if ($needsTranslation && $enqueueMissing) {
            $priority = $bumpFront
                ? AppQyV1WordTranslationQueueService::PRIORITY_ELEVATED
                : AppQyV1WordTranslationQueueService::PRIORITY_HIGH;
            $this->translationQueue->stackWords([$word], $langCode, $targetLang, $priority);

            // Re-read the row (a queue add may have just created it) so the
            // returned md5/phonetics reflect the canonical row.
            if (!$row) {
                $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
            }
        }

        $audioFilesPayload = $audioState['audio_files'];
        return [
            'word' => $word,
            'md5' => $md5,
            'language' => $langCode,
            'image_url' => $imageUrl,
            'audio_url' => $audioUrl,
            'image_status' => $hasImage ? 'ready' : 'pending',
            'audio_status' => $hasAudio ? 'ready' : 'pending',
            'audio_accent' => $audioAccent,
            'accent_fallback' => $accentFallback,
            // audio_files is the CANONICAL key; audio_variants is kept as an
            // alias (same payload) for backward compatibility with older FEs.
            'audio_files' => $audioFilesPayload,
            'audio_variants' => $audioFilesPayload,
            'audio_queue' => [
                'task_id' => $audioState['queue_task_id'],
                'position' => $audioState['queue_position'],
                'status' => $audioState['queue_status'],
            ],
            'translations' => $translations,
            'explanation' => $this->extractExplanation($row),
            'phonetic' => $row ? ($row->phonetic ?? null) : null,
            'us_phonetic' => $row ? ($row->us_phonetic ?? null) : null,
            'uk_phonetic' => $row ? ($row->uk_phonetic ?? null) : null,
        ];
    }

    /**
     * On-query prioritization hook for missing pronunciation work.
     *
     * @param AppQyV1LangDictionaryModel|null $row Resolved row (may be null).
     * @param string $word Queried word.
     * @param string $language Source language (code or name).
     */
    public function bumpQueriedWordAudio($row, string $word, string $language): void
    {
        $word = trim($word);
        if ($word === '') {
            return;
        }

        try {
            $langCode = AppQyV1DictionaryService::getLanguageCode($language);
            $hasAudio = $row ? ($this->resolveAudioUrl($row) !== null) : false;
            if ($hasAudio) {
                return;
            }

            $this->audioGateway->request($word, $langCode, null, true, true);
        } catch (\Throwable $e) {
            // Non-blocking: never let a media bump break a lookup.
            Log::warning('[AppQyV1WordMedia] query bump failed', [
                'word' => $word,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * File-first image URL for a row, or null when no image_files entry is on
     * disk. Local relative paths get the word-image serve prefix; absolute URLs
     * pass through (AppQyV1ImageUrl).
     */
    public function resolveImageUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        $imageFiles = $row->image_files;
        if (!is_array($imageFiles) || empty($imageFiles)) {
            return null;
        }

        foreach ($imageFiles as $entry) {
            // Absolute / already-served URLs are usable as-is.
            $url = AppQyV1ImageUrl::forEntry($entry);
            if ($url === null) {
                continue;
            }
            $relative = $this->localRelative($entry);
            if ($relative === null) {
                // Absolute URL — trust it (defensive legacy fallback).
                return $url;
            }
            if (is_file(PathMapper::getAppQyV1WordImagesDir($relative))) {
                return $url;
            }
        }

        return null;
    }

    /**
     * File-first audio URL for a row, or null when no tts_files entry is on disk.
     */
    public function resolveAudioUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        return $this->audioGateway->resolveWordAudioUrl($row);
    }

    /**
     * Pick the best on-disk audio URL for a row, optionally honoring accent preference.
     *
     * @return array{url:?string,accent:?string,fallback:bool}
     */
    public function resolveAudioPick(AppQyV1LangDictionaryModel $row, ?string $accent = null): array
    {
        return $this->audioGateway->resolveWordAudioPick($row, $accent);
    }

    /**
     * Canonical per-variant audio payload: ONE entry per on-disk audio file for
     * the row. Single source of truth shared by the media resolve endpoint (GET
     * /word/{lang}/{word}/media) and the group get_words payload, so the two never
     * diverge. Each entry carries the playable {url}, a display {voice} label and
     * the {lang} code, plus the richer per-variant fields. Capped at
     * the gateway's bounded variant limit.
     *
     * @return array<int,array<string,mixed>>
     */
    public function audioVariantsForApi(AppQyV1LangDictionaryModel $row, string $langCode): array
    {
        return $this->audioGateway->wordAudioVariantsForApi($row, $langCode);
    }

    /**
     * Bare local relative path of an image_files entry, or null for an absolute
     * / already-served URL.
     */
    private function localRelative($entry): ?string
    {
        $raw = null;
        if (is_string($entry)) {
            $raw = $entry;
        } elseif (is_array($entry)) {
            if (isset($entry['path']) && is_string($entry['path'])) {
                $raw = $entry['path'];
            } elseif (isset($entry['url']) && is_string($entry['url'])) {
                $raw = $entry['url'];
            }
        }

        if (!is_string($raw) || $raw === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $raw) === 1 || str_starts_with($raw, '//') || str_starts_with($raw, '/')) {
            return null;
        }
        return ltrim($raw, '/');
    }

    /**
     * Flat list of translation strings for the row (the contract's
     * translations:[]). Reads the dictionary translations json: every scalar
     * target-language value plus the nested word_translation pairs' text.
     *
     * @return array<int, string>
     */
    private function extractTranslations($row): array
    {
        if (!$row) {
            return [];
        }
        $translations = $row->translations;
        if (!is_array($translations)) {
            return [];
        }

        $content = (string) $row->content;
        $out = [];

        // Nested word_translation pairs: pair[1] = target meaning. Drop any pair
        // whose target IS the source headword itself.
        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            foreach ($translations['word_translation'] as $pair) {
                if (is_array($pair) && isset($pair[1]) && is_string($pair[1]) && $pair[1] !== ''
                    && strcasecmp($pair[1], $content) !== 0) {
                    $out[] = $pair[1];
                }
            }
        }

        // Flat scalar target values, EXCLUDING the legacy metadata keys (the
        // top-level 'word' holds the source headword, never a translation) and any
        // value equal (case-insensitive) to the headword.
        foreach ($translations as $key => $value) {
            if (!is_string($value) || $value === '') {
                continue;
            }
            if (in_array($key, self::TRANSLATION_META_KEYS, true)) {
                continue;
            }
            if (strcasecmp($value, $content) === 0) {
                continue;
            }
            $out[] = $value;
        }

        return array_values(array_unique($out));
    }

    /**
     * True when the row already has a translation for $targetLanguage (or any
     * translation when no target is supplied). A null row has none.
     */
    private function hasTranslationFor($row, ?string $targetLanguage): bool
    {
        if (!$row) {
            return false;
        }
        $translations = $row->translations;
        if (!is_array($translations)) {
            return false;
        }

        if ($targetLanguage === null || trim($targetLanguage) === '') {
            // No target specified: any translation counts as present.
            return !empty($this->extractTranslations($row)) || !empty($row->has_translation);
        }

        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        return isset($translations[$targetCode]) && is_string($translations[$targetCode]) && $translations[$targetCode] !== '';
    }

    /**
     * Explanation string for the row. Prefers word_details.explanation; when that
     * is empty, COMPOSES one from the translations json (word_translation pairs,
     * else advanced_translate). null when truly nothing.
     * Mirrors AppQyV1WordGroupWordController::wordDefinition.
     */
    private function extractExplanation($row): ?string
    {
        if (!$row) {
            return null;
        }
        $details = $row->word_details;
        if (is_array($details) && isset($details['explanation']) && is_string($details['explanation']) && $details['explanation'] !== '') {
            return $details['explanation'];
        }
        $composed = self::composeDefinition($row);
        return $composed !== '' ? $composed : null;
    }

    /**
     * Compose a definition from the translations json when word_details has none:
     * join the word_translation pairs as "pair[0] pair[1]" with ' / ', else fall
     * back to advanced_translate. '' when nothing usable.
     * Mirrors AppQyV1WordGroupWordController::composeDefinition.
     */
    private static function composeDefinition(AppQyV1LangDictionaryModel $row): string
    {
        $translations = $row->translations;
        if (!is_array($translations)) {
            return '';
        }

        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            $parts = [];
            foreach ($translations['word_translation'] as $pair) {
                if (!is_array($pair)) {
                    continue;
                }
                $meaning = isset($pair[1]) && is_string($pair[1]) ? trim($pair[1]) : '';
                if ($meaning === '') {
                    continue;
                }
                $tag = isset($pair[0]) && is_string($pair[0]) ? trim($pair[0]) : '';
                $parts[] = $tag !== '' ? ($tag . ' ' . $meaning) : $meaning;
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        $advanced = $translations['advanced_translate'] ?? null;
        if (is_string($advanced) && trim($advanced) !== '') {
            return trim($advanced);
        }
        if (is_array($advanced)) {
            $parts = [];
            foreach ($advanced as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $parts[] = trim($item);
                } elseif (is_array($item)) {
                    $text = isset($item[1]) && is_string($item[1]) ? trim($item[1])
                        : (isset($item[0]) && is_string($item[0]) ? trim($item[0]) : '');
                    if ($text !== '') {
                        $parts[] = $text;
                    }
                }
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        return '';
    }
}
