<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Unified canonical multi-language dictionary tables.
 *
 * Single source of truth: {prefix}_tts_cache_{lang} (formal) plus
 * {prefix}_tts_cache_{lang}_staging (Stage-1 import target). Schema is aligned
 * to App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel.
 *
 * Idempotent and data-safe: a hasTable() guard means already-populated tables
 * (e.g. the existing tts_cache_en) are never recreated or altered, so the
 * 103,941 EN rows are preserved. down() is intentionally a no-op so a rollback
 * never drops dictionary data.
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
                AppQyV1TableMaps::getDictionaryTableName($lang) => true,         // formal: md5 unique
                AppQyV1TableMaps::getDictionaryStagingTableName($lang) => false, // staging: md5 index
            ];

            foreach ($tables as $table => $md5Unique) {
                if ($schema->hasTable($table)) {
                    // Data-safety: never recreate/alter a populated table.
                    continue;
                }

                $schema->create($table, function (Blueprint $t) use ($md5Unique) {
                    $t->bigIncrements('id');
                    $t->text('content');
                    if ($md5Unique) {
                        $t->string('md5', 32)->unique();
                    } else {
                        $t->string('md5', 32)->index();
                    }
                    $t->text('translations')->nullable();
                    $t->boolean('has_translation')->default(false);
                    $t->string('translation_provider', 100)->nullable();
                    $t->text('phonetic')->nullable();
                    $t->text('us_phonetic')->nullable();
                    $t->text('uk_phonetic')->nullable();
                    $t->text('tts_files')->nullable();
                    $t->string('tts_provider', 100)->nullable();
                    $t->boolean('has_audio')->default(false);
                    $t->text('image_files')->nullable();
                    $t->string('image_provider', 100)->nullable();
                    $t->text('word_details')->nullable();
                    $t->boolean('is_exist_local')->default(false);
                    $t->boolean('has_operations')->default(false);
                    $t->integer('query_count')->default(0);
                    $t->dateTime('last_modified')->nullable();
                    $t->dateTime('last_query_time')->nullable();
                    $t->timestamps();
                    $t->index('content');
                    $t->index('query_count');
                    $t->index('has_translation');
                    $t->index('has_audio');
                });
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop dictionary data on rollback.
    }
};
