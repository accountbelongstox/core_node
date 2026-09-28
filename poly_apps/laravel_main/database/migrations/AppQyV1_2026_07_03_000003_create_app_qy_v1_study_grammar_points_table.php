<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Book Study-Content Generation pipeline — grammar points per segment
 * (development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md §3.3).
 *
 * Batch-linked to a study_segments row (FK-by-value on segment_id, plus the
 * denormalized source_type/source_key/segment_index composite). Loading a
 * passage finds its grammar batch via this composite (or via the seq lookup on
 * the study-gen segment-content endpoint). Like study_phrases, duplicates across
 * segments are allowed and within-segment retry is guarded by the submit gate.
 *
 * Static table, auto-discovered by sys:init's single migrate --force. Idempotent
 * add-only via SafeMigrationHelper::alignTableStructureFromArray.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'study_grammar_points');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'segment_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'FK-by-value to study_segments.id'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'comment' => 'denormalized segment link'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'comment' => 'denormalized segment link'],
                'segment_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'denormalized segment link'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'which language the grammar point belongs to'],
                'point' => ['type' => 'text', 'nullable' => false, 'comment' => 'short label, e.g. "not only...but also"'],
                'explanation' => ['type' => 'text', 'nullable' => true, 'comment' => 'detail'],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type', 'source_key', 'segment_index'], 'name' => 'idx_study_grammar_seg'],
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
