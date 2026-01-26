<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'vipclubv1';
    
    public function up(): void
    {
        $this->createSupportMessagesTable();
        $this->createSupportConfigTable();
    }
    
    private function createSupportMessagesTable(): void
    {
        $tableName = 'vipclubv1_support_messages';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'message' => ['type' => 'text', 'nullable' => false],
                'attachments' => ['type' => 'json', 'nullable' => true],
                'is_from_user' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'is_read' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'index' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['is_read']],
                ['columns' => ['created_at']],
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
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createSupportConfigTable(): void
    {
        $tableName = 'vipclubv1_support_config';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'phone' => ['type' => 'string', 'nullable' => true],
                'email' => ['type' => 'string', 'nullable' => true],
                'wechat' => ['type' => 'string', 'nullable' => true],
                'whatsapp' => ['type' => 'string', 'nullable' => true],
                'hours' => ['type' => 'string', 'nullable' => false, 'default' => 'Mon-Fri: 9AM-6PM'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('vipclubv1_support_messages');
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('vipclubv1_support_config');
    }
};
