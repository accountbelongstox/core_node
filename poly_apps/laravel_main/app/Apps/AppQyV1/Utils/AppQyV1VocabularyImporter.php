<?php

namespace App\Apps\AppQyV1\Utils;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCollectionModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyItemModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

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

    public function importVocabularyFile(string $filePath, string $collectionName, string $langCode = 'en'): array
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
            $words = array_filter(array_map('trim', $lines), function($line) {
                return !empty($line) && !str_starts_with($line, '#');
            });

            $words = array_values($words);

            if (empty($words)) {
                return [
                    'success' => false,
                    'error' => 'No valid words found in file',
                ];
            }

            return $this->createVocabularyCollection($collectionName, $langCode, $words, 'system');

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

    public function createVocabularyCollection(
        string $collectionName,
        string $langCode,
        array $words,
        string $sourceType = 'user_upload',
        ?int $ownerId = null,
        bool $isPublic = true,
        ?string $description = null
    ): array {
        try {
            DB::transaction(function () use ($collectionName, $langCode, $sourceType, $ownerId, $isPublic, $description, $words, &$ensuredCount, &$collection) {
                $existing = AppQyV1VocabularyCollectionModel::where('collection_name', $collectionName)
                    ->where('lang_code', $langCode)
                    ->where('owner_id', $ownerId)
                    ->first();

                if ($existing) {
                    $collection = $existing;
                    $collection->description = $description ?? $collection->description;
                    $collection->save();

                    AppQyV1VocabularyItemModel::where('collection_id', $collection->id)->delete();
                } else {
                    $collection = new AppQyV1VocabularyCollectionModel([
                        'collection_name' => $collectionName,
                        'lang_code' => $langCode,
                        'source_type' => $sourceType,
                        'owner_id' => $ownerId,
                        'is_public' => $isPublic,
                        'description' => $description,
                        'total_words' => count($words),
                    ]);
                    $collection->save();
                }

                AppQyV1VocabularyItemModel::createBatch($collection->id, $langCode, $words);

                $collection->updateWordCount();

                $ensuredCount = $this->ensureWordsInDictionary($langCode, $words);
            });

            return [
                'success' => true,
                'collection_id' => $collection->id,
                'collection_name' => $collectionName,
                'total_words' => count($words),
                'ensured_in_dictionary' => $ensuredCount,
            ];

        } catch (\Exception $e) {

            Log::error('[AppQyV1VocabularyImporter] Error creating collection', [
                'collection_name' => $collectionName,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function ensureWordsInDictionary(string $langCode, array $words): int
    {
        // Keep behavior (ensure all missing words exist) but avoid per-word lookups.
        // 1. Compute missing words in a single query using existing helper.
        $missingWordList = AppQyV1MultiLangDictionaryModel::findMissingEntries($langCode, $words);
        
        if (empty($missingWordList)) {
            return 0;
        }
        
        // 2. Build payload only for truly missing words.
        $missingWords = [];
        foreach ($missingWordList as $word) {
            $missingWords[] = [
                'word' => $word,
                'has_translation' => false,
                'tts_generated' => false,
            ];
        }
        
        if (!empty($missingWords)) {
            $inserted = AppQyV1MultiLangDictionaryModel::batchCreateOrUpdate($langCode, $missingWords);
            return count($inserted);
        }
        
        return 0;
    }

    public function extractWordsFromDocument(string $content, string $langCode = 'en'): array
    {
        $content = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $content);

        $words = preg_split('/\s+/', $content, -1, PREG_SPLIT_NO_EMPTY);

        $words = array_unique(array_map('trim', $words));

        $words = array_filter($words, function($word) {
            return mb_strlen($word) >= 2 && mb_strlen($word) <= 50;
        });

        return array_values($words);
    }

    public function getImportedCollections(string $langCode = null): array
    {
        $query = AppQyV1VocabularyCollectionModel::where('source_type', 'system');

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        return $query->orderBy('collection_name')->get()->toArray();
    }
}
