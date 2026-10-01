<?php

use Illuminate\Database\Migrations\Migration;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1DictionaryTableSchema;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Unified canonical multi-language dictionary tables.
 *
 * Single source of truth: {prefix}_tts_cache_{lang} (formal) plus
 * {prefix}_tts_cache_{lang}_staging (Stage-1 import target), from the one
 * schema owner AppQyV1DictionaryTableSchema (also used by sys:init alignment).
 *
 * Idempotent and add-only; down() is intentionally a no-op so a rollback never
 * drops dictionary data.
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
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            AppQyV1DictionaryTableSchema::ensure($this->connection, $lang);
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop dictionary data on rollback.
    }
};
