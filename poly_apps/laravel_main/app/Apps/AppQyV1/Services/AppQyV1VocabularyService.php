<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyWordModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1VocabularyService
{
    /**
     * Check if vocabulary tables exist
     * Tables are created automatically by 'php artisan sys:init' command
     * This method only checks table existence, does not create tables
     */
    public static function ensureVocabularyTablesExist(): array
    {
        $results = [];
        $connectionName = (new AppQyV1VocabularyLibraryModel)->getConnectionName();
        $schema = Schema::connection($connectionName);

        $appKey = AppKeys::APPQYV1;
        $tables = [
            AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_words'),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'user_languages'),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'user_vocabulary_selections'),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_covers'),
        ];

        foreach ($tables as $tableName) {
            $exists = $schema->hasTable($tableName);
            $results[$tableName] = $exists ? 'exists' : 'missing';
        }

        return $results;
    }
    
    public static function importVocabularyFromFiles(): array
    {
        $results = [
            'imported' => 0,
            'skipped' => 0,
            'errors' => 0,
            'libraries' => []
        ];
        
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
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
        
        foreach ($files as $filePath) {
            $filename = basename($filePath);
            $meta = self::buildLibraryMetadata($filename);
            
            try {
                $existing = AppQyV1VocabularyLibraryModel::where('source', $meta['source'])->first();
                
                if ($existing) {
                    $wordsCount = AppQyV1VocabularyWordModel::where('library_id', $existing->id)->count();
                    
                    if ($wordsCount > 0) {
                        $results['libraries'][$filename] = 'already imported';
                        $results['skipped']++;
                        continue;
                    }
                }
                
                $words = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $words = array_values(array_unique(array_filter(array_map('trim', $words))));
                
                if (empty($words)) {
                    $results['libraries'][$filename] = 'no words detected';
                    $results['skipped']++;
                    continue;
                }
                
                if ($existing) {
                    $existing->update([
                        'name' => $meta['name'],
                        'description' => $meta['description'],
                        'language' => $meta['language'],
                        'total_words' => count($words),
                        'category' => $meta['category'],
                        'difficulty_level' => $meta['difficulty'],
                        'image_url' => $meta['image_url'],
                        'is_recommended' => $meta['is_recommended'],
                        'tags' => $meta['tags'],
                    ]);
                    
                    AppQyV1VocabularyWordModel::where('library_id', $existing->id)->delete();
                    $libraryId = $existing->id;
                } else {
                    $library = AppQyV1VocabularyLibraryModel::create([
                        'name' => $meta['name'],
                        'description' => $meta['description'],
                        'language' => $meta['language'],
                        'total_words' => count($words),
                        'is_public' => true,
                        'owner_user_id' => null,
                        'source' => $meta['source'],
                        'difficulty_level' => $meta['difficulty'],
                        'category' => $meta['category'],
                        'image_url' => $meta['image_url'],
                        'is_recommended' => $meta['is_recommended'],
                        'tags' => $meta['tags'],
                    ]);
                    $libraryId = $library->id;
                }
                
                $batchSize = 1000;
                $wordIndex = 0;
                
                foreach (array_chunk($words, $batchSize) as $batch) {
                    $insertData = [];
                    foreach ($batch as $word) {
                        $insertData[] = [
                            'library_id' => $libraryId,
                            'word_index' => $wordIndex++,
                            'word' => $word,
                            'created_at' => now(),
                        ];
                    }
                    
                    AppQyV1VocabularyWordModel::insert($insertData);
                }
                
                $results['libraries'][$filename] = "imported {$wordIndex} words";
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
