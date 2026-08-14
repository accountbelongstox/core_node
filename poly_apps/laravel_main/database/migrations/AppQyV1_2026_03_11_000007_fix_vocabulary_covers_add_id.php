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
        $driver = $connection->getDriverName();

        // pgsql supports adding a serial primary key column in-place; no table rebuild needed.
        if ($driver === 'pgsql') {
            $connection->statement('ALTER TABLE "' . $this->tableName . '" ADD COLUMN id BIGSERIAL PRIMARY KEY');

            return;
        }

        // This app is PostgreSQL-only. The historical sqlite copy-drop-rename
        // rebuild branch was removed: initialization may adjust tables but
        // never rebuild/destroy them. On any non-pgsql driver, skip.
        \Illuminate\Support\Facades\Log::warning(
            '[fix_vocabulary_covers_add_id] non-pgsql driver ' . $driver . ': id column not added (rebuild path removed).'
        );
        return;
    }

    public function down(): void
    {
        // No-op: we don't remove the id column once created
    }
};

