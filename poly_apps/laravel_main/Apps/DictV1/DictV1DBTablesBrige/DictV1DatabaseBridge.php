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

namespace App\Apps\DictV1\DictV1DBTablesBrige;

use App\Providers\GlobalTablesMap;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DictV1DatabaseBridge
{
    /**
     * DictV1 Database Bridge
     * Provides unified access to both DictV1-specific and global database tables
     * with proper validation and error handling
     */

    /**
     * Get table name for DictV1 tables
     */
    public static function getDictV1TableName(string $tableKey): string
    {
        return DictV1TableMaps::getTableName($tableKey);
    }

    /**
     * Get field name for DictV1 tables
     */
    public static function getDictV1FieldName(string $tableKey, string $fieldKey): string
    {
        return DictV1TableMaps::getFieldName($tableKey, $fieldKey);
    }

    /**
     * Get table name for global tables
     */
    public static function getGlobalTableName(string $tableKey): string
    {
        return GlobalTablesMap::getTableName($tableKey);
    }

    /**
     * Get field name for global tables
     */
    public static function getGlobalFieldName(string $tableKey, string $fieldKey): string
    {
        return GlobalTablesMap::getFieldName($tableKey, $fieldKey);
    }

    /**
     * Get table name (automatically determines if it's DictV1 or global table)
     */
    public static function getTableName(string $tableKey): string
    {
        // First check if it's a DictV1 table
        if (DictV1TableMaps::hasTableKey($tableKey)) {
            return DictV1TableMaps::getTableName($tableKey);
        }

        // Then check if it's a global table
        if (GlobalTablesMap::hasTableKey($tableKey)) {
            return GlobalTablesMap::getTableName($tableKey);
        }

        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in either DictV1 or Global tables");
    }

    /**
     * Get field name (automatically determines if it's DictV1 or global table)
     */
    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        // First check if it's a DictV1 table
        if (DictV1TableMaps::hasTableKey($tableKey)) {
            return DictV1TableMaps::getFieldName($tableKey, $fieldKey);
        }

        // Then check if it's a global table
        if (GlobalTablesMap::hasTableKey($tableKey)) {
            return GlobalTablesMap::getFieldName($tableKey, $fieldKey);
        }

        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in either DictV1 or Global tables");
    }

    /**
     * Get all fields for a table
     */
    public static function getTableFields(string $tableKey): array
    {
        // First check if it's a DictV1 table
        if (DictV1TableMaps::hasTableKey($tableKey)) {
            return DictV1TableMaps::getTableFields($tableKey);
        }

        // Then check if it's a global table
        if (GlobalTablesMap::hasTableKey($tableKey)) {
            return GlobalTablesMap::getTableFields($tableKey);
        }

        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in either DictV1 or Global tables");
    }

    /**
     * Check if table exists in database
     */
    public static function tableExists(string $tableKey): bool
    {
        try {
            $tableName = self::getTableName($tableKey);
            return Schema::hasTable($tableName);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check if field exists in table
     */
    public static function fieldExists(string $tableKey, string $fieldKey): bool
    {
        try {
            $tableName = self::getTableName($tableKey);
            $fieldName = self::getFieldName($tableKey, $fieldKey);
            return Schema::hasColumn($tableName, $fieldName);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get all available table keys (both DictV1 and global)
     */
    public static function getAllAvailableTableKeys(): array
    {
        $dictV1Tables = DictV1TableMaps::getAvailableTableKeys();
        $globalTables = GlobalTablesMap::getAvailableTableKeys();
        
        return array_merge($dictV1Tables, $globalTables);
    }

    /**
     * Get DictV1-specific table keys only
     */
    public static function getDictV1TableKeys(): array
    {
        return DictV1TableMaps::getAvailableTableKeys();
    }

    /**
     * Get global table keys only
     */
    public static function getGlobalTableKeys(): array
    {
        return GlobalTablesMap::getAvailableTableKeys();
    }

    /**
     * Check if table key is a DictV1 table
     */
    public static function isDictV1Table(string $tableKey): bool
    {
        return DictV1TableMaps::hasTableKey($tableKey);
    }

    /**
     * Check if table key is a global table
     */
    public static function isGlobalTable(string $tableKey): bool
    {
        return GlobalTablesMap::hasTableKey($tableKey);
    }

    /**
     * Get table type (DictV1 or Global)
     */
    public static function getTableType(string $tableKey): string
    {
        if (self::isDictV1Table($tableKey)) {
            return 'DictV1';
        }
        
        if (self::isGlobalTable($tableKey)) {
            return 'Global';
        }
        
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found");
    }

    /**
     * Validate table and field keys
     */
    public static function validateTableAndField(string $tableKey, string $fieldKey): bool
    {
        try {
            self::getTableName($tableKey);
            self::getFieldName($tableKey, $fieldKey);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get table information including all fields
     */
    public static function getTableInfo(string $tableKey): array
    {
        $tableName = self::getTableName($tableKey);
        $fields = self::getTableFields($tableKey);
        $tableType = self::getTableType($tableKey);
        
        return [
            'table_key' => $tableKey,
            'table_name' => $tableName,
            'table_type' => $tableType,
            'fields' => $fields,
            'exists_in_database' => self::tableExists($tableKey)
        ];
    }

    /**
     * Get all table information for all available tables
     */
    public static function getAllTableInfo(): array
    {
        $allTables = self::getAllAvailableTableKeys();
        $tableInfo = [];
        
        foreach ($allTables as $tableKey) {
            try {
                $tableInfo[$tableKey] = self::getTableInfo($tableKey);
            } catch (\Exception $e) {
                // Skip invalid tables
                continue;
            }
        }
        
        return $tableInfo;
    }

    /**
     * Build a query builder for a specific table
     */
    public static function table(string $tableKey)
    {
        $tableName = self::getTableName($tableKey);
        return DB::table($tableName);
    }

    /**
     * Get table schema information
     */
    public static function getTableSchema(string $tableKey): array
    {
        $tableName = self::getTableName($tableKey);
        
        if (!Schema::hasTable($tableName)) {
            throw new \InvalidArgumentException("Table '{$tableName}' does not exist in database");
        }
        
        $columns = Schema::getColumnListing($tableName);
        $schema = [];
        
        foreach ($columns as $column) {
            $schema[$column] = [
                'name' => $column,
                'type' => Schema::getColumnType($tableName, $column),
                'nullable' => Schema::getColumnNullable($tableName, $column),
                'default' => Schema::getColumnDefault($tableName, $column)
            ];
        }
        
        return $schema;
    }
}
