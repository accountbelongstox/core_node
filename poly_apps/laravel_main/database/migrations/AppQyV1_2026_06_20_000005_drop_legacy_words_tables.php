<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Drop the orphan legacy word tables {prefix}_words_{lang}.
 *
 * Superseded by the canonical per-language dictionary tts_cache_{lang}
 * (AppQyV1_2026_05_19_000000). getWordTableName() is now an ALIAS that already
 * resolves to tts_cache_{lang}, so no live code reads/writes a physical words_*
 * table; only old installs may still carry orphan tables. There was never a
 * create migration for them, so this drop covers BOTH historical namings:
 *   - by CODE: {prefix}_words_{code} for every getSupportedLanguages()
 *   - by NAME: {prefix}_words_{name} reusing the same nameMap as the diagnostic
 *     scanner AppQyV1SystemInitComplianceCtl (e.g. words_english, words_japanese).
 *
 * Only EXACT {prefix}_words_{lang|name} tables are dropped — never word_groups,
 * article_words, group_word_progress, etc.
 *
 * Idempotent and data-safe: each drop is hasTable()-guarded; down() is a no-op
 * (the legacy tables are not recreated).
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
        // Legacy words tables are left in place — dead, unread, harmless.
        return;
    }

    public function down(): void
    {
        // One-way: the legacy words_* tables are not recreated (canonical store
        // is tts_cache_{lang}).
    }
};
