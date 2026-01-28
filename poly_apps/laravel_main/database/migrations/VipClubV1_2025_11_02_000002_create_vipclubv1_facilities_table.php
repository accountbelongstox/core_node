<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
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
        $this->appKey = AppKeys::VIPCLUBV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'facilities');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'name' => ['type' => 'string', 'nullable' => false],
                'type' => ['type' => 'enum', 'values' => ['shooting', 'golf', 'hotel'], 'nullable' => false, 'index' => true],
                'description' => ['type' => 'text', 'nullable' => true],
                'image_url' => ['type' => 'string', 'nullable' => true],
                'base_price' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'available_times' => ['type' => 'json', 'nullable' => true],
                'features' => ['type' => 'json', 'nullable' => true],
                'is_active' => ['type' => 'boolean', 'nullable' => false, 'default' => true, 'index' => true],
                'vip_only' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'specific_data' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['type']],
                ['columns' => ['is_active']],
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
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
