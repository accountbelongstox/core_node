<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Add word-validity tracking to the canonical dictionary tables.
 *
 * Validity is an explicit, externally-asserted flag: a row is VALID by default
 * and is only INVALID when a third-party client (which verifies the word
 * against the internet) explicitly marks it so via POST /vocabulary/validity/report.
 * Rows that were never checked stay valid, matching that contract.
 *
 * Columns added to every {prefix}_tts_cache_{lang} (formal) and its _staging
 * counterpart:
 *   - is_valid (boolean, default true)   marked false only by an explicit check
 *   - validity_checked_at (datetime)     null until a client reports a result
 *   - validity_source (string)           which client/source asserted the result
 *   - validity_note (text)               optional reason (e.g. "not found online")
 *
 * Idempotent and data-safe: per-column hasColumn() guards mean already-populated
 * tables (e.g. the existing tts_cache_en with ~104k rows) gain the columns
 * without any data loss. down() is intentionally a no-op so a rollback never
 * strips validity data.
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
        $schema = Schema::connection($this->connection);

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables = [
                AppQyV1TableMaps::getDictionaryTableName($lang),
                AppQyV1TableMaps::getDictionaryStagingTableName($lang),
            ];

            foreach ($tables as $table) {
                if (!$schema->hasTable($table)) {
                    continue;
                }

                $missing = [];
                if (!$schema->hasColumn($table, 'is_valid')) {
                    $missing[] = 'is_valid';
                }
                if (!$schema->hasColumn($table, 'validity_checked_at')) {
                    $missing[] = 'validity_checked_at';
                }
                if (!$schema->hasColumn($table, 'validity_source')) {
                    $missing[] = 'validity_source';
                }
                if (!$schema->hasColumn($table, 'validity_note')) {
                    $missing[] = 'validity_note';
                }

                if (empty($missing)) {
                    continue;
                }

                $schema->table($table, function (Blueprint $t) use ($missing) {
                    if (in_array('is_valid', $missing, true)) {
                        $t->boolean('is_valid')->default(true)->index();
                    }
                    if (in_array('validity_checked_at', $missing, true)) {
                        $t->dateTime('validity_checked_at')->nullable();
                    }
                    if (in_array('validity_source', $missing, true)) {
                        $t->string('validity_source', 100)->nullable();
                    }
                    if (in_array('validity_note', $missing, true)) {
                        $t->text('validity_note')->nullable();
                    }
                });
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop validity data on rollback.
    }
};
