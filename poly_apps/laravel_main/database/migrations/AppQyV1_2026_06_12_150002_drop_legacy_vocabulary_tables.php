<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Vocabulary storage consolidation - Wave A, step 3 (drops).
 *
 * Removes the legacy word stores after AppQyV1_2026_06_12_150001 has
 * converted everything into vocabulary_libraries.word_ids + cover_* and
 * re-pointed group_words / user_word_progress at the per-language
 * dictionary tables (tts_cache_{lang}).
 *
 * DELIBERATELY a separate migration file so steps 1+2 can land and be
 * verified first. Run this ONLY after the conversion verification passed
 * and the read endpoints have been rewired to word_ids (Wave B).
 *
 * Drop order respects foreign keys:
 *   vocabulary_items  -> vocabulary_collections
 *   vocabulary_words  -> vocabulary_libraries (libraries stay)
 *   vocabulary_covers -> vocabulary_libraries (libraries stay)
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
        // Neutralized: initialization adjusts table STRUCTURE in place and
        // never drops a table (empty or not). Legacy tables are left in
        // place — a dead table costs nothing and no data can be lost.
        return;
    }

    public function down(): void
    {
        // One-way: the legacy tables cannot be restored from word_ids alone
        // (per-row timestamps/ids are gone). Restore from backup if needed.
    }
};
