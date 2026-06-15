<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\Utils;

use Illuminate\Support\Facades\Config;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1DatabaseBridge
{
    /**
     * Get the database table configuration for AppQyV1
     *
     * @return array
     */
    public static function getTableConfig(): array
    {
        return Config::get('AppQyV1_db_tables', []);
    }

    /**
     * Get table name by key
     *
     * @param string $tableKey
     * @return string|null
     */
    public static function getTableName(string $tableKey): ?string
    {
        $config = self::getTableConfig();
        return $config[$tableKey]['tableName'] ?? null;
    }

    /**
     * Get field name by table key and field key
     *
     * @param string $tableKey
     * @param string $fieldKey
     * @return string|null
     */
    public static function getFieldName(string $tableKey, string $fieldKey): ?string
    {
        $config = self::getTableConfig();
        return $config[$tableKey]['fields'][$fieldKey] ?? null;
    }

    /**
     * Get all field mappings for a table
     *
     * @param string $tableKey
     * @return array|null
     */
    public static function getTableFields(string $tableKey): ?array
    {
        $config = self::getTableConfig();
        return $config[$tableKey]['fields'] ?? null;
    }

    /**
     * Get all table keys
     *
     * @return array
     */
    public static function getTableKeys(): array
    {
        $config = self::getTableConfig();
        return array_keys($config);
    }

    /**
     * Check if table key exists
     *
     * @param string $tableKey
     * @return bool
     */
    public static function hasTable(string $tableKey): bool
    {
        $config = self::getTableConfig();
        return isset($config[$tableKey]);
    }

    /**
     * Check if field key exists in table
     *
     * @param string $tableKey
     * @param string $fieldKey
     * @return bool
     */
    public static function hasField(string $tableKey, string $fieldKey): bool
    {
        $config = self::getTableConfig();
        return isset($config[$tableKey]['fields'][$fieldKey]);
    }

    /**
     * Get field mappings for building queries
     *
     * @param string $tableKey
     * @param array $fieldKeys
     * @return array
     */
    public static function getFieldMappings(string $tableKey, array $fieldKeys): array
    {
        $mappings = [];
        foreach ($fieldKeys as $fieldKey) {
            $fieldName = self::getFieldName($tableKey, $fieldKey);
            if ($fieldName) {
                $mappings[$fieldKey] = $fieldName;
            }
        }
        return $mappings;
    }

    /**
     * Build select fields for query
     *
     * @param string $tableKey
     * @param array $fieldKeys
     * @return array
     */
    public static function buildSelectFields(string $tableKey, array $fieldKeys): array
    {
        $tableName = self::getTableName($tableKey);
        if (!$tableName) {
            return [];
        }

        $fields = [];
        foreach ($fieldKeys as $fieldKey) {
            $fieldName = self::getFieldName($tableKey, $fieldKey);
            if ($fieldName) {
                $fields[] = "{$tableName}.{$fieldName} as {$fieldKey}";
            }
        }
        return $fields;
    }

    /**
     * Build where conditions using field keys
     *
     * @param string $tableKey
     * @param array $conditions
     * @return array
     */
    public static function buildWhereConditions(string $tableKey, array $conditions): array
    {
        $tableName = self::getTableName($tableKey);
        if (!$tableName) {
            return [];
        }

        $whereConditions = [];
        foreach ($conditions as $fieldKey => $value) {
            $fieldName = self::getFieldName($tableKey, $fieldKey);
            if ($fieldName) {
                $whereConditions["{$tableName}.{$fieldName}"] = $value;
            }
        }
        return $whereConditions;
    }

    /**
     * Get table name for dictionaries
     *
     * @return string
     */
    public static function getDictionariesTableName(): string
    {
        $appKey = AppKeys::APPQYV1;
        return AppTablePrefixServiceProvider::buildTableName($appKey, 'dictionaries');
    }

    /**
     * Get table name for personal dictionaries
     *
     * @return string
     */
    public static function getPersonalDictionariesTableName(): string
    {
        $appKey = AppKeys::APPQYV1;
        return AppTablePrefixServiceProvider::buildTableName($appKey, 'personal_dictionaries');
    }

    /**
     * Get table name for word groups
     *
     * @return string
     */
    public static function getWordGroupsTableName(): string
    {
        $appKey = AppKeys::APPQYV1;
        return AppTablePrefixServiceProvider::buildTableName($appKey, 'word_groups');
    }

    /**
     * Get table name for global users
     *
     * @return string
     */
    public static function getGlobalUsersTableName(): string
    {
        return self::getTableName('global_users') ?? 'users';
    }

    /**
     * Get table name for global groups
     *
     * @return string
     */
    public static function getGlobalGroupsTableName(): string
    {
        return self::getTableName('global_groups') ?? 'global_groups';
    }
}

