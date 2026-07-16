<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * DB-driven TTS engine priority config (app_qy_v1_tts_engine_config).
 *
 * Canonical engine priority order for the TTS orchestrator + the Queue Center
 * drawer. Static table, auto-discovered by sys:init's single migrate --force.
 * Idempotent add-only via SafeMigrationHelper::alignTableStructureFromArray;
 * down() drops only on an explicit rollback. Default rows are seeded by
 * InitializeApps (sys:init) via AppQyV1TtsEngineConfigModel::seedDefaults().
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_engine_config');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'engine' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'comment' => 'TTS engine id (chattts|cosyvoice|fishspeech|qwen3tts|bark|parler|voxcpm2|kokoro|gptsovits|f5tts|melotts|sherpa|edge|streamelements|gtts_web|azure)'],
                'priority_order' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'lower = sooner in the orchestrator chain'],
                'enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => true, 'comment' => 'operator can disable an engine without deleting it'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['engine'], 'unique' => true, 'name' => 'uniq_tts_engine_config_engine'],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
