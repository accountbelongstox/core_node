<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UserSyncService
{
    const SUB_APPS = [
        'AppQyV1',
        'AwyV0',
        'VipClubV1',
        'ServerManagerV1',
        'AChatV1',
        'CodeMartV1',
        'McpV1',
        'ItToolsV1',
        'BankV1',
    ];
    
    public static function syncUserToAllApps(array $userData): array
    {
        $results = [
            'main' => false,
            'sub_apps' => [],
            'errors' => [],
        ];
        
        DB::beginTransaction();
        
        try {
            $mainUser = User::create($userData);
            $results['main'] = true;
            $results['main_user_id'] = $mainUser->id;
            
            foreach (self::SUB_APPS as $appName) {
                try {
                    $connectionName = strtolower($appName);
                    
                    if (!config("database.connections.{$connectionName}")) {
                        $results['sub_apps'][$appName] = 'skipped_no_connection';
                        continue;
                    }
                    
                    if (!self::tableExists($connectionName, 'users')) {
                        $results['sub_apps'][$appName] = 'skipped_no_table';
                        continue;
                    }
                    
                    $subAppData = array_merge($userData, [
                        'main_user_id' => $mainUser->id,
                    ]);
                    
                    DB::connection($connectionName)->table('users')->insert($subAppData);
                    
                    $results['sub_apps'][$appName] = 'success';
                    
                } catch (\Exception $e) {
                    Log::error("[UserSync] Failed to sync user to {$appName}: " . $e->getMessage());
                    $results['sub_apps'][$appName] = 'error';
                    $results['errors'][$appName] = $e->getMessage();
                }
            }
            
            DB::commit();
            
            return [
                'success' => true,
                'user' => $mainUser,
                'sync_results' => $results,
            ];
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('[UserSync] Failed to create main user: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'sync_results' => $results,
            ];
        }
    }
    
    private static function tableExists(string $connection, string $table): bool
    {
        try {
            return DB::connection($connection)
                ->getSchemaBuilder()
                ->hasTable($table);
        } catch (\Exception $e) {
            return false;
        }
    }
    
    public static function getTableStructure(string $connection, string $tableName): array
    {
        try {
            $columns = DB::connection($connection)->select("PRAGMA table_info({$tableName})");
            $structure = [];
            
            foreach ($columns as $column) {
                $structure[] = [
                    'name' => $column->name,
                    'type' => $column->type,
                    'notnull' => $column->notnull ? 'NOT NULL' : 'NULL',
                    'default' => $column->dflt_value,
                    'pk' => $column->pk ? 'PK' : '',
                ];
            }
            
            return $structure;
        } catch (\Exception $e) {
            Log::error("[TableStructure] Failed to get structure for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    public static function getTableIndexes(string $connection, string $tableName): array
    {
        try {
            $indexes = DB::connection($connection)->select("PRAGMA index_list({$tableName})");
            $indexDetails = [];
            
            foreach ($indexes as $index) {
                $indexInfo = DB::connection($connection)->select("PRAGMA index_info({$index->name})");
                $columns = array_map(fn($col) => $col->name, $indexInfo);
                
                $indexDetails[] = [
                    'name' => $index->name,
                    'unique' => $index->unique ? 'UNIQUE' : '',
                    'columns' => implode(', ', $columns),
                ];
            }
            
            return $indexDetails;
        } catch (\Exception $e) {
            Log::error("[TableIndexes] Failed to get indexes for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    public static function ensureUserTablesExist(): array
    {
        $results = [];

        if (self::tableExists('sqlite', 'users')) {
            $results['Main'] = 'exists';
        } else {
            $results['Main'] = 'skipped - will be created by migrations';
        }

        if (self::tableExists('sqlite', 'personal_access_tokens')) {
            $results['Main (personal_access_tokens)'] = 'exists';
        } else {
            $results['Main (personal_access_tokens)'] = 'skipped - will be created by migrations';
        }

        foreach (self::SUB_APPS as $appName) {
            $connectionName = strtolower($appName);

            if (!config("database.connections.{$connectionName}")) {
                $results[$appName] = 'no_connection';
                continue;
            }

            try {
                if (!self::tableExists($connectionName, 'users')) {
                    self::createUserTable($connectionName);
                    $results[$appName] = 'created';
                } else {
                    $results[$appName] = 'exists';
                }
            } catch (\Exception $e) {
                Log::error("[UserSync] Failed to create table for {$appName}: " . $e->getMessage());
                $results[$appName] = 'error: ' . $e->getMessage();
            }
        }

        return $results;
    }
    
    private static function createUserTable(string $connection): void
    {
        $config = config("database.connections.{$connection}");
        if ($config && $config['driver'] === 'sqlite') {
            $dbPath = $config['database'];
            if (!file_exists($dbPath)) {
                $dir = dirname($dbPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                touch($dbPath);
                chmod($dbPath, 0664);
            }
        }
        
        if ($connection === 'sqlite') {
            DB::connection($connection)->statement('
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(255),
                    name VARCHAR(255),
                    nickname VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    phone VARCHAR(20),
                    email_verified_at TIMESTAMP NULL,
                    password VARCHAR(255),
                    remember_token VARCHAR(100),
                    avatar TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ');
        } else {
            DB::connection($connection)->statement('
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    main_user_id INTEGER NOT NULL,
                    username VARCHAR(255),
                    name VARCHAR(255),
                    nickname VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(20),
                    email_verified_at TIMESTAMP NULL,
                    remember_token VARCHAR(100),
                    avatar TEXT,
                    credit INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ');
        }
        
        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_main_user_id ON users(main_user_id)
        ');
        
        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        ');
    }

    private static function createPersonalAccessTokensTable(string $connection): void
    {
        $config = config("database.connections.{$connection}");
        if ($config && $config['driver'] === 'sqlite') {
            $dbPath = $config['database'];
            if (!file_exists($dbPath)) {
                $dir = dirname($dbPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                touch($dbPath);
                chmod($dbPath, 0664);
            }
        }

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS personal_access_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tokenable_type VARCHAR(255) NOT NULL,
                tokenable_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                token VARCHAR(64) UNIQUE NOT NULL,
                abilities TEXT,
                last_used_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_tokenable ON personal_access_tokens(tokenable_type, tokenable_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_token ON personal_access_tokens(token)
        ');
    }

    public static function ensureTTSCacheTablesExist(): array
    {
        $results = [];
        $connection = 'appqyv1';
        
        try {
            DB::connection($connection)->statement('
                CREATE TABLE IF NOT EXISTS app_qy_v1_tts_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text_hash VARCHAR(32) UNIQUE NOT NULL,
                    text TEXT NOT NULL,
                    language VARCHAR(10) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    voice VARCHAR(100),
                    audio_path TEXT NOT NULL,
                    audio_size INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 1
                )
            ');
            
            DB::connection($connection)->statement('
                CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON app_qy_v1_tts_cache(text_hash)
            ');
            
            DB::connection($connection)->statement('
                CREATE INDEX IF NOT EXISTS idx_tts_cache_language ON app_qy_v1_tts_cache(language)
            ');
            
            DB::connection($connection)->statement('
                CREATE INDEX IF NOT EXISTS idx_tts_cache_type ON app_qy_v1_tts_cache(type)
            ');
            
            DB::connection($connection)->statement('
                CREATE INDEX IF NOT EXISTS idx_tts_cache_last_accessed ON app_qy_v1_tts_cache(last_accessed)
            ');
            
            $results['app_qy_v1_tts_cache'] = 'created';
            
        } catch (\Exception $e) {
            Log::error("[UserSync] Failed to create TTS cache table: " . $e->getMessage());
            $results['app_qy_v1_tts_cache'] = 'error: ' . $e->getMessage();
        }
        
        return $results;
    }
}
