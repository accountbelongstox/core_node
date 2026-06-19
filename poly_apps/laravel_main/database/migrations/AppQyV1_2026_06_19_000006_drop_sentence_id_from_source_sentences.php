<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Drop the redundant `sentence_id` column from {prefix}_source_sentences
 * (Books v3.1 §3.3 — redundancy note).
 *
 * The per-language link is now carried entirely by `lang_content_ids`
 * (content_id refs into sentences_{lang}); the slot's unique key
 * (source_type, source_key, grain, seq) does NOT use sentence_id, so dropping it
 * is safe. NOTE: sentence_id stays ON the per-language sentences_{lang} tables
 * (its legacy within-row key) — only this language-independent index table loses
 * it.
 *
 * Idempotent and data-safe: a hasColumn() guard means a re-run is a no-op; down()
 * is intentionally a no-op (the column is not recreated).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->tableName)) {
            return;
        }
        if (!$schema->hasColumn($this->tableName, 'sentence_id')) {
            return;
        }

        $schema->table($this->tableName, function (Blueprint $t) {
            $t->dropColumn('sentence_id');
        });
    }

    public function down(): void
    {
        // Intentionally empty: the redundant sentence_id column is not recreated.
    }
};
