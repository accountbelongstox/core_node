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
        $this->appKey = AppKeys::CODEMARTV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $this->createEmailVerificationsTable();
        $this->createPhoneVerificationsTable();
        $this->createKycVerificationsTable();
        $this->createUserRolesTable();
        $this->createDeveloperProfilesTable();
        $this->createClientProfilesTable();
    }

    private function createEmailVerificationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'email_verifications');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'email' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'token' => ['type' => 'string', 'nullable' => false],
                'verified_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['token']],
                ['columns' => ['email']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createPhoneVerificationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'phone_verifications');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'phone' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'otp_code' => ['type' => 'string', 'nullable' => false],
                'otp_attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'otp_expires_at' => ['type' => 'timestamp', 'nullable' => false],
                'verified_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['phone']],
                ['columns' => ['user_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createKycVerificationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'kyc_verifications');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'identity_type' => ['type' => 'string', 'nullable' => false],
                'identity_number' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'real_name' => ['type' => 'string', 'nullable' => false],
                'date_of_birth' => ['type' => 'date', 'nullable' => true],
                'id_front_image_path' => ['type' => 'string', 'nullable' => true],
                'id_back_image_path' => ['type' => 'string', 'nullable' => true],
                'selfie_image_path' => ['type' => 'string', 'nullable' => true],
                'verification_status' => ['type' => 'string', 'nullable' => false, 'default' => 'pending'],
                'verification_notes' => ['type' => 'text', 'nullable' => true],
                'verified_at' => ['type' => 'timestamp', 'nullable' => true],
                'verified_by' => ['type' => 'string', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['verification_status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createUserRolesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_roles');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'role_type' => ['type' => 'string', 'nullable' => false],
                'role_status' => ['type' => 'string', 'nullable' => false, 'default' => 'pending'],
                'deposit_amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'role_activated_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'role_type'], 'unique' => true],
                ['columns' => ['role_type']],
                ['columns' => ['role_status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createDeveloperProfilesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'developer_profiles');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'unique' => true],
                'company_name' => ['type' => 'string', 'nullable' => true],
                'bio' => ['type' => 'text', 'nullable' => true],
                'skills' => ['type' => 'json', 'nullable' => true],
                'certifications' => ['type' => 'json', 'nullable' => true],
                'completed_projects' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'average_rating' => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'followers_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'profile_completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createClientProfilesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'client_profiles');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'foreignId', 'nullable' => false, 'unique' => true],
                'company_name' => ['type' => 'string', 'nullable' => false],
                'company_registration_number' => ['type' => 'string', 'nullable' => true],
                'industry' => ['type' => 'string', 'nullable' => true],
                'company_description' => ['type' => 'text', 'nullable' => true],
                'contact_person' => ['type' => 'string', 'nullable' => true],
                'contact_phone' => ['type' => 'string', 'nullable' => true],
                'company_website' => ['type' => 'string', 'nullable' => true],
                'posted_projects' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'average_rating' => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'profile_completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
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
        $tables = [
            'client_profiles',
            'developer_profiles',
            'user_roles',
            'kyc_verifications',
            'phone_verifications',
            'email_verifications',
        ];
        
        foreach ($tables as $tableSuffix) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, $tableSuffix);
            Schema::connection($this->connection)->dropIfExists($tableName);
        }
    }
};
