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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'uploaded_documents');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'comment' => 'Owner user id (global users table)'],
                'collection_id' => ['type' => 'unsignedBigInteger', 'nullable' => true, 'comment' => 'Vocabulary collection created from this document'],
                'original_name' => ['type' => 'string', 'length' => 255, 'nullable' => false, 'comment' => 'Document / collection display name'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'en', 'comment' => 'Document language code (e.g. en)'],
                'content' => ['type' => 'longText', 'nullable' => false, 'comment' => 'Plain-text document content kept for later word/sentence extraction'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id'], 'name' => 'idx_uploaded_documents_user'],
                ['columns' => ['collection_id'], 'name' => 'idx_uploaded_documents_collection'],
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
