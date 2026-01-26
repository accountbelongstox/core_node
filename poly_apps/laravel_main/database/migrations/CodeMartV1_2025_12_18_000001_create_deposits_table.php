<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';
    protected $tableName = 'codemart_v1_deposits';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'role_type' => ['type' => 'string', 'nullable' => false],
                'amount' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false],
                'payment_method' => ['type' => 'string', 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['pending', 'paid', 'failed', 'refunded'], 'nullable' => false, 'default' => 'pending', 'index' => true],
                'payment_url' => ['type' => 'string', 'nullable' => true],
                'paid_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['status']],
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
