<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AwyV0\AwyV0DBTablesBrige;

class AwyV0TableMaps
{
    /**
     * AwyV0 Application Database Table Mappings
     * This class provides centralized table name and field mappings for the AwyV0 application
     * All database operations should reference these mappings instead of hardcoded table/field names
     */
    
    // AwyV0 Application Tables
    public const AWY_V0_USERS = [
        'tablename' => 'awy_v0_users',
        'fields' => [
            'id' => 'id',
            'username' => 'username',
            'email' => 'email',
            'phone' => 'phone',
            'password' => 'password',
            'user_token' => 'user_token',
            'avatar' => 'avatar',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const AWY_V0_FRIENDS = [
        'tablename' => 'awy_v0_friends',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'friend_id' => 'friend_id',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const AWY_V0_DEVICES = [
        'tablename' => 'awy_v0_devices',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'device_token' => 'device_token',
            'device_type' => 'device_type',
            'platform' => 'platform',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const AWY_V0_CHATS = [
        'tablename' => 'awy_v0_chats',
        'fields' => [
            'id' => 'id',
            'sender_id' => 'sender_id',
            'receiver_id' => 'receiver_id',
            'message' => 'message',
            'message_type' => 'message_type',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // Global Tables (referenced from app/Providers)
    // Note: Global tables are managed in App\Providers\GlobalTablesMap
    // Use GlobalTablesMap::getTableName('GLOBAL_USERS') and GlobalTablesMap::getFieldName('GLOBAL_USERS', 'field_key')
    // for accessing global table mappings

    /**
     * Get table name by key
     */
    public static function getTableName(string $tableKey): string
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            return constant("self::{$constantName}")['tablename'];
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AwyV0TableMaps");
    }

    /**
     * Get field name by table key and field key
     */
    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            $tableConfig = constant("self::{$constantName}");
            if (isset($tableConfig['fields'][$fieldKey])) {
                return $tableConfig['fields'][$fieldKey];
            }
            throw new \InvalidArgumentException("Field key '{$fieldKey}' not found in table '{$tableKey}'");
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AwyV0TableMaps");
    }

    /**
     * Get all fields for a table
     */
    public static function getTableFields(string $tableKey): array
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            return constant("self::{$constantName}")['fields'];
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AwyV0TableMaps");
    }

    /**
     * Get available table keys
     */
    public static function getAvailableTableKeys(): array
    {
        return [
            'AWY_V0_USERS',
            'AWY_V0_FRIENDS',
            'AWY_V0_DEVICES',
            'AWY_V0_CHATS'
        ];
    }

    /**
     * Get global table name by key
     */
    public static function getGlobalTableName(string $tableKey): string
    {
        return \App\Providers\GlobalTablesMap::getTableName($tableKey);
    }

    /**
     * Get global field name by table key and field key
     */
    public static function getGlobalFieldName(string $tableKey, string $fieldKey): string
    {
        return \App\Providers\GlobalTablesMap::getFieldName($tableKey, $fieldKey);
    }

    /**
     * Get global table fields
     */
    public static function getGlobalTableFields(string $tableKey): array
    {
        return \App\Providers\GlobalTablesMap::getTableFields($tableKey);
    }

    /**
     * Check if global table key exists
     */
    public static function hasGlobalTableKey(string $tableKey): bool
    {
        return \App\Providers\GlobalTablesMap::hasTableKey($tableKey);
    }
}
