<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Roaming client settings for guests (browser fingerprint key) and optional
 * device-scoped blobs. Logged-in reader prefs live in users.preferences.app_settings.reader.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'client_device_settings');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'client_key' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => false,
                    'comment' => 'Browser fingerprint visitor id (hex) or stable local id',
                ],
                'settings' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'JSON blob: { reader: {...}, updated_at: ISO8601 }',
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
                    'columns' => ['client_key'],
                    'name' => 'unique_cds_client_key',
                    'unique' => true,
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
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
