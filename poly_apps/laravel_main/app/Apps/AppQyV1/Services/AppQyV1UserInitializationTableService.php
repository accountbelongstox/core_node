<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AppQyV1UserInitializationTableService
{
    public static function ensureTablesExist(): array
    {
        $connection = 'appqyv1';
        $results = [];
        $tableName = 'app_qy_v1_user_initializations';
        $alreadyExists = Schema::connection($connection)->hasTable($tableName);

        DB::connection($connection)->statement("
            CREATE TABLE IF NOT EXISTS {$tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                occupation VARCHAR(100),
                daily_words_target INTEGER DEFAULT 20,
                daily_study_time INTEGER DEFAULT 30,
                preferences TEXT,
                is_initialized INTEGER DEFAULT 0,
                initialization_completed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");

        DB::connection($connection)->statement("
            CREATE INDEX IF NOT EXISTS idx_app_qy_v1_user_init_user_id
            ON {$tableName}(user_id)
        ");

        $results[$tableName] = $alreadyExists ? 'exists' : 'created';

        return $results;
    }
}
