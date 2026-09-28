<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Apps\McpV1\McpV1Models\McpV1PlaceholderImageModel;

return new class extends Migration
{
    // McpV1 owns this table -> use the McpV1 connection (its own database under the
    // per-app pgsql topology), not the default 'sqlite'/core_node_main connection.
    protected $connection = 'mcpv1';
    protected $tableName = 'placeholder_images';

    public function up(): void
    {
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            McpV1PlaceholderImageModel::tableStructure(),
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
