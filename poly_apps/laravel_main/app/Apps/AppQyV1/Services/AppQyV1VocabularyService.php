<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Database\Schema\Blueprint;
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
        $schema = Schema::connection($connection);

        $librariesTable = 'app_qy_v1_vocabulary_libraries';

        if (!$schema->hasTable($librariesTable)) {
            $schema->create($librariesTable, function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 255);
                $table->text('description')->nullable();
                $table->string('language', 50)->default('english');
                $table->integer('total_words')->default(0);
                $table->boolean('is_public')->default(true);
                $table->unsignedInteger('owner_user_id')->nullable();
                $table->string('source', 100)->nullable();
                $table->string('difficulty_level', 50)->nullable();
                $table->string('category', 100)->default('general');
                $table->text('image_url')->nullable();
                $table->boolean('is_recommended')->default(false);
                $table->text('tags')->nullable();
                $table->timestamps();

                $table->unique('source', 'uniq_vocab_lib_source');
                $table->index('language', 'idx_vocab_lib_language');
                $table->index('is_public', 'idx_vocab_lib_public');
                $table->index('owner_user_id', 'idx_vocab_lib_owner');
                $table->index('category', 'idx_vocab_lib_category');
                $table->index('is_recommended', 'idx_vocab_lib_recommended');
            });
            $results[$librariesTable] = 'created';
        } else {
            $results[$librariesTable] = 'exists';

            self::ensureColumn($schema, $librariesTable, 'category', function (Blueprint $table) {
                $table->string('category', 100)->default('general')->after('difficulty_level');
            });

            self::ensureColumn($schema, $librariesTable, 'image_url', function (Blueprint $table) {
                $table->text('image_url')->nullable()->after('category');
            });

            self::ensureColumn($schema, $librariesTable, 'is_recommended', function (Blueprint $table) {
                $table->boolean('is_recommended')->default(false)->after('image_url');
            });

            self::ensureColumn($schema, $librariesTable, 'source', function (Blueprint $table) {
                $table->string('source', 100)->nullable()->after('owner_user_id');
            });
        }

        $wordsTable = 'app_qy_v1_vocabulary_words';
        if (!$schema->hasTable($wordsTable)) {
            $schema->create($wordsTable, function (Blueprint $table) use ($librariesTable) {
                $table->increments('id');
                $table->unsignedInteger('library_id');
                $table->integer('word_index');
                $table->text('word');
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('library_id')
                    ->references('id')
                    ->on($librariesTable)
                    ->onDelete('cascade');

                $table->index('library_id', 'idx_vocab_words_library');
                $table->index('word', 'idx_vocab_words_word');
                $table->index(['library_id', 'word_index'], 'idx_vocab_words_lib_index');
            });
            $results[$wordsTable] = 'created';
        } else {
            $results[$wordsTable] = 'exists';
        }

        $userLanguagesTable = 'app_qy_v1_user_languages';
        if (!$schema->hasTable($userLanguagesTable)) {
            $schema->create($userLanguagesTable, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->string('language', 50);
                $table->string('native_language', 50)->nullable();
                $table->boolean('is_learning')->default(true);
                $table->string('proficiency_level', 50)->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'language'], 'uniq_user_language');
                $table->index('user_id', 'idx_user_lang_user');
                $table->index('is_learning', 'idx_user_lang_learning');
            });
            $results[$userLanguagesTable] = 'created';
        } else {
            $results[$userLanguagesTable] = 'exists';
        }

        $selectionsTable = 'app_qy_v1_user_vocabulary_selections';
        if (!$schema->hasTable($selectionsTable)) {
            $schema->create($selectionsTable, function (Blueprint $table) use ($librariesTable) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('library_id');
                $table->timestamp('selected_at')->useCurrent();
                $table->boolean('is_active')->default(true);
                $table->unique(['user_id', 'library_id'], 'uniq_user_library_selection');
                $table->foreign('library_id')
                    ->references('id')
                    ->on($librariesTable)
                    ->onDelete('cascade');

                $table->index('user_id', 'idx_user_vocab_sel_user');
                $table->index('is_active', 'idx_user_vocab_sel_active');
            });
            $results[$selectionsTable] = 'created';
        } else {
            $results[$selectionsTable] = 'exists';
        }

        $coversTable = 'app_qy_v1_vocabulary_covers';
        if (!$schema->hasTable($coversTable)) {
            $schema->create($coversTable, function (Blueprint $table) use ($librariesTable) {
                $table->increments('id');
                $table->unsignedInteger('library_id')->unique();
                $table->string('cover_filename', 255);
                $table->string('status', 50)->default('pending');
                $table->text('prompt')->nullable();
                $table->text('description')->nullable();
                $table->integer('priority')->default(0);
                $table->text('error_message')->nullable();
                $table->integer('width')->default(1280);
                $table->integer('height')->default(720);
                $table->timestamp('last_requested_at')->nullable();
                $table->timestamp('last_generated_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->timestamps();

                $table->foreign('library_id')
                    ->references('id')
                    ->on($librariesTable)
                    ->onDelete('cascade');

                $table->index('status', 'idx_vocab_covers_status');
                $table->index('priority', 'idx_vocab_covers_priority');
            });
            $results[$coversTable] = 'created';
        } else {
            $results[$coversTable] = 'exists';

            self::ensureColumn($schema, $coversTable, 'started_at', function (Blueprint $table) {
                $table->timestamp('started_at')->nullable()->after('last_generated_at');
            });

            self::ensureColumn($schema, $coversTable, 'finished_at', function (Blueprint $table) {
                $table->timestamp('finished_at')->nullable()->after('started_at');
            });
        }

        return $results;
    }

    private static function ensureColumn($schema, string $table, string $column, callable $definition): void
    {
        if (!$schema->hasColumn($table, $column)) {
            $schema->table($table, function (Blueprint $table) use ($definition) {
                $definition($table);
            });
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
