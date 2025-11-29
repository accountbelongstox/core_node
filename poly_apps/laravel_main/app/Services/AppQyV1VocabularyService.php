<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AppQyV1VocabularyService
{
    public static function ensureVocabularyTablesExist(): array
    {
        $results = [];
        $connection = 'appqyv1';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS app_qy_v1_vocabulary_libraries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                language VARCHAR(50) NOT NULL DEFAULT "english",
                total_words INTEGER DEFAULT 0,
                is_public INTEGER DEFAULT 1,
                owner_user_id INTEGER,
                source VARCHAR(100),
                difficulty_level VARCHAR(50),
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_language ON app_qy_v1_vocabulary_libraries(language)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_public ON app_qy_v1_vocabulary_libraries(is_public)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_vocab_lib_owner ON app_qy_v1_vocabulary_libraries(owner_user_id)
        ');

        $results['app_qy_v1_vocabulary_libraries'] = 'created';

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
        
        $vocabularyFiles = [
            'simple_words.txt' => ['name' => 'Simple Words', 'level' => 'beginner', 'source' => 'basic'],
            'highschool_edited.txt' => ['name' => 'High School Vocabulary', 'level' => 'intermediate', 'source' => 'highschool'],
            'CET6_edited.txt' => ['name' => 'CET-6 Vocabulary', 'level' => 'advanced', 'source' => 'CET6'],
            'WordList_TOEFL.txt' => ['name' => 'TOEFL Vocabulary', 'level' => 'advanced', 'source' => 'TOEFL'],
            'WordList_GRE.txt' => ['name' => 'GRE Vocabulary', 'level' => 'expert', 'source' => 'GRE'],
            'COCA20000.txt' => ['name' => 'COCA 20000', 'level' => 'comprehensive', 'source' => 'COCA'],
        ];
        
        foreach ($vocabularyFiles as $filename => $meta) {
            $filePath = $vocabDir . '/' . $filename;
            
            if (!file_exists($filePath)) {
                $results['libraries'][$filename] = 'file not found';
                continue;
            }
            
            try {
                $existing = DB::connection($connection)
                    ->table('app_qy_v1_vocabulary_libraries')
                    ->where('source', $meta['source'])
                    ->first();
                
                if ($existing) {
                    $results['libraries'][$filename] = 'already imported';
                    $results['skipped']++;
                    continue;
                }
                
                $words = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $words = array_unique(array_map('trim', $words));
                $words = array_filter($words);
                
                $libraryId = DB::connection($connection)
                    ->table('app_qy_v1_vocabulary_libraries')
                    ->insertGetId([
                        'name' => $meta['name'],
                        'description' => "Vocabulary list from {$meta['source']}",
                        'language' => 'english',
                        'total_words' => count($words),
                        'is_public' => 1,
                        'owner_user_id' => null,
                        'source' => $meta['source'],
                        'difficulty_level' => $meta['level'],
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                
                $batchSize = 1000;
                $wordIndex = 0;
                $batches = array_chunk($words, $batchSize);
                
                foreach ($batches as $batch) {
                    $insertData = [];
                    foreach ($batch as $word) {
                        $insertData[] = [
                            'library_id' => $libraryId,
                            'word_index' => $wordIndex++,
                            'word' => $word,
                            'created_at' => date('Y-m-d H:i:s'),
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
