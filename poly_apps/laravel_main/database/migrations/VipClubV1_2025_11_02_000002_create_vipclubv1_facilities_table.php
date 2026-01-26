<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'vipclubv1';
    protected $tableName = 'vipclubv1_facilities';

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
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
