<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;

/**
 * The hot-path partial indexes of every language's word and sentence table
 * (AppQyV1MediaGaps::indexDefinitions): gap listings, the failed-free lease
 * claim order, the lease expiry the reaper scans and the failed rows the
 * resurfacing sweep walks. Additive and idempotent; an index whose columns a
 * table lacks yet is skipped by the ensure functions and built at alignment.
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
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            AppQyV1MediaGaps::ensureWordIndexes($this->connection, $language);
            AppQyV1MediaGaps::ensureSentenceIndexes($this->connection, $language);
        }
    }

    public function down(): void
    {
    }
};
