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
        $this->createConversationsTable();
        $this->createConversationParticipantsTable();
        $this->createMessagesTable();
    }

    private function createConversationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversations');
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'conversation_id' => [
                    'type' => 'string',
                    'length' => 100,
                    'nullable' => false,
                    'unique' => true,
                ],
                'type' => [
                    'type' => 'string',
                    'nullable' => false,
                    'default' => 'direct',
                ],
                'title' => [
                    'type' => 'string',
                    'nullable' => true,
                ],
                'created_by' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'index' => true,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['created_by'],
                    'name' => 'awy_v0_conversations_created_by',
                ],
                [
                    'columns' => ['type'],
                    'name' => 'awy_v0_conversations_type',
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'created_by',
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

    private function createConversationParticipantsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversation_participants');
        $conversationsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversations');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'conversation_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'index' => true,
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'index' => true,
                ],
                'role' => [
                    'type' => 'enum',
                    'values' => ['participant', 'admin'],
                    'nullable' => false,
                    'default' => 'participant',
                ],
                'joined_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'last_read_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'is_active' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['conversation_id', 'user_id'],
                    'name' => 'awy_v0_conversation_participants_unique',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id', 'is_active'],
                    'name' => 'awy_v0_conversation_participants_user_active',
                ],
                [
                    'columns' => ['joined_at'],
                    'name' => 'awy_v0_conversation_participants_joined_at',
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'conversation_id',
                    'references' => $conversationsTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
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

    private function createMessagesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'messages');
        $conversationsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversations');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'conversation_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'index' => true,
                ],
                'sender_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'index' => true,
                ],
                'content' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'type' => [
                    'type' => 'enum',
                    'values' => ['text', 'image', 'file', 'system'],
                    'nullable' => false,
                    'default' => 'text',
                ],
                'metadata' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'is_read' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => false,
                ],
                'read_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'edited_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'deleted_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['conversation_id', 'created_at'],
                    'name' => 'awy_v0_messages_conversation_created',
                ],
                [
                    'columns' => ['sender_id', 'created_at'],
                    'name' => 'awy_v0_messages_sender_created',
                ],
                [
                    'columns' => ['conversation_id', 'is_read'],
                    'name' => 'awy_v0_messages_conversation_read',
                ],
                [
                    'columns' => ['is_read'],
                    'name' => 'awy_v0_messages_read',
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'conversation_id',
                    'references' => $conversationsTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'sender_id',
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

    public function down(): void
    {
        $messagesTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'messages');
        $participantsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversation_participants');
        $conversationsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversations');
        
        Schema::connection($this->connection)->dropIfExists($messagesTableName);
        Schema::connection($this->connection)->dropIfExists($participantsTableName);
        Schema::connection($this->connection)->dropIfExists($conversationsTableName);
    }
};
