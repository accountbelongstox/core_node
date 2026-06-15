<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Books Sentence/Word Model v2 - add content_id + reconstruction columns to books.
 *
 *  - content_id   : md5(normalize(strip_punctuation(full_content))), UNIQUE.
 *  - sentence_seq : ordered reconstruction sequence interleaving sentence
 *                   content-ids with punctuation-marker codes, e.g.
 *                   [{"s":"<content_id>"},{"m":"period"},{"s":"<content_id>"}].
 *  - word_ids     : { "<lang>": ["<md5>", ...] } distinct word md5s per language
 *                   (matches app_qy_v1_tts_cache_<lang>.md5).
 *
 * Add-only via SafeMigrationHelper - never drops or rewrites existing data.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumns($this->connection, $this->tableName, [
            'content_id' => function (Blueprint $table, string $col) {
                $table->string($col, 32)->nullable()
                    ->comment('v2 dedup key = md5(normalize(strip_punctuation(full_content)))');
            },
            'sentence_seq' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Ordered reconstruction sequence: sentence content-ids interleaved with marker codes');
            },
            'word_ids' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Distinct word md5s per language { lang: [md5,...] }');
            },
        ]);

        SafeMigrationHelper::safeAddUniqueIndex(
            $this->connection,
            $this->tableName,
            ['content_id'],
            'uniq_app_qy_v1_books_content_id'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
