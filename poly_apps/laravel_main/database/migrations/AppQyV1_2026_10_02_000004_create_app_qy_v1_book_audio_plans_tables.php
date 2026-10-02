<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Server-owned audio plan of one book (audio_orchestration_contract book_plan):
 * one plan row per (book, chapter, languages, words) and one membership row per
 * required clip (sentence content id or word md5) with its play position, the
 * ready sequence the app follows by cursor and the fast-pass quality state.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $plansTable;
    protected $clipsTable;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->plansTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'book_audio_plans');
        $this->clipsTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'book_audio_plan_clips');
    }

    public function up(): void
    {
        $options = ['shrink_columns' => false, 'modify_columns' => true, 'add_indexes' => true];

        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->plansTable, [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'plan_id' => ['type' => 'string', 'length' => 40, 'nullable' => false],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true],
                'chapter_index' => ['type' => 'integer', 'nullable' => true],
                'languages' => ['type' => 'json', 'nullable' => true],
                'include_words' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'plan_hash' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'position' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'raised_position' => ['type' => 'integer', 'nullable' => true],
                'state' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'default' => 'building'],
                'skipped' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'fast_pass' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'ready_seq_max' => ['type' => 'bigInteger', 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['plan_id'], 'unique' => true, 'name' => 'uniq_book_audio_plan_id'],
            ],
        ], $options);

        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->clipsTable, [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'plan_pk' => ['type' => 'bigInteger', 'nullable' => false],
                'lane' => ['type' => 'string', 'length' => 16, 'nullable' => false],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false],
                'content_key' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'position' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'ready_seq' => ['type' => 'bigInteger', 'nullable' => true],
                'quality' => ['type' => 'smallInteger', 'nullable' => false, 'default' => 0],
            ],
            'indexes' => [
                ['columns' => ['plan_pk', 'lane', 'language', 'content_key'], 'unique' => true, 'name' => 'uniq_book_audio_clip_plan_key'],
                ['columns' => ['plan_pk', 'ready_seq'], 'name' => 'idx_book_audio_clip_ready'],
                ['columns' => ['plan_pk', 'lane', 'language', 'position'], 'name' => 'idx_book_audio_clip_position'],
                ['columns' => ['lane', 'language', 'content_key'], 'name' => 'idx_book_audio_clip_content'],
            ],
        ], $options);
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists($this->clipsTable);
        Schema::connection($this->connection)->dropIfExists($this->plansTable);
    }
};
