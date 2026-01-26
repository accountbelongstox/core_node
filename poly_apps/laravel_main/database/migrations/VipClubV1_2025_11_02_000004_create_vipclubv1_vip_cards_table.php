<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'vipclubv1';
    protected $tableName = 'vipclubv1_vip_cards';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'card_number' => ['type' => 'string', 'nullable' => false, 'unique' => true, 'index' => true],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'member_type' => ['type' => 'enum', 'values' => ['guest', 'regular', 'gold', 'platinum', 'diamond'], 'nullable' => false, 'default' => 'regular', 'index' => true],
                'issue_date' => ['type' => 'timestamp', 'nullable' => true],
                'expiry_date' => ['type' => 'timestamp', 'nullable' => true],
                'points' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'benefits' => ['type' => 'json', 'nullable' => true],
                'qr_code' => ['type' => 'text', 'nullable' => true],
                'is_active' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['card_number']],
                ['columns' => ['member_type']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
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
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
