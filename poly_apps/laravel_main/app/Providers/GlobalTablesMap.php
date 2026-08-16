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
            'SESSIONS'
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
