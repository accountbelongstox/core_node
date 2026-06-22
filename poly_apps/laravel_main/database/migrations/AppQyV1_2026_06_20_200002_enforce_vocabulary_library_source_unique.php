<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Make vocabulary_libraries.`source` a real NOT-NULL + UNIQUE canonical key, so
 * the duplicate-library bug cannot recur at the schema level (multiple NULLs are
 * allowed under a unique index, which is exactly how the duplicates slipped in).
 *
 * MUST run AFTER AppQyV1_2026_06_20_200001_dedup_vocabulary_libraries, which both
 * backfills every blank source and removes duplicate rows — otherwise the
 * NOT-NULL / UNIQUE constraints below would fail to apply.
 *
 * Cross-DB + idempotent:
 *  - Backfill any still-blank source (defensive; the dedup migration already did
 *    this) so NOT NULL can be enforced.
 *  - pgsql: ALTER COLUMN ... SET NOT NULL (guarded; skipped if already NOT NULL).
 *    sqlite: cannot alter a column in place; the data is fully backfilled and the
 *    application always writes a NOT-NULL source, so the unique index is the
 *    effective guarantee there.
 *  - Ensure the unique index on `source` exists (safeAddUniqueIndex is a no-op
 *    when it already does — the original create migration declared it).
 */
return new class extends Migration
{
    // $connection is inherited UNTYPED from Migration -> must stay untyped here
    // (a `string` type triggers a fatal "must be omitted to match the parent").
    protected $connection;
    protected string $tableName;

    public function __construct()
    {
        $appKey = AppKeys::APPQYV1;
        $this->connection = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);
        if (!$schema->hasTable($this->tableName)) {
            return;
        }

        $conn = DB::connection($this->connection);

        // Defensive backfill: never let a blank source reach the NOT-NULL step.
        $blankRows = $conn->table($this->tableName)
            ->where(function ($q) {
                $q->whereNull('source')->orWhere('source', '');
            })
            ->get(['id', 'name', 'language']);

        foreach ($blankRows as $row) {
            $base = mb_strtolower(trim((string) $row->name)) . '_' . mb_strtolower(trim((string) $row->language));
            $slug = preg_replace('/[^a-z0-9]+/u', '_', $base);
            $slug = trim((string) $slug, '_');
            if ($slug === '') {
                $slug = 'lib_' . md5($base);
            }
            $conn->table($this->tableName)->where('id', $row->id)->update(['source' => $slug]);
        }

        // Enforce NOT NULL where the driver supports an in-place column change.
        $driver = $conn->getDriverName();
        if ($driver === 'pgsql') {
            $columns = $schema->getColumns($this->tableName);
            $isNullable = true;
            foreach ($columns as $column) {
                if (($column['name'] ?? null) === 'source') {
                    $isNullable = (bool) ($column['nullable'] ?? true);
                    break;
                }
            }
            if ($isNullable) {
                $conn->statement(
                    'ALTER TABLE ' . $conn->getTablePrefix() . $this->tableName .
                    ' ALTER COLUMN "source" SET NOT NULL'
                );
            }
        }
        // sqlite: column stays nullable in the schema (ALTER COLUMN unsupported),
        // but data is fully backfilled and the app always writes a source. The
        // unique index below is the effective guard on sqlite.

        // Ensure the canonical unique index exists (idempotent).
        SafeMigrationHelper::safeAddUniqueIndex(
            $this->connection,
            $this->tableName,
            'source',
            'uniq_vocab_lib_source'
        );
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        if (!$schema->hasTable($this->tableName)) {
            return;
        }

        $conn = DB::connection($this->connection);
        $driver = $conn->getDriverName();
        if ($driver === 'pgsql') {
            $conn->statement(
                'ALTER TABLE ' . $conn->getTablePrefix() . $this->tableName .
                ' ALTER COLUMN "source" DROP NOT NULL'
            );
        }
        // Leave the unique index in place (it predates this migration).
    }
};
