<?php

namespace App\Apps\AppQyV1\Utils;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Support\Facades\Log;

/**
 * Vocabulary importer - Wave A consolidated shape.
 *
 * Words live ONLY in the per-language dictionary tables
 * (app_qy_v1_tts_cache_{lang}); membership lives ONLY in
 * vocabulary_libraries.word_ids (ordered JSON array of dictionary ids).
 * This importer never writes vocabulary_collections / vocabulary_items
 * (both dropped by AppQyV1_2026_06_12_150002).
 *
 * Idempotency: libraries are keyed by their unique `source`. Re-imports
 * refresh word_ids fill-missing style - new words are appended, existing
 * ids are NEVER removed (word_ids never shrinks).
 */
class AppQyV1VocabularyImporter
{
    private $vocabularyDataDir;

    public function __construct()
    {
        $baseDir = base_path('init_data/AppQyV1/VoiceStaticServer/vocabulary');
        $this->vocabularyDataDir = $baseDir;
    }

    public function importAllVocabularies(string $langCode = 'en'): array
    {
        $results = [];

        if (!is_dir($this->vocabularyDataDir)) {
            return [
                'success' => false,
                'error' => 'Vocabulary data directory not found: ' . $this->vocabularyDataDir,
            ];
        }

        $files = glob($this->vocabularyDataDir . '/*.txt');

        foreach ($files as $file) {
            $filename = basename($file, '.txt');
            $result = $this->importVocabularyFile($file, $filename, $langCode);
            $results[$filename] = $result;
        }

        return [
            'success' => true,
            'imported' => count($results),
            'details' => $results,
        ];
    }

    /**
     * Import one init_data .txt file into a vocabulary_libraries row.
     * `source` stays the filename-based unique key (matches the 8 live
     * system libraries: english_coca_20000 etc.), so re-runs refresh the
     * existing row instead of duplicating it.
     */
    public function importVocabularyFile(string $filePath, string $sourceName, string $langCode = 'en'): array
    {
        if (!file_exists($filePath)) {
            return [
                'success' => false,
                'error' => 'File not found: ' . $filePath,
            ];
        }

        try {
            $content = file_get_contents($filePath);
            if ($content === false) {
                return [
                    'success' => false,
                    'error' => 'Failed to read file: ' . $filePath,
                ];
            }

            $lines = explode("\n", $content);
            $words = array_filter(array_map('trim', $lines), function ($line) {
                return !empty($line) && !str_starts_with($line, '#');
            });

            $words = array_values($words);

            if (empty($words)) {
                return [
                    'success' => false,
                    'error' => 'No valid words found in file',
                ];
            }

            $displayName = ucwords(str_replace('_', ' ', $sourceName));

            return $this->createVocabularyCollection(
                $displayName,
                $langCode,
                $words,
                'system',
                null,
                true,
                null,
                strtolower($sourceName)
            );
        } catch (\Exception $e) {
            Log::error('[AppQyV1VocabularyImporter] Error importing file', [
                'file' => $filePath,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Create or refresh a vocabulary LIBRARY from a word list.
     *
     * Legacy method name kept so the upload/document controllers stay
     * call-compatible. NOTE: the returned `collection_id` key now carries the
     * vocabulary_libraries id (collections were merged into libraries by the
     * Wave A conversion; the response shape stays byte-compatible).
     *
     * `$source` is the unique idempotency key. When null it is derived:
     *  - system imports: lowercased name
     *  - user uploads: unique per (owner, language, name)
     */
    /**
     * Normalize an explicitly-provided source to the canonical, comparable form:
     * trimmed + lowercased. Keeps the import upsert and the read-side dedup
     * (AppQyV1VocabularyLibraryPublicController::canonicalLibraryKey) in
     * agreement on what "the same library" means.
     */
    public static function normalizeSource(string $source): string
    {
        return mb_strtolower(trim($source));
    }

    /**
     * Derive the canonical NOT-NULL `source` idempotency key when a caller does
     * not supply one. Deterministic so a re-import always targets the SAME row:
     *  - system imports: slugified name (lowercase, non-alnum -> single '_').
     *  - user uploads:   unique per (owner, language, name) via an md5 of the
     *    normalized name, prefixed with owner + language so different users /
     *    languages never collide.
     *
     * Never returns an empty string (falls back to a language-scoped hash), so a
     * row created through this path can never have a blank source.
     */
    public static function canonicalSource(
        string $sourceType,
        string $collectionName,
        string $langCode,
        ?int $ownerId = null
    ): string {
        $langCode = mb_strtolower(trim($langCode));
        $normalizedName = mb_strtolower(trim($collectionName));

        if ($sourceType === 'system') {
            // Slugify: collapse any run of non-alphanumeric chars to one '_'.
            $slug = preg_replace('/[^a-z0-9]+/u', '_', $normalizedName);
            $slug = trim((string) $slug, '_');
            if ($slug === '') {
                $slug = 'lib_' . md5($normalizedName . '|' . $langCode);
            }
            return $slug;
        }

        $ownerKey = '0';
        if ($ownerId !== null) {
            $ownerKey = (string) $ownerId;
        }
        return 'user_' . $ownerKey . '_' . $langCode . '_' . md5($normalizedName);
    }

    public function createVocabularyCollection(
        string $collectionName,
        string $langCode,
        array $words,
        string $sourceType = 'user_upload',
        ?int $ownerId = null,
        bool $isPublic = true,
        ?string $description = null,
        ?string $source = null
    ): array {
        $langCode = strtolower($langCode);
        $langName = AppQyV1VocabularyLibraryModel::languageCodeToName($langCode);
        if ($langName === null) {
            return [
                'success' => false,
                'error' => 'Unsupported language code: ' . $langCode,
            ];
        }

        // Canonical NOT-NULL idempotency key. A blank/whitespace-only $source is
        // treated as "not provided" so a caller passing '' can never create a
        // row whose source defeats the unique constraint.
        if ($source === null || trim($source) === '') {
            $source = self::canonicalSource($sourceType, $collectionName, $langCode, $ownerId);
        } else {
            $source = self::normalizeSource($source);
        }

        try {
            $library = null;
            $ensuredCount = 0;
            $appended = 0;

            AppQyV1VocabularyLibraryModel::runInTransaction(function () use ($collectionName, $langCode, $langName, $sourceType, $ownerId, $isPublic, $description, $source, $words, &$library, &$ensuredCount, &$appended) {
                // Upsert by canonical source first. As a safety net for legacy
                // rows created before the NOT-NULL backfill (source NULL/blank),
                // also adopt a same name+language row so the importer REUSES and
                // populates it instead of inserting a second one. Whichever row is
                // adopted gets its source normalized to the canonical key.
                $library = AppQyV1VocabularyLibraryModel::findBySource($source);

                if (!$library) {
                    $library = AppQyV1VocabularyLibraryModel::findLegacyWithoutSource(
                        $langName,
                        $collectionName
                    );
                    if ($library) {
                        $library->source = $source;
                    }
                }

                if (!$library) {
                    $library = new AppQyV1VocabularyLibraryModel([
                        'name' => $collectionName,
                        'description' => $description,
                        'language' => $langName,
                        'total_words' => 0,
                        'is_public' => $isPublic,
                        'owner_user_id' => $ownerId,
                        'source' => $source,
                        'category' => 'general',
                        'word_ids' => [],
                    ]);
                    $library->saveRecord();
                } elseif ($description !== null && $library->description === null) {
                    $library->description = $description;
                }

                $deduped = $this->dedupeWords($words);
                $ensuredCount = $this->ensureWordsInDictionary($langCode, $deduped);
                $ids = $this->resolveDictionaryIds($langCode, $deduped);

                // Fill-missing, never shrink: append unseen dictionary ids,
                // keep every existing id and the existing order.
                $wordIds = $library->getWordIdsArray();
                $existingSet = array_flip($wordIds);
                foreach ($ids as $id) {
                    if (isset($existingSet[$id])) {
                        continue;
                    }
                    $wordIds[] = $id;
                    $existingSet[$id] = true;
                    $appended++;
                }

                $library->word_ids = $wordIds;
                $library->total_words = count($wordIds);
                $library->saveRecord();
            });

            return [
                'success' => true,
                // Library id under the legacy key (see method docblock).
                'collection_id' => $library->id,
                'collection_name' => $collectionName,
                'total_words' => (int) $library->total_words,
                'ensured_in_dictionary' => $ensuredCount,
            ];
        } catch (\Exception $e) {
            Log::error('[AppQyV1VocabularyImporter] Error creating library', [
                'collection_name' => $collectionName,
                'source' => $source,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Idempotently APPEND words to an existing library's word_ids.
     *
     * Legacy method name kept ($collectionId is a vocabulary_libraries id).
     * Words already present (by dictionary id) are skipped; new words are
     * appended after the current last index. word_ids never shrinks.
     *
     * @return array ['success' => bool, 'added' => int, 'skipped' => int, ...] or ['success' => false, 'error' => string]
     */
    public function addWordsToCollection(int $collectionId, string $langCode, array $words): array
    {
        try {
            $added = 0;
            $skipped = 0;
            $ensuredCount = 0;

            $langCode = strtolower($langCode);

            AppQyV1VocabularyLibraryModel::runInTransaction(function () use ($collectionId, $langCode, $words, &$added, &$skipped, &$ensuredCount) {
                $library = AppQyV1VocabularyLibraryModel::findById($collectionId);
                if (!$library) {
                    throw new \RuntimeException('Library not found: ' . $collectionId);
                }

                $deduped = $this->dedupeWords($words);
                if (empty($deduped)) {
                    return;
                }

                $ensuredCount = $this->ensureWordsInDictionary($langCode, $deduped);
                $ids = $this->resolveDictionaryIds($langCode, $deduped);

                $wordIds = $library->getWordIdsArray();
                $existingSet = array_flip($wordIds);
                foreach ($ids as $id) {
                    if (isset($existingSet[$id])) {
                        $skipped++;
                        continue;
                    }
                    $wordIds[] = $id;
                    $existingSet[$id] = true;
                    $added++;
                }

                if ($added > 0) {
                    $library->word_ids = $wordIds;
                    $library->total_words = count($wordIds);
                    $library->saveRecord();
                }
            });

            return [
                'success' => true,
                'collection_id' => $collectionId,
                'added' => $added,
                'skipped' => $skipped,
                'ensured_in_dictionary' => $ensuredCount,
            ];
        } catch (\Exception $e) {
            Log::error('[AppQyV1VocabularyImporter] Error adding words to library', [
                'collection_id' => $collectionId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Dedupe a word list by normalized identity (trim + lowercase), keeping
     * the FIRST occurrence's original casing and the input order. The
     * original casing is what gets md5-keyed in the dictionary.
     */
    private function dedupeWords(array $words): array
    {
        $deduped = [];
        $seen = [];
        foreach ($words as $word) {
            $word = trim((string) $word);
            if ($word === '') {
                continue;
            }
            $normalized = mb_strtolower($word);
            if (isset($seen[$normalized])) {
                continue;
            }
            $seen[$normalized] = true;
            $deduped[] = $word;
        }
        return $deduped;
    }

    /**
     * Resolve already-deduped words to their tts_cache_{lang} ids, preserving
     * input order. Batched md5 lookups only (no per-word queries). Words must
     * have been ensured in the dictionary first (ensureWordsInDictionary).
     */
    private function resolveDictionaryIds(string $langCode, array $words): array
    {
        if (empty($words)) {
            return [];
        }

        $table = AppQyV1TableMaps::getDictionaryTableName($langCode);

        $md5List = [];
        foreach ($words as $word) {
            $md5List[] = md5($word);
        }

        $md5ToId = AppQyV1LangDictionaryModel::idMapByHashes($langCode, $md5List);

        $ids = [];
        foreach ($md5List as $md5) {
            if (!isset($md5ToId[$md5])) {
                // ensureWordsInDictionary ran in the same transaction, so a
                // miss means a real write failure - surface it.
                throw new \RuntimeException("Dictionary id unresolved for md5 {$md5} in {$table}");
            }
            $ids[] = $md5ToId[$md5];
        }

        return $ids;
    }

    private function ensureWordsInDictionary(string $langCode, array $words): int
    {
        // Unified: ensure missing words exist in the canonical
        // tts_cache_{lang} table (single source of truth), keyed by md5(content).
        $byMd5 = [];
        foreach ($words as $word) {
            $byMd5[md5($word)] = $word;
        }

        if (empty($byMd5)) {
            return 0;
        }

        $existing = AppQyV1LangDictionaryModel::existingHashes($langCode, array_keys($byMd5));

        $missingMd5 = array_diff(array_keys($byMd5), $existing);
        if (empty($missingMd5)) {
            return 0;
        }

        $now = now();
        $rows = [];
        foreach ($missingMd5 as $md5) {
            $rows[] = [
                'content' => $byMd5[$md5],
                'md5' => $md5,
                'has_translation' => false,
                'has_audio' => false,
                'query_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $inserted = AppQyV1LangDictionaryModel::insertRows($langCode, $rows);

        // New rows change the dictionary count -> invalidate cached metrics.
        if ($inserted > 0) {
            AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

        return $inserted;
    }

    public function extractWordsFromDocument(string $content, string $langCode = 'en'): array
    {
        $content = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $content);

        $words = preg_split('/\s+/', $content, -1, PREG_SPLIT_NO_EMPTY);

        $words = array_unique(array_map('trim', $words));

        $words = array_filter($words, function ($word) {
            return mb_strlen($word) >= 2 && mb_strlen($word) <= 50;
        });

        return array_values($words);
    }

    /**
     * System-imported libraries (legacy method name kept; collections were
     * merged into vocabulary_libraries by the Wave A conversion).
     */
    public function getImportedCollections(?string $langCode = null): array
    {
        return AppQyV1VocabularyLibraryModel::systemImportedRows($langCode);
    }
}
