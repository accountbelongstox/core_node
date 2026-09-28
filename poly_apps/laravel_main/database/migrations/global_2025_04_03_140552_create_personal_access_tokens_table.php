<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'main';
    protected $tableName = 'personal_access_tokens';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'tokenable_type' => ['type' => 'string', 'nullable' => false],
                'tokenable_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'name' => ['type' => 'string', 'nullable' => false],
                'token' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true],
                'abilities' => ['type' => 'text', 'nullable' => true],
                'last_used_at' => ['type' => 'timestamp', 'nullable' => true],
                'expires_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['tokenable_type', 'tokenable_id']],
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
