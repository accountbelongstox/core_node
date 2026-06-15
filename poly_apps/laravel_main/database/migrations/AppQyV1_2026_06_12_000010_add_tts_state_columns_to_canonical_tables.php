<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * TTS generation state moves INTO the canonical tables — the intermediate
 * app_qy_v1_tts_queue table is decommissioned (see
 * App\Services\AppQyV1TTSQueueDecommission, run from sys:init).
 *
 * "What needs audio" is now answered directly by the source of truth:
 *   - words:    {prefix}_tts_cache_{lang}  (has_audio=false ⇒ needs generation)
 *   - articles: {prefix}_articles          (has_audio=false ⇒ needs generation)
 *
 * The columns added here carry only the PROCESS state the queue table used to
 * hold (claim locking for workers such as pycore, retry bookkeeping, errors):
 *   - tts_status        null | pending | processing | completed | failed
 *                       (null = never explicitly requested; pending derives
 *                       from has_audio=false either way)
 *   - tts_attempts      generation attempts (retry cap enforced in service)
 *   - tts_error         last failure message
 *   - tts_locked_at     when a processor claimed the row (stale after 10 min)
 *   - tts_locked_by     processor identity (octane-timer | pycore worker id)
 *   - tts_priority      higher first; user-facing requests outrank backfill
 *   - tts_requested_at  when generation was first requested
 *   - tts_completed_at  when generation last succeeded
 *
 * Idempotent and data-safe: per-column hasColumn() guards; down() is a no-op
 * so a rollback never strips generation state.
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

        $targets = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $targets[] = AppQyV1TableMaps::getDictionaryTableName($lang);
            // Articles own their audio state too (has_audio / audio_files
            // already live on the per-language article tables); they get the
            // same process-state columns.
            $targets[] = AppTablePrefixServiceProvider::buildTableName($this->appKey, "{$lang}_article_library");
        }

        foreach ($targets as $table) {
            if (!$schema->hasTable($table)) {
                continue;
            }

            $columns = [
                'tts_status',
                'tts_attempts',
                'tts_error',
                'tts_locked_at',
                'tts_locked_by',
                'tts_priority',
                'tts_requested_at',
                'tts_completed_at',
            ];

            $missing = [];
            foreach ($columns as $column) {
                if (!$schema->hasColumn($table, $column)) {
                    $missing[] = $column;
                }
            }

            if (empty($missing)) {
                continue;
            }

            $schema->table($table, function (Blueprint $t) use ($missing) {
                if (in_array('tts_status', $missing, true)) {
                    // String (not enum) keeps PG/SQLite drivers symmetric.
                    $t->string('tts_status', 20)->nullable()->index();
                }
                if (in_array('tts_attempts', $missing, true)) {
                    $t->integer('tts_attempts')->default(0);
                }
                if (in_array('tts_error', $missing, true)) {
                    $t->text('tts_error')->nullable();
                }
                if (in_array('tts_locked_at', $missing, true)) {
                    $t->dateTime('tts_locked_at')->nullable()->index();
                }
                if (in_array('tts_locked_by', $missing, true)) {
                    $t->string('tts_locked_by', 100)->nullable();
                }
                if (in_array('tts_priority', $missing, true)) {
                    $t->integer('tts_priority')->default(0)->index();
                }
                if (in_array('tts_requested_at', $missing, true)) {
                    $t->dateTime('tts_requested_at')->nullable();
                }
                if (in_array('tts_completed_at', $missing, true)) {
                    $t->dateTime('tts_completed_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop TTS generation state on rollback.
    }
};
