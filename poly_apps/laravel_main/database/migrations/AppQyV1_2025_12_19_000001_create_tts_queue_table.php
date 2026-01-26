<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_queue');
        
        // Create table if it doesn't exist
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('task_type', 50)->default('word')->index()->comment('Task type: word, sentence, article');
                $table->text('content_text')->nullable()->comment('Original content text');
                $table->string('content_hash', 64)->nullable()->index()->comment('MD5 hash of content');
                $table->string('word', 255)->nullable()->index()->comment('Word (for word type tasks)');
                $table->string('word_md5', 32)->nullable()->index()->comment('Word MD5 (for word type tasks)');
                $table->string('language', 10)->index();
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();
                $table->string('audio_path')->nullable()->comment('Single audio file path');
                $table->json('audio_files')->nullable()->comment('Multiple audio files (for article/sentence tasks)');
                $table->json('metadata')->nullable()->comment('Additional metadata');
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->unique(['content_hash', 'language', 'task_type'], 'unique_content_lang_type');
                $table->index(['status', 'priority', 'created_at']);
                $table->index(['task_type', 'status']);
            });
            return;
        }
        
        // Table exists, check and add missing columns (idempotent)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            // Add task_type if missing
            if (!isset($columnsMap['task_type'])) {
                $table->string('task_type', 50)->default('word')->index()->after('id')->comment('Task type: word, sentence, article');
            }
            
            // Add content_text if missing
            if (!isset($columnsMap['content_text'])) {
                $table->text('content_text')->nullable()->after('task_type')->comment('Original content text');
            }
            
            // Add content_hash if missing
            if (!isset($columnsMap['content_hash'])) {
                $table->string('content_hash', 64)->nullable()->index()->after('content_text')->comment('MD5 hash of content');
            }
            
            // Add audio_files if missing
            if (!isset($columnsMap['audio_files'])) {
                $table->json('audio_files')->nullable()->after('audio_path')->comment('Multiple audio files (for article/sentence tasks)');
            }
            
            // Add metadata if missing
            if (!isset($columnsMap['metadata'])) {
                $table->json('metadata')->nullable()->after('audio_files')->comment('Additional metadata');
            }
        });
        
        // Ensure indexes exist (idempotent)
        $this->ensureIndexes($connection, $tableName, $columnsMap);
    }
    
    /**
     * Ensure required indexes exist (idempotent)
     */
    private function ensureIndexes(string $connection, string $tableName, array $columnsMap): void
    {
        // Get existing indexes
        $indexes = \Illuminate\Support\Facades\DB::connection($connection)->select("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='{$tableName}'");
        $indexNames = array_column($indexes, 'name');
        $indexMap = array_flip($indexNames);
        
        // Add unique constraint if content_hash exists but unique index doesn't
        if (isset($columnsMap['content_hash']) && !isset($indexMap['unique_content_lang_type'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE UNIQUE INDEX IF NOT EXISTS unique_content_lang_type ON {$tableName}(content_hash, language, task_type) WHERE content_hash IS NOT NULL"
                );
            } catch (\Exception $e) {
                // Index might already exist with different name, skip
            }
        }
        
        // Add task_type index if column exists but index doesn't
        if (isset($columnsMap['task_type']) && !isset($indexMap['tts_queue_task_type_status_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS tts_queue_task_type_status_index ON {$tableName}(task_type, status)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    public function down(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_queue');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
