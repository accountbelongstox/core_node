<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Drop the deprecated single {prefix}_dictionaries table.
 *
 * Superseded by the per-language canonical dictionary tts_cache_{lang}
 * (AppQyV1_2026_05_19_000000) via AppQyV1LangDictionaryModel / the
 * AppQyV1MultiLangDictionaryModel shim. The legacy single table + its
 * language-less surface (AppQyV1DictionaryModel and the word-CRUD controllers)
 * were removed; this drops the table itself.
 *
 * Idempotent and data-safe: hasTable()-guarded; down() is a no-op (the legacy
 * table is not recreated — personal_dictionaries is a SEPARATE active table and
 * is NOT touched here).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'dictionaries');
    }

    public function up(): void
    {
        // Neutralized: initialization never drops a table (empty or not).
        // The legacy table is left in place — dead, unread, harmless.
        return;
    }

    public function down(): void
    {
        // One-way: the legacy single dictionaries table is not recreated.
    }
};
