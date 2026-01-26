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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'task_type' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => false,
                    'default' => 'word',
                    'index' => true,
                    'comment' => 'Task type: word, sentence, article',
                ],
                'content_text' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'Original content text',
                ],
                'content_hash' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => true,
                    'index' => true,
                    'comment' => 'MD5 hash of content',
                ],
                'word' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                    'index' => true,
                    'comment' => 'Word (for word type tasks)',
                ],
                'word_md5' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'index' => true,
                    'comment' => 'Word MD5 (for word type tasks)',
                ],
                'language' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                    'index' => true,
                ],
                'status' => [
                    'type' => 'enum',
                    'values' => ['pending', 'processing', 'completed', 'failed'],
                    'nullable' => false,
                    'default' => 'pending',
                    'index' => true,
                ],
                'priority' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'index' => true,
                ],
                'retry_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'error_message' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'audio_path' => [
                    'type' => 'string',
                    'nullable' => true,
                    'comment' => 'Single audio file path',
                ],
                'audio_files' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Multiple audio files (for article/sentence tasks)',
                ],
                'metadata' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Additional metadata',
                ],
                'requested_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'started_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'completed_at' => [
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
                    'columns' => ['content_hash', 'language', 'task_type'],
                    'name' => 'unique_content_lang_type',
                    'unique' => true,
                ],
                [
                    'columns' => ['status', 'priority', 'created_at'],
                ],
                [
                    'columns' => ['task_type', 'status'],
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
