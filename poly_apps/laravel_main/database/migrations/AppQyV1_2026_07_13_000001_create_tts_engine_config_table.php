<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel;

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
        // Structure lives in the model (single source of truth, shared with the
        // per-sys:init alignment in seedDefaults()).
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            AppQyV1TtsEngineConfigModel::tableStructure(),
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
