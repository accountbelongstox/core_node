<?php

use App\Services\MediaIngestTablesInitializer;
use App\Services\UserSyncService;
use Illuminate\Database\Migrations\Migration;

/**
 * Aligns every language's word and sentence table through the sys:init
 * alignment owners (AppQyV1DictionaryTableSchema via UserSyncService,
 * MediaIngestTablesInitializer), so a migrate-only deploy also gets the gap
 * and work-lease columns and indexes; both owners record the schema-gate
 * revision when every table is aligned. Add-only and idempotent.
 */
return new class extends Migration
{
    // The owners build the gap indexes CONCURRENTLY (no transaction block).
    public $withinTransaction = false;

    public function up(): void
    {
        UserSyncService::ensureMultiLangDictionaryTablesExist();
        MediaIngestTablesInitializer::ensureTablesExist();
    }

    public function down(): void
    {
    }
};
