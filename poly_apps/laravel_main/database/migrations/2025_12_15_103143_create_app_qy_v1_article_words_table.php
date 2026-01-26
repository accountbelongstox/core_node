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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'article_words');
        
        // Create table if it doesn't exist (idempotent)
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('article_id', 64)->comment('Article ID reference');
                $table->string('word_md5', 32)->comment('Word MD5 from dictionary');
                $table->string('word', 255)->comment('The actual word text');
                $table->string('language', 20)->comment('Word language');
                $table->integer('frequency')->default(1)->comment('Frequency of word in article');
                $table->boolean('is_new_for_user')->default(false)->comment('Is this a new word for the user');
                $table->timestamps();

                $table->index('article_id');
                $table->index('word_md5');
                $table->index('language');
                $table->unique(['article_id', 'word_md5']);
            });
            return; // Table created, exit early
        }
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['article_id'])) {
                $table->string('article_id', 64)->index()->after('id')->comment('Article ID reference');
            }
            if (!isset($columnsMap['word_md5'])) {
                $table->string('word_md5', 32)->index()->after('article_id')->comment('Word MD5 from dictionary');
            }
            if (!isset($columnsMap['word'])) {
                $table->string('word', 255)->after('word_md5')->comment('The actual word text');
            }
            if (!isset($columnsMap['language'])) {
                $table->string('language', 20)->index()->after('word')->comment('Word language');
            }
            if (!isset($columnsMap['frequency'])) {
                $table->integer('frequency')->default(1)->after('language')->comment('Frequency of word in article');
            }
            if (!isset($columnsMap['is_new_for_user'])) {
                $table->boolean('is_new_for_user')->default(false)->after('frequency')->comment('Is this a new word for the user');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('is_new_for_user');
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
        if (isset($columnsMap['article_id']) && !isset($indexMap['app_qy_v1_article_words_article_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_article_words_article_id_index ON {$tableName}(article_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['word_md5']) && !isset($indexMap['app_qy_v1_article_words_word_md5_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_article_words_word_md5_index ON {$tableName}(word_md5)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['language']) && !isset($indexMap['app_qy_v1_article_words_language_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS app_qy_v1_article_words_language_index ON {$tableName}(language)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        // Add unique constraint if both columns exist but unique index doesn't
        if (isset($columnsMap['article_id']) && isset($columnsMap['word_md5']) && !isset($indexMap['app_qy_v1_article_words_article_id_word_md5_unique'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE UNIQUE INDEX IF NOT EXISTS app_qy_v1_article_words_article_id_word_md5_unique ON {$tableName}(article_id, word_md5)"
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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'article_words');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
