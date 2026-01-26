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
        $this->appKey = AppKeys::VIPCLUBV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'points_transactions');
    }

    public function up(): void
    {
        $bookingsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'bookings');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'points' => ['type' => 'integer', 'nullable' => false],
                'type' => ['type' => 'enum', 'values' => ['earn', 'redeem'], 'nullable' => false, 'index' => true],
                'description' => ['type' => 'text', 'nullable' => true],
                'related_booking_id' => ['type' => 'foreignId', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['type']],
                ['columns' => ['created_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'related_booking_id',
                    'references' => $bookingsTableName,
                    'on' => 'id',
                    'onDelete' => 'set null',
                ],
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
