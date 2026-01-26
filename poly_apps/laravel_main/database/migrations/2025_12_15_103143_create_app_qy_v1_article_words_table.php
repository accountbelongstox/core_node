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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'article_words');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'article_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'Article ID reference'],
                'word_md5' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'index' => true, 'comment' => 'Word MD5 from dictionary'],
                'word' => ['type' => 'string', 'length' => 255, 'nullable' => false, 'comment' => 'The actual word text'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'Word language'],
                'frequency' => ['type' => 'integer', 'nullable' => false, 'default' => 1, 'comment' => 'Frequency of word in article'],
                'is_new_for_user' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'Is this a new word for the user'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['article_id']],
                ['columns' => ['word_md5']],
                ['columns' => ['language']],
                ['columns' => ['article_id', 'word_md5'], 'unique' => true],
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
