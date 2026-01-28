<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'word_groups');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'gid' => [
                    'type' => 'string',
                    'nullable' => false,
                    'unique' => true,
                    'comment' => 'Group ID',
                ],
                'username' => [
                    'type' => 'string',
                    'nullable' => true,
                    'comment' => 'Username',
                ],
                'uid' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'User ID',
                ],
                'gname' => [
                    'type' => 'text',
                    'nullable' => false,
                    'comment' => 'Group Name',
                ],
                'gcontent' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'Group Content',
                ],
                'gwords' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Group Words',
                ],
                'words_frequency' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Words Frequency',
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'deleted_at' => [
                    'type' => 'softDeletes',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['uid'],
                ],
                [
                    'columns' => ['gname'],
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
