<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * PddToolV1 (订多多) schema. Add-only / idempotent: every table is aligned via
 * SafeMigrationHelper::alignTableStructureFromArray, so re-running only ADDS
 * missing columns/indexes and never drops data. Routed onto the per-app
 * 'pddtoolv1' connection.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;

    public function __construct()
    {
        $this->appKey = AppKeys::PDDTOOLV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    private function table(string $suffix): string
    {
        return AppTablePrefixServiceProvider::buildTableName($this->appKey, $suffix);
    }

    public function up(): void
    {
        $options = [
            'shrink_columns' => false,
            'modify_columns' => true,
            'add_indexes' => true,
        ];

        // profiles — PddToolV1 membership data, keyed by user_id (= global users.id).
        // Identity (username / password / Sanctum tokens) lives in the global users
        // table on the `main` connection; this row only carries app-specific
        // membership fields. One row per user.
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('profiles'), [
            'columns' => [
                // One profile per global user. user_id is the logical key (= users.id);
                // a unique constraint enforces one-row-per-user (the Eloquent model
                // treats user_id as a non-incrementing primary key).
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'unique' => true],
                'package_name' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => 'TRIAL'],
                'payment_model' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                'valid_until' => ['type' => 'timestamp', 'nullable' => true],
                'max_orders' => ['type' => 'integer', 'nullable' => false, 'default' => 10],
                'max_pdd_accounts' => ['type' => 'integer', 'nullable' => false, 'default' => 2],
                'points' => ['type' => 'decimal', 'precision' => 12, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'invite_code' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                'app_type' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'acquisition_source' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'disabled' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'last_login' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['package_name'], 'name' => 'pdd_profiles_package_idx'],
                ['columns' => ['valid_until'], 'name' => 'pdd_profiles_valid_until_idx'],
            ],
        ], $options);

        // pdd_accounts
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('pdd_accounts'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'pdd_user_id' => ['type' => 'string', 'length' => 191, 'nullable' => false],
                'pdd_name' => ['type' => 'string', 'length' => 191, 'nullable' => true],
                'pdd_avatar' => ['type' => 'text', 'nullable' => true],
                'pdd_access_token' => ['type' => 'text', 'nullable' => true],
                'pdd_cookie' => ['type' => 'text', 'nullable' => true],
                'mobile_bind' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'dd_info' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'pdd_user_id'], 'name' => 'pdd_accounts_user_pdd_unique', 'unique' => true],
                ['columns' => ['user_id'], 'name' => 'pdd_accounts_user_idx'],
            ],
        ], $options);

        // warehouses
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('warehouses'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'warehouse_code' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'warehouse_name' => ['type' => 'string', 'length' => 191, 'nullable' => true],
                'receiver_name' => ['type' => 'string', 'length' => 191, 'nullable' => true],
                'phone' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'province' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'city' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'district' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'detail_address' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'warehouse_code'], 'name' => 'pdd_warehouses_user_code_unique', 'unique' => true],
                ['columns' => ['user_id'], 'name' => 'pdd_warehouses_user_idx'],
            ],
        ], $options);

        // batch_orders
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('batch_orders'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'batch_id' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'order_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'status' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => 'created'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['batch_id'], 'name' => 'pdd_batch_orders_batch_unique', 'unique' => true],
                ['columns' => ['user_id'], 'name' => 'pdd_batch_orders_user_idx'],
            ],
        ], $options);

        // batch_purchase_orders
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('batch_purchase_orders'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'batch_id' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'purchase_order_no' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'goods_id' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'sku_id' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'quantity' => ['type' => 'integer', 'nullable' => false, 'default' => 1],
                'status' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => 'pending'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['batch_id'], 'name' => 'pdd_bpo_batch_idx'],
                ['columns' => ['user_id'], 'name' => 'pdd_bpo_user_idx'],
            ],
        ], $options);

        // recharges
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('recharges'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'username' => ['type' => 'string', 'length' => 191, 'nullable' => true],
                'out_trade_no' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'amount' => ['type' => 'decimal', 'precision' => 12, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'method' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'default' => 'alipay'],
                'status' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'default' => 'pending'],
                'package_name' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                'period' => ['type' => 'string', 'length' => 16, 'nullable' => true],
                'grant_days' => ['type' => 'integer', 'nullable' => true],
                'pay_url' => ['type' => 'text', 'nullable' => true],
                'qr_code' => ['type' => 'text', 'nullable' => true],
                'sandbox' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'paid_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['out_trade_no'], 'name' => 'pdd_recharges_out_trade_no_unique', 'unique' => true],
                ['columns' => ['user_id'], 'name' => 'pdd_recharges_user_idx'],
                ['columns' => ['status'], 'name' => 'pdd_recharges_status_idx'],
            ],
        ], $options);

        // packages
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('packages'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'code' => ['type' => 'string', 'length' => 32, 'nullable' => false],
                'name' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'price_month' => ['type' => 'decimal', 'precision' => 12, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'price_year' => ['type' => 'decimal', 'precision' => 12, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'max_orders' => ['type' => 'integer', 'nullable' => false, 'default' => 10],
                'max_pdd_accounts' => ['type' => 'integer', 'nullable' => false, 'default' => 2],
                'enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['code'], 'name' => 'pdd_packages_code_unique', 'unique' => true],
            ],
        ], $options);

        // usage_logs
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('usage_logs'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'action' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'meta' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id'], 'name' => 'pdd_usage_logs_user_idx'],
                ['columns' => ['action'], 'name' => 'pdd_usage_logs_action_idx'],
            ],
        ], $options);

        // payment_settings (single-row gateway config)
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $this->table('payment_settings'), [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'alipay_enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'alipay_app_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'wechat_enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'wechat_mch_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'wechat_app_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [],
        ], $options);
    }

    public function down(): void
    {
        $schema = \Illuminate\Support\Facades\Schema::connection($this->connection);
        foreach ([
            'payment_settings', 'usage_logs', 'packages', 'recharges',
            'batch_purchase_orders', 'batch_orders', 'warehouses',
            'pdd_accounts', 'profiles',
        ] as $suffix) {
            $schema->dropIfExists($this->table($suffix));
        }
    }
};
