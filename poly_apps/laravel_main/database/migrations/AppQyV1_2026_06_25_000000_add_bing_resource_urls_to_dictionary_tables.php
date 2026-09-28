<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Add the FULL remote Bing resource URLs to the canonical per-language dictionary
 * tables ({prefix}_tts_cache_{lang}). The Bing chrome worker captures the image
 * (*.bing.net) + pronunciation (/dict/mediamp3) BYTES in-page and ships base64,
 * but the remote URLs were discarded. Persisting them lets the missing-media
 * REPAIR re-fetch the bytes in-page from the stored URL WITHOUT a full
 * re-translate (a Bing dictionary search) — the fast path.
 *
 * Shape (JSON): { "images": ["https://.../th?id=...", ...], "audio": "https://.../dict/mediamp3?..." }
 *
 * Idempotent + data-safe: per-column hasColumn() guard; down() is a no-op so a
 * rollback never strips the URLs. text() (not json()) keeps PG/SQLite symmetric,
 * matching image_files. Applied by `php artisan sys:init` (-> migrate --force).
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
            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!$schema->hasTable($table)) {
                continue;
            }
            if ($schema->hasColumn($table, 'bing_resource_urls')) {
                continue;
            }
            $schema->table($table, function (Blueprint $t) {
                // text (not json) — PG + SQLite symmetric, matches image_files.
                $t->text('bing_resource_urls')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop the stored Bing URLs on rollback.
    }
};
