<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'daily_recitation_logs');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'comment' => 'Owner user id (global users table)'],
                'date' => ['type' => 'date', 'nullable' => false, 'comment' => 'Recitation day (server timezone)'],
                'word' => ['type' => 'string', 'length' => 255, 'nullable' => false, 'comment' => 'Recited word text (personal_dicts key)'],
                'language_code' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'default' => 'en', 'comment' => 'Study language code'],
                'action' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'comment' => 'read|learn|review_correct|review_wrong'],
                'session_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Client recitation session id'],
                'batch_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Client batch id for offline-replay idempotency'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id'], 'name' => 'idx_daily_recitation_logs_user'],
                ['columns' => ['user_id', 'date'], 'name' => 'idx_daily_recitation_logs_user_date'],
                ['columns' => ['batch_id'], 'name' => 'idx_daily_recitation_logs_batch'],
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
