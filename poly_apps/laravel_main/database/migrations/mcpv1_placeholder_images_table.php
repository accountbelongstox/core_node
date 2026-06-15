<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    // McpV1 owns this table -> use the McpV1 connection (its own database under the
    // per-app pgsql topology), not the default 'sqlite'/core_node_main connection.
    protected $connection = 'mcpv1';
    protected $tableName = 'placeholder_images';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'uuid' => ['type' => 'string', 'length' => 36, 'nullable' => false, 'unique' => true, 'index' => true],
                'filename' => ['type' => 'string', 'nullable' => false],
                'width' => ['type' => 'integer', 'nullable' => false],
                'height' => ['type' => 'integer', 'nullable' => false],
                'text' => ['type' => 'text', 'nullable' => true],
                'type' => ['type' => 'string', 'length' => 50, 'nullable' => false, 'default' => 'simple'],
                'file_path' => ['type' => 'string', 'nullable' => false],
                'file_size' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'downloaded' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'downloaded_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['downloaded', 'created_at']],
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
