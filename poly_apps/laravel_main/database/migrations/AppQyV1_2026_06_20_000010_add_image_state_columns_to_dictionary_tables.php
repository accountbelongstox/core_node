<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Word-image generation state moves INTO the canonical per-language dictionary
 * tables ({prefix}_tts_cache_{lang}), mirroring the TTS process-state columns
 * added by add_tts_state_columns_to_canonical_tables.
 *
 * "What needs an image" is answered directly by the source of truth:
 *   {prefix}_tts_cache_{lang}  (has_image=false / image_files empty => needs one)
 *
 * The columns added here carry the IMAGE queue PROCESS state (claim locking for
 * the word-image queue + workers, retry bookkeeping, priority):
 *   - image_status        null | pending | processing | completed | failed
 *                         (null = never explicitly requested)
 *   - image_priority      higher first; user-facing requests outrank backfill
 *   - image_locked_at     when a processor claimed the row (stale after timeout)
 *   - image_locked_by     processor identity (queue worker id)
 *   - image_attempts      generation attempts (retry cap enforced in service)
 *   - image_requested_at  when generation was first requested
 *   - image_completed_at  when generation last succeeded
 *
 * Idempotent and data-safe: per-column hasColumn() guards; down() is a no-op
 * so a rollback never strips generation state. Cross-DB safe (string/int/
 * dateTime only; PostgreSQL default + sqlite legacy).
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
        }

        foreach ($targets as $table) {
            if (!$schema->hasTable($table)) {
                continue;
            }

            $columns = [
                'image_status',
                'image_priority',
                'image_locked_at',
                'image_locked_by',
                'image_attempts',
                'image_requested_at',
                'image_completed_at',
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
                if (in_array('image_status', $missing, true)) {
                    // String (not enum) keeps PG/SQLite drivers symmetric.
                    $t->string('image_status', 20)->nullable()->index();
                }
                if (in_array('image_priority', $missing, true)) {
                    $t->integer('image_priority')->default(0)->index();
                }
                if (in_array('image_locked_at', $missing, true)) {
                    $t->dateTime('image_locked_at')->nullable();
                }
                if (in_array('image_locked_by', $missing, true)) {
                    $t->string('image_locked_by', 100)->nullable();
                }
                if (in_array('image_attempts', $missing, true)) {
                    $t->integer('image_attempts')->default(0);
                }
                if (in_array('image_requested_at', $missing, true)) {
                    $t->dateTime('image_requested_at')->nullable();
                }
                if (in_array('image_completed_at', $missing, true)) {
                    $t->dateTime('image_completed_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop image generation state on rollback.
    }
};
