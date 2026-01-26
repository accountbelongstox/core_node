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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'articles');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'article_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Unique article identifier'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'Article title'],
                'content' => ['type' => 'text', 'nullable' => false, 'comment' => 'Article content'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'english', 'index' => true, 'comment' => 'Article language'],
                'article_type' => ['type' => 'string', 'length' => 50, 'nullable' => false, 'default' => 'general', 'index' => true, 'comment' => 'Article type for categorization'],
                'source' => ['type' => 'string', 'nullable' => true, 'comment' => 'Source of the article'],
                'difficulty_level' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'comment' => 'Difficulty level (beginner, intermediate, advanced)'],
                'word_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Total word count'],
                'unique_word_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Unique word count'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Total sentence count'],
                'is_daily_reading' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'index' => true, 'comment' => 'Is this a daily reading article'],
                'reading_date' => ['type' => 'date', 'nullable' => true, 'index' => true, 'comment' => 'Date for daily reading'],
                'task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'index' => true, 'comment' => 'Associated task ID'],
                'tts_generated' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'Whether TTS audio has been generated'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['article_id']],
                ['columns' => ['language']],
                ['columns' => ['article_type']],
                ['columns' => ['is_daily_reading']],
                ['columns' => ['reading_date']],
                ['columns' => ['task_id']],
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
