<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

/**
 * Unified TTS Queue System Initializer
 *
 * Supports multiple task types:
 * - word: Single word TTS generation
 * - sentence: Sentence TTS generation
 * - article: Article broken into sentences for TTS
 */
class AppQyV1TTSQueueInitializer
{
    /**
     * Ensure TTS queue table exists with unified structure
     */
    public static function ensureTablesExist(): array
    {
        $connection = 'appqyv1';
        $tableName = 'appqyv1_tts_queue';

        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();

                // Task type: word, sentence, article
                $table->enum('task_type', ['word', 'sentence', 'article'])->default('word')->index();

                // Original content
                $table->text('content_text');
                $table->string('content_hash', 32)->index();

                // Language
                $table->string('language', 10)->index();

                // Status tracking
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();

                // Results
                $table->text('audio_path')->nullable();
                $table->json('audio_files')->nullable(); // For articles with multiple sentences
                $table->json('metadata')->nullable(); // Additional task-specific data

                // Timestamps
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                // Indexes
                $table->unique(['task_type', 'content_hash', 'language'], 'unique_task');
                $table->index(['status', 'priority', 'created_at'], 'queue_order');
                $table->index(['task_type', 'status'], 'type_status');
            });

            return [$tableName => 'created'];
        } else {
            // Migrate existing table if needed
            self::migrateExistingTable($connection, $tableName);
            return [$tableName => 'migrated'];
        }
    }

    /**
     * Migrate existing table to new structure
     */
    private static function migrateExistingTable(string $connection, string $tableName): void
    {
        $schema = Schema::connection($connection);

        // Check if old structure exists and needs migration
        if (!$schema->hasColumn($tableName, 'task_type')) {
            // First, make old columns nullable for backward compatibility
            DB::connection($connection)->statement("
                CREATE TABLE appqyv1_tts_queue_new AS SELECT * FROM appqyv1_tts_queue;
            ");

            DB::connection($connection)->statement("DROP TABLE appqyv1_tts_queue");

            $schema->create($tableName, function (Blueprint $table) {
                $table->id();

                // New unified structure
                $table->enum('task_type', ['word', 'sentence', 'article'])->default('word')->index();
                $table->text('content_text');
                $table->string('content_hash', 32)->index();
                $table->string('language', 10)->index();

                // Old columns (nullable for backward compatibility)
                $table->text('word')->nullable();
                $table->string('word_md5', 32)->nullable();

                // Status tracking
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();

                // Results
                $table->text('audio_path')->nullable();
                $table->json('audio_files')->nullable();
                $table->json('metadata')->nullable();

                // Timestamps
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                // Indexes
                $table->unique(['task_type', 'content_hash', 'language'], 'unique_task');
                $table->index(['status', 'priority', 'created_at'], 'queue_order');
                $table->index(['task_type', 'status'], 'type_status');
            });

            // Migrate existing data from backup table
            DB::connection($connection)->statement("
                INSERT INTO appqyv1_tts_queue
                SELECT
                    id,
                    'word' as task_type,
                    word as content_text,
                    word_md5 as content_hash,
                    language,
                    word,
                    word_md5,
                    status,
                    priority,
                    retry_count,
                    error_message,
                    audio_path,
                    NULL as audio_files,
                    NULL as metadata,
                    requested_at,
                    started_at,
                    completed_at,
                    created_at,
                    updated_at
                FROM appqyv1_tts_queue_new
            ");

            // Drop backup table
            DB::connection($connection)->statement("DROP TABLE IF EXISTS appqyv1_tts_queue_new");
        }
    }

    /**
     * Get TTS queue statistics (supports all task types)
     */
    public static function getTableStats(): array
    {
        $connection = 'appqyv1';
        $tableName = 'appqyv1_tts_queue';

        if (!Schema::connection($connection)->hasTable($tableName)) {
            return ['error' => 'Table does not exist'];
        }

        $stats = [
            'by_status' => [
                'pending' => DB::connection($connection)->table($tableName)->where('status', 'pending')->count(),
                'processing' => DB::connection($connection)->table($tableName)->where('status', 'processing')->count(),
                'completed' => DB::connection($connection)->table($tableName)->where('status', 'completed')->count(),
                'failed' => DB::connection($connection)->table($tableName)->where('status', 'failed')->count(),
            ],
            'by_type' => [
                'word' => DB::connection($connection)->table($tableName)->where('task_type', 'word')->count(),
                'sentence' => DB::connection($connection)->table($tableName)->where('task_type', 'sentence')->count(),
                'article' => DB::connection($connection)->table($tableName)->where('task_type', 'article')->count(),
            ],
            'total' => DB::connection($connection)->table($tableName)->count(),
        ];

        // For backward compatibility
        $stats['pending'] = $stats['by_status']['pending'];
        $stats['processing'] = $stats['by_status']['processing'];
        $stats['completed'] = $stats['by_status']['completed'];
        $stats['failed'] = $stats['by_status']['failed'];

        return $stats;
    }
}
