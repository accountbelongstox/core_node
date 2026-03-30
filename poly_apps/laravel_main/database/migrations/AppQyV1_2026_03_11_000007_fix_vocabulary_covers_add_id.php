<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->tableName)) {
            $referencedTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');

            $tableStructure = [
                'columns' => [
                    'id' => [
                        'type' => 'increments',
                    ],
                    'library_id' => [
                        'type' => 'unsignedInteger',
                        'nullable' => false,
                        'unique' => true,
                    ],
                    'cover_filename' => [
                        'type' => 'string',
                        'length' => 255,
                        'nullable' => false,
                    ],
                    'status' => [
                        'type' => 'string',
                        'length' => 50,
                        'nullable' => false,
                        'default' => 'pending',
                    ],
                    'prompt' => [
                        'type' => 'text',
                        'nullable' => true,
                    ],
                    'description' => [
                        'type' => 'text',
                        'nullable' => true,
                    ],
                    'priority' => [
                        'type' => 'integer',
                        'nullable' => false,
                        'default' => 0,
                    ],
                    'attempts' => [
                        'type' => 'integer',
                        'nullable' => false,
                        'default' => 0,
                    ],
                    'error_message' => [
                        'type' => 'text',
                        'nullable' => true,
                    ],
                    'width' => [
                        'type' => 'integer',
                        'nullable' => false,
                        'default' => 1280,
                    ],
                    'height' => [
                        'type' => 'integer',
                        'nullable' => false,
                        'default' => 720,
                    ],
                    'last_requested_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'last_generated_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'started_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'finished_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'created_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'updated_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                ],
                'indexes' => [
                    [
                        'columns' => ['status'],
                        'name' => 'idx_vocab_covers_status',
                    ],
                    [
                        'columns' => ['priority'],
                        'name' => 'idx_vocab_covers_priority',
                    ],
                    [
                        'columns' => ['status', 'priority', 'last_requested_at'],
                        'name' => 'idx_cover_processing',
                    ],
                ],
                'foreignKeys' => [
                    [
                        'column' => 'library_id',
                        'references' => $referencedTable,
                        'on' => 'id',
                        'onDelete' => 'cascade',
                    ],
                ],
            ];

            SafeMigrationHelper::alignTableStructureFromArray(
                $this->connection,
                $this->tableName,
                $tableStructure,
                [
                    'shrink_columns' => false,
                    'modify_columns' => true,
                    'add_indexes' => true,
                ]
            );

            return;
        }

        if ($schema->hasColumn($this->tableName, 'id')) {
            return;
        }

        $connection = DB::connection($this->connection);
        $quotedTable = '"' . $this->tableName . '"';
        $tempTable = $this->tableName . '_tmp_with_id';
        $quotedTemp = '"' . $tempTable . '"';

        $connection->statement("
            CREATE TABLE {$quotedTemp} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                library_id INTEGER NOT NULL UNIQUE,
                cover_filename VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                prompt TEXT NULL,
                description TEXT NULL,
                priority INTEGER NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                width INTEGER NOT NULL DEFAULT 1280,
                height INTEGER NOT NULL DEFAULT 720,
                last_requested_at DATETIME NULL,
                last_generated_at DATETIME NULL,
                started_at DATETIME NULL,
                finished_at DATETIME NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL
            )
        ");

        $connection->statement("
            INSERT INTO {$quotedTemp} (
                library_id,
                cover_filename,
                status,
                prompt,
                description,
                priority,
                attempts,
                error_message,
                width,
                height,
                last_requested_at,
                last_generated_at,
                started_at,
                finished_at,
                created_at,
                updated_at
            )
            SELECT
                library_id,
                cover_filename,
                status,
                prompt,
                description,
                priority,
                attempts,
                error_message,
                width,
                height,
                last_requested_at,
                last_generated_at,
                started_at,
                finished_at,
                created_at,
                updated_at
            FROM {$quotedTable}
        ");

        $connection->statement("DROP TABLE {$quotedTable}");
        $connection->statement("ALTER TABLE {$quotedTemp} RENAME TO {$quotedTable}");
    }

    public function down(): void
    {
        // No-op: we don't remove the id column once created
    }
};

