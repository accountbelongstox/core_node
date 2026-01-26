<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'vipclubv1';
    protected $tableName = 'vipclubv1_articles';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'title' => ['type' => 'string', 'nullable' => false],
                'summary' => ['type' => 'text', 'nullable' => true],
                'content' => ['type' => 'longText', 'nullable' => false],
                'category' => ['type' => 'enum', 'values' => ['news', 'events', 'tips', 'promotions', 'announcements'], 'nullable' => false, 'default' => 'news', 'index' => true],
                'cover_image_url' => ['type' => 'string', 'nullable' => true],
                'author' => ['type' => 'string', 'nullable' => false, 'default' => 'VIP Club Admin'],
                'publish_date' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'read_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'tags' => ['type' => 'json', 'nullable' => true],
                'is_featured' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'index' => true],
                'is_published' => ['type' => 'boolean', 'nullable' => false, 'default' => true, 'index' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['category']],
                ['columns' => ['is_featured']],
                ['columns' => ['is_published']],
                ['columns' => ['publish_date']],
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
