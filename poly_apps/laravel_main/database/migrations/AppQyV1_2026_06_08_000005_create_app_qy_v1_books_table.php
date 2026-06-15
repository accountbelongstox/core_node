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
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Stable hash of the source abs path (pycore)'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'Book title'],
                'original_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Source original basename (mapping filename.original)'],
                'ascii_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Transcoded ASCII stem (mapping filename.ascii)'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'index' => true, 'comment' => 'Primary language'],
                'full_content' => ['type' => 'longText', 'nullable' => true, 'comment' => 'Complete book backup'],
                'audio' => ['type' => 'json', 'nullable' => true, 'comment' => 'Book audio reference(s); books have no video'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of sentences'],
                'synced_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last sync timestamp'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['language']],
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
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
