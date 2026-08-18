<?php

use Illuminate\Database\Migrations\Migration;
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_presence');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'latitude' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => true, 'comment' => 'Last shared latitude'],
                'longitude' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => true, 'comment' => 'Last shared longitude'],
                'location_accuracy' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => true, 'comment' => 'Location accuracy in meters'],
                'location_visible' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'Allow nearby discovery'],
                'location_updated_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last location update'],
            ],
            'indexes' => [
                ['columns' => ['location_visible', 'location_updated_at'], 'name' => 'idx_app_qy_v1_presence_location'],
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
        // Location data is preserved on rollback to avoid destructive schema changes.
    }
};
