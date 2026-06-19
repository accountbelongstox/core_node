<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Add selected_languages to {prefix}_subtitles (Books/Subtitles v3.1 §12.2).
 *
 * Subtitles reuse the per-language sentence model. The UI multi-select on the
 * Voice & Subtitle page submits the checked correspondence languages (>=1,
 * primary locked, auto-including every detected track language); the set is
 * stored here as a JSON array of language CODES (mirrors books). The per-slot
 * lang_content_ids carries the actual per-language correspondence.
 *
 * Idempotent and data-safe: a hasColumn() guard means a re-run is a no-op; down()
 * is intentionally non-destructive (the column is left in place).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'subtitles');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->tableName)) {
            return;
        }
        if ($schema->hasColumn($this->tableName, 'selected_languages')) {
            return;
        }

        $schema->table($this->tableName, function (Blueprint $t) {
            // Checked correspondence languages (codes); null when never set.
            $t->json('selected_languages')->nullable();
        });
    }

    public function down(): void
    {
        // Intentionally empty: never strip the selected_languages column.
    }
};
