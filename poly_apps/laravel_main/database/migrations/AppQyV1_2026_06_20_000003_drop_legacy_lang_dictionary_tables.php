<?php

use Illuminate\Database\Migrations\Migration;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Drop the legacy per-language dictionary tables {prefix}_{lang}_dictionaries
 * (and the defensively-named {prefix}_multi_language_dictionaries).
 *
 * Superseded by the canonical multi-language dictionary tts_cache_{lang}
 * (AppQyV1_2026_05_19_000000). The legacy {lang}_dictionaries family was
 * unreferenced at runtime and its create migration is a no-op; this migration
 * removes any orphan tables a pre-supersession install may still carry.
 *
 * The compatibility model has been removed; AppQyV1LangDictionaryModel is the
 * only dictionary model entry point. Existing legacy tables remain untouched.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $prefix;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    public function up(): void
    {
        // Neutralized: initialization never drops a table (empty or not).
        // Legacy dictionary tables are left in place — dead, unread, harmless.
        return;
    }

    public function down(): void
    {
        // One-way: the legacy {lang}_dictionaries family is not recreated;
        // tts_cache_{lang} is the canonical store.
    }
};
