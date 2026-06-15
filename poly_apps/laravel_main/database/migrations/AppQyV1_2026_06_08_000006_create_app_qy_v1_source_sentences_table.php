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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'subtitle', 'index' => true, 'comment' => 'subtitle|book'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'Originating source key'],
                'sentence_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'FK to sentences.sentence_id'],
                'grain' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'cue', 'comment' => 'cue (1 srt cue) | sentence (merged real sentence)'],
                'seq' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Order within source for that grain'],
                'seg_index' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Subtitle cue video segment index'],
                'sub_idx' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Srt cue index'],
                'start_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Start time in seconds'],
                'end_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'End time in seconds'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type']],
                ['columns' => ['source_key']],
                ['columns' => ['sentence_id']],
                ['columns' => ['source_type', 'source_key', 'grain', 'seq'], 'unique' => true, 'name' => 'uniq_source_sentence_pos'],
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
