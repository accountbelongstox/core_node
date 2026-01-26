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
        $this->appKey = AppKeys::AWYV0;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        // Table 1: awy_v0_users
        $this->createAwyV0UsersTable();
        
        // Table 2: verification_codes
        $this->createVerificationCodesTable();
        
        // Table 3: friend_requests
        $this->createFriendRequestsTable();
        
        // Table 4: friends
        $this->createFriendsTable();
        
        // Table 5: devices
        $this->createDevicesTable();
        
        // Table 6: locations
        $this->createLocationsTable();
        
        // Table 7: location_history
        $this->createLocationHistoryTable();
        
        // Table 8: health_data
        $this->createHealthDataTable();
        
        // Table 9: chats
        $this->createChatsTable();
        
        // Table 10: products
        $this->createProductsTable();
        
        // Table 11: ai_chat_history
        $this->createAiChatHistoryTable();
    }
    
    private function createAwyV0UsersTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'username' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'email' => ['type' => 'string', 'nullable' => true, 'unique' => true],
                'phone' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'unique' => true],
                'password' => ['type' => 'string', 'nullable' => false],
                'name' => ['type' => 'string', 'nullable' => true],
                'avatar' => ['type' => 'string', 'nullable' => true],
                'signature' => ['type' => 'string', 'nullable' => true],
                'gender' => ['type' => 'enum', 'values' => ['male', 'female'], 'nullable' => true],
                'address' => ['type' => 'string', 'nullable' => true],
                'birthday' => ['type' => 'date', 'nullable' => true],
                'id_card' => ['type' => 'string', 'nullable' => true],
                'user_token' => ['type' => 'string', 'nullable' => true],
                'status' => ['type' => 'integer', 'nullable' => false, 'default' => 1],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                'deleted_at' => ['type' => 'softDeletes'],
            ],
            'indexes' => [
                ['columns' => ['username']],
                ['columns' => ['email']],
                ['columns' => ['phone']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createVerificationCodesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'verification_codes');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'phone' => ['type' => 'string', 'length' => 20, 'nullable' => false],
                'code' => ['type' => 'string', 'length' => 10, 'nullable' => false],
                'expires_at' => ['type' => 'timestamp', 'nullable' => false],
                'used' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['phone']],
                ['columns' => ['expires_at']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createFriendRequestsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'friend_requests');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'from_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'to_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'message' => ['type' => 'string', 'nullable' => true],
                'alias' => ['type' => 'string', 'nullable' => true],
                'relation' => ['type' => 'enum', 'values' => ['Partner', 'Child', 'Parent', 'Friend', 'Family'], 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['pending', 'accepted', 'rejected'], 'nullable' => false, 'default' => 'pending'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['from_user_id']],
                ['columns' => ['to_user_id']],
                ['columns' => ['status']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createFriendsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'friends');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'friend_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'relation' => ['type' => 'enum', 'values' => ['Partner', 'Child', 'Parent', 'Friend', 'Family'], 'nullable' => true],
                'alias' => ['type' => 'string', 'nullable' => true],
                'days_connected' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'is_monitored' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'status' => ['type' => 'enum', 'values' => ['active', 'blocked'], 'nullable' => false, 'default' => 'active'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'friend_id'], 'unique' => true],
                ['columns' => ['user_id']],
                ['columns' => ['friend_id']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createDevicesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'devices');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'device_name' => ['type' => 'string', 'nullable' => false],
                'device_type' => ['type' => 'string', 'nullable' => false],
                'device_token' => ['type' => 'string', 'nullable' => true],
                'platform' => ['type' => 'string', 'nullable' => true],
                'network' => ['type' => 'string', 'nullable' => true],
                'unlocks' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'usage_time_minutes' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'battery' => ['type' => 'integer', 'nullable' => true],
                'last_unlock' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['device_token']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createLocationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'locations');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'lat' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => false],
                'lng' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => false],
                'address' => ['type' => 'string', 'nullable' => true],
                'accuracy' => ['type' => 'decimal', 'precision' => 8, 'scale' => 2, 'nullable' => true],
                'speed' => ['type' => 'decimal', 'precision' => 8, 'scale' => 2, 'nullable' => true],
                'heading' => ['type' => 'decimal', 'precision' => 8, 'scale' => 2, 'nullable' => true],
                'location_timestamp' => ['type' => 'timestamp', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['location_timestamp']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createLocationHistoryTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'location_history');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'location_name' => ['type' => 'string', 'nullable' => true],
                'address' => ['type' => 'string', 'nullable' => true],
                'lat' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => false],
                'lng' => ['type' => 'decimal', 'precision' => 10, 'scale' => 7, 'nullable' => false],
                'duration_minutes' => ['type' => 'integer', 'nullable' => true],
                'visited_at' => ['type' => 'timestamp', 'nullable' => false],
                'left_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['visited_at']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createHealthDataTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'health_data');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'steps' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'heart_rate' => ['type' => 'integer', 'nullable' => true],
                'temperature' => ['type' => 'decimal', 'precision' => 4, 'scale' => 1, 'nullable' => true],
                'data_date' => ['type' => 'date', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'data_date'], 'unique' => true],
                ['columns' => ['user_id']],
                ['columns' => ['data_date']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createChatsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'chats');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'sender_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'receiver_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'message' => ['type' => 'text', 'nullable' => false],
                'message_type' => ['type' => 'enum', 'values' => ['text', 'image', 'voice', 'video'], 'nullable' => false, 'default' => 'text'],
                'read' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'status' => ['type' => 'enum', 'values' => ['sent', 'delivered', 'read', 'deleted'], 'nullable' => false, 'default' => 'sent'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['sender_id']],
                ['columns' => ['receiver_id']],
                ['columns' => ['sender_id', 'receiver_id']],
                ['columns' => ['created_at']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createProductsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'products');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'name' => ['type' => 'string', 'nullable' => false],
                'name_en' => ['type' => 'string', 'nullable' => true],
                'price' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false],
                'currency' => ['type' => 'string', 'length' => 10, 'nullable' => false, 'default' => 'CNY'],
                'rating' => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'reviews_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'image' => ['type' => 'string', 'nullable' => true],
                'images' => ['type' => 'json', 'nullable' => true],
                'description' => ['type' => 'text', 'nullable' => true],
                'description_en' => ['type' => 'text', 'nullable' => true],
                'category' => ['type' => 'enum', 'values' => ['watch', 'accessory', 'health'], 'nullable' => false, 'default' => 'watch'],
                'specifications' => ['type' => 'json', 'nullable' => true],
                'in_stock' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'stock_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['category']],
                ['columns' => ['in_stock']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createAiChatHistoryTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_chat_history');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'role' => ['type' => 'enum', 'values' => ['user', 'assistant'], 'nullable' => false, 'default' => 'user'],
                'content' => ['type' => 'text', 'nullable' => false],
                'context' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['created_at']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }

    public function down(): void
    {
        $tables = [
            'ai_chat_history',
            'products',
            'chats',
            'health_data',
            'location_history',
            'locations',
            'devices',
            'friends',
            'friend_requests',
            'verification_codes',
            'users',
        ];
        
        foreach ($tables as $tableSuffix) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, $tableSuffix);
            Schema::connection($this->connection)->dropIfExists($tableName);
        }
    }
};
