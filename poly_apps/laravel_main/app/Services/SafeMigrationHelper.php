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
     * 安全添加索引（如果不存在）
     * 
     * @param string $connection 连接名称
     * @param string $tableName 表名
     * @param string|array $columns 索引字段（字符串或数组）
     * @param string|null $indexName 索引名称（可选）
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
}
