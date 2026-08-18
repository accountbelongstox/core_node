<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Multi-variant word audio registry on canonical tts_cache_{lang} tables.
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
            if (!$schema->hasTable($table) || $schema->hasColumn($table, 'audio_files')) {
                continue;
            }
            $schema->table($table, function (Blueprint $blueprint) {
                $blueprint->json('audio_files')->nullable()->after('tts_files')
                    ->comment('Multi-variant word audio [{variant_key,accent,gender,source,provider,path,has_file}]');
            });
        }
    }

    public function down(): void
    {
        // Data-safe: never drop audio_files on rollback.
    }
};
