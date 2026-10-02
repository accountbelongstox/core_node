<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * The hot-path partial indexes of every language's word and sentence table
 * (AppQyV1MediaGaps::indexDefinitions): gap listings, the failed-free lease
 * claim order, the lease expiry the reaper scans and the failed rows the
 * resurfacing sweep walks. Additive and idempotent; a table that sys:init has
 * not aligned yet (a column missing) is skipped and gets them at alignment.
 */
return new class extends Migration
{
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
    public $withinTransaction = false;

    protected $connection;
    protected $appKey;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            if ($this->indexable($schema, AppQyV1TableMaps::getDictionaryTableName($language), true)) {
                AppQyV1MediaGaps::ensureWordIndexes($this->connection, $language);
            }
            if ($this->indexable($schema, AppQyV1TableMaps::getSentenceTableName($language), false)) {
                AppQyV1MediaGaps::ensureSentenceIndexes($this->connection, $language);
            }
        }
    }

    public function down(): void
    {
    }

    private function indexable($schema, string $table, bool $wordTable): bool
    {
        return $schema->hasTable($table) && $schema->hasColumns($table, AppQyV1MediaGaps::indexedColumns($wordTable));
    }
};
