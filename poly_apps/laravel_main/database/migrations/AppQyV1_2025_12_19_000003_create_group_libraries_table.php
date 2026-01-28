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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'group_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Group ID from word_groups table',
                ],
                'library_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Library ID from vocabulary_libraries',
                ],
                'added_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
                    'comment' => 'When library was added to group',
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
                    'columns' => ['group_id', 'library_id'],
                    'name' => 'unique_group_library',
                    'unique' => true,
                ],
                [
                    'columns' => ['group_id'],
                    'name' => 'idx_group_lib_group',
                ],
                [
                    'columns' => ['library_id'],
                    'name' => 'idx_group_lib_library',
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
