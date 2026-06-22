<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1VocabularyService
{
    /**
     * Check if vocabulary tables exist
     * Tables are created automatically by 'php artisan sys:init' command
     * This method only checks table existence, does not create tables
     *
     * Wave B consolidation: vocabulary_words and vocabulary_covers are gone
     * (membership lives in vocabulary_libraries.word_ids, covers in the
     * cover_* columns), so only the surviving tables are checked.
     * group_word_progress replaced the dropped group_words /
     * user_word_progress pair (one JSON row per user+group). The orphan
     * user_languages / user_vocabulary_selections tables were dropped
     * (superseded by users.learning_languages / user_selected_libraries).
     */
    public static function ensureVocabularyTablesExist(): array
    {
        $results = [];
        $connectionName = (new AppQyV1VocabularyLibraryModel)->getConnectionName();
        $schema = Schema::connection($connectionName);

        $appKey = AppKeys::APPQYV1;
        $tables = [
            AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'group_word_progress'),
        ];

        foreach ($tables as $tableName) {
            $exists = $schema->hasTable($tableName);
            $results[$tableName] = $exists ? 'exists' : 'missing';
        }

        return $results;
    }

    /**
     * Import the init_data vocabulary .txt files into vocabulary_libraries.
     *
     * Wave B consolidation: words go into the per-language dictionary
     * (tts_cache_{lang}) and membership into word_ids - all through
     * AppQyV1VocabularyImporter (idempotent fill-missing, keyed by source).
     * This service only contributes the filename-derived metadata.
     */
    public static function importVocabularyFromFiles(): array
    {
        $results = [
            'imported' => 0,
            'skipped' => 0,
            'errors' => 0,
            'libraries' => []
        ];

        $vocabDir = base_path('init_data/AppQyV1/VoiceStaticServer/vocabulary');

        if (!is_dir($vocabDir)) {
            $results['error'] = 'Vocabulary directory not found';
            return $results;
        }

        $files = glob($vocabDir . '/*.txt');
        if (empty($files)) {
            $results['error'] = 'No vocabulary files found';
            return $results;
        }

        $importer = new AppQyV1VocabularyImporter();

        foreach ($files as $filePath) {
            $filename = basename($filePath);
            $meta = self::buildLibraryMetadata($filename);

            try {
                // Normalize the lookup key to match the importer's canonical
                // source so this skip-check and the upsert agree on identity.
                $canonicalSource = AppQyV1VocabularyImporter::normalizeSource($meta['source']);
                $existing = AppQyV1VocabularyLibraryModel::where('source', $canonicalSource)->first();

                // Only skip when the row is ALREADY fully populated. A
                // partially-created (empty word_ids) row falls through to
                // createVocabularyCollection, which REUSES (upserts) it rather
                // than inserting a duplicate.
                if ($existing && count($existing->getWordIdsArray()) > 0) {
                    $results['libraries'][$filename] = 'already imported';
                    $results['skipped']++;
                    continue;
                }

                $words = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $words = array_values(array_unique(array_filter(array_map('trim', $words))));

                if (empty($words)) {
                    $results['libraries'][$filename] = 'no words detected';
                    $results['skipped']++;
                    continue;
                }

                $langCode = AppQyV1VocabularyLibraryModel::languageNameToCode($meta['language']);
                if ($langCode === null) {
                    $results['libraries'][$filename] = 'error: unmapped language ' . $meta['language'];
                    $results['errors']++;
                    continue;
                }

                $importResult = $importer->createVocabularyCollection(
                    $meta['name'],
                    $langCode,
                    $words,
                    'system',
                    null,
                    true,
                    $meta['description'],
                    $meta['source']
                );

                if (empty($importResult['success'])) {
                    $results['libraries'][$filename] = 'error: ' . ($importResult['error'] ?? 'unknown import failure');
                    $results['errors']++;
                    continue;
                }

                // Refresh the filename-derived metadata (the importer only
                // manages name/description/word_ids).
                AppQyV1VocabularyLibraryModel::where('id', $importResult['collection_id'])->update([
                    'name' => $meta['name'],
                    'description' => $meta['description'],
                    'category' => $meta['category'],
                    'difficulty_level' => $meta['difficulty'],
                    'image_url' => $meta['image_url'],
                    'is_recommended' => $meta['is_recommended'],
                    'tags' => json_encode($meta['tags']),
                    'updated_at' => now(),
                ]);

                $results['libraries'][$filename] = "imported {$importResult['total_words']} words";
                $results['imported']++;

            } catch (\Exception $e) {
                Log::error("[VocabService] Failed to import {$filename}: " . $e->getMessage());
                $results['libraries'][$filename] = 'error: ' . $e->getMessage();
                $results['errors']++;
            }
        }

        return $results;
    }

    private static function buildLibraryMetadata(string $filename): array
    {
        $slug = Str::of(pathinfo($filename, PATHINFO_FILENAME))->lower()->toString();
        $displayName = Str::of($slug)->replace('_', ' ')->replace('-', ' ')->title()->toString();
        $language = 'english';
        $category = 'general';
        $difficulty = 'intermediate';
        $isRecommended = false;
        $tags = [];

        if (Str::contains($slug, 'beginner') || Str::contains($slug, 'simple')) {
            $difficulty = 'beginner';
            $category = 'foundation';
            $isRecommended = true;
        } elseif (Str::contains($slug, 'high_school')) {
            $difficulty = 'intermediate';
            $category = 'academic';
            $isRecommended = true;
        } elseif (Str::contains($slug, 'coca_20000')) {
            $difficulty = 'intermediate';
            $category = 'frequency';
            $isRecommended = true;
        } elseif (Str::contains($slug, 'coca_60000')) {
            $difficulty = 'advanced';
            $category = 'frequency';
            $isRecommended = true;
        } elseif (Str::contains($slug, 'general_all')) {
            $difficulty = 'advanced';
            $category = 'frequency';
        }

        if (Str::contains($slug, 'exam') || Str::contains($slug, 'gre') || Str::contains($slug, 'toefl') || Str::contains($slug, 'cet6')) {
            $category = 'exam';
            $difficulty = 'advanced';
            $isRecommended = true;
        }

        $tags[] = $category;
        $tags[] = $difficulty;
        if ($isRecommended) {
            $tags[] = 'recommended';
        }

        $name = trim("English " . Str::of($displayName)->replace('English', '')->trim());

        return [
            'source' => $slug,
            'name' => $name !== '' ? $name : 'English Vocabulary',
            'description' => "Auto-imported vocabulary list: {$displayName}",
            'language' => $language,
            'difficulty' => $difficulty,
            'category' => $category,
            'is_recommended' => $isRecommended,
            'image_url' => null,
            'tags' => array_values(array_unique($tags)),
        ];
    }

    public static function calculateNextReviewTime(int $familiarityLevel, int $timesCorrect): string
    {
        $intervals = [
            0 => 1,
            1 => 2,
            2 => 4,
            3 => 7,
            4 => 15,
            5 => 30,
            6 => 60,
            7 => 120,
        ];

        $level = min($familiarityLevel, count($intervals) - 1);
        $days = $intervals[$level];

        if ($timesCorrect >= 5 && $familiarityLevel >= 5) {
            $days = 180;
        }

        return date('Y-m-d H:i:s', strtotime("+{$days} days"));
    }
}
