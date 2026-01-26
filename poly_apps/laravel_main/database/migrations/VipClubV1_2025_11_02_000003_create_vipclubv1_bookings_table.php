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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'bookings');
    }

    public function up(): void
    {
        $facilitiesTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'facilities');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'facility_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'facility_type' => ['type' => 'enum', 'values' => ['shooting', 'golf', 'hotel'], 'nullable' => false],
                'facility_name' => ['type' => 'string', 'nullable' => false],
                'booking_date' => ['type' => 'date', 'nullable' => false, 'index' => true],
                'time_slot' => ['type' => 'string', 'nullable' => false],
                'duration' => ['type' => 'integer', 'nullable' => false, 'default' => 1],
                'price' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'discount' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'final_price' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'status' => ['type' => 'enum', 'values' => ['pending', 'confirmed', 'cancelled', 'completed'], 'nullable' => false, 'default' => 'pending', 'index' => true],
                'extras' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['facility_id']],
                ['columns' => ['booking_date']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'facility_id',
                    'references' => $facilitiesTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
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
