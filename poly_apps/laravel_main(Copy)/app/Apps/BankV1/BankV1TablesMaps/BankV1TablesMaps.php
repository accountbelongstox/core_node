<?php

namespace App\Apps\BankV1\BankV1TablesMaps;

use App\Providers\GlobalTablesMaps;

class BankV1TablesMaps
{
    // Import global tables
    public static function getGlobalTables(): array
    {
        return GlobalTablesMaps::getTables();
    }
    
    // Bank V1 specific tables
    public static function getTables(): array
    {
        return [
            // User Management Tables
            'bank_users' => [
                'tablename' => 'bankv1_users',
                'fields' => [
                    'id' => 'id',
                    'username' => 'username',
                    'email' => 'email',
                    'email_verified_at' => 'email_verified_at',
                    'password' => 'password',
                    'full_name' => 'full_name',
                    'phone' => 'phone',
                    'date_of_birth' => 'date_of_birth',
                    'gender' => 'gender',
                    'account_status' => 'account_status',
                    'is_locked' => 'is_locked',
                    'lock_reason' => 'lock_reason',
                    'locked_at' => 'locked_at',
                    'last_login_at' => 'last_login_at',
                    'login_attempts' => 'login_attempts',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // User Profiles Table
            'bank_user_profiles' => [
                'tablename' => 'bankv1_user_profiles',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'avatar' => 'avatar',
                    'bio' => 'bio',
                    'preferences' => 'preferences',
                    'notification_settings' => 'notification_settings',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // User Addresses Table
            'bank_user_addresses' => [
                'tablename' => 'bankv1_user_addresses',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'type' => 'type',
                    'street' => 'street',
                    'city' => 'city',
                    'state' => 'state',
                    'zip_code' => 'zip_code',
                    'country' => 'country',
                    'is_primary' => 'is_primary',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // Accounts Table
            'bank_accounts' => [
                'tablename' => 'bankv1_accounts',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'account_number' => 'account_number',
                    'account_type' => 'account_type',
                    'balance' => 'balance',
                    'currency' => 'currency',
                    'status' => 'status',
                    'opened_at' => 'opened_at',
                    'closed_at' => 'closed_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // Transactions Table
            'bank_transactions' => [
                'tablename' => 'bankv1_transactions',
                'fields' => [
                    'id' => 'id',
                    'transaction_id' => 'transaction_id',
                    'from_account_id' => 'from_account_id',
                    'to_account_id' => 'to_account_id',
                    'amount' => 'amount',
                    'fee' => 'fee',
                    'currency' => 'currency',
                    'type' => 'type',
                    'status' => 'status',
                    'description' => 'description',
                    'reference' => 'reference',
                    'metadata' => 'metadata',
                    'processed_at' => 'processed_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // Device Management Tables
            'bank_devices' => [
                'tablename' => 'bankv1_devices',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'app_signature' => 'app_signature',
                    'device_name' => 'device_name',
                    'platform' => 'platform',
                    'app_version' => 'app_version',
                    'status' => 'status',
                    'is_locked' => 'is_locked',
                    'lock_reason' => 'lock_reason',
                    'locked_at' => 'locked_at',
                    'last_used_at' => 'last_used_at',
                    'registered_at' => 'registered_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // Sessions Table
            'bank_sessions' => [
                'tablename' => 'bankv1_sessions',
                'fields' => [
                    'id' => 'id',
                    'session_id' => 'session_id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'ip_address' => 'ip_address',
                    'user_agent' => 'user_agent',
                    'started_at' => 'started_at',
                    'ended_at' => 'ended_at',
                    'last_activity_at' => 'last_activity_at',
                    'duration' => 'duration',
                    'is_active' => 'is_active',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // App Logs Table
            'bank_app_logs' => [
                'tablename' => 'bankv1_app_logs',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'session_id' => 'session_id',
                    'event_type' => 'event_type',
                    'event_data' => 'event_data',
                    'ip_address' => 'ip_address',
                    'user_agent' => 'user_agent',
                    'timestamp' => 'timestamp',
                    'created_at' => 'created_at',
                ]
            ],
            
            // Security Logs Table
            'bank_security_logs' => [
                'tablename' => 'bankv1_security_logs',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'event_type' => 'event_type',
                    'severity' => 'severity',
                    'description' => 'description',
                    'event_data' => 'event_data',
                    'ip_address' => 'ip_address',
                    'user_agent' => 'user_agent',
                    'resolved' => 'resolved',
                    'resolved_at' => 'resolved_at',
                    'resolved_by' => 'resolved_by',
                    'timestamp' => 'timestamp',
                    'created_at' => 'created_at',
                ]
            ],
            
            // Registration Codes Table
            'bank_registration_codes' => [
                'tablename' => 'bankv1_registration_codes',
                'fields' => [
                    'id' => 'id',
                    'code' => 'code',
                    'type' => 'type',
                    'value' => 'value',
                    'description' => 'description',
                    'max_uses' => 'max_uses',
                    'used_count' => 'used_count',
                    'is_active' => 'is_active',
                    'expires_at' => 'expires_at',
                    'created_by' => 'created_by',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
            
            // Code Usage Table
            'bank_code_usage' => [
                'tablename' => 'bankv1_code_usage',
                'fields' => [
                    'id' => 'id',
                    'code_id' => 'code_id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'used_at' => 'used_at',
                    'ip_address' => 'ip_address',
                    'user_agent' => 'user_agent',
                    'created_at' => 'created_at',
                ]
            ],
            
            // JWT Tokens Table
            'bank_jwt_tokens' => [
                'tablename' => 'bankv1_jwt_tokens',
                'fields' => [
                    'id' => 'id',
                    'user_id' => 'user_id',
                    'device_id' => 'device_id',
                    'token_id' => 'token_id',
                    'token_hash' => 'token_hash',
                    'refresh_token_hash' => 'refresh_token_hash',
                    'expires_at' => 'expires_at',
                    'refresh_expires_at' => 'refresh_expires_at',
                    'is_revoked' => 'is_revoked',
                    'revoked_at' => 'revoked_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at',
                ]
            ],
        ];
    }
    
    // Helper methods to get specific table info
    public static function getTableName(string $tableKey): string
    {
        $tables = self::getTables();
        return $tables[$tableKey]['tablename'] ?? '';
    }
    
    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $tables = self::getTables();
        return $tables[$tableKey]['fields'][$fieldKey] ?? '';
    }
    
    public static function getAllTableNames(): array
    {
        $tables = self::getTables();
        return array_column($tables, 'tablename');
    }
    
    public static function getTableFields(string $tableKey): array
    {
        $tables = self::getTables();
        return $tables[$tableKey]['fields'] ?? [];
    }
}
