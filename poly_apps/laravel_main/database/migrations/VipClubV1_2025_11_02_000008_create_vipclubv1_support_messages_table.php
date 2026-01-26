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
    
    public function __construct()
    {
        $this->appKey = AppKeys::VIPCLUBV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }
    
    public function up(): void
    {
        $this->createSupportMessagesTable();
        $this->createSupportConfigTable();
    }
    
    private function createSupportMessagesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'support_messages');
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
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }
    
    private function createSupportConfigTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'support_config');
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
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
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
        $supportMessagesTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'support_messages');
        $supportConfigTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'support_config');
        
        Schema::connection($this->connection)->dropIfExists($supportMessagesTableName);
        Schema::connection($this->connection)->dropIfExists($supportConfigTableName);
    }
};
