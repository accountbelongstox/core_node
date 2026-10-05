<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1PhraseTableSchema;
use App\Services\MediaIngestTablesInitializer;
use Illuminate\Database\Migrations\Migration;

/**
 * Phrase pipeline schema (docs_fix/DESIGN_PHRASE_PIPELINE.md §3) through the
 * sys:init alignment owners: the sentence phrase columns and indexes
 * (MediaIngestTablesInitializer, which also records the schema-gate revision)
 * and every language's phrase and link tables (AppQyV1PhraseTableSchema).
 * Add-only and idempotent.
 */
return new class extends Migration
{
    // The owners build the gap indexes CONCURRENTLY (no transaction block).
    public $withinTransaction = false;

    public function up(): void
    {
        MediaIngestTablesInitializer::ensureTablesExist();
        AppQyV1PhraseTableSchema::ensureAll();
    }

    public function down(): void
    {
    }
};
