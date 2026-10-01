<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;

/**
 * Dictionary partial indexes on the exact AppQyV1MediaGaps predicates, per language: the
 * keyset listings (id) and the claim heads (query_count DESC, id) of every
 * missing-audio / missing-translation / validity gap read only the gap rows.
 */
return new class extends Migration
{
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
        }
    }

    public function down(): void
    {
    }
};
