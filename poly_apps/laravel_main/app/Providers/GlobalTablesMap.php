<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Providers;

class GlobalTablesMap extends TableMaps
{
    public const CONNECTION = 'main';

    /**
     * Global Database Table Mappings
     * This class provides centralized table name and field mappings for global tables
     * that are shared across all applications in the Laravel project
     * All database operations should reference these mappings instead of hardcoded table/field names
     */

    // Global Users Table
    public const GLOBAL_USERS = [
        'tablename' => 'users',
        'fields' => [
            'id' => 'id',
            'name' => 'name',
            'nickname' => 'nickname',
            'username' => 'username',
            'avatar' => 'avatar',
            'about' => 'about',
            'flollwers' => 'flollwers',
            'website' => 'website',
            'github' => 'github',
            'wechat' => 'wechat',
            'weibo' => 'weibo',
            'qq' => 'qq',
            'age' => 'age',
            'gender' => 'gender',
            'birthday' => 'birthday',
            'city' => 'city',
            'education' => 'education',
            'occupation' => 'occupation',
            'language' => 'language',
            'religion' => 'religion',
            'rolelevel' => 'rolelevel',
            'rolename' => 'rolename',
            'email' => 'email',
            'email_verified_at' => 'email_verified_at',
            'password' => 'password',
            'user_token' => 'user_token',
            'remember_token' => 'remember_token',
            'phone' => 'phone',
            'avatar_url' => 'avatar_url',
            'member_type' => 'member_type',
            'vip_points' => 'vip_points',
            'member_since' => 'member_since',
            'member_expiry' => 'member_expiry',
            'is_active' => 'is_active',
            'preferences' => 'preferences',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // Personal Access Tokens Table
    public const PERSONAL_ACCESS_TOKENS = [
        'tablename' => 'personal_access_tokens',
        'fields' => [
            'id' => 'id',
            'tokenable_type' => 'tokenable_type',
            'tokenable_id' => 'tokenable_id',
            'name' => 'name',
            'token' => 'token',
            'abilities' => 'abilities',
            'last_used_at' => 'last_used_at',
            'expires_at' => 'expires_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // Password Reset Tokens Table
    public const PASSWORD_RESET_TOKENS = [
        'tablename' => 'password_reset_tokens',
        'fields' => [
            'email' => 'email',
            'token' => 'token',
            'created_at' => 'created_at'
        ]
    ];

    // Sessions Table
    public const SESSIONS = [
        'tablename' => 'sessions',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'ip_address' => 'ip_address',
            'user_agent' => 'user_agent',
            'payload' => 'payload',
            'last_activity' => 'last_activity'
        ]
    ];

    public const RELAY_DEVICES = [
        'tablename' => 'global_relay_devices',
        'fields' => [
            'id' => 'id',
            'device_id' => 'device_id',
            'owner_user_id' => 'owner_user_id',
            'label' => 'label',
            'platform' => 'platform',
            'capabilities' => 'capabilities',
            'capability_digest' => 'capability_digest',
            'contract_digest' => 'contract_digest',
            'status' => 'status',
            'current_credential_version' => 'current_credential_version',
            'last_seen_at' => 'last_seen_at',
            'credential_expires_at' => 'credential_expires_at',
            'revoked_at' => 'revoked_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_ENROLLMENTS = [
        'tablename' => 'global_relay_enrollments',
        'fields' => [
            'id' => 'id',
            'enrollment_id' => 'enrollment_id',
            'device_id' => 'device_id',
            'public_key' => 'public_key',
            'key_algorithm' => 'key_algorithm',
            'key_version' => 'key_version',
            'label' => 'label',
            'platform' => 'platform',
            'capabilities' => 'capabilities',
            'capability_digest' => 'capability_digest',
            'contract_digest' => 'contract_digest',
            'claim_code_hash' => 'claim_code_hash',
            'claim_code_encrypted' => 'claim_code_encrypted',
            'state' => 'state',
            'claimant_user_id' => 'claimant_user_id',
            'credential_id' => 'credential_id',
            'claim_attempts' => 'claim_attempts',
            'expires_at' => 'expires_at',
            'claimed_at' => 'claimed_at',
            'revoked_at' => 'revoked_at',
            'revision' => 'revision',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_CREDENTIALS = [
        'tablename' => 'global_relay_credentials',
        'fields' => [
            'id' => 'id',
            'credential_id' => 'credential_id',
            'device_id' => 'device_id',
            'credential_version' => 'credential_version',
            'public_key' => 'public_key',
            'status' => 'status',
            'expires_at' => 'expires_at',
            'revoked_at' => 'revoked_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_PAIRINGS = [
        'tablename' => 'global_relay_pairings',
        'fields' => [
            'id' => 'id',
            'pairing_id' => 'pairing_id',
            'user_id' => 'user_id',
            'device_id' => 'device_id',
            'client_instance_hash' => 'client_instance_hash',
            'state' => 'state',
            'credential_version' => 'credential_version',
            'revision' => 'revision',
            'last_seen_at' => 'last_seen_at',
            'expires_at' => 'expires_at',
            'revoked_at' => 'revoked_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_OPERATIONS = [
        'tablename' => 'global_relay_operations',
        'fields' => [
            'id' => 'id',
            'operation_id' => 'operation_id',
            'idempotency_key' => 'idempotency_key',
            'user_id' => 'user_id',
            'device_id' => 'device_id',
            'pairing_id' => 'pairing_id',
            'route_policy_key' => 'route_policy_key',
            'permission' => 'permission',
            'retry_policy' => 'retry_policy',
            'method' => 'method',
            'normalized_path' => 'normalized_path',
            'normalized_query' => 'normalized_query',
            'filtered_headers' => 'filtered_headers',
            'request_digest' => 'request_digest',
            'request_body_present' => 'request_body_present',
            'request_body_base64' => 'request_body_base64',
            'request_blob_id' => 'request_blob_id',
            'request_body_sha256' => 'request_body_sha256',
            'request_body_length' => 'request_body_length',
            'state' => 'state',
            'revision' => 'revision',
            'attempt' => 'attempt',
            'claim_epoch' => 'claim_epoch',
            'lease_owner' => 'lease_owner',
            'lease_expires_at' => 'lease_expires_at',
            'response_status' => 'response_status',
            'response_headers' => 'response_headers',
            'response_body_present' => 'response_body_present',
            'response_body_base64' => 'response_body_base64',
            'response_blob_id' => 'response_blob_id',
            'response_body_sha256' => 'response_body_sha256',
            'response_body_length' => 'response_body_length',
            'result_digest' => 'result_digest',
            'error_code' => 'error_code',
            'accepted_at' => 'accepted_at',
            'execution_started_at' => 'execution_started_at',
            'completed_at' => 'completed_at',
            'expires_at' => 'expires_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_BLOBS = [
        'tablename' => 'global_relay_blobs',
        'fields' => [
            'id' => 'id',
            'blob_id' => 'blob_id',
            'owner_user_id' => 'owner_user_id',
            'device_id' => 'device_id',
            'pairing_id' => 'pairing_id',
            'operation_id' => 'operation_id',
            'direction' => 'direction',
            'operation_revision' => 'operation_revision',
            'claim_epoch' => 'claim_epoch',
            'lease_owner' => 'lease_owner',
            'expected_sha256' => 'expected_sha256',
            'expected_length' => 'expected_length',
            'final_sha256' => 'final_sha256',
            'final_length' => 'final_length',
            'received_chunk_count' => 'received_chunk_count',
            'received_length' => 'received_length',
            'finalized_at' => 'finalized_at',
            'expires_at' => 'expires_at',
            'revision' => 'revision',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_BLOB_CHUNKS = [
        'tablename' => 'global_relay_blob_chunks',
        'fields' => [
            'id' => 'id',
            'blob_id' => 'blob_id',
            'chunk_index' => 'chunk_index',
            'chunk_sha256' => 'chunk_sha256',
            'chunk_length' => 'chunk_length',
            'storage_relative_path' => 'storage_relative_path',
            'stored_at' => 'stored_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const RELAY_NONCES = [
        'tablename' => 'global_relay_nonces',
        'fields' => [
            'id' => 'id',
            'credential_scope' => 'credential_scope',
            'nonce_hash' => 'nonce_hash',
            'expires_at' => 'expires_at',
            'created_at' => 'created_at',
        ],
    ];

    public const RELAY_OUTBOX = [
        'tablename' => 'global_relay_outbox',
        'fields' => [
            'id' => 'id',
            'outbox_id' => 'outbox_id',
            'entity_type' => 'entity_type',
            'entity_id' => 'entity_id',
            'revision' => 'revision',
            'event_type' => 'event_type',
            'topic_role' => 'topic_role',
            'topic' => 'topic',
            'private' => 'private',
            'payload' => 'payload',
            'state' => 'state',
            'publish_attempts' => 'publish_attempts',
            'next_attempt_at' => 'next_attempt_at',
            'published_at' => 'published_at',
            'hub_update_id' => 'hub_update_id',
            'last_publish_error' => 'last_publish_error',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    /**
     * Global tables carry no app prefix.
     */
    protected static function getTablePrefix(): string
    {
        return '';
    }

    public static function getConnection(): string
    {
        return self::CONNECTION;
    }

    /**
     * Get all available table keys
     */
    public static function getAvailableTableKeys(): array
    {
        return [
            'GLOBAL_USERS',
            'PERSONAL_ACCESS_TOKENS',
            'PASSWORD_RESET_TOKENS',
            'SESSIONS',
            'RELAY_DEVICES',
            'RELAY_ENROLLMENTS',
            'RELAY_CREDENTIALS',
            'RELAY_PAIRINGS',
            'RELAY_OPERATIONS',
            'RELAY_BLOBS',
            'RELAY_BLOB_CHUNKS',
            'RELAY_NONCES',
            'RELAY_OUTBOX',
        ];
    }

    protected static function missingTableName(string $tableKey): string
    {
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in GlobalTablesMap");
    }

    protected static function missingFieldName(string $tableKey, string $fieldKey): string
    {
        if (!static::hasTableKey($tableKey)) {
            throw new \InvalidArgumentException("Table key '{$tableKey}' not found in GlobalTablesMap");
        }
        throw new \InvalidArgumentException("Field key '{$fieldKey}' not found in table '{$tableKey}'");
    }

    protected static function missingTableFields(string $tableKey): array
    {
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in GlobalTablesMap");
    }
}
