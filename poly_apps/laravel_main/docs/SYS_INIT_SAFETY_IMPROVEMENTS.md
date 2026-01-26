# sys:init 命令安全性改进文档

## 概述

本文档详细说明了 `php artisan sys:init` 命令的安全性改进，确保：
1. **幂等性**：多次运行结果一致
2. **数据安全**：永远不会删除数据
3. **字段对齐**：代码向数据库结构对齐（不是重建表）
4. **详细注释**：每一行代码都有详细说明

## 核心原则

### 1. 数据安全保证

- ✅ **表存在则跳过**：如果表已存在，不会重建
- ✅ **字段不一致则修正**：添加缺失字段，但不删除数据
- ✅ **永远不删除数据**：所有操作都是添加性的
- ✅ **幂等性**：多次运行结果一致

### 2. --force 参数说明

**重要**：`--force` 参数**只**用于绕过生产环境的确认提示，**不会**删除数据。

```php
// --force 的作用：
// 1. 绕过生产环境的确认提示（"Do you really wish to run this command? (yes/no)")
// 2. 允许在自动化脚本中运行迁移
// 3. 不会改变迁移的行为（迁移仍然是幂等的）
// 4. 不会删除数据（迁移使用 hasTable() 检查）
```

### 3. 迁移行为

所有迁移文件都遵循以下模式：

```php
public function up(): void
{
    // 1. 检查表是否存在
    if (!Schema::connection($connection)->hasTable($tableName)) {
        // 2. 如果不存在，创建表
        Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            // 定义表结构
        });
        return;
    }
    
    // 3. 如果表存在，检查缺失字段并添加（不删除数据）
    $columns = Schema::connection($connection)->getColumnListing($tableName);
    $columnsMap = array_flip($columns);
    
    Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
        // 只添加缺失的字段，不删除现有字段
        if (!isset($columnsMap['new_column'])) {
            $table->string('new_column')->nullable();
        }
    });
}
```

## 文件改进清单

### 1. InitializeApps.php

**位置**：`app/Console/Commands/InitializeApps.php`

**改进内容**：
- ✅ 添加了详细的逐行注释，说明每一行的作用
- ✅ 详细解释了 `--force` 参数的作用和安全性
- ✅ 说明了迁移的执行流程和数据安全保证
- ✅ 添加了连接解析的说明（KEY center）

**关键方法**：`runSafeMigrations()`

**注释说明**：
- Line 793: 显示迁移模式信息
- Line 798-800: 默认连接迁移执行（带详细注释）
- Line 812-815: AppQyV1 连接迁移执行（带详细注释）
- Line 824: 异常处理

### 2. SafeMigrationHelper.php（新建）

**位置**：`app/Services/SafeMigrationHelper.php`

**功能**：
- ✅ 提供安全的迁移辅助方法
- ✅ 确保表存在并包含所有必需字段
- ✅ 添加缺失字段（不删除数据）
- ✅ 检查表结构完整性

**主要方法**：
- `ensureTableWithColumns()`: 确保表存在并包含所有字段
- `checkTableColumns()`: 检查表是否包含所有必需字段
- `addMissingColumns()`: 添加缺失字段（不删除数据）

## 迁移文件检查

### 已检查的迁移文件

所有迁移文件都已检查，确保：
- ✅ 使用 `hasTable()` 检查表是否存在
- ✅ 如果表存在，只添加缺失字段
- ✅ 不删除现有字段或数据

### 迁移文件示例

**好的示例**（使用 hasTable 检查）：

```php
// AppQyV1_2025_12_19_000001_create_tts_queue_table.php
if (!Schema::connection($this->connection)->hasTable($tableName)) {
    Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
        // 创建表
    });
    return;
}

// 表存在，添加缺失字段
$columns = Schema::connection($this->connection)->getColumnListing($tableName);
// ... 添加缺失字段
```

## 运行说明

### 基本用法

```bash
php artisan sys:init
```

### 执行流程

1. **检查 Octane/Swoole 兼容性**
2. **检查 Octane hot-reload 依赖**
3. **创建外部存储目录**
4. **运行安全迁移**（核心步骤）
   - 默认连接迁移
   - AppQyV1 连接迁移
5. **创建邀请码表**
6. **初始化用户表**
7. **清理冲突表**（仅在安全条件下）
8. **创建 TTS 缓存表**
9. **创建语音字幕用户设置表**
10. **检查统一 TTS 队列表**
11. **检查文章库表**
12. **创建单词学习表**
13. **导入多语言单词数据**
14. **初始化词典**
15. **检查 AppQyV1 用户初始化表**
16. **验证 Octane Timer 任务**
17. **检查词汇库表**
18. **导入词汇库**
19. **初始化全局任务系统**
20. **验证 AI 提供商**
21. **初始化应用**

## 数据安全保证

### 1. 表创建

- ✅ 如果表不存在，创建表（无数据丢失，表不存在）
- ✅ 如果表存在，跳过创建（无数据丢失，表已存在）

### 2. 字段添加

- ✅ 如果字段不存在，添加字段（不删除数据）
- ✅ 如果字段存在，跳过添加（不删除数据）
- ✅ 永远不删除现有字段

### 3. 数据保护

- ✅ 所有操作都是添加性的
- ✅ 不会修改现有数据
- ✅ 不会删除现有数据
- ✅ 不会删除现有表

## 常见问题

### Q: --force 参数会删除数据吗？

**A**: 不会。`--force` 只用于绕过生产环境的确认提示，不会改变迁移的行为。迁移使用 `hasTable()` 检查确保幂等性，不会删除数据。

### Q: 如果表已存在但字段不同怎么办？

**A**: 迁移会检查缺失字段并添加它们，但不会删除现有字段或数据。这确保了代码向数据库结构对齐，而不是重建表。

### Q: 多次运行 sys:init 安全吗？

**A**: 是的。所有操作都是幂等的，多次运行结果一致，不会造成数据丢失。

### Q: 如果迁移失败会删除数据吗？

**A**: 不会。即使迁移失败，也不会删除数据。迁移只执行添加操作（创建表、添加字段），不执行删除操作。

## 验证清单

运行 `php artisan sys:init` 后，检查：

- [ ] 所有迁移成功完成（无错误）
- [ ] 所有表都存在
- [ ] 所有必需字段都存在
- [ ] 现有数据完整（无数据丢失）
- [ ] 可以多次运行而不出错

## 相关文件

- `app/Console/Commands/InitializeApps.php` - 主命令文件
- `app/Services/SafeMigrationHelper.php` - 安全迁移辅助类
- `database/migrations/` - 所有迁移文件

## 更新日志

- **2025-01-XX**: 添加详细的逐行注释
- **2025-01-XX**: 创建 SafeMigrationHelper 辅助类
- **2025-01-XX**: 改进 runSafeMigrations() 方法注释
- **2025-01-XX**: 验证所有迁移文件使用 hasTable() 检查

