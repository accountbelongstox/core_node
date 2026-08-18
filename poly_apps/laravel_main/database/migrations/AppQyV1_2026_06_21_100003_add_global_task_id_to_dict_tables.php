<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;

/**
 * Phase 5 — Dual-write link columns on the canonical AppQyV1 dictionary tables.
 *
 * Each per-language word table ({prefix}_tts_cache_{lang}) gains tts_global_task_id
 * and image_global_task_id; each article table ({prefix}_{lang}_article_library)
 * gains tts_global_task_id. They hold the task_id of the linked GlobalTask the
 * dual-write path creates, so a row can be reconciled with its generic task.
 *
 * Add-only via SafeMigrationHelper, guarded by hasTable per language so it is a
 * no-op where a table is absent. Unused unless APPQYV1_DUAL_WRITE_GLOBAL is on.
 */
return new class extends Migration
{
    protected $connection;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
    }

    public function up(): void
    {
        $wordColumns = [
            'tts_global_task_id' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Linked GlobalTask id for the audio dual-write path');
            },
            'image_global_task_id' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Linked GlobalTask id for the image dual-write path');
            },
        ];

        $articleColumns = [
            'tts_global_task_id' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Linked GlobalTask id for the article audio dual-write path');
            },
        ];

        $languages = AppQyV1DictionaryTTSCoordinator::supportedLanguages();

        foreach ($languages as $lang) {
            // Word table: derive the exact name from the authoritative model.
            try {
                $wordTable = AppQyV1LangDictionaryModel::forLanguage($lang)->getTable();
                if ($wordTable && Schema::connection($this->connection)->hasTable($wordTable)) {
                    SafeMigrationHelper::safeAddColumns($this->connection, $wordTable, $wordColumns);
                    SafeMigrationHelper::safeAddIndex(
                        $this->connection,
                        $wordTable,
                        ['tts_global_task_id'],
                        'idx_' . $wordTable . '_tts_gtid'
                    );
                    SafeMigrationHelper::safeAddIndex(
                        $this->connection,
                        $wordTable,
                        ['image_global_task_id'],
                        'idx_' . $wordTable . '_img_gtid'
                    );
                }
            } catch (\Throwable $e) {
                // Skip a language whose word table cannot be resolved.
            }

            // Article table: same convention the queue services use.
            $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (Schema::connection($this->connection)->hasTable($articleTable)) {
                SafeMigrationHelper::safeAddColumns($this->connection, $articleTable, $articleColumns);
                SafeMigrationHelper::safeAddIndex(
                    $this->connection,
                    $articleTable,
                    ['tts_global_task_id'],
                    'idx_' . $articleTable . '_tts_gtid'
                );
            }
        }
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
