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

namespace App\Apps\AppQyV1\AppQyV1DBTablesBrige;

class AppQyV1TableMaps
{
    /**
     * AppQyV1 Application Database Table Mappings
     * This class provides centralized table name and field mappings for the AppQyV1 application
     * All database operations should reference these mappings instead of hardcoded table/field names
     */
    
    // AppQyV1 Application Tables
    public const app_qy_v1_DICTIONARIES = [
        'tablename' => 'app_qy_v1_dictionaries',
        'fields' => [
            'id' => 'id',
            'content' => 'content',
            'md5' => 'md5',
            'translation' => 'translation',
            'isTranslation' => 'isTranslation',
            'translation_provider' => 'translation_provider',
            'lastModified' => 'lastModified',
            'lastInsertTime' => 'lastInsertTime',
            'lastUpdateTime' => 'lastUpdateTime',
            'lastQueryTime' => 'lastQueryTime',
            'queryCount' => 'queryCount',
            'usPhonetic' => 'usPhonetic',
            'ukPhonetic' => 'ukPhonetic',
            'voice_files' => 'voice_files',
            'image_files' => 'image_files',
            'isExistLocal' => 'isExistLocal',
            'voice_files_provider' => 'voice_files_provider',
            'image_files_provider' => 'image_files_provider',
            'hasOperations' => 'hasOperations',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'createdAt' => 'createdAt'
        ]
    ];

    public const app_qy_v1_PERSONAL_DICTIONARIES = [
        'tablename' => 'app_qy_v1_personal_dictionaries',
        'fields' => [
            'id' => 'id',
            'uid' => 'uid',
            'personal_dicts' => 'personal_dicts',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_WORD_GROUPS = [
        'tablename' => 'app_qy_v1_word_groups',
        'fields' => [
            'id' => 'id',
            'gid' => 'gid',
            'username' => 'username',
            'uid' => 'uid',
            'gname' => 'gname',
            'gcontent' => 'gcontent',
            'gwords' => 'gwords',
            'words_frequency' => 'words_frequency',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
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
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AppQyV1TableMaps");
    }

    /**
     * Get field name by table key and field key
     */
    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            $tableMap = constant("self::{$constantName}");
            if (isset($tableMap['fields'][$fieldKey])) {
                return $tableMap['fields'][$fieldKey];
            }
            throw new \InvalidArgumentException("Field key '{$fieldKey}' not found in table '{$tableKey}'");
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AppQyV1TableMaps");
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
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in AppQyV1TableMaps");
    }

    /**
     * Get all available table keys
     */
    public static function getAvailableTableKeys(): array
    {
        return [
            'app_qy_v1_DICTIONARIES',
            'app_qy_v1_PERSONAL_DICTIONARIES',
            'app_qy_v1_WORD_GROUPS'
        ];
    }

    /**
     * Get global table name by key
     * Delegates to GlobalTablesMap for global table access
     */
    public static function getGlobalTableName(string $tableKey): string
    {
        return \App\Providers\GlobalTablesMap::getTableName($tableKey);
    }

    /**
     * Get global field name by table key and field key
     * Delegates to GlobalTablesMap for global table field access
     */
    public static function getGlobalFieldName(string $tableKey, string $fieldKey): string
    {
        return \App\Providers\GlobalTablesMap::getFieldName($tableKey, $fieldKey);
    }

    /**
     * Get all global table fields
     * Delegates to GlobalTablesMap for global table fields access
     */
    public static function getGlobalTableFields(string $tableKey): array
    {
        return \App\Providers\GlobalTablesMap::getTableFields($tableKey);
    }

    /**
     * Check if global table key exists
     * Delegates to GlobalTablesMap for global table key validation
     */
    public static function hasGlobalTableKey(string $tableKey): bool
    {
        return \App\Providers\GlobalTablesMap::hasTableKey($tableKey);
    }
}

