<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Books Sentence/Word Model v2 - add content_id to the shared sentence library.
 *
 * content_id = md5(normalize(strip_punctuation(text))) (NO language in the hash;
 * identical stripped text dedupes across languages). The legacy sentence_id
 * (sha1(normalize(text)+'|'+language)) is KEPT for backward compatibility with
 * the v1 ingest path and existing readers. From v2 the stored `text` is
 * punctuation-stripped (pycore sends it stripped); the `audio` column is kept
 * and filled later by the TTS pipeline.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'sentences');
    }

    public function up(): void
    {
        // hasColumn guard is handled inside SafeMigrationHelper::safeAddColumns
        // (only adds when missing), so re-runs are safe.
        SafeMigrationHelper::safeAddColumns($this->connection, $this->tableName, [
            'content_id' => function (Blueprint $table, string $col) {
                $table->string($col, 32)->nullable()
                    ->comment('v2 dedup key = md5(normalize(strip_punctuation(text))); no language');
            },
        ]);

        // Unique index added separately (safe: skipped when already present).
        SafeMigrationHelper::safeAddUniqueIndex(
            $this->connection,
            $this->tableName,
            ['content_id'],
            'uniq_app_qy_v1_sentences_content_id'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
