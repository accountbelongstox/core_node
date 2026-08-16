<?php

namespace App\Services;

use App\Models\User;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

class UserSyncService
{
    /**
     * Get all sub-app keys from AppKeys constants
     * 
     * @return array
     */
    public static function getSubAppKeys(): array
    {
        return AppKeys::all();
    }
    
    public static function syncUserToAllApps(array $userData): array
    {
        $results = [
            'main' => false,
            'sub_apps' => [],
            'errors' => [],
        ];
        
        // Canonical-identity model: the user exists ONCE in the main `users`
        // table. There is no fan-out write to per-sub-app `users` tables
        // (that duplication is removed). Kept for backward compatibility.
        User::beginModelTransaction();

        try {
            $mainUser = User::createRecord($userData);
            $results['main'] = true;
            $results['main_user_id'] = $mainUser->id;

            User::commitModelTransaction();

            return [
                'success' => true,
                'user' => $mainUser,
                'sync_results' => $results,
            ];

        } catch (\Exception $e) {
            User::rollBackModelTransaction();
            
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
            return Schema::connection($connection)->hasTable($table);
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * List tables matching a SQL-LIKE pattern using Laravel's NATIVE, driver
     * agnostic Schema builder (no raw sqlite_master / pg_catalog SQL). Returns
     * row objects each exposing a ->name property, so existing callers are
     * unchanged. Accepts a connection name or a Connection instance.
     */
    public static function listTablesLike($connection, string $likePattern): array
    {
        $connectionName = is_string($connection) ? $connection : $connection->getName();

        $names = Schema::connection($connectionName)->getTableListing();

        // Normalize possibly schema-qualified names (pgsql may return
        // "public.table") down to the bare table name.
        $names = array_map(static function ($name) {
            $pos = strrpos($name, '.');
            return $pos === false ? $name : substr($name, $pos + 1);
        }, $names);

        // Translate the SQL LIKE pattern to a shell glob (only '%' is used by our
        // callers) and filter in PHP -- keeps this fully Schema-native.
        $glob = str_replace('%', '*', $likePattern);
        $matched = array_values(array_filter($names, static fn ($name) => fnmatch($glob, $name)));
        sort($matched);

        return array_map(static fn ($name) => (object) ['name' => $name], $matched);
    }

    public static function getTableStructure(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);

            if (!$schema->hasTable($tableName)) {
                return [];
            }

            // ONE driver-agnostic path: Laravel's native getColumns() works
            // identically on sqlite + pgsql (no PRAGMA / information_schema).
            // It returns ['name','type_name','type','nullable'(bool),'default',
            // 'auto_increment'(bool),...]; map those onto the legacy shape that
            // InitializeApps relies on: ['name','type','notnull','default','pk'].
            $primaryKeyColumns = self::primaryKeyColumns($schema, $tableName);

            $structure = [];
            foreach ($schema->getColumns($tableName) as $column) {
                $structure[] = [
                    'name' => $column['name'],
                    'type' => $column['type'] ?? ($column['type_name'] ?? ''),
                    'notnull' => empty($column['nullable']) ? 'NOT NULL' : 'NULL',
                    'default' => $column['default'] ?? null,
                    'pk' => in_array($column['name'], $primaryKeyColumns, true) ? 'PK' : '',
                ];
            }

            return $structure;
        } catch (\Exception $e) {
            Log::error("[TableStructure] Failed to get structure for {$tableName}: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Resolve the primary-key column names for a table via the native
     * getIndexes() metadata (the index flagged primary). Driver-agnostic.
     */
    private static function primaryKeyColumns($schema, string $tableName): array
    {
        foreach ($schema->getIndexes($tableName) as $index) {
            if (!empty($index['primary'])) {
                return $index['columns'] ?? [];
            }
        }

        return [];
    }

    public static function getTableIndexes(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);

            if (!$schema->hasTable($tableName)) {
                return [];
            }

            // ONE driver-agnostic path: native getIndexes() returns
            // ['name','columns'(list),'type','unique'(bool),'primary'(bool)]
            // on both sqlite + pgsql. Map onto the legacy shape the callers
            // expect: ['name','unique','columns'(comma-joined string)].
            $indexDetails = [];
            foreach ($schema->getIndexes($tableName) as $index) {
                $indexDetails[] = [
                    'name' => $index['name'],
                    'unique' => !empty($index['unique']) ? 'UNIQUE' : '',
                    'columns' => implode(', ', $index['columns'] ?? []),
                ];
            }

            return $indexDetails;
        } catch (\Exception $e) {
            Log::error("[TableIndexes] Failed to get indexes for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Ensure user tables exist with correct structure (no data deletion)
     * 
     * Table structure alignment strategy:
     * 1. If table does not exist: Create table (no data deletion, table doesn't exist)
     * 2. If table exists: Skip (no data deletion, no modification to existing table structure)
     * 
     * IMPORTANT: This method NEVER deletes tables or data, only creates non-existent tables
     */
    public static function ensureUserTablesExist(): array
    {
        $results = [];

        // Line 230: Check main database users table (no data deletion)
        $mainConnection = (string) config('database.default');
        if (self::tableExists($mainConnection, 'users')) {
            $results['Main'] = 'exists';
        } else {
            // Line 233: Table does not exist, will be created by migrations (no data deletion)
            $results['Main'] = 'skipped - will be created by migrations';
        }

        // Line 236: Check main database personal_access_tokens table (no data deletion)
        if (self::tableExists($mainConnection, 'personal_access_tokens')) {
            $results['Main (personal_access_tokens)'] = 'exists';
        } else {
            // Line 239: Table does not exist, will be created by migrations (no data deletion)
            $results['Main (personal_access_tokens)'] = 'skipped - will be created by migrations';
        }

        // Canonical-identity model: all sub-apps share the main `users` table.
        // No per-sub-app users tables exist (the old dual-write duplication was
        // removed). Report a single summary instead of per-app "skipped" lines.
        $subAppKeys = self::getSubAppKeys();
        if (!empty($subAppKeys)) {
            $appList = implode(', ', $subAppKeys);
            $results['Sub-apps (' . count($subAppKeys) . ')'] = "canonical identity — all use main users table ({$appList})";
        }

        return $results;
    }
    
    /**
     * Create user table (no data deletion)
     * 
     * IMPORTANT: This method only creates table if it doesn't exist, returns immediately if table exists
     * NEVER deletes tables or data
     */
    /**
     * DEPRECATED / DISABLED. The canonical-identity refactor removed per-sub-app
     * duplicate `users` tables. This method must never recreate one (doing so
     * reintroduced the cross-file self-FK that broke registration). Kept as a
     * guarded no-op for backward compatibility; it has no callers.
     */
    private static function createUserTable(string $connection): void
    {
        Log::warning("[UserSync] createUserTable('{$connection}') is disabled: "
            . 'per-sub-app users tables were removed (canonical-identity model). No-op.');
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

        if (Schema::connection($connection)->hasTable('personal_access_tokens')) {
            return;
        }

        Schema::connection($connection)->create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('tokenable_type');
            $table->unsignedBigInteger('tokenable_id');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            
            $table->index(['tokenable_type', 'tokenable_id']);
            $table->index('token');
        });
    }

    /**
     * Ensure the AppQyV1 TTS cache table exists with the correct structure
     * (no data deletion).
     *
     * Canonical mechanism: SafeMigrationHelper::alignTableStructureFromArray()
     * — create-if-missing, then in-place add-missing columns/indexes only
     * (probe-first, idempotent; never drops or rebuilds a table).
     */
    public static function ensureTTSCacheTablesExist(): array
    {
        $results = [];
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_cache');

        $align = SafeMigrationHelper::alignTableStructureFromArray(
            $connection,
            $tableName,
            [
                'columns' => [
                    'id'            => ['type' => 'bigIncrements'],
                    'text_hash'     => ['type' => 'string', 'length' => 32, 'unique' => true],
                    'text'          => ['type' => 'text'],
                    'language'      => ['type' => 'string', 'length' => 10],
                    'type'          => ['type' => 'string', 'length' => 50],
                    'voice'         => ['type' => 'string', 'length' => 100, 'nullable' => true],
                    'audio_path'    => ['type' => 'text'],
                    'audio_size'    => ['type' => 'integer', 'nullable' => true],
                    'created_at'    => ['type' => 'timestamp', 'useCurrent' => true],
                    'last_accessed' => ['type' => 'timestamp', 'useCurrent' => true],
                    'access_count'  => ['type' => 'integer', 'default' => 1],
                ],
                'indexes' => [
                    ['columns' => ['text_hash']],
                    ['columns' => ['language']],
                    ['columns' => ['type']],
                    ['columns' => ['last_accessed']],
                ],
            ],
            ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
        );

        $results[$tableName] = self::mapAlignStatus($align['status'] ?? 'error');

        return $results;
    }

    /**
     * Ensure multilingual dictionary tables exist with correct structure (no data deletion)
     *
     * Canonical mechanism: SafeMigrationHelper::alignTableStructureFromArray()
     * — create-if-missing, then in-place add-missing columns/indexes only
     * (probe-first, idempotent; never drops or rebuilds a table, never
     * modifies/deletes existing columns or rows). When code adds a new
     * dictionary column, existing words are preserved and the data-fill
     * flow still runs separately.
     *
     * Per supported language this aligns two tables:
     *   - formal  tts_cache_{lang}           (md5 UNIQUE)
     *   - staging tts_cache_{lang}_staging   (md5 indexed, NOT unique — import
     *     may produce duplicate md5 across files; promotion dedups)
     */
    public static function ensureMultiLangDictionaryTablesExist($progressCallback = null): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();
        $total = count($supportedLanguages);
        $current = 0;

        // Canonical formal-table column spec (must mirror the staging spec
        // below minus audio_files, plus the formal-only indexes).
        $formalStructure = [
            'columns' => [
                'id'                   => ['type' => 'increments'],
                'content'              => ['type' => 'text'],
                'md5'                  => ['type' => 'string', 'length' => 32, 'unique' => true],
                'translations'         => ['type' => 'text', 'nullable' => true],
                'has_translation'      => ['type' => 'boolean', 'default' => false],
                'translation_provider' => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'phonetic'             => ['type' => 'text', 'nullable' => true],
                'us_phonetic'          => ['type' => 'text', 'nullable' => true],
                'uk_phonetic'          => ['type' => 'text', 'nullable' => true],
                'tts_files'            => ['type' => 'text', 'nullable' => true],
                'audio_files'          => ['type' => 'json', 'nullable' => true],
                'tts_provider'         => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'has_audio'            => ['type' => 'boolean', 'default' => false],
                'image_files'          => ['type' => 'text', 'nullable' => true],
                'image_provider'       => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'word_details'         => ['type' => 'text', 'nullable' => true],
                'is_exist_local'       => ['type' => 'boolean', 'default' => false],
                'has_operations'       => ['type' => 'boolean', 'default' => false],
                'query_count'          => ['type' => 'integer', 'default' => 0],
                'last_modified'        => ['type' => 'timestamp', 'nullable' => true],
                'last_query_time'      => ['type' => 'timestamp', 'nullable' => true],
                'created_at'           => ['type' => 'timestamp', 'nullable' => true],
                'updated_at'           => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['md5']],
                ['columns' => ['content']],
                ['columns' => ['query_count']],
                ['columns' => ['has_translation']],
                ['columns' => ['has_audio']],
            ],
        ];

        // Staging spec: same columns minus audio_files; md5 is a plain index
        // (not unique) and content carries the only extra index.
        $stagingStructure = [
            'columns' => [
                'id'                   => ['type' => 'increments'],
                'content'              => ['type' => 'text'],
                'md5'                  => ['type' => 'string', 'length' => 32, 'index' => true],
                'translations'         => ['type' => 'text', 'nullable' => true],
                'has_translation'      => ['type' => 'boolean', 'default' => false],
                'translation_provider' => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'phonetic'             => ['type' => 'text', 'nullable' => true],
                'us_phonetic'          => ['type' => 'text', 'nullable' => true],
                'uk_phonetic'          => ['type' => 'text', 'nullable' => true],
                'tts_files'            => ['type' => 'text', 'nullable' => true],
                'tts_provider'         => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'has_audio'            => ['type' => 'boolean', 'default' => false],
                'image_files'          => ['type' => 'text', 'nullable' => true],
                'image_provider'       => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'word_details'         => ['type' => 'text', 'nullable' => true],
                'is_exist_local'       => ['type' => 'boolean', 'default' => false],
                'has_operations'       => ['type' => 'boolean', 'default' => false],
                'query_count'          => ['type' => 'integer', 'default' => 0],
                'last_modified'        => ['type' => 'timestamp', 'nullable' => true],
                'last_query_time'      => ['type' => 'timestamp', 'nullable' => true],
                'created_at'           => ['type' => 'timestamp', 'nullable' => true],
                'updated_at'           => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['content']],
            ],
        ];

        $alignOptions = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];

        foreach ($supportedLanguages as $langCode) {
            $current++;
            $tableName = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName($langCode);

            $align = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                $tableName,
                $formalStructure,
                $alignOptions
            );
            $results[$tableName] = self::mapAlignStatus($align['status'] ?? 'error');

            // Stage-1 staging table (md5 indexed, not unique - import may
            // produce duplicate md5 across files; promotion dedups).
            $stagingTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName($langCode);
            $align = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                $stagingTable,
                $stagingStructure,
                $alignOptions
            );
            $results[$stagingTable] = self::mapAlignStatus($align['status'] ?? 'error');

            if ($progressCallback && $current % 10 === 0) {
                $progressCallback($current, $total);
            }
        }

        if ($progressCallback) {
            $progressCallback($total, $total);
        }

        return $results;
    }

    /**
     * Map a SafeMigrationHelper align status onto the legacy result vocabulary
     * the InitializeApps command gates on: 'created' for a fresh table,
     * 'exists' for an already-present table (including in-place 'updated' /
     * 'aligned' outcomes — adding missing columns to an existing table is a
     * success, not a failure).
     */
    private static function mapAlignStatus(string $status): string
    {
        return in_array($status, ['aligned', 'updated'], true) ? 'exists' : $status;
    }
}
