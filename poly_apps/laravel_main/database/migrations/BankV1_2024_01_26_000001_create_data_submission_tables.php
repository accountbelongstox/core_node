<?php

use Illuminate\Database\Migrations\Migration;
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
        // Table 1: bankv1_device_submissions
        $this->createDeviceSubmissionsTable();
        
        // Table 2: bankv1_registration_submissions
        $this->createRegistrationSubmissionsTable();
        
        // Table 3: bankv1_user_data_submissions
        $this->createUserDataSubmissionsTable();
        
        // Table 4: bankv1_bank_card_submissions
        $this->createBankCardSubmissionsTable();
    }
    
    private function createDeviceSubmissionsTable(): void
    {
        $tableName = 'bankv1_device_submissions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'device_id' => ['type' => 'string', 'nullable' => false, 'index' => true],
                'device_name' => ['type' => 'string', 'nullable' => false],
                'machine_code' => ['type' => 'string', 'nullable' => false, 'index' => true],
                'platform' => ['type' => 'string', 'nullable' => false],
                'platform_version' => ['type' => 'string', 'nullable' => false],
                'ip_address' => ['type' => 'ipAddress', 'nullable' => true],
                'app_signature' => ['type' => 'string', 'nullable' => false],
                'additional_info' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['device_id', 'machine_code']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createRegistrationSubmissionsTable(): void
    {
        $tableName = 'bankv1_registration_submissions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'device_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'registration_code' => ['type' => 'string', 'nullable' => true, 'index' => true],
                'is_registered' => ['type' => 'boolean', 'nullable' => false],
                'is_super_user' => ['type' => 'boolean', 'nullable' => false],
                'registration_time' => ['type' => 'timestamp', 'nullable' => true],
                'expiration_time' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['device_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'device_id',
                    'references' => 'bankv1_device_submissions',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createUserDataSubmissionsTable(): void
    {
        $tableName = 'bankv1_user_data_submissions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'device_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'phone' => ['type' => 'string', 'nullable' => true, 'index' => true],
                'full_name' => ['type' => 'string', 'nullable' => true],
                'location' => ['type' => 'string', 'nullable' => true],
                'city' => ['type' => 'string', 'nullable' => true],
                'total_balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => true],
                'user_id' => ['type' => 'string', 'nullable' => true],
                'username' => ['type' => 'string', 'nullable' => true],
                'email' => ['type' => 'string', 'nullable' => true],
                'role_level' => ['type' => 'integer', 'nullable' => true],
                'role_name' => ['type' => 'string', 'nullable' => true],
                'additional_data' => ['type' => 'json', 'nullable' => true],
                'submit_time' => ['type' => 'timestamp', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['device_id']],
                ['columns' => ['phone']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'device_id',
                    'references' => 'bankv1_device_submissions',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createBankCardSubmissionsTable(): void
    {
        $tableName = 'bankv1_bank_card_submissions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_data_submission_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'card_number' => ['type' => 'text', 'nullable' => false, 'index' => true],
                'card_type' => ['type' => 'string', 'nullable' => false],
                'balance' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'currency' => ['type' => 'string', 'length' => 3, 'nullable' => false],
                'opened_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_data_submission_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_data_submission_id',
                    'references' => 'bankv1_user_data_submissions',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('bankv1_bank_card_submissions');
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('bankv1_user_data_submissions');
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('bankv1_registration_submissions');
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('bankv1_device_submissions');
    }
};
