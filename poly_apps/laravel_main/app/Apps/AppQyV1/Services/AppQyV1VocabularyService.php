<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AppQyV1VocabularyService
{
    public static function ensureVocabularyTablesExist(): array
    {
        $results = [];
        $connection = 'appqyv1';
        $librariesTable = 'app_qy_v1_vocabulary_libraries';

        DB::connection($connection)->statement("
            CREATE TABLE IF NOT EXISTS {$librariesTable} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                language VARCHAR(50) NOT NULL DEFAULT 'english',
                total_words INTEGER DEFAULT 0,
                is_public INTEGER DEFAULT 1,
                owner_user_id INTEGER,
                source VARCHAR(100),
                difficulty_level VARCHAR(50),
                category VARCHAR(100) DEFAULT 'general',
                image_url TEXT,
                is_recommended INTEGER DEFAULT 0,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");

        self::ensureLibraryColumn($connection, $librariesTable, 'category', "ALTER TABLE {$librariesTable} ADD COLUMN category VARCHAR(100) DEFAULT 'general'");
        self::ensureLibraryColumn($connection, $librariesTable, 'image_url', "ALTER TABLE {$librariesTable} ADD COLUMN image_url TEXT");
        self::ensureLibraryColumn($connection, $librariesTable, 'is_recommended', "ALTER TABLE {$librariesTable} ADD COLUMN is_recommended INTEGER DEFAULT 0");
        self::ensureLibraryColumn($connection, $librariesTable, 'source', "ALTER TABLE {$librariesTable} ADD COLUMN source VARCHAR(100)");

        DB::connection($connection)->statement("
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_vocab_lib_source ON {$librariesTable}(source)
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_language ON {$librariesTable}(language)
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_public ON {$librariesTable}(is_public)
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_owner ON {$librariesTable}(owner_user_id)
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_category ON {$librariesTable}(category)
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_recommended ON {$librariesTable}(is_recommended)
        ");

        $results[$librariesTable] = 'created';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS app_qy_v1_vocabulary_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                library_id INTEGER NOT NULL,
                word_index INTEGER NOT NULL,
                word TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (library_id) REFERENCES app_qy_v1_vocabulary_libraries(id) ON DELETE CASCADE
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_words_library ON app_qy_v1_vocabulary_words(library_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_words_word ON app_qy_v1_vocabulary_words(word)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_words_lib_index ON app_qy_v1_vocabulary_words(library_id, word_index)
        ');

        $results['app_qy_v1_vocabulary_words'] = 'created';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS app_qy_v1_user_languages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                language VARCHAR(50) NOT NULL,
                native_language VARCHAR(50),
                is_learning INTEGER DEFAULT 1,
                proficiency_level VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, language)
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_user_lang_user ON app_qy_v1_user_languages(user_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_user_lang_learning ON app_qy_v1_user_languages(is_learning)
        ');

        $results['app_qy_v1_user_languages'] = 'created';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS app_qy_v1_user_vocabulary_selections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                library_id INTEGER NOT NULL,
                selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                UNIQUE(user_id, library_id),
                FOREIGN KEY (library_id) REFERENCES app_qy_v1_vocabulary_libraries(id) ON DELETE CASCADE
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_user_vocab_sel_user ON app_qy_v1_user_vocabulary_selections(user_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_user_vocab_sel_active ON app_qy_v1_user_vocabulary_selections(is_active)
        ');

        $results['app_qy_v1_user_vocabulary_selections'] = 'created';

        return $results;
    }

    private static function ensureLibraryColumn(string $connection, string $table, string $column, string $statement): void
    {
        if (!Schema::connection($connection)->hasColumn($table, $column)) {
            DB::connection($connection)->statement($statement);
        }
    }
    
    public static function importVocabularyFromFiles(): array
    {
        $results = [
            'imported' => 0,
            'skipped' => 0,
            'errors' => 0,
            'libraries' => []
        ];
        
        $connection = 'appqyv1';
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
                $existing = DB::connection($connection)
                    ->table('app_qy_v1_vocabulary_libraries')
                    ->where('source', $meta['source'])
                    ->first();
                
                if ($existing) {
                    $wordsCount = DB::connection($connection)
                        ->table('app_qy_v1_vocabulary_words')
                        ->where('library_id', $existing->id)
                        ->count();
                    
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
                
                $libraryId = $existing?->id;
                $timestamps = [
                    'created_at' => now()->toDateTimeString(),
                    'updated_at' => now()->toDateTimeString(),
                ];
                
                if ($libraryId) {
                    DB::connection($connection)
                        ->table('app_qy_v1_vocabulary_libraries')
                        ->where('id', $libraryId)
                        ->update(array_merge([
                            'name' => $meta['name'],
                            'description' => $meta['description'],
                            'language' => $meta['language'],
                            'total_words' => count($words),
                            'category' => $meta['category'],
                            'difficulty_level' => $meta['difficulty'],
                            'image_url' => $meta['image_url'],
                            'is_recommended' => $meta['is_recommended'] ? 1 : 0,
                            'tags' => json_encode($meta['tags']),
                        ], $timestamps));
                    
                    DB::connection($connection)
                        ->table('app_qy_v1_vocabulary_words')
                        ->where('library_id', $libraryId)
                        ->delete();
                } else {
                    $libraryId = DB::connection($connection)
                        ->table('app_qy_v1_vocabulary_libraries')
                        ->insertGetId(array_merge([
                            'name' => $meta['name'],
                            'description' => $meta['description'],
                            'language' => $meta['language'],
                            'total_words' => count($words),
                            'is_public' => 1,
                            'owner_user_id' => null,
                            'source' => $meta['source'],
                            'difficulty_level' => $meta['difficulty'],
                            'category' => $meta['category'],
                            'image_url' => $meta['image_url'],
                            'is_recommended' => $meta['is_recommended'] ? 1 : 0,
                            'tags' => json_encode($meta['tags']),
                        ], $timestamps));
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
                            'created_at' => now()->toDateTimeString(),
                        ];
                    }
                    
                    DB::connection($connection)
                        ->table('app_qy_v1_vocabulary_words')
                        ->insert($insertData);
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
        } elseif (Str::contains($slug, 'coca_60000') || Str::contains($slug, 'general_all')) {
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
