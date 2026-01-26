<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    /**
     * Run the migrations (idempotent - preserves existing data)
     * 
     * Behavior:
     * - If table doesn't exist: Creates the table with all required columns
     * - If table exists: Checks for missing columns and adds them (preserves data)
     * - If table exists with all columns: Skips (no changes)
     */
    public function up(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'articles');
        
        // Create table if it doesn't exist (idempotent)
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('article_id', 64)->unique()->comment('Unique article identifier');
                $table->string('title')->nullable()->comment('Article title');
                $table->text('content')->comment('Article content');
                $table->string('language', 20)->default('english')->comment('Article language');
                $table->string('article_type', 50)->default('general')->comment('Article type for categorization');
                $table->string('source')->nullable()->comment('Source of the article');
                $table->string('difficulty_level', 20)->nullable()->comment('Difficulty level (beginner, intermediate, advanced)');
                $table->integer('word_count')->default(0)->comment('Total word count');
                $table->integer('unique_word_count')->default(0)->comment('Unique word count');
                $table->integer('sentence_count')->default(0)->comment('Total sentence count');
                $table->boolean('is_daily_reading')->default(false)->comment('Is this a daily reading article');
                $table->date('reading_date')->nullable()->comment('Date for daily reading');
                $table->string('task_id', 64)->nullable()->comment('Associated task ID');
                $table->boolean('tts_generated')->default(false)->comment('Whether TTS audio has been generated');
                $table->json('metadata')->nullable()->comment('Additional metadata');
                $table->timestamps();

                $table->index('article_id');
                $table->index('language');
                $table->index('article_type');
                $table->index('is_daily_reading');
                $table->index('reading_date');
                $table->index('task_id');
            });
            return; // Table created, exit early
        }
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['article_id'])) {
                $table->string('article_id', 64)->unique()->after('id')->comment('Unique article identifier');
            }
            if (!isset($columnsMap['title'])) {
                $table->string('title')->nullable()->after('article_id')->comment('Article title');
            }
            if (!isset($columnsMap['content'])) {
                $table->text('content')->after('title')->comment('Article content');
            }
            if (!isset($columnsMap['language'])) {
                $table->string('language', 20)->default('english')->index()->after('content')->comment('Article language');
            }
            if (!isset($columnsMap['article_type'])) {
                $table->string('article_type', 50)->default('general')->index()->after('language')->comment('Article type for categorization');
            }
            if (!isset($columnsMap['source'])) {
                $table->string('source')->nullable()->after('article_type')->comment('Source of the article');
            }
            if (!isset($columnsMap['difficulty_level'])) {
                $table->string('difficulty_level', 20)->nullable()->after('source')->comment('Difficulty level (beginner, intermediate, advanced)');
            }
            if (!isset($columnsMap['word_count'])) {
                $table->integer('word_count')->default(0)->after('difficulty_level')->comment('Total word count');
            }
            if (!isset($columnsMap['unique_word_count'])) {
                $table->integer('unique_word_count')->default(0)->after('word_count')->comment('Unique word count');
            }
            if (!isset($columnsMap['sentence_count'])) {
                $table->integer('sentence_count')->default(0)->after('unique_word_count')->comment('Total sentence count');
            }
            if (!isset($columnsMap['is_daily_reading'])) {
                $table->boolean('is_daily_reading')->default(false)->index()->after('sentence_count')->comment('Is this a daily reading article');
            }
            if (!isset($columnsMap['reading_date'])) {
                $table->date('reading_date')->nullable()->index()->after('is_daily_reading')->comment('Date for daily reading');
            }
            if (!isset($columnsMap['task_id'])) {
                $table->string('task_id', 64)->nullable()->index()->after('reading_date')->comment('Associated task ID');
            }
            if (!isset($columnsMap['tts_generated'])) {
                $table->boolean('tts_generated')->default(false)->after('task_id')->comment('Whether TTS audio has been generated');
            }
            if (!isset($columnsMap['metadata'])) {
                $table->json('metadata')->nullable()->after('tts_generated')->comment('Additional metadata');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('metadata');
            }
            if (!isset($columnsMap['updated_at'])) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
        
        // Ensure indexes exist (idempotent)
        $this->ensureIndexes($tableName, $columnsMap, $connection);
    }
    
    /**
     * Ensure required indexes exist (idempotent)
     */
    private function ensureIndexes(string $tableName, array $columnsMap, string $connection): void
    {
        // Get existing indexes
        $indexes = \Illuminate\Support\Facades\DB::connection($connection)->select("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='{$tableName}'");
        $indexNames = array_column($indexes, 'name');
        $indexMap = array_flip($indexNames);
        
        // Add indexes if columns exist but indexes don't
        if (isset($columnsMap['article_id']) && !isset($indexMap['app_qy_v1_articles_article_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_article_id_index ON {$tableName}(article_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['language']) && !isset($indexMap['app_qy_v1_articles_language_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_language_index ON {$tableName}(language)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['article_type']) && !isset($indexMap['app_qy_v1_articles_article_type_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_article_type_index ON {$tableName}(article_type)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['is_daily_reading']) && !isset($indexMap['app_qy_v1_articles_is_daily_reading_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_is_daily_reading_index ON {$tableName}(is_daily_reading)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['reading_date']) && !isset($indexMap['app_qy_v1_articles_reading_date_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_reading_date_index ON {$tableName}(reading_date)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['task_id']) && !isset($indexMap['app_qy_v1_articles_task_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_articles_task_id_index ON {$tableName}(task_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'articles');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
