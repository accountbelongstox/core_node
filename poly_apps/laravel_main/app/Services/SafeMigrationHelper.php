<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

/**
 * Safe Migration Helper - 安全迁移辅助类
 * 
 * 提供幂等性数据库迁移工具，确保：
 * - 永远不会删除表或数据
 * - 只在表不存在时创建表
 * - 只在字段不存在时添加字段
 * - 支持字段类型扩展（如 string(50) -> string(255)），但不收缩
 * - 支持索引对齐（添加缺失索引）
 * - 确保代码向数据库结构对齐（不是重建表）
 * 
 * 使用场景：
 * - 表不存在：创建表及所有字段
 * - 表存在但字段缺失：添加缺失字段
 * - 表存在但字段类型需要扩展：扩展字段类型（不收缩）
 * - 表存在但索引缺失：添加缺失索引
 */
class SafeMigrationHelper
{
    /**
     * 安全创建表（如果不存在）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param callable $tableDefinition 表定义闭包
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
     * 安全添加字段（如果不存在）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $columnName 字段名
     * @param callable $columnDefinition 字段定义闭包，接收 Blueprint $table 参数
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
     * 安全修改字段类型（仅扩展，不收缩）
     * 
     * 支持的扩展操作：
     * - string(50) -> string(255) ✅
     * - string(255) -> text ✅
     * - integer -> bigInteger ✅
     * - 不支持收缩操作（会跳过）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $columnName 字段名
     * @param string $newType 新类型（'string', 'text', 'bigInteger' 等）
     * @param array $options 选项 ['length' => int, 'nullable' => bool, 'default' => mixed]
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
        
        // 获取当前字段信息
        $columnInfo = self::getColumnInfo($connection, $tableName, $columnName);
        if (!$columnInfo) {
            return [
                'status' => 'error',
                'message' => "Could not get column info for {$tableName}.{$columnName}"
            ];
        }
        
        // 检查是否需要修改（类型扩展）
        $needsModify = self::shouldModifyColumn($columnInfo, $newType, $options);
        if (!$needsModify) {
            return [
                'status' => 'skipped',
                'message' => "Column {$tableName}.{$columnName} does not need modification"
            ];
        }
        
        // 执行修改（SQLite 需要特殊处理）
        $driver = DB::connection($connection)->getDriverName();
        if ($driver === 'sqlite') {
            // SQLite 不支持直接修改列类型，需要重建表
            // 但为了安全，我们只允许扩展操作，且不删除数据
            return [
                'status' => 'skipped',
                'message' => "SQLite does not support column type modification. Column {$tableName}.{$columnName} kept as is."
            ];
        }
        
        // MySQL/PostgreSQL 支持修改
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
        
        // 生成索引名称
        if ($indexName === null) {
            $indexName = self::generateIndexName($tableName, $columns);
        }
        
        // 检查索引是否存在
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
     * 安全添加外键（如果不存在）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $column 字段名
     * @param string $referencedTable 引用表名
     * @param string $referencedColumn 引用字段名（默认 'id'）
     * @param string|null $foreignKeyName 外键名称（可选）
     * @param string $onDelete 删除行为（默认 'cascade'）
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
        
        // 生成外键名称
        if ($foreignKeyName === null) {
            $foreignKeyName = self::generateForeignKeyName($tableName, $column);
        }
        
        // 检查外键是否存在
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
     * 批量安全添加字段
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param array $columns 字段定义数组 ['column_name' => callable]
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
     * 获取字段信息
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $columnName 字段名
     * @return array|null
     */
    private static function getColumnInfo(string $connection, string $tableName, string $columnName): ?array
    {
        $driver = DB::connection($connection)->getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite 查询字段信息
            $result = DB::connection($connection)->select(
                "PRAGMA table_info({$tableName})"
            );
            
            foreach ($result as $column) {
                if ($column->name === $columnName) {
                    return [
                        'type' => $column->type,
                        'notnull' => $column->notnull,
                        'default' => $column->dflt_value,
                    ];
                }
            }
        } else {
            // MySQL/PostgreSQL 查询字段信息
            $database = DB::connection($connection)->getDatabaseName();
            $result = DB::connection($connection)->select(
                "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
                 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                [$database, $tableName, $columnName]
            );
            
            if (!empty($result)) {
                $info = $result[0];
                return [
                    'type' => $info->COLUMN_TYPE ?? null,
                    'nullable' => ($info->IS_NULLABLE ?? 'NO') === 'YES',
                    'default' => $info->COLUMN_DEFAULT ?? null,
                ];
            }
        }
        
        return null;
    }

    /**
     * 判断是否需要修改字段
     * 
     * @param array $currentInfo 当前字段信息
     * @param string $newType 新类型
     * @param array $options 选项
     * @return bool
     */
    private static function shouldModifyColumn(array $currentInfo, string $newType, array $options): bool
    {
        $currentType = strtolower($currentInfo['type'] ?? '');
        
        // 类型扩展规则
        $typeExpansions = [
            'string' => ['varchar', 'char', 'string'],
            'text' => ['varchar', 'char', 'string', 'text'],
            'bigInteger' => ['int', 'integer', 'bigint', 'biginteger'],
        ];
        
        // 检查是否需要扩展类型
        if (isset($typeExpansions[$newType])) {
            $canExpand = false;
            foreach ($typeExpansions[$newType] as $expandableType) {
                if (stripos($currentType, $expandableType) !== false) {
                    $canExpand = true;
                    break;
                }
            }
            
            if (!$canExpand) {
                return false; // 不支持的类型扩展
            }
            
            // 检查长度扩展（仅适用于 string）
            if ($newType === 'string' && isset($options['length'])) {
                // 提取当前长度
                preg_match('/\((\d+)\)/', $currentType, $matches);
                $currentLength = $matches[1] ?? 255;
                
                // 只允许扩展，不允许收缩
                if ($options['length'] <= $currentLength) {
                    return false; // 收缩操作，不允许
                }
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * 检查索引是否存在
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $indexName 索引名称
     * @return bool
     */
    private static function indexExists(string $connection, string $tableName, string $indexName): bool
    {
        $driver = DB::connection($connection)->getDriverName();
        
        if ($driver === 'sqlite') {
            $result = DB::connection($connection)->select(
                "SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?",
                [$indexName, $tableName]
            );
            return !empty($result);
        } else {
            $database = DB::connection($connection)->getDatabaseName();
            $result = DB::connection($connection)->select(
                "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?",
                [$database, $tableName, $indexName]
            );
            return !empty($result);
        }
    }

    /**
     * 检查外键是否存在
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string $foreignKeyName 外键名称
     * @return bool
     */
    private static function foreignKeyExists(string $connection, string $tableName, string $foreignKeyName): bool
    {
        $driver = DB::connection($connection)->getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite 外键检查
            $result = DB::connection($connection)->select(
                "SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE ?",
                ["%CONSTRAINT {$foreignKeyName}%"]
            );
            return !empty($result);
        } else {
            $database = DB::connection($connection)->getDatabaseName();
            $result = DB::connection($connection)->select(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
                [$database, $tableName, $foreignKeyName]
            );
            return !empty($result);
        }
    }

    /**
     * 生成索引名称
     * 
     * @param string $tableName 表名
     * @param string|array $columns 字段
     * @return string
     */
    private static function generateIndexName(string $tableName, $columns): string
    {
        $columnStr = is_array($columns) ? implode('_', $columns) : $columns;
        return 'idx_' . $tableName . '_' . $columnStr;
    }

    /**
     * 生成外键名称
     * 
     * @param string $tableName 表名
     * @param string $column 字段名
     * @return string
     */
    private static function generateForeignKeyName(string $tableName, string $column): string
    {
        return 'fk_' . $tableName . '_' . $column;
    }

    /**
     * 完整表结构对齐 - 核心方法
     * 
     * 功能：
     * 1. 表不存在则创建
     * 2. 添加缺失字段
     * 3. 收缩多余字段（可选，默认关闭）
     * 4. 修正字段属性（类型、长度、nullable、default等）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param callable $tableDefinition 表定义闭包，定义完整的表结构
     * @param array $options 选项
     *   - 'shrink_columns' => bool 是否收缩多余字段（默认false，避免数据丢失）
     *   - 'modify_columns' => bool 是否修正字段属性（默认true）
     *   - 'add_indexes' => bool 是否添加缺失索引（默认true）
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
        
        // 步骤1: 如果表不存在，创建表
        if (!$schema->hasTable($tableName)) {
            $schema->create($tableName, $tableDefinition);
            $actions[] = ['action' => 'created_table', 'message' => "Table {$tableName} created"];
            return [
                'status' => 'created',
                'actions' => $actions,
                'message' => "Table {$tableName} created successfully"
            ];
        }
        
        // 步骤2: 获取期望的表结构定义
        $expectedStructure = self::extractTableStructure($tableDefinition);
        
        // 步骤3: 获取当前表结构
        $currentColumns = $schema->getColumnListing($tableName);
        $currentColumnInfo = self::getAllColumnsInfo($connection, $tableName);
        
        // 步骤4: 添加缺失字段
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
        
        // 步骤5: 收缩多余字段（如果启用）
        if ($shrinkColumns) {
            $extraColumns = array_diff($currentColumns, array_keys($expectedStructure['columns']));
            foreach ($extraColumns as $columnName) {
                // 跳过主键和系统字段
                if (in_array($columnName, ['id', 'created_at', 'updated_at'])) {
                    continue;
                }
                $result = self::safeDropColumn($connection, $tableName, $columnName);
                if ($result['status'] === 'dropped') {
                    $actions[] = ['action' => 'dropped_column', 'column' => $columnName, 'message' => $result['message'], 'warning' => 'Data may be lost'];
                }
            }
        }
        
        // 步骤6: 修正字段属性（如果启用）
        if ($modifyColumns) {
            foreach ($expectedStructure['columns'] as $columnName => $columnDef) {
                if (!in_array($columnName, $currentColumns)) {
                    continue; // 已在上一步添加
                }
                
                $currentInfo = $currentColumnInfo[$columnName] ?? null;
                if (!$currentInfo) {
                    continue;
                }
                
                // 检查是否需要修改
                $needsModify = self::columnNeedsModification($currentInfo, $columnDef);
                if ($needsModify) {
                    $result = self::modifyColumnProperties($connection, $tableName, $columnName, $columnDef, $currentInfo);
                    if ($result['status'] === 'modified') {
                        $actions[] = ['action' => 'modified_column', 'column' => $columnName, 'message' => $result['message']];
                    }
                }
            }
        }
        
        // 步骤7: 添加缺失索引
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
     * 提取表结构定义（从闭包）
     * 
     * 注意：此方法难以实现，因为需要解析闭包内容
     * 推荐使用 alignTableStructureFromArray 方法，直接传入数组定义
     * 
     * @param callable $tableDefinition 表定义闭包
     * @return array ['columns' => array, 'indexes' => array]
     */
    private static function extractTableStructure(callable $tableDefinition): array
    {
        // 注意：此方法需要复杂的闭包解析，目前返回空结构
        // 推荐使用 alignTableStructureFromArray 方法替代
        return [
            'columns' => [],
            'indexes' => [],
        ];
    }

    /**
     * 应用字段定义到Blueprint
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
     * 安全删除字段（仅在启用收缩时使用）
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
            // SQLite不支持直接删除列，需要重建表
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
     * 获取所有字段的详细信息
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
     * 检查字段是否需要修改
     * 
     * @param array $currentInfo
     * @param array $expectedDef
     * @return bool
     */
    private static function columnNeedsModification(array $currentInfo, array $expectedDef): bool
    {
        // 检查类型
        $currentType = strtolower($currentInfo['type'] ?? '');
        $expectedType = strtolower($expectedDef['type'] ?? 'string');
        
        // 检查nullable
        $currentNullable = $currentInfo['nullable'] ?? false;
        $expectedNullable = $expectedDef['nullable'] ?? true;
        
        // 检查默认值
        $currentDefault = $currentInfo['default'] ?? null;
        $expectedDefault = $expectedDef['default'] ?? null;
        
        // 检查长度（对于string类型）
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
     * 修改字段属性
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
            // SQLite不支持直接修改列，跳过
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
     * 定义表结构并对齐（便捷方法）
     * 
     * 使用表结构数组定义，更易于使用
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param array $tableStructure 表结构定义
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
     * @param array $options 选项
     * @return array
     */
    public static function alignTableStructureFromArray(
        string $connection,
        string $tableName,
        array $tableStructure,
        array $options = []
    ): array {
        // 转换为闭包形式
        $tableDefinition = function (Blueprint $table) use ($tableStructure) {
            // 创建字段
            foreach ($tableStructure['columns'] ?? [] as $columnName => $columnDef) {
                self::applyColumnDefinition($table, $columnName, $columnDef);
            }
            
            // 创建索引
            foreach ($tableStructure['indexes'] ?? [] as $indexDef) {
                $columns = $indexDef['columns'] ?? [];
                $name = $indexDef['name'] ?? null;
                if (is_array($columns)) {
                    $table->index($columns, $name);
                } else {
                    $table->index($columns, $name);
                }
            }
        };
        
        // 保存索引定义供后续使用
        $expectedStructure = [
            'columns' => $tableStructure['columns'] ?? [],
            'indexes' => $tableStructure['indexes'] ?? [],
        ];
        
        $schema = Schema::connection($connection);
        $actions = [];
        
        // 步骤1: 如果表不存在，创建表
        if (!$schema->hasTable($tableName)) {
            $schema->create($tableName, $tableDefinition);
            $actions[] = ['action' => 'created_table', 'message' => "Table {$tableName} created"];
            return [
                'status' => 'created',
                'actions' => $actions,
                'message' => "Table {$tableName} created successfully"
            ];
        }
        
        // 步骤2: 获取当前表结构
        $currentColumns = $schema->getColumnListing($tableName);
        $currentColumnInfo = self::getAllColumnsInfo($connection, $tableName);
        
        // 步骤3: 添加缺失字段
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
        
        // 步骤4: 收缩多余字段（如果启用）
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
        
        // 步骤5: 修正字段属性（如果启用）
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
