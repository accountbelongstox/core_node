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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'personal_dictionary_entries');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'uid' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'User ID',
                ],
                'word' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                    'comment' => 'Dictionary word',
                ],
                'language' => [
                    'type' => 'string',
                    'length' => 16,
                    'nullable' => true,
                    'comment' => 'Language code (e.g. en, zh)',
                ],
                'definition' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'Word definition',
                ],
                'example' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'Usage example',
                ],
                'notes' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'Personal notes',
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
                    'columns' => ['uid', 'word'],
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'uid',
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
