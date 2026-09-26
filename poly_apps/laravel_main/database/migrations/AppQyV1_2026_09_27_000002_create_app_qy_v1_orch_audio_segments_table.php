<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Declared output segments of an orchestration task. The segment is ready when
 * stored_sha256 equals the declared audio_sha256.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'orch_audio_segments');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_key' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'index' => true],
                'segment_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'sentence_start' => ['type' => 'integer', 'nullable' => true],
                'sentence_end' => ['type' => 'integer', 'nullable' => true],
                'status' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                'audio_sha256' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'audio_bytes' => ['type' => 'bigInteger', 'nullable' => false, 'default' => 0],
                'duration_ms' => ['type' => 'bigInteger', 'nullable' => false, 'default' => 0],
                'timeline' => ['type' => 'json', 'nullable' => true, 'comment' => '[{seq, type, start_ms, end_ms}] inside the segment mp3'],
                'stored_sha256' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'started_at' => ['type' => 'timestamp', 'nullable' => true],
                'finished_at' => ['type' => 'timestamp', 'nullable' => true],
                'stored_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['task_key', 'segment_index'], 'unique' => true, 'name' => 'uniq_orch_audio_segment_pos'],
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
