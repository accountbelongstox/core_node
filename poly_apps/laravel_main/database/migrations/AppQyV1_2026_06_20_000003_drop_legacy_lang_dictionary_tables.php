<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Drop the legacy per-language dictionary tables {prefix}_{lang}_dictionaries
 * (and the defensively-named {prefix}_multi_language_dictionaries).
 *
 * Superseded by the canonical multi-language dictionary tts_cache_{lang}
 * (AppQyV1_2026_05_19_000000). The legacy {lang}_dictionaries family was
 * unreferenced at runtime and its create migration is a no-op; this migration
 * removes any orphan tables a pre-supersession install may still carry.
 *
 * KEEP the AppQyV1MultiLangDictionaryModel SHIM (it now resolves to tts_cache).
 * The loop mirrors AppQyV1TableMaps::getSupportedLanguages() so it covers every
 * supported language.
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
        $schema = Schema::connection($this->connection);

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $langCode) {
            $schema->dropIfExists($this->prefix . '_' . $langCode . '_dictionaries');
        }

        // Defensive: a singular shared name some old installs may have created.
        $schema->dropIfExists($this->prefix . '_multi_language_dictionaries');
    }

    public function down(): void
    {
        // One-way: the legacy {lang}_dictionaries family is not recreated;
        // tts_cache_{lang} is the canonical store.
    }
};
