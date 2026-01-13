<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

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
     * Check if TTS queue table exists and has all required columns
     * Table is created/updated automatically by 'php artisan sys:init' command
     * This method checks table existence and structure, does not create/update tables
     */
    public static function ensureTablesExist(): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_queue');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            return [$tableName => 'missing'];
        }
        
        // Check if all required columns exist
        $requiredColumns = [
            'id', 'task_type', 'content_text', 'content_hash', 'word', 'word_md5',
            'language', 'status', 'priority', 'retry_count', 'error_message',
            'audio_path', 'audio_files', 'metadata', 'requested_at', 'started_at',
            'completed_at', 'created_at', 'updated_at'
        ];
        
        $existingColumns = Schema::connection($connection)->getColumnListing($tableName);
        $missingColumns = array_diff($requiredColumns, $existingColumns);
        
        if (!empty($missingColumns)) {
            return [$tableName => 'incomplete - missing: ' . implode(', ', $missingColumns)];
        }
        
        return [$tableName => 'exists'];
    }

    /**
     * Get TTS queue statistics (supports all task types)
     */
    public static function getTableStats(): array
    {
        $appKey = AppKeys::APPQYV1;
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1TTSQueueModel();
        
        if (!Schema::connection($model->getConnectionName())->hasTable($model->getTable())) {
            return ['error' => 'Table does not exist'];
        }
        
        $stats = [
            'by_status' => [
                'pending' => $model->where('status', 'pending')->count(),
                'processing' => $model->where('status', 'processing')->count(),
                'completed' => $model->where('status', 'completed')->count(),
                'failed' => $model->where('status', 'failed')->count(),
            ],
            'by_type' => [
                'word' => $model->where('task_type', 'word')->count(),
                'sentence' => $model->where('task_type', 'sentence')->count(),
                'article' => $model->where('task_type', 'article')->count(),
            ],
            'total' => $model->count(),
        ];

        // For backward compatibility
        $stats['pending'] = $stats['by_status']['pending'];
        $stats['processing'] = $stats['by_status']['processing'];
        $stats['completed'] = $stats['by_status']['completed'];
        $stats['failed'] = $stats['by_status']['failed'];

        return $stats;
    }
}
