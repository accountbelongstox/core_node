<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Pycore audio-orchestration tasks delivered to Laravel (one row per
 * machine_id + task_id). task_key is the stable public identity.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'orch_audio_tasks');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_key' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'unique' => true, 'comment' => 'sha256(machine_id\ntask_id)[0:40]'],
                'machine_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true],
                'task_id' => ['type' => 'string', 'length' => 128, 'nullable' => false],
                'source' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'index' => true],
                'name' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true],
                'status' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => 'draft'],
                'meta_hash' => ['type' => 'string', 'length' => 128, 'nullable' => false],
                'source_ref' => ['type' => 'json', 'nullable' => true],
                'source_text' => ['type' => 'longText', 'nullable' => true],
                'preview_text' => ['type' => 'string', 'length' => 500, 'nullable' => true],
                'pattern' => ['type' => 'json', 'nullable' => true],
                'sentences' => ['type' => 'json', 'nullable' => true],
                'resources' => ['type' => 'json', 'nullable' => true],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'segment_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'segments_ready' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'duration_ms' => ['type' => 'bigInteger', 'nullable' => false, 'default' => 0],
                'task_created_at' => ['type' => 'timestamp', 'nullable' => true],
                'task_updated_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'generation_started_at' => ['type' => 'timestamp', 'nullable' => true],
                'generation_finished_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['machine_id', 'task_id'], 'unique' => true, 'name' => 'uniq_orch_audio_task_origin'],
                ['columns' => ['source', 'task_updated_at'], 'name' => 'idx_orch_audio_task_source_time'],
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
