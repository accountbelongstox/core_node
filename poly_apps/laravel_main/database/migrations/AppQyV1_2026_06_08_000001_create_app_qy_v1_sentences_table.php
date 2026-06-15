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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'sentences');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'sentence_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Dedup key = sha1(normalized_text + | + language)'],
                'text' => ['type' => 'text', 'nullable' => false, 'comment' => 'Sentence text'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'english', 'index' => true, 'comment' => 'Sentence language'],
                'explanation' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: explanation (enrich-only)'],
                'ai_commentary' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: commentary (enrich-only)'],
                'grammar' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: grammar notes (enrich-only)'],
                'special_usage' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: special usage (enrich-only)'],
                'audio' => ['type' => 'string', 'nullable' => true, 'comment' => 'Sentence audio reference (enrich-only)'],
                'occurrence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 1, 'comment' => 'Times this sentence has been ingested'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['sentence_id'], 'unique' => true],
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
