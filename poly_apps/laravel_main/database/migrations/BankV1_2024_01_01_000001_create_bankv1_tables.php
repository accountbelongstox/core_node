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
    
    public function __construct()
    {
        $this->appKey = AppKeys::BANKV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }
    
    public function up(): void
    {
        $this->createUsersTable();
        $this->createUserProfilesTable();
        $this->createUserAddressesTable();
        $this->createAccountsTable();
        $this->createTransactionsTable();
        $this->createDevicesTable();
        $this->createSessionsTable();
        $this->createAppLogsTable();
        $this->createSecurityLogsTable();
        $this->createRegistrationCodesTable();
        $this->createCodeUsageTable();
        $this->createJwtTokensTable();
    }
    
    private function createUsersTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'username' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'email' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'email_verified_at' => ['type' => 'timestamp', 'nullable' => true],
                'password' => ['type' => 'string', 'nullable' => false],
                'full_name' => ['type' => 'string', 'nullable' => false],
                'phone' => ['type' => 'string', 'nullable' => true],
                'date_of_birth' => ['type' => 'date', 'nullable' => true],
                'gender' => ['type' => 'enum', 'values' => ['male', 'female', 'other'], 'nullable' => true],
                'account_status' => ['type' => 'enum', 'values' => ['active', 'inactive', 'suspended'], 'nullable' => false, 'default' => 'active'],
                'is_locked' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'lock_reason' => ['type' => 'string', 'nullable' => true],
                'locked_at' => ['type' => 'timestamp', 'nullable' => true],
                'last_login_at' => ['type' => 'timestamp', 'nullable' => true],
                'login_attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['username', 'email']],
                ['columns' => ['account_status']],
                ['columns' => ['is_locked']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createUserProfilesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_profiles');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'avatar' => ['type' => 'string', 'nullable' => true],
                'bio' => ['type' => 'text', 'nullable' => true],
                'preferences' => ['type' => 'json', 'nullable' => true],
                'notification_settings' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createUserAddressesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_addresses');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'type' => ['type' => 'enum', 'values' => ['primary', 'billing', 'shipping'], 'nullable' => false, 'default' => 'primary'],
                'street' => ['type' => 'string', 'nullable' => true],
                'city' => ['type' => 'string', 'nullable' => true],
                'state' => ['type' => 'string', 'nullable' => true],
                'zip_code' => ['type' => 'string', 'nullable' => true],
                'country' => ['type' => 'string', 'nullable' => true],
                'is_primary' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'type']],
                ['columns' => ['is_primary']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createAccountsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'accounts');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'account_number' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'account_type' => ['type' => 'enum', 'values' => ['checking', 'savings', 'credit'], 'nullable' => false, 'default' => 'checking'],
                'balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0.00],
                'currency' => ['type' => 'string', 'length' => 3, 'nullable' => false, 'default' => 'USD'],
                'status' => ['type' => 'enum', 'values' => ['active', 'inactive', 'closed'], 'nullable' => false, 'default' => 'active'],
                'opened_at' => ['type' => 'timestamp', 'nullable' => false],
                'closed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'status']],
                ['columns' => ['account_number']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createTransactionsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'transactions');
        $accountsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'accounts');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'transaction_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'from_account_id' => ['type' => 'foreignId', 'nullable' => true],
                'to_account_id' => ['type' => 'foreignId', 'nullable' => true],
                'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'fee' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0.00],
                'currency' => ['type' => 'string', 'length' => 3, 'nullable' => false, 'default' => 'USD'],
                'type' => ['type' => 'enum', 'values' => ['transfer', 'payment', 'deposit', 'withdrawal', 'fee', 'refund', 'adjustment'], 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['pending', 'completed', 'failed', 'cancelled', 'processing'], 'nullable' => false, 'default' => 'pending'],
                'description' => ['type' => 'string', 'nullable' => true],
                'reference' => ['type' => 'string', 'nullable' => true],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'processed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['transaction_id', 'status']],
                ['columns' => ['from_account_id', 'to_account_id']],
                ['columns' => ['type', 'status']],
                ['columns' => ['processed_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'from_account_id',
                    'references' => $accountsTableName,
                    'on' => 'id',
                ],
                [
                    'column' => 'to_account_id',
                    'references' => $accountsTableName,
                    'on' => 'id',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createDevicesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'devices');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => true],
                'device_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'app_signature' => ['type' => 'string', 'nullable' => false],
                'device_name' => ['type' => 'string', 'nullable' => true],
                'platform' => ['type' => 'enum', 'values' => ['android', 'ios', 'web', 'windows', 'macos', 'linux'], 'nullable' => false, 'default' => 'android'],
                'app_version' => ['type' => 'string', 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['active', 'locked', 'suspended', 'pending', 'revoked'], 'nullable' => false, 'default' => 'pending'],
                'is_locked' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'lock_reason' => ['type' => 'string', 'nullable' => true],
                'locked_at' => ['type' => 'timestamp', 'nullable' => true],
                'last_used_at' => ['type' => 'timestamp', 'nullable' => true],
                'registered_at' => ['type' => 'timestamp', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['device_id', 'status']],
                ['columns' => ['user_id', 'status']],
                ['columns' => ['is_locked']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createSessionsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'sessions');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'session_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'user_id' => ['type' => 'foreignId', 'nullable' => true],
                'device_id' => ['type' => 'string', 'nullable' => true],
                'ip_address' => ['type' => 'ipAddress', 'nullable' => true],
                'user_agent' => ['type' => 'text', 'nullable' => true],
                'started_at' => ['type' => 'timestamp', 'nullable' => false],
                'ended_at' => ['type' => 'timestamp', 'nullable' => true],
                'last_activity_at' => ['type' => 'timestamp', 'nullable' => false],
                'duration' => ['type' => 'integer', 'nullable' => true],
                'is_active' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['session_id', 'is_active']],
                ['columns' => ['user_id', 'device_id']],
                ['columns' => ['last_activity_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createAppLogsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'app_logs');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => true],
                'device_id' => ['type' => 'string', 'nullable' => true],
                'session_id' => ['type' => 'string', 'nullable' => true],
                'event_type' => ['type' => 'string', 'nullable' => false],
                'event_data' => ['type' => 'json', 'nullable' => true],
                'ip_address' => ['type' => 'ipAddress', 'nullable' => true],
                'user_agent' => ['type' => 'text', 'nullable' => true],
                'timestamp' => ['type' => 'timestamp', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'event_type']],
                ['columns' => ['device_id', 'event_type']],
                ['columns' => ['event_type', 'timestamp']],
                ['columns' => ['timestamp']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createSecurityLogsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'security_logs');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => true],
                'device_id' => ['type' => 'string', 'nullable' => true],
                'event_type' => ['type' => 'string', 'nullable' => false],
                'severity' => ['type' => 'enum', 'values' => ['low', 'medium', 'high', 'critical'], 'nullable' => false, 'default' => 'medium'],
                'description' => ['type' => 'string', 'nullable' => false],
                'event_data' => ['type' => 'json', 'nullable' => true],
                'ip_address' => ['type' => 'ipAddress', 'nullable' => true],
                'user_agent' => ['type' => 'text', 'nullable' => true],
                'resolved' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'resolved_at' => ['type' => 'timestamp', 'nullable' => true],
                'resolved_by' => ['type' => 'foreignId', 'nullable' => true],
                'timestamp' => ['type' => 'timestamp', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'event_type']],
                ['columns' => ['device_id', 'event_type']],
                ['columns' => ['event_type', 'severity']],
                ['columns' => ['resolved', 'severity']],
                ['columns' => ['timestamp']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'resolved_by',
                    'references' => $usersTableName,
                    'on' => 'id',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createRegistrationCodesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'registration_codes');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'code' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'type' => ['type' => 'enum', 'values' => ['balance_bonus', 'discount', 'feature_unlock'], 'nullable' => false, 'default' => 'balance_bonus'],
                'value' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0.00],
                'description' => ['type' => 'string', 'nullable' => true],
                'max_uses' => ['type' => 'integer', 'nullable' => true],
                'used_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'is_active' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'expires_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_by' => ['type' => 'foreignId', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['code', 'is_active']],
                ['columns' => ['type', 'is_active']],
                ['columns' => ['expires_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'created_by',
                    'references' => $usersTableName,
                    'on' => 'id',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createCodeUsageTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'code_usage');
        $registrationCodesTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'registration_codes');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'code_id' => ['type' => 'foreignId', 'nullable' => false],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'device_id' => ['type' => 'string', 'nullable' => true],
                'used_at' => ['type' => 'timestamp', 'nullable' => false],
                'ip_address' => ['type' => 'ipAddress', 'nullable' => true],
                'user_agent' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['code_id', 'user_id']],
                ['columns' => ['used_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'code_id',
                    'references' => $registrationCodesTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createJwtTokensTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'jwt_tokens');
        $usersTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'users');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'device_id' => ['type' => 'string', 'nullable' => true],
                'token_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'token_hash' => ['type' => 'string', 'nullable' => false],
                'refresh_token_hash' => ['type' => 'string', 'nullable' => false],
                'expires_at' => ['type' => 'timestamp', 'nullable' => false],
                'refresh_expires_at' => ['type' => 'timestamp', 'nullable' => false],
                'is_revoked' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'device_id']],
                ['columns' => ['token_hash', 'is_revoked']],
                ['columns' => ['expires_at']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => $usersTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }

    public function down(): void
    {
        $tables = [
            'jwt_tokens',
            'code_usage',
            'registration_codes',
            'security_logs',
            'app_logs',
            'sessions',
            'devices',
            'transactions',
            'accounts',
            'user_addresses',
            'user_profiles',
            'users',
        ];
        
        foreach ($tables as $tableSuffix) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, $tableSuffix);
            Schema::connection($this->connection)->dropIfExists($tableName);
        }
    }
};
