<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Index matching the pending-position read (plan, lane, language, position >= ?
 * ORDER BY position, id LIMIT n) so it walks the clips in order and stops at
 * the limit instead of sorting every later clip. Additive and idempotent.
 */
return new class extends Migration
{
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
    public $withinTransaction = false;

    protected $connection;
    protected $clipsTable;
    protected $indexName = 'idx_book_audio_clip_position_id';

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->clipsTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'book_audio_plan_clips');
    }

    public function up(): void
    {
        if (!Schema::connection($this->connection)->hasTable($this->clipsTable)) {
            return;
        }
        DB::connection($this->connection)->statement(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS {$this->indexName} ON \"{$this->clipsTable}\" (plan_pk, lane, language, position, id)"
        );
    }

    public function down(): void
    {
    }
};
