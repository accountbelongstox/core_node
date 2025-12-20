<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

class AppQyV1TTSQueueInitializer
{
    /**
     * Ensure TTS queue table exists
     */
    public static function ensureTablesExist(): array
    {
        $connection = 'appqyv1';
        $tableName = 'appqyv1_tts_queue';

        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('word', 255)->index();
                $table->string('word_md5', 32)->index();
                $table->string('language', 10)->index();
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();
                $table->string('audio_path')->nullable();
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->unique(['word_md5', 'language']);
                $table->index(['status', 'priority', 'created_at']);
            });

            return [$tableName => 'created'];
        }

        return [$tableName => 'exists'];
    }

    /**
     * Get TTS queue statistics
     */
    public static function getTableStats(): array
    {
        $connection = 'appqyv1';
        $tableName = 'appqyv1_tts_queue';

        if (!Schema::connection($connection)->hasTable($tableName)) {
            return ['error' => 'Table does not exist'];
        }

        $stats = [
            'pending' => DB::connection($connection)->table($tableName)->where('status', 'pending')->count(),
            'processing' => DB::connection($connection)->table($tableName)->where('status', 'processing')->count(),
            'completed' => DB::connection($connection)->table($tableName)->where('status', 'completed')->count(),
            'failed' => DB::connection($connection)->table($tableName)->where('status', 'failed')->count(),
            'total' => DB::connection($connection)->table($tableName)->count(),
        ];

        return $stats;
    }
}
