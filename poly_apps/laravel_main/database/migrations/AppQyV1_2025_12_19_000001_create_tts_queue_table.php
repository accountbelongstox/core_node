<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
        
        // Create table if it doesn't exist
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
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
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($this->connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($this->connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['task_type'])) {
                $table->string('task_type', 50)->default('word')->index()->after('id')->comment('Task type: word, sentence, article');
            }
            if (!isset($columnsMap['content_text'])) {
                $table->text('content_text')->nullable()->after('task_type')->comment('Original content text');
            }
            if (!isset($columnsMap['content_hash'])) {
                $table->string('content_hash', 64)->nullable()->index()->after('content_text')->comment('MD5 hash of content');
            }
            if (!isset($columnsMap['word'])) {
                $table->string('word', 255)->nullable()->index()->after('content_hash')->comment('Word (for word type tasks)');
            }
            if (!isset($columnsMap['word_md5'])) {
                $table->string('word_md5', 32)->nullable()->index()->after('word')->comment('Word MD5 (for word type tasks)');
            }
            if (!isset($columnsMap['language'])) {
                $table->string('language', 10)->index()->after('word_md5');
            }
            if (!isset($columnsMap['status'])) {
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index()->after('language');
            }
            if (!isset($columnsMap['priority'])) {
                $table->integer('priority')->default(0)->index()->after('status');
            }
            if (!isset($columnsMap['retry_count'])) {
                $table->integer('retry_count')->default(0)->after('priority');
            }
            if (!isset($columnsMap['error_message'])) {
                $table->text('error_message')->nullable()->after('retry_count');
            }
            if (!isset($columnsMap['audio_path'])) {
                $table->string('audio_path')->nullable()->after('error_message')->comment('Single audio file path');
            }
            if (!isset($columnsMap['audio_files'])) {
                $table->json('audio_files')->nullable()->after('audio_path')->comment('Multiple audio files (for article/sentence tasks)');
            }
            if (!isset($columnsMap['metadata'])) {
                $table->json('metadata')->nullable()->after('audio_files')->comment('Additional metadata');
            }
            if (!isset($columnsMap['requested_at'])) {
                $table->timestamp('requested_at')->nullable()->after('metadata');
            }
            if (!isset($columnsMap['started_at'])) {
                $table->timestamp('started_at')->nullable()->after('requested_at');
            }
            if (!isset($columnsMap['completed_at'])) {
                $table->timestamp('completed_at')->nullable()->after('started_at');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('completed_at');
            }
            if (!isset($columnsMap['updated_at'])) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
        
        // Ensure indexes exist (idempotent)
        $this->ensureIndexes($tableName, $columnsMap);
    }
    
    /**
     * Ensure required indexes exist (idempotent)
     */
    private function ensureIndexes(string $tableName, array $columnsMap): void
    {
        // Get existing indexes
        $indexes = \Illuminate\Support\Facades\DB::connection($this->connection)->select("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='{$tableName}'");
        $indexNames = array_column($indexes, 'name');
        $indexMap = array_flip($indexNames);
        
        // Add unique constraint if content_hash exists but unique index doesn't
        if (isset($columnsMap['content_hash']) && !isset($indexMap['unique_content_lang_type'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($this->connection)->statement(
                    "CREATE UNIQUE INDEX IF NOT EXISTS unique_content_lang_type ON {$tableName}(content_hash, language, task_type) WHERE content_hash IS NOT NULL"
                );
            } catch (\Exception $e) {
                // Index might already exist with different name, skip
            }
        }
        
        // Add task_type index if column exists but index doesn't
        if (isset($columnsMap['task_type']) && !isset($indexMap['tts_queue_task_type_status_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($this->connection)->statement(
                    "CREATE INDEX IF NOT EXISTS tts_queue_task_type_status_index ON {$tableName}(task_type, status)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    public function down(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
