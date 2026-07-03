<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Book Study-Content Generation pipeline — the per-source generation marker on
 * BOTH the books and articles tables
 * (development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md §3.4).
 *
 *   - study_gen_status    string(20) default 'none'  none|partial|complete
 *   - study_gen_progress  json nullable              {segments_total,segments_done,languages,updated_at}
 *
 * A DENORMALIZED cache recomputed from study_segments (the source of truth) on
 * every submit/release; `complete` = every planned segment done, `partial` = at
 * least one done, else `none`. Deliberately NOT on books.metadata (that json is
 * fill-missing-protected on re-ingest — a mutable cache there would freeze).
 * Documents (doc_*) have no source table; their progress is computed from
 * study_segments directly.
 *
 * Add-only via SafeMigrationHelper + guarded by hasTable — idempotent, never
 * drops data, PostgreSQL-safe (plain nullable adds + a single-column index).
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $booksTable;
    protected $articlesTable;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->booksTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
        $this->articlesTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'articles');
    }

    public function up(): void
    {
        $columns = [
            'study_gen_status' => function (Blueprint $table, string $col) {
                $table->string($col, 20)->default('none')
                    ->comment('Study-content generation marker: none | partial | complete');
            },
            'study_gen_progress' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Denormalized cache {segments_total,segments_done,languages,updated_at}');
            },
        ];

        $tables = [
            $this->booksTable => 'idx_books_study_gen_status',
            $this->articlesTable => 'idx_articles_study_gen_status',
        ];

        foreach ($tables as $table => $indexName) {
            if (!Schema::connection($this->connection)->hasTable($table)) {
                continue;
            }
            SafeMigrationHelper::safeAddColumns($this->connection, $table, $columns);
            SafeMigrationHelper::safeAddIndex(
                $this->connection,
                $table,
                ['study_gen_status'],
                $indexName
            );
        }
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
