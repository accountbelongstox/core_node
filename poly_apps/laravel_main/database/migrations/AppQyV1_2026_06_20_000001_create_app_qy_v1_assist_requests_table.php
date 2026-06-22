<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * {prefix}_assist_requests — record-scoped assist-request layer (CoreBook §6).
 *
 * Per-record assist selection does NOT exist in the worker-pull assist pool
 * (covers/TTS/poster claimed by media-type, not per record). This thin table
 * lets a human (Task Center modal) or pycore (partial CoreBook submit) file the
 * specific missing pieces for ONE record so the task-queue finishes them:
 *
 *   - record_type  'book'|'subtitle'     which media record the request targets
 *   - source_key   the record's stable id (sha1)
 *   - request_type 'add_language'|'fill_audio'|'cover'|'poster'
 *   - language     nullable target lang code (null for cover/poster)
 *   - status       pending|claimed|processing|completed|failed
 *   - priority     higher first
 *   - claimed_by   worker identity (60-minute lease via claimed_at)
 *   - payload/result json, error text
 *
 * Unique (record_type, source_key, request_type, language) makes create
 * idempotent — re-filing the same gap upserts the existing row instead of
 * duplicating it.
 *
 * Idempotent via SafeMigrationHelper - re-running sys:init only ADDS missing
 * columns/indexes and NEVER drops data; guarded by hasTable; PostgreSQL-safe.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'assist_requests');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'record_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'book', 'index' => true, 'comment' => 'book|subtitle'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'Record stable id (sha1)'],
                'request_type' => ['type' => 'string', 'length' => 30, 'nullable' => false, 'index' => true, 'comment' => 'add_language|fill_audio|cover|poster'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'comment' => 'Target language code (null for cover/poster)'],
                'status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'pending', 'index' => true, 'comment' => 'pending|claimed|processing|completed|failed'],
                'priority' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Higher first'],
                'claimed_by' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Worker identity holding the lease'],
                'claimed_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Lease start (60-minute lease)'],
                'payload' => ['type' => 'json', 'nullable' => true, 'comment' => 'Request parameters'],
                'result' => ['type' => 'json', 'nullable' => true, 'comment' => 'Worker-reported result'],
                'error' => ['type' => 'text', 'nullable' => true, 'comment' => 'Last failure message'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['record_type']],
                ['columns' => ['source_key']],
                ['columns' => ['request_type']],
                ['columns' => ['status']],
                ['columns' => ['record_type', 'source_key', 'request_type', 'language'], 'unique' => true, 'name' => 'uniq_assist_request'],
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
