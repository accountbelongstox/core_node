<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Extend {prefix}_source_sentences with the v3 chapter + cross-language
 * correspondence anchor columns (Books v3 unified model — see
 * poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §3.3).
 *
 * source_sentences is language-independent: one row per (source, grain, seq)
 * slot. The per-language text lives in {prefix}_sentences_{lang} keyed by the
 * content_id found in lang_content_ids.
 *
 * Idempotent and data-safe: per-column hasColumn() guards; down() is a no-op so
 * a rollback never strips correspondence data.
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

        $columns = [
            'chapter_index',
            'corr_id',
            'primary_language',
            'lang_content_ids',
        ];

        $missing = [];
        foreach ($columns as $column) {
            if (!$schema->hasColumn($this->tableName, $column)) {
                $missing[] = $column;
            }
        }

        if (empty($missing)) {
            return;
        }

        $schema->table($this->tableName, function (Blueprint $t) use ($missing) {
            if (in_array('chapter_index', $missing, true)) {
                // Which chapter this slot belongs to (0-based).
                $t->integer('chapter_index')->default(0)->index();
            }
            if (in_array('corr_id', $missing, true)) {
                // Correspondence group id for this slot.
                $t->string('corr_id', 40)->nullable()->index();
            }
            if (in_array('primary_language', $missing, true)) {
                // The source's primary language code.
                $t->string('primary_language', 20)->nullable();
            }
            if (in_array('lang_content_ids', $missing, true)) {
                // {"en":"<md5>","ja":null,"zh":"<md5>"} — null = empty correspondence.
                $t->json('lang_content_ids')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Intentionally empty: never strip correspondence data on rollback.
    }
};
