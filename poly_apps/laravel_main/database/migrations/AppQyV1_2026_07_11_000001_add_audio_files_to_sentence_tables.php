<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Multi-variant sentence audio registry (Books v3.1 extension).
 *
 * audio_files JSON array — one entry per clip variant (accent, source, voice_type).
 * Idempotent: per-table hasColumn guard; down() is a no-op (data-safe).
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
            $table = AppQyV1TableMaps::getSentenceTableName($lang);
            if (!$schema->hasTable($table) || $schema->hasColumn($table, 'audio_files')) {
                continue;
            }
            $schema->table($table, function (Blueprint $blueprint) {
                $blueprint->json('audio_files')->nullable()->after('metadata')
                    ->comment('Multi-variant audio registry [{variant_key,accent,source,voice_type,provider,path,has_file}]');
            });
        }
    }

    public function down(): void
    {
        // Data-safe: never drop audio_files on rollback.
    }
};
