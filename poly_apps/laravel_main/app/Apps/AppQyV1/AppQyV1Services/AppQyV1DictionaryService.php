<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use Illuminate\Support\Facades\Log;

class AppQyV1DictionaryService
{
    /**
     * Language code mapping
     */
    private const LANGUAGE_MAP = [
        'english' => 'en',
        'chinese' => 'zh',
        'spanish' => 'es',
        'french' => 'fr',
        'german' => 'de',
        'japanese' => 'ja',
        'korean' => 'ko',
        'vietnamese' => 'vi',
        'lao' => 'lo',
    ];

    /**
     * Get language code from language name
     */
    public static function getLanguageCode(string $language): string
    {
        $normalizedLanguage = strtolower($language);
        return self::LANGUAGE_MAP[$normalizedLanguage] ?? $normalizedLanguage;
    }

    /**
     * Query words from dictionary and return their status
     * Returns array with existing words and missing words
     *
     * @param string $language Language name (e.g., 'english')
     * @param array $words Array of words to query
     * @return array ['existing' => [...], 'missing' => [...], 'untranslated' => [...]]
     */
    public static function queryWords(string $language, array $words): array
    {
        $langCode = self::getLanguageCode($language);
        $existing = [];
        $missing = [];
        $untranslated = [];

        foreach ($words as $word) {
            $wordMd5 = md5(strtolower($word));
            $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $wordMd5);

            if ($entry) {
                $existing[] = [
                    'word' => $word,
                    'md5' => $wordMd5,
                    'has_translation' => $entry->has_translation ?? false,
                    'translations' => $entry->translations,
                    'has_tts' => !empty($entry->tts_files),
                ];

                if (!$entry->has_translation || empty($entry->translations)) {
                    $untranslated[] = $word;
                }
            } else {
                $missing[] = $word;
            }
        }

        return [
            'existing' => $existing,
            'missing' => $missing,
            'untranslated' => $untranslated,
        ];
    }

    /**
     * Add words to dictionary with default status
     * All new words will be marked as untranslated
     *
     * @param string $language Language name
     * @param array $words Array of words to add
     * @return array ['added' => count, 'skipped' => count, 'failed' => count]
     */
    public static function addWords(string $language, array $words): array
    {
        $langCode = self::getLanguageCode($language);
        $added = 0;
        $skipped = 0;
        $failed = 0;

        $wordsData = [];

        foreach ($words as $word) {
            $wordMd5 = md5(strtolower($word));
            $existing = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $wordMd5);

            if ($existing) {
                $skipped++;
                continue;
            }

            $wordsData[] = [
                'content' => $word,
                'md5' => $wordMd5,
            ];
        }

        if (!empty($wordsData)) {
            try {
                $results = AppQyV1MultiLangDictionaryModel::batchCreateOrUpdate($langCode, $wordsData);
                $added = count($results);
            } catch (\Throwable $e) {
                Log::error('[AppQyV1DictionaryService] Failed to add words', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
                $failed = count($wordsData);
            }
        }

        return [
            'added' => $added,
            'skipped' => $skipped,
            'failed' => $failed,
        ];
    }

    /**
     * Query and add words in one operation
     * Returns detailed information about each word
     *
     * @param string $language Language name
     * @param array $words Array of words
     * @return array Detailed word information
     */
    public static function queryAndAdd(string $language, array $words): array
    {
        $langCode = self::getLanguageCode($language);
        $result = [];
        $missingWords = [];

        foreach ($words as $word) {
            $wordMd5 = md5(strtolower($word));
            $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $wordMd5);

            if ($entry) {
                $result[] = [
                    'word' => $word,
                    'md5' => $wordMd5,
                    'status' => 'existing',
                    'has_translation' => $entry->has_translation ?? false,
                    'has_tts' => !empty($entry->tts_files),
                    'translations' => $entry->translations,
                ];
            } else {
                $missingWords[] = [
                    'content' => $word,
                    'md5' => $wordMd5,
                ];

                $result[] = [
                    'word' => $word,
                    'md5' => $wordMd5,
                    'status' => 'new',
                    'has_translation' => false,
                    'has_tts' => false,
                    'translations' => null,
                ];
            }
        }

        if (!empty($missingWords)) {
            try {
                AppQyV1MultiLangDictionaryModel::batchCreateOrUpdate($langCode, $missingWords);
                Log::info('[AppQyV1DictionaryService] Added new words to dictionary', [
                    'language' => $langCode,
                    'count' => count($missingWords),
                ]);
            } catch (\Throwable $e) {
                Log::error('[AppQyV1DictionaryService] Failed to add new words', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $result;
    }

    /**
     * Get statistics for a language dictionary
     *
     * @param string $language Language name
     * @return array Dictionary statistics
     */
    public static function getStatistics(string $language): array
    {
        $langCode = self::getLanguageCode($language);

        $total = AppQyV1MultiLangDictionaryModel::countAll($langCode);
        $translated = AppQyV1MultiLangDictionaryModel::countByTranslation($langCode);
        $untranslated = $total - $translated;

        $needingTTS = AppQyV1MultiLangDictionaryModel::forLanguage($langCode)
            ->where(function($query) {
                $query->whereJsonLength('tts_files', '=', 0)
                    ->orWhereNull('tts_files');
            })
            ->count();

        return [
            'language' => $language,
            'language_code' => $langCode,
            'total_words' => $total,
            'translated' => $translated,
            'untranslated' => $untranslated,
            'needing_tts' => $needingTTS,
            'translation_progress' => $total > 0 ? round(($translated / $total) * 100, 2) : 0,
        ];
    }

    /**
     * Get untranslated words for a language
     *
     * @param string $language Language name
     * @param int $limit Limit
     * @return array Untranslated words
     */
    public static function getUntranslatedWords(string $language, int $limit = 100): array
    {
        $langCode = self::getLanguageCode($language);
        $words = AppQyV1MultiLangDictionaryModel::getWordsNeedingTranslation($langCode, $limit);

        $result = [];
        foreach ($words as $word) {
            $result[] = [
                'word' => $word->content,
                'md5' => $word->md5,
                'query_count' => $word->query_count ?? 0,
            ];
        }

        return $result;
    }

    /**
     * Language specific processing rules
     * Different languages may have different tokenization or processing rules
     *
     * @param string $language Language name
     * @param string $text Text to process
     * @return array Processed words
     */
    public static function processTextByLanguage(string $language, string $text): array
    {
        $langCode = self::getLanguageCode($language);

        switch ($langCode) {
            case 'en':
            case 'es':
            case 'fr':
            case 'de':
                return self::processLatinLanguage($text);

            case 'zh':
                return self::processChineseLanguage($text);

            case 'ja':
                return self::processJapaneseLanguage($text);

            case 'ko':
                return self::processKoreanLanguage($text);

            default:
                return self::processLatinLanguage($text);
        }
    }

    /**
     * Process Latin-based languages (English, Spanish, French, German, etc.)
     */
    private static function processLatinLanguage(string $text): array
    {
        $splitPattern = "/[^a-zA-Z'\-_]+/";
        $words = preg_split($splitPattern, $text, -1, PREG_SPLIT_NO_EMPTY);

        $filteredWords = [];
        foreach ($words as $word) {
            if (strlen($word) >= 2 && preg_match('/[a-zA-Z]/', $word)) {
                $filteredWords[] = strtolower($word);
            }
        }

        return array_unique($filteredWords);
    }

    /**
     * Process Chinese language
     * Note: Requires proper Chinese word segmentation library
     */
    private static function processChineseLanguage(string $text): array
    {
        return [];
    }

    /**
     * Process Japanese language
     */
    private static function processJapaneseLanguage(string $text): array
    {
        return [];
    }

    /**
     * Process Korean language
     */
    private static function processKoreanLanguage(string $text): array
    {
        return [];
    }
}
