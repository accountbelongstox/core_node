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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'payments');
    }

    public function up(): void
    {
        $bookingsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'bookings');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'index' => true],
                'booking_id' => ['type' => 'foreignId', 'nullable' => true, 'index' => true],
                'payment_type' => ['type' => 'string', 'nullable' => false, 'default' => 'booking', 'index' => true],
                'membership_tier' => ['type' => 'string', 'nullable' => true],
                'amount' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false],
                'currency' => ['type' => 'string', 'length' => 3, 'nullable' => false, 'default' => 'USD'],
                'payment_method' => ['type' => 'enum', 'values' => ['stripe', 'paypal', 'wechat', 'alipay', 'credit_card'], 'nullable' => false, 'default' => 'credit_card'],
                'payment_status' => ['type' => 'enum', 'values' => ['pending', 'processing', 'completed', 'failed', 'refunded'], 'nullable' => false, 'default' => 'pending', 'index' => true],
                'transaction_id' => ['type' => 'string', 'nullable' => true, 'unique' => true],
                'payment_intent_id' => ['type' => 'string', 'nullable' => true],
                'client_secret' => ['type' => 'string', 'nullable' => true],
                'receipt_url' => ['type' => 'text', 'nullable' => true],
                'payment_details' => ['type' => 'json', 'nullable' => true],
                'paid_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['booking_id']],
                ['columns' => ['payment_status']],
                ['columns' => ['payment_type']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'booking_id',
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
