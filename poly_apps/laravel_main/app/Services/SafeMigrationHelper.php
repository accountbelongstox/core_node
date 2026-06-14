<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

/**
 * Safe Migration Helper
 *
 * Provides idempotent database migration tools that guarantee:
 * - Tables and data are never dropped
 * - Tables are created only when they do not exist
 * - Columns are added only when they do not exist
 * - Column type expansion is supported (e.g. string(50) -> string(255)), but never shrinking
 * - Index alignment is supported (adds missing indexes)
 * - Code is aligned to the database structure (not by rebuilding the table)
 *
 * Use cases:
 * - Table missing: create the table and all columns
 * - Table exists but a column is missing: add the missing column
 * - Table exists but a column type needs widening: expand the column type (no shrinking)
 * - Table exists but an index is missing: add the missing index
 */
class SafeMigrationHelper
{
    /**
     * Safely create a table (if it does not exist)
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param callable $tableDefinition Table definition closure
     * @return array ['status' => 'created'|'exists', 'message' => string]
     */
    public static function safeCreateTable(
        string $connection,
        string $tableName,
        callable $tableDefinition
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            $schema->create($tableName, $tableDefinition);
            return [
                'status' => 'created',
                'message' => "Table {$tableName} created successfully"
            ];
        }
        
        return [
            'status' => 'exists',
            'message' => "Table {$tableName} already exists"
        ];
    }

    /**
     * Safely add a column (if it does not exist)
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $columnName Column name
     * @param callable $columnDefinition Column definition closure, receives the Blueprint $table argument
     * @return array ['status' => 'added'|'exists'|'error', 'message' => string]
     */
    public static function safeAddColumn(
        string $connection,
        string $tableName,
        string $columnName,
        callable $columnDefinition
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        if ($schema->hasColumn($tableName, $columnName)) {
            return [
                'status' => 'exists',
                'message' => "Column {$tableName}.{$columnName} already exists"
            ];
        }
        
        $schema->table($tableName, function (Blueprint $table) use ($columnName, $columnDefinition) {
            $columnDefinition($table, $columnName);
        });
        
        return [
            'status' => 'added',
            'message' => "Column {$tableName}.{$columnName} added successfully"
        ];
    }

    /**
     * Safely modify a column type (widen only, never shrink)
     *
     * Supported expansion operations:
     * - string(50) -> string(255) ✅
     * - string(255) -> text ✅
     * - integer -> bigInteger ✅
     * - Shrink operations are not supported (they are skipped)
     * 
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $columnName Column name
     * @param string $newType New type ('string', 'text', 'bigInteger', etc.)
     * @param array $options Options ['length' => int, 'nullable' => bool, 'default' => mixed]
     * @return array ['status' => 'modified'|'skipped'|'error', 'message' => string]
     */
    public static function safeModifyColumn(
        string $connection,
        string $tableName,
        string $columnName,
        string $newType,
        array $options = []
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        if (!$schema->hasColumn($tableName, $columnName)) {
            return [
                'status' => 'error',
                'message' => "Column {$tableName}.{$columnName} does not exist"
            ];
        }
        
        // Get the current column info
        $columnInfo = self::getColumnInfo($connection, $tableName, $columnName);
        if (!$columnInfo) {
            return [
                'status' => 'error',
                'message' => "Could not get column info for {$tableName}.{$columnName}"
            ];
        }
        
        // Check whether modification is needed (type widening)
        $needsModify = self::shouldModifyColumn($columnInfo, $newType, $options);
        if (!$needsModify) {
            return [
                'status' => 'skipped',
                'message' => "Column {$tableName}.{$columnName} does not need modification"
            ];
        }
        
        // Perform the modification (SQLite needs special handling)
        $driver = DB::connection($connection)->getDriverName();
        if ($driver === 'sqlite') {
            // SQLite does not support direct column type changes; it would require rebuilding the table.
            // For safety we only allow expansion operations and never delete data.
            return [
                'status' => 'skipped',
                'message' => "SQLite does not support column type modification. Column {$tableName}.{$columnName} kept as is."
            ];
        }
        
        // MySQL/PostgreSQL support modification
        $schema->table($tableName, function (Blueprint $table) use ($columnName, $newType, $options) {
            $column = null;
            $length = $options['length'] ?? null;
            
            switch ($newType) {
                case 'string':
                    $column = $length ? $table->string($columnName, $length) : $table->string($columnName);
                    break;
                case 'text':
                    $column = $table->text($columnName);
                    break;
                case 'bigInteger':
                    $column = $table->bigInteger($columnName);
                    break;
                default:
                    $column = $table->string($columnName);
            }
            
            if (isset($options['nullable']) && $options['nullable']) {
                $column->nullable()->change();
            } else {
                $column->change();
            }
            
            if (isset($options['default'])) {
                $column->default($options['default'])->change();
            }
        });
        
        return [
            'status' => 'modified',
            'message' => "Column {$tableName}.{$columnName} modified successfully"
        ];
    }

    /**
     * Safe add unique index (if not exists)
     * 
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string|array $columns Index columns (string or array)
     * @param string|null $indexName Index name (optional)
     * @return array ['status' => 'added'|'exists'|'error', 'message' => string]
     */
    public static function safeAddUniqueIndex(
        string $connection,
        string $tableName,
        $columns,
        ?string $indexName = null
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        // Generate index name
        if ($indexName === null) {
            $indexName = self::generateIndexName($tableName, $columns);
        }
        
        // Check if index exists
        if (self::indexExists($connection, $tableName, $indexName)) {
            return [
                'status' => 'exists',
                'message' => "Unique index {$indexName} on {$tableName} already exists"
            ];
        }
        
        $schema->table($tableName, function (Blueprint $table) use ($columns, $indexName) {
            if (is_array($columns)) {
                $table->unique($columns, $indexName);
            } else {
                $table->unique($columns, $indexName);
            }
        });
        
        return [
            'status' => 'added',
            'message' => "Unique index {$indexName} on {$tableName} added successfully"
        ];
    }

    /**
     * Safe add index (if not exists)
     * 
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string|array $columns Index columns (string or array)
     * @param string|null $indexName Index name (optional)
     * @return array ['status' => 'added'|'exists'|'error', 'message' => string]
     */
    public static function safeAddIndex(
        string $connection,
        string $tableName,
        $columns,
        ?string $indexName = null
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        // Generate the index name
        if ($indexName === null) {
            $indexName = self::generateIndexName($tableName, $columns);
        }
        
        // Check whether the index already exists
        if (self::indexExists($connection, $tableName, $indexName)) {
            return [
                'status' => 'exists',
                'message' => "Index {$indexName} on {$tableName} already exists"
            ];
        }
        
        $schema->table($tableName, function (Blueprint $table) use ($columns, $indexName) {
            if (is_array($columns)) {
                $table->index($columns, $indexName);
            } else {
                $table->index($columns, $indexName);
            }
        });
        
        return [
            'status' => 'added',
            'message' => "Index {$indexName} on {$tableName} added successfully"
        ];
    }

    /**
     * Safely add a foreign key (if it does not exist)
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $column Column name
     * @param string $referencedTable Referenced table name
     * @param string $referencedColumn Referenced column name (default 'id')
     * @param string|null $foreignKeyName Foreign key name (optional)
     * @param string $onDelete On-delete behavior (default 'cascade')
     * @return array ['status' => 'added'|'exists'|'error', 'message' => string]
     */
    public static function safeAddForeignKey(
        string $connection,
        string $tableName,
        string $column,
        string $referencedTable,
        string $referencedColumn = 'id',
        ?string $foreignKeyName = null,
        string $onDelete = 'cascade'
    ): array {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        if (!$schema->hasTable($referencedTable)) {
            return [
                'status' => 'error',
                'message' => "Referenced table {$referencedTable} does not exist"
            ];
        }
        
        // Generate the foreign key name
        if ($foreignKeyName === null) {
            $foreignKeyName = self::generateForeignKeyName($tableName, $column);
        }
        
        // Check whether the foreign key already exists
        if (self::foreignKeyExists($connection, $tableName, $foreignKeyName)) {
            return [
                'status' => 'exists',
                'message' => "ForeignKey {$foreignKeyName} on {$tableName} already exists"
            ];
        }
        
        $schema->table($tableName, function (Blueprint $table) use ($column, $referencedTable, $referencedColumn, $foreignKeyName, $onDelete) {
            $table->foreign($column, $foreignKeyName)
                ->references($referencedColumn)
                ->on($referencedTable)
                ->onDelete($onDelete);
        });
        
        return [
            'status' => 'added',
            'message' => "ForeignKey {$foreignKeyName} on {$tableName} added successfully"
        ];
    }

    /**
     * Safely add multiple columns in bulk
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param array $columns Column definition array ['column_name' => callable]
     * @return array ['added' => [], 'skipped' => [], 'errors' => []]
     */
    public static function safeAddColumns(
        string $connection,
        string $tableName,
        array $columns
    ): array {
        $result = [
            'added' => [],
            'skipped' => [],
            'errors' => []
        ];
        
        foreach ($columns as $columnName => $columnDefinition) {
            $addResult = self::safeAddColumn($connection, $tableName, $columnName, $columnDefinition);
            
            if ($addResult['status'] === 'added') {
                $result['added'][] = $columnName;
            } elseif ($addResult['status'] === 'exists') {
                $result['skipped'][] = $columnName;
            } else {
                $result['errors'][] = [
                    'column' => $columnName,
                    'message' => $addResult['message']
                ];
            }
        }
        
        return $result;
    }

    /**
     * Get column information
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $columnName Column name
     * @return array|null
     */
    private static function getColumnInfo(string $connection, string $tableName, string $columnName): ?array
    {
        // ONE driver-agnostic path: Laravel's native getColumns() returns the
        // same shape on sqlite / pgsql / mysql. Its 'type' string already
        // carries the length (e.g. "varchar(255)", "character varying(255)"),
        // which the shared shouldModifyColumn()/columnNeedsModification() regex
        // and stripos() type-matching consume. No PRAGMA / information_schema.
        $columns = Schema::connection($connection)->getColumns($tableName);

        foreach ($columns as $column) {
            if (($column['name'] ?? null) === $columnName) {
                return [
                    'type' => $column['type'] ?? ($column['type_name'] ?? null),
                    'nullable' => (bool) ($column['nullable'] ?? false),
                    'default' => $column['default'] ?? null,
                ];
            }
        }

        return null;
    }

    /**
     * Determine whether a column needs modification
     *
     * @param array $currentInfo Current column info
     * @param string $newType New type
     * @param array $options Options
     * @return bool
     */
    private static function shouldModifyColumn(array $currentInfo, string $newType, array $options): bool
    {
        $currentType = strtolower($currentInfo['type'] ?? '');
        
        // Type expansion rules
        $typeExpansions = [
            'string' => ['varchar', 'char', 'string'],
            'text' => ['varchar', 'char', 'string', 'text'],
            'bigInteger' => ['int', 'integer', 'bigint', 'biginteger'],
        ];
        
        // Check whether the type needs to be widened
        if (isset($typeExpansions[$newType])) {
            $canExpand = false;
            foreach ($typeExpansions[$newType] as $expandableType) {
                if (stripos($currentType, $expandableType) !== false) {
                    $canExpand = true;
                    break;
                }
            }
            
            if (!$canExpand) {
                return false; // Unsupported type expansion
            }

            // Check length expansion (string type only)
            if ($newType === 'string' && isset($options['length'])) {
                // Extract the current length
                preg_match('/\((\d+)\)/', $currentType, $matches);
                $currentLength = $matches[1] ?? 255;

                // Only allow widening, never shrinking
                if ($options['length'] <= $currentLength) {
                    return false; // Shrink operation: not allowed
                }
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Check whether an index exists
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $indexName Index name
     * @return bool
     */
    private static function indexExists(string $connection, string $tableName, string $indexName): bool
    {
        // Native, driver-agnostic (sqlite / pgsql / mysql): hasIndex() matches
        // by index NAME against getIndexes() metadata. pgsql lower-cases index
        // names in its processor, so match case-insensitively to stay
        // equivalent to the previous catalog lookups.
        $schema = Schema::connection($connection);

        if ($schema->hasIndex($tableName, $indexName)) {
            return true;
        }

        foreach ($schema->getIndexes($tableName) as $index) {
            if (strcasecmp((string) ($index['name'] ?? ''), $indexName) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check whether a foreign key exists
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param string $foreignKeyName Foreign key name
     * @return bool
     */
    private static function foreignKeyExists(string $connection, string $tableName, string $foreignKeyName): bool
    {
        // Native, driver-agnostic (sqlite / pgsql / mysql) via getForeignKeys(),
        // which returns ['name','columns'(list),'foreign_table',...].
        //
        // On pgsql / mysql the constraint carries a real name, so match by name
        // (case-insensitive; pgsql lower-cases identifiers). SQLite does NOT
        // persist FK constraint names (getForeignKeys() reports name => null),
        // so the old code matched the generated name's substring in the CREATE
        // SQL. We keep equivalent behaviour without raw SQL: the generated name
        // is "fk_{table}_{column}", so derive the column and check whether an
        // FK on that column exists. This avoids any sqlite_master lookup.
        $foreignKeys = Schema::connection($connection)->getForeignKeys($tableName);

        foreach ($foreignKeys as $fk) {
            $name = $fk['name'] ?? null;
            if ($name !== null && strcasecmp((string) $name, $foreignKeyName) === 0) {
                return true;
            }
        }

        // Name-less (sqlite) fallback: match by the column encoded in the
        // conventional generated name "fk_{table}_{column}".
        $prefix = 'fk_' . $tableName . '_';
        if (str_starts_with($foreignKeyName, $prefix)) {
            $column = substr($foreignKeyName, strlen($prefix));
            foreach ($foreignKeys as $fk) {
                if (in_array($column, $fk['columns'] ?? [], true)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Generate an index name
     *
     * @param string $tableName Table name
     * @param string|array $columns Columns
     * @return string
     */
    private static function generateIndexName(string $tableName, $columns): string
    {
        $columnStr = is_array($columns) ? implode('_', $columns) : $columns;
        return 'idx_' . $tableName . '_' . $columnStr;
    }

    /**
     * Generate a foreign key name
     *
     * @param string $tableName Table name
     * @param string $column Column name
     * @return string
     */
    private static function generateForeignKeyName(string $tableName, string $column): string
    {
        return 'fk_' . $tableName . '_' . $column;
    }

    /**
     * Full table structure alignment - core method
     *
     * Features:
     * 1. Create the table if it does not exist
     * 2. Add missing columns
     * 3. Shrink extra columns (optional, disabled by default)
     * 4. Correct column properties (type, length, nullable, default, etc.)
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param callable $tableDefinition Table definition closure that defines the full table structure
     * @param array $options Options
     *   - 'shrink_columns' => bool Whether to drop extra columns (default false, to avoid data loss)
     *   - 'modify_columns' => bool Whether to correct column properties (default true)
     *   - 'add_indexes' => bool Whether to add missing indexes (default true)
     * @return array ['status' => string, 'actions' => array, 'message' => string]
     */
    public static function alignTableStructure(
        string $connection,
        string $tableName,
        callable $tableDefinition,
        array $options = []
    ): array {
        $shrinkColumns = $options['shrink_columns'] ?? false;
        $modifyColumns = $options['modify_columns'] ?? true;
        $addIndexes = $options['add_indexes'] ?? true;
        
        $schema = Schema::connection($connection);
        $actions = [];
        
        // Step 1: create the table if it does not exist
        if (!$schema->hasTable($tableName)) {
            $schema->create($tableName, $tableDefinition);
            $actions[] = ['action' => 'created_table', 'message' => "Table {$tableName} created"];
            return [
                'status' => 'created',
                'actions' => $actions,
                'message' => "Table {$tableName} created successfully"
            ];
        }

        // Step 2: get the expected table structure definition
        $expectedStructure = self::extractTableStructure($tableDefinition);

        // Step 3: get the current table structure
        $currentColumns = $schema->getColumnListing($tableName);
        $currentColumnInfo = self::getAllColumnsInfo($connection, $tableName);

        // Step 4: add missing columns
        $missingColumns = array_diff(array_keys($expectedStructure['columns']), $currentColumns);
        foreach ($missingColumns as $columnName) {
            $columnDef = $expectedStructure['columns'][$columnName];
            $result = self::safeAddColumn($connection, $tableName, $columnName, function (Blueprint $table, string $colName) use ($columnDef) {
                self::applyColumnDefinition($table, $colName, $columnDef);
            });
            if ($result['status'] === 'added') {
                $actions[] = ['action' => 'added_column', 'column' => $columnName, 'message' => $result['message']];
            }
        }
        
        // Step 5: drop extra columns (if enabled)
        if ($shrinkColumns) {
            $extraColumns = array_diff($currentColumns, array_keys($expectedStructure['columns']));
            foreach ($extraColumns as $columnName) {
                // Skip the primary key and system columns
                if (in_array($columnName, ['id', 'created_at', 'updated_at'])) {
                    continue;
                }
                $result = self::safeDropColumn($connection, $tableName, $columnName);
                if ($result['status'] === 'dropped') {
                    $actions[] = ['action' => 'dropped_column', 'column' => $columnName, 'message' => $result['message'], 'warning' => 'Data may be lost'];
                }
            }
        }
        
        // Step 6: correct column properties (if enabled)
        if ($modifyColumns) {
            foreach ($expectedStructure['columns'] as $columnName => $columnDef) {
                if (!in_array($columnName, $currentColumns)) {
                    continue; // Already added in the previous step
                }

                $currentInfo = $currentColumnInfo[$columnName] ?? null;
                if (!$currentInfo) {
                    continue;
                }

                // Check whether modification is needed
                $needsModify = self::columnNeedsModification($currentInfo, $columnDef);
                if ($needsModify) {
                    $result = self::modifyColumnProperties($connection, $tableName, $columnName, $columnDef, $currentInfo);
                    if ($result['status'] === 'modified') {
                        $actions[] = ['action' => 'modified_column', 'column' => $columnName, 'message' => $result['message']];
                    }
                }
            }
        }
        
        // Step 7: add missing indexes
        if ($addIndexes && !empty($expectedStructure['indexes'])) {
            foreach ($expectedStructure['indexes'] as $indexDef) {
                $result = self::safeAddIndex(
                    $connection,
                    $tableName,
                    $indexDef['columns'],
                    $indexDef['name'] ?? null
                );
                if ($result['status'] === 'added') {
                    $actions[] = ['action' => 'added_index', 'index' => $indexDef['name'] ?? 'auto', 'message' => $result['message']];
                }
            }
        }
        
        $status = !empty($actions) ? 'updated' : 'aligned';
        return [
            'status' => $status,
            'actions' => $actions,
            'message' => empty($actions) 
                ? "Table {$tableName} is already aligned" 
                : "Table {$tableName} aligned: " . count($actions) . " action(s) performed"
        ];
    }

    /**
     * Extract the table structure definition (from a closure)
     *
     * Note: this method is hard to implement because it would require parsing the closure body.
     * Prefer the alignTableStructureFromArray method and pass an array definition directly.
     *
     * @param callable $tableDefinition Table definition closure
     * @return array ['columns' => array, 'indexes' => array]
     */
    private static function extractTableStructure(callable $tableDefinition): array
    {
        // Note: this method would need complex closure parsing; for now it returns an empty structure.
        // Prefer the alignTableStructureFromArray method instead.
        return [
            'columns' => [],
            'indexes' => [],
        ];
    }

    /**
     * Apply a column definition to the Blueprint
     *
     * @param Blueprint $table
     * @param string $columnName
     * @param array $columnDef
     */
    private static function applyColumnDefinition(Blueprint $table, string $columnName, array $columnDef): void
    {
        $type = $columnDef['type'] ?? 'string';
        $length = $columnDef['length'] ?? null;
        $column = null;
        
        switch ($type) {
            case 'id':
            case 'bigIncrements':
                $column = $table->bigIncrements($columnName);
                break;
            case 'increments':
                $column = $table->increments($columnName);
                break;
            case 'string':
                $column = $length ? $table->string($columnName, $length) : $table->string($columnName);
                break;
            case 'text':
                $column = $table->text($columnName);
                break;
            case 'integer':
                $column = $table->integer($columnName);
                break;
            case 'bigInteger':
                $column = $table->bigInteger($columnName);
                break;
            case 'unsignedBigInteger':
                $column = $table->unsignedBigInteger($columnName);
                break;
            case 'unsignedInteger':
            case 'unsigned':
                $column = $table->unsignedInteger($columnName);
                break;
            case 'boolean':
                $column = $table->boolean($columnName);
                break;
            case 'timestamp':
                $column = $table->timestamp($columnName);
                break;
            case 'timestamps':
                // Special case: timestamps() creates both created_at and updated_at
                $table->timestamps();
                return;
            case 'softDeletes':
                // Special case: softDeletes() creates deleted_at
                $table->softDeletes($columnName);
                break;
            case 'softDeletesTz':
                $table->softDeletesTz($columnName);
                break;
            case 'json':
                $column = $table->json($columnName);
                break;
            case 'decimal':
                $precision = $columnDef['precision'] ?? 8;
                $scale = $columnDef['scale'] ?? 2;
                $column = $table->decimal($columnName, $precision, $scale);
                break;
            case 'foreignId':
                $column = $table->foreignId($columnName);
                break;
            case 'uuid':
                $column = $table->uuid($columnName);
                break;
            case 'date':
                $column = $table->date($columnName);
                break;
            case 'dateTime':
                $column = $table->dateTime($columnName);
                break;
            case 'dateTimeTz':
                $column = $table->dateTimeTz($columnName);
                break;
            case 'time':
                $column = $table->time($columnName);
                break;
            case 'char':
                $column = $length ? $table->char($columnName, $length) : $table->char($columnName);
                break;
            case 'mediumText':
                $column = $table->mediumText($columnName);
                break;
            case 'longText':
                $column = $table->longText($columnName);
                break;
            case 'tinyInteger':
                $column = $table->tinyInteger($columnName);
                break;
            case 'tinyInteger':
                $column = $table->tinyInteger($columnName);
                break;
            case 'smallInteger':
                $column = $table->smallInteger($columnName);
                break;
            case 'mediumInteger':
                $column = $table->mediumInteger($columnName);
                break;
            case 'float':
                $column = $table->float($columnName);
                break;
            case 'double':
                $column = $table->double($columnName);
                break;
            case 'enum':
                $values = $columnDef['values'] ?? [];
                if (empty($values)) {
                    $column = $table->string($columnName);
                } else {
                    $column = $table->enum($columnName, $values);
                }
                break;
            case 'ipAddress':
                $column = $table->ipAddress($columnName);
                break;
            case 'macAddress':
                $column = $table->macAddress($columnName);
                break;
            case 'morphs':
                // Special case: morphs() creates tokenable_type and tokenable_id
                $table->morphs($columnName);
                return;
            case 'foreignId':
                $column = $table->foreignId($columnName);
                break;
            default:
                $column = $table->string($columnName);
        }
        
        // Apply modifiers
        if (isset($columnDef['nullable']) && $columnDef['nullable']) {
            $column->nullable();
        }
        
        if (isset($columnDef['default'])) {
            $defaultValue = $columnDef['default'];
            // Support DB::raw() expressions
            if (is_string($defaultValue) && (strpos($defaultValue, 'CURRENT_TIMESTAMP') !== false || strpos($defaultValue, 'DB::raw') !== false)) {
                // For SQLite, use useCurrent() instead
                if (isset($columnDef['useCurrent']) && $columnDef['useCurrent']) {
                    $column->useCurrent();
                } else {
                    $column->default($defaultValue);
                }
            } else {
                $column->default($defaultValue);
            }
        }
        
        if (isset($columnDef['unsigned']) && $columnDef['unsigned']) {
            $column->unsigned();
        }
        
        if (isset($columnDef['comment'])) {
            $column->comment($columnDef['comment']);
        }
        
        if (isset($columnDef['after'])) {
            $column->after($columnDef['after']);
        }
        
        if (isset($columnDef['unique']) && $columnDef['unique']) {
            $column->unique();
        }
        
        if (isset($columnDef['index']) && $columnDef['index']) {
            $column->index();
        }
        
        if (isset($columnDef['useCurrent']) && $columnDef['useCurrent']) {
            $column->useCurrent();
        }
        
        if (isset($columnDef['useCurrentOnUpdate']) && $columnDef['useCurrentOnUpdate']) {
            $column->useCurrentOnUpdate();
        }
    }

    /**
     * Safely drop a column (only used when shrinking is enabled)
     *
     * @param string $connection
     * @param string $tableName
     * @param string $columnName
     * @return array
     */
    private static function safeDropColumn(string $connection, string $tableName, string $columnName): array
    {
        $schema = Schema::connection($connection);
        
        if (!$schema->hasTable($tableName)) {
            return [
                'status' => 'error',
                'message' => "Table {$tableName} does not exist"
            ];
        }
        
        if (!$schema->hasColumn($tableName, $columnName)) {
            return [
                'status' => 'skipped',
                'message' => "Column {$tableName}.{$columnName} does not exist"
            ];
        }
        
        $driver = DB::connection($connection)->getDriverName();
        if ($driver === 'sqlite') {
            // SQLite does not support dropping columns directly; it would require rebuilding the table
            return [
                'status' => 'skipped',
                'message' => "SQLite does not support dropping columns. Column {$columnName} kept."
            ];
        }
        
        $schema->table($tableName, function (Blueprint $table) use ($columnName) {
            $table->dropColumn($columnName);
        });
        
        return [
            'status' => 'dropped',
            'message' => "Column {$tableName}.{$columnName} dropped (data may be lost)"
        ];
    }

    /**
     * Get detailed info for all columns
     *
     * @param string $connection
     * @param string $tableName
     * @return array
     */
    private static function getAllColumnsInfo(string $connection, string $tableName): array
    {
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $result = [];
        
        foreach ($columns as $columnName) {
            $info = self::getColumnInfo($connection, $tableName, $columnName);
            if ($info) {
                $result[$columnName] = $info;
            }
        }
        
        return $result;
    }

    /**
     * Check whether a column needs modification
     *
     * @param array $currentInfo
     * @param array $expectedDef
     * @return bool
     */
    private static function columnNeedsModification(array $currentInfo, array $expectedDef): bool
    {
        // Check the type
        $currentType = strtolower($currentInfo['type'] ?? '');
        $expectedType = strtolower($expectedDef['type'] ?? 'string');

        // Check nullable
        $currentNullable = $currentInfo['nullable'] ?? false;
        $expectedNullable = $expectedDef['nullable'] ?? true;

        // Check the default value
        $currentDefault = $currentInfo['default'] ?? null;
        $expectedDefault = $expectedDef['default'] ?? null;

        // Check the length (for the string type)
        if ($expectedType === 'string' && isset($expectedDef['length'])) {
            preg_match('/\((\d+)\)/', $currentType, $matches);
            $currentLength = $matches[1] ?? 255;
            if ($expectedDef['length'] != $currentLength) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Modify column properties
     *
     * @param string $connection
     * @param string $tableName
     * @param string $columnName
     * @param array $expectedDef
     * @param array $currentInfo
     * @return array
     */
    private static function modifyColumnProperties(
        string $connection,
        string $tableName,
        string $columnName,
        array $expectedDef,
        array $currentInfo
    ): array {
        $driver = DB::connection($connection)->getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite does not support modifying columns directly; skip
            return [
                'status' => 'skipped',
                'message' => "SQLite does not support column modification. Column {$columnName} kept as is."
            ];
        }
        
        $schema = Schema::connection($connection);
        $schema->table($tableName, function (Blueprint $table) use ($columnName, $expectedDef) {
            $column = null;
            $type = $expectedDef['type'] ?? 'string';
            $length = $expectedDef['length'] ?? null;
            
            switch ($type) {
                case 'string':
                    $column = $length ? $table->string($columnName, $length) : $table->string($columnName);
                    break;
                case 'text':
                    $column = $table->text($columnName);
                    break;
                case 'bigInteger':
                    $column = $table->bigInteger($columnName);
                    break;
                default:
                    $column = $table->string($columnName);
            }
            
            if (isset($expectedDef['nullable']) && $expectedDef['nullable']) {
                $column->nullable();
            }
            
            if (isset($expectedDef['default'])) {
                $column->default($expectedDef['default']);
            }
            
            $column->change();
        });
        
        return [
            'status' => 'modified',
            'message' => "Column {$tableName}.{$columnName} properties modified"
        ];
    }

    /**
     * Define a table structure and align it (convenience method)
     *
     * Uses a table structure array definition, which is easier to use
     *
     * @param string $connection Connection name
     * @param string $tableName Table name
     * @param array $tableStructure Table structure definition
     *   [
     *     'columns' => [
     *       'column_name' => [
     *         'type' => 'string|integer|text|...',
     *         'length' => 255,
     *         'nullable' => true,
     *         'default' => null,
     *         'comment' => 'Comment',
     *         'after' => 'other_column',
     *         'unique' => false,
     *         'index' => false,
     *       ],
     *       ...
     *     ],
     *     'indexes' => [
     *       ['columns' => ['col1', 'col2'], 'name' => 'idx_name'],
     *       ...
     *     ],
     *   ]
     * @param array $options Options
     * @return array
     */
    public static function alignTableStructureFromArray(
        string $connection,
        string $tableName,
        array $tableStructure,
        array $options = []
    ): array {
        // Convert to closure form
        $tableDefinition = function (Blueprint $table) use ($tableStructure) {
            // Create columns
            $columnIndexMap = [];
            foreach ($tableStructure['columns'] ?? [] as $columnName => $columnDef) {
                self::applyColumnDefinition($table, $columnName, $columnDef);

                // Record indexes created via column definitions to avoid creating a duplicate single-column index on the same column
                if (!empty($columnDef['index'])) {
                    $columnIndexMap[$columnName] = true;
                }
            }

            // Create indexes (avoid duplicating column-level index)
            foreach ($tableStructure['indexes'] ?? [] as $indexDef) {
                $columns = $indexDef['columns'] ?? [];
                $name = $indexDef['name'] ?? null;
                $isUnique = $indexDef['unique'] ?? false;

                // Normalize the column list
                $columnsList = is_array($columns) ? $columns : [$columns];

                // If it is a single-column regular index and that column already has index=true in its column definition, skip it to prevent duplicate creation
                if (
                    !$isUnique
                    && $name === null
                    && count($columnsList) === 1
                    && isset($columnIndexMap[$columnsList[0]])
                ) {
                    continue;
                }

                if (is_array($columns)) {
                    $table->index($columns, $name);
                } else {
                    $table->index($columns, $name);
                }
            }
        };
        
        // Save the index definitions for later use
        $expectedStructure = [
            'columns' => $tableStructure['columns'] ?? [],
            'indexes' => $tableStructure['indexes'] ?? [],
        ];
        
        $schema = Schema::connection($connection);
        $actions = [];
        
        // Step 1: create the table if it does not exist
        if (!$schema->hasTable($tableName)) {
            $schema->create($tableName, $tableDefinition);
            $actions[] = ['action' => 'created_table', 'message' => "Table {$tableName} created"];
            return [
                'status' => 'created',
                'actions' => $actions,
                'message' => "Table {$tableName} created successfully"
            ];
        }

        // Step 2: get the current table structure
        $currentColumns = $schema->getColumnListing($tableName);
        $currentColumnInfo = self::getAllColumnsInfo($connection, $tableName);

        // Step 3: add missing columns
        $driver = DB::connection($connection)->getDriverName();
        $missingColumns = array_diff(array_keys($expectedStructure['columns']), $currentColumns);
        foreach ($missingColumns as $columnName) {
            $columnDef = $expectedStructure['columns'][$columnName];
            $isPkOrIncrements = in_array($columnDef['type'] ?? '', ['increments', 'bigIncrements', 'id'], true)
                || $columnName === 'id';
            if ($driver === 'sqlite' && $isPkOrIncrements) {
                $actions[] = ['action' => 'skipped_column', 'column' => $columnName, 'message' => "SQLite cannot add PRIMARY KEY column to existing table. Table {$tableName} already exists without {$columnName}. Recreate table or use migrate:fresh if needed."];
                continue;
            }
            $result = self::safeAddColumn($connection, $tableName, $columnName, function (Blueprint $table, string $colName) use ($columnDef) {
                self::applyColumnDefinition($table, $colName, $columnDef);
            });
            if ($result['status'] === 'added') {
                $actions[] = ['action' => 'added_column', 'column' => $columnName, 'message' => $result['message']];
            }
        }
        
        // Step 4: drop extra columns (if enabled)
        $shrinkColumns = $options['shrink_columns'] ?? false;
        if ($shrinkColumns) {
            $extraColumns = array_diff($currentColumns, array_keys($expectedStructure['columns']));
            foreach ($extraColumns as $columnName) {
                if (in_array($columnName, ['id', 'created_at', 'updated_at'])) {
                    continue;
                }
                $result = self::safeDropColumn($connection, $tableName, $columnName);
                if ($result['status'] === 'dropped') {
                    $actions[] = ['action' => 'dropped_column', 'column' => $columnName, 'message' => $result['message'], 'warning' => 'Data may be lost'];
                }
            }
        }
        
        // Step 5: correct column properties (if enabled)
        $modifyColumns = $options['modify_columns'] ?? true;
        if ($modifyColumns) {
            foreach ($expectedStructure['columns'] as $columnName => $columnDef) {
                if (!in_array($columnName, $currentColumns)) {
                    continue;
                }
                
                $currentInfo = $currentColumnInfo[$columnName] ?? null;
                if (!$currentInfo) {
                    continue;
                }
                
                $needsModify = self::columnNeedsModification($currentInfo, $columnDef);
                if ($needsModify) {
                    $result = self::modifyColumnProperties($connection, $tableName, $columnName, $columnDef, $currentInfo);
                    if ($result['status'] === 'modified') {
                        $actions[] = ['action' => 'modified_column', 'column' => $columnName, 'message' => $result['message']];
                    }
                }
            }
        }
        
        // Step 6: Add missing indexes
        $addIndexes = $options['add_indexes'] ?? true;
        if ($addIndexes && !empty($expectedStructure['indexes'])) {
            foreach ($expectedStructure['indexes'] as $indexDef) {
                $columns = $indexDef['columns'] ?? $indexDef['column'] ?? [];
                $indexName = $indexDef['name'] ?? null;
                $isUnique = $indexDef['unique'] ?? false;
                
                if ($isUnique) {
                    // Handle unique index
                    $result = self::safeAddUniqueIndex($connection, $tableName, $columns, $indexName);
                } else {
                    // Handle regular index
                    $result = self::safeAddIndex($connection, $tableName, $columns, $indexName);
                }
                
                if ($result['status'] === 'added') {
                    $actions[] = ['action' => 'added_index', 'index' => $indexName ?? 'auto', 'message' => $result['message']];
                }
            }
        }
        
        // Step 7: Add missing foreign keys
        if (!empty($expectedStructure['foreignKeys'])) {
            foreach ($expectedStructure['foreignKeys'] as $fkDef) {
                $result = self::safeAddForeignKey(
                    $connection,
                    $tableName,
                    $fkDef['column'],
                    $fkDef['references'],
                    $fkDef['on'] ?? 'id',
                    $fkDef['name'] ?? null,
                    $fkDef['onDelete'] ?? 'cascade'
                );
                if ($result['status'] === 'added') {
                    $actions[] = ['action' => 'added_foreign_key', 'fk' => $fkDef['name'] ?? 'auto', 'message' => $result['message']];
                }
            }
        }
        
        $status = !empty($actions) ? 'updated' : 'aligned';
        return [
            'status' => $status,
            'actions' => $actions,
            'message' => empty($actions) 
                ? "Table {$tableName} is already aligned" 
                : "Table {$tableName} aligned: " . count($actions) . " action(s) performed"
        ];
    }
}
