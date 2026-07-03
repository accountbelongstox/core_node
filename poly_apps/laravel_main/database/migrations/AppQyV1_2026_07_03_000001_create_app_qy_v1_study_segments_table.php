<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Book Study-Content Generation pipeline — the segment plan + lease + status
 * anchor (development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md §3.1).
 *
 * One row per planned ~500-char segment of a source (book|article|document).
 * THE anchor every generated study artifact (phrases / grammar points /
 * per-language sentence links) hangs off of. The 60-minute claim lease lives on
 * claimed_at/claimed_by (deliberately NOT on books.assist_claimed_at, which is
 * the poster-assist lease — sharing would cross-starve poster generation).
 *
 * Static table, auto-discovered by sys:init's single migrate --force. Idempotent
 * add-only via SafeMigrationHelper::alignTableStructureFromArray; down() drops
 * only on an explicit rollback.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'study_segments');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'book | article | document'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'books.source_key / articles.article_id / doc_<id>'],
                'segment_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => '0-based segment position within the source'],
                'grain' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'sentence', 'comment' => 'slot grain the plan was built on (sentence else cue)'],
                'seq_start' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'inclusive first slot seq'],
                'seq_end' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'inclusive last slot seq'],
                'chapter_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'chapter of the first slot (display hint)'],
                'primary_language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'comment' => 'language the char budget was measured in'],
                'char_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'mb_strlen of primary text at plan time'],
                'status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'pending', 'index' => true, 'comment' => 'pending | generating | done | failed'],
                'attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'incremented on claim'],
                'error' => ['type' => 'text', 'nullable' => true, 'comment' => 'last release/submit error'],
                'claimed_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'lease start (60-minute lease)'],
                'claimed_by' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'claimer id'],
                'languages_done' => ['type' => 'json', 'nullable' => true, 'comment' => 'lang codes in the accepted submission'],
                'provider' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'comment' => 'gemini | chatgpt | grok | copilot provenance'],
                'generated_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'when submit was accepted'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'plan params {target_chars} etc.'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type', 'source_key', 'segment_index'], 'unique' => true, 'name' => 'uniq_study_segment_pos'],
                ['columns' => ['source_type', 'source_key', 'status'], 'name' => 'idx_study_seg_src_status'],
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
