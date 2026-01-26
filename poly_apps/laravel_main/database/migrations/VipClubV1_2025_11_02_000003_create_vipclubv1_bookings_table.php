<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'vipclubv1';
    protected $tableName = 'vipclubv1_bookings';

    public function up(): void
    {
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
                    'references' => 'vipclubv1_facilities',
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
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
