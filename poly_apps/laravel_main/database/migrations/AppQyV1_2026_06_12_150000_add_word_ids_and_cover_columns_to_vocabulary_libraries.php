<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Vocabulary storage consolidation - Wave A, step 1 (schema add only).
 *
 * vocabulary_libraries becomes the ONLY membership store:
 *  - word_ids: JSON flat array of per-language dictionary ids
 *    (app_qy_v1_tts_cache_{lang}.id, language taken from the library's
 *    `language` column - libraries are single-language).
 *  - cover_*: vocabulary_covers is absorbed as columns (one cover per
 *    library; the covers table had unique(library_id) so this is lossless).
 *    cover_description is intentionally NOT added: libraries already have a
 *    `description` column.
 *
 * Add-only via SafeMigrationHelper - never drops or rewrites existing data.
 * Data conversion happens in AppQyV1_2026_06_12_150001, drops in ..._150002.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumns($this->connection, $this->tableName, [
            'word_ids' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Flat ordered array of dictionary ids in tts_cache_{language}');
            },
            'cover_filename' => function (Blueprint $table, string $col) {
                $table->string($col, 255)->nullable();
            },
            'cover_status' => function (Blueprint $table, string $col) {
                $table->string($col, 50)->nullable()->default('pending');
            },
            'cover_prompt' => function (Blueprint $table, string $col) {
                $table->text($col)->nullable();
            },
            'cover_priority' => function (Blueprint $table, string $col) {
                $table->integer($col)->nullable()->default(0);
            },
            'cover_attempts' => function (Blueprint $table, string $col) {
                $table->integer($col)->nullable()->default(0);
            },
            'cover_error_message' => function (Blueprint $table, string $col) {
                $table->text($col)->nullable();
            },
            'cover_width' => function (Blueprint $table, string $col) {
                $table->integer($col)->nullable()->default(1280);
            },
            'cover_height' => function (Blueprint $table, string $col) {
                $table->integer($col)->nullable()->default(720);
            },
            'cover_last_requested_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable();
            },
            'cover_last_generated_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable();
            },
            'cover_started_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable();
            },
            'cover_finished_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable();
            },
        ]);

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->tableName,
            ['cover_status'],
            'idx_vocab_lib_cover_status'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback. The added
        // columns carry converted data after ..._150001; dropping them on a
        // rollback would lose the only copy once legacy tables are removed.
    }
};
