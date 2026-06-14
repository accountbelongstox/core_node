# Migration Safety — Superseded (see LARAVEL_GUIDE.md §5.1)

> **The canonical migration / schema-safety norm now lives in
> [`development-guides/LARAVEL_GUIDE.md` §5.1 "Idempotent Schema Management"](../../development-guides/LARAVEL_GUIDE.md).**
> The former one-time per-file audit progress table (a 2026-01 sweep, mostly stale)
> has been removed. The durable `SafeMigrationHelper` reference is retained below.

## 安全原则 (canonical: LARAVEL_GUIDE.md §5.1)

1. ✅ **只创建不存在的表** — `Schema::hasTable()`
2. ✅ **只添加不存在的字段** — `Schema::hasColumn()` / `getColumnListing()` + `array_diff`
3. ✅ **只添加不存在的索引** — `Schema::hasIndex()`
4. ❌ **禁止删除表** — `dropTable()` / `dropIfExists()`（仅 `down()` 回滚允许）
5. ❌ **禁止删除字段** — `dropColumn()`（仅 `down()` 回滚允许）
6. ❌ **禁止删除数据** — `truncate()` 或全表 `delete()`
7. ❌ **禁止重建表** — 删除后重建（有数据的表绝不重建）

**结构 vs 数据分离**：表存在但代码改了结构时，只 `Schema::table()` **ALTER 补加缺失字段/索引**（通用补加，覆盖所有期望字段，而非 `if 列=='x'` 的一次性写法）；数据的幂等补缺（只插入缺失行，如新增的单词用 `insertOrIgnore` / md5 去重 upsert）是**独立的一遍**，加字段绝不重灌或清空已有行。

由 `App\Console\Commands\CheckMigrationSafety` 强制校验。

## SafeMigrationHelper 使用说明

### 核心方法：`alignTableStructureFromArray`（推荐，幂等结构对齐）

1. ✅ 表不存在则创建
2. ✅ 添加缺失字段（ALTER，不重建）
3. ✅ 收缩多余字段（可选，`shrink_columns` 默认 `false` —— 初始化路径**必须**保持 false，删字段=丢数据）
4. ✅ 修正字段属性（`modify_columns`；大表已有数据时建议设 `false`，避免整表类型重写）
5. ✅ 添加缺失索引

```php
use App\Services\SafeMigrationHelper;

$result = SafeMigrationHelper::alignTableStructureFromArray(
    $connection,        // e.g. AppTablePrefixServiceProvider::getConnection($appKey)
    $tableName,
    [
        'columns' => [
            'id'         => ['type' => 'bigIncrements'],
            'name'       => ['type' => 'string', 'length' => 255, 'nullable' => false],
            'status'     => ['type' => 'string', 'length' => 50, 'default' => 'active'],
            'created_at' => ['type' => 'timestamp', 'nullable' => true],
            'updated_at' => ['type' => 'timestamp', 'nullable' => true],
        ],
        'indexes' => [
            ['columns' => ['name'],   'name' => 'idx_example_name'],
            ['columns' => ['status'], 'name' => 'idx_example_status'],
        ],
    ],
    [
        'shrink_columns' => false, // false=不删多余字段（安全）；true=删除（危险，禁用于 init）
        'modify_columns' => true,  // 修正字段属性（大表已有数据时设 false）
        'add_indexes'    => true,
    ]
);
```

### 支持的字段类型
`bigIncrements` · `increments` · `string`(length) · `text` · `integer` · `bigInteger` · `boolean` · `timestamp` · `json` · `decimal`(precision,scale)

### 字段属性
`type`(必需) · `length` · `nullable`(默认 true) · `default` · `unsigned` · `comment` · `after` · `unique` · `index`

### 基本方法（单独使用）

```php
SafeMigrationHelper::safeCreateTable($connection, $tableName, fn (Blueprint $t) => $t->id());
SafeMigrationHelper::safeAddColumn($connection, $tableName, 'new_column',
    fn (Blueprint $t, string $c) => $t->string($c)->nullable());
SafeMigrationHelper::safeAddIndex($connection, $tableName, 'column_name', 'index_name');
SafeMigrationHelper::safeAddForeignKey($connection, $tableName, 'user_id', 'users', 'id');
```

完整示例：`database/migrations/EXAMPLE_using_SafeMigrationHelper.php`
