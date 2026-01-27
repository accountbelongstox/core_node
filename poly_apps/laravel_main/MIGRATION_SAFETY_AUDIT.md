# Migration Safety Audit Progress

## 安全原则
1. ✅ **只创建不存在的表** - 使用 `hasTable()` 检查
2. ✅ **只添加不存在的字段** - 使用 `hasColumn()` 检查
3. ✅ **只添加不存在的索引** - 检查索引是否存在
4. ❌ **禁止删除表** - 不允许 `dropTable()` 或 `dropIfExists()`（除非在 down() 方法中用于回滚）
5. ❌ **禁止删除字段** - 不允许 `dropColumn()`（除非在 down() 方法中用于回滚）
6. ❌ **禁止删除数据** - 不允许 `truncate()` 或 `delete()` 所有数据
7. ❌ **禁止重建表** - 不允许删除后重建表

## 检查进度

### AppQyV1 Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| AppQyV1_2025_12_01_072228_add_cover_processing_columns_and_indexes.php | ✅ 已检查 | 无 | 已使用SafeMigrationHelper模式 |
| AppQyV1_2025_12_19_000001_create_group_words_table.php | ✅ 已检查 | 无 | 使用hasTable检查 |
| AppQyV1_2025_12_19_000002_create_user_word_progress_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_12_19_000003_create_group_libraries_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_12_20_000001_create_user_initializations_table.php | ✅ 已检查 | 无 | 使用hasTable检查 |
| AppQyV1_2025_12_20_000002_create_vocabulary_libraries_table.php | ✅ 已检查 | 无 | 使用hasTable检查 |
| AppQyV1_2025_12_20_000003_create_vocabulary_words_table.php | ✅ 已检查 | 无 | 使用hasTable检查 |
| AppQyV1_2025_12_20_000004_add_cover_image_to_word_groups.php | ✅ 已检查 | 无 | 使用hasTable和hasColumn检查 |
| AppQyV1_2025_12_20_000004_create_user_languages_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_12_20_000005_add_language_fields_to_word_groups.php | ✅ 已检查 | 无 | 使用hasTable和hasColumn检查 |
| AppQyV1_2025_12_20_000005_create_user_vocabulary_selections_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_12_20_000006_create_vocabulary_covers_table.php | ✅ 已检查 | 无 | 使用hasTable检查 |
| AppQyV1_2025_12_19_000001_create_tts_queue_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_04_02_074632_create_app_qy_v1_word_groups_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_04_02_082636_create_app_qy_v1_personal_dictionaries_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_04_16_170153_create_app_qy_v1_dictionaries_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_11_23_231133_create_multi_language_dictionaries_tables.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_11_24_000001_create_vocabulary_collections_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_11_24_000002_create_vocabulary_items_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_11_24_000003_create_user_learning_progress_table.php | ⏳ 待检查 | - | - |
| AppQyV1_2025_11_24_000004_create_user_selected_libraries_table.php | ⏳ 待检查 | - | - |
| 2025_12_20_222838_add_has_audio_to_dictionaries.php | ⏳ 待检查 | - | - |
| 2025_12_15_103119_create_app_qy_v1_articles_table.php | ⏳ 待检查 | - | - |
| 2025_12_15_103143_create_app_qy_v1_article_words_table.php | ⏳ 待检查 | - | - |

### AwyV0 Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| AwyV0_2025_11_03_000001_create_awy_v0_friends_table.php | ⏳ 待检查 | - | - |
| AwyV0_2025_11_03_000002_create_awy_v0_conversations_table.php | ⏳ 待检查 | - | - |
| AwyV0_2025_11_03_000003_create_awy_v0_conversation_participants_table.php | ⏳ 待检查 | - | - |
| AwyV0_2025_11_03_000004_create_awy_v0_messages_table.php | ⏳ 待检查 | - | - |
| AwyV0_2025_12_03_create_awy_v0_tables.php | ⏳ 待检查 | - | - |

### BankV1 Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| BankV1_2024_01_26_000001_create_data_submission_tables.php | ⏳ 待检查 | - | - |
| BankV1_2026_01_26_000001_add_extended_fields_to_user_data_submissions.php | ✅ 已检查 | 无 | 使用hasTable和hasColumn检查 |

### CodeMartV1 Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| CodeMartV1_2025_12_18_000001_create_deposits_table.php | ⏳ 待检查 | - | - |
| CodeMartV1_2025_12_18_000002_create_ai_analyses_table.php | ⏳ 待检查 | - | - |
| CodeMartV1_2025_12_18_000003_create_developer_stats_table.php | ⏳ 待检查 | - | - |

### VipClubV1 Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| VipClubV1_2025_11_02_000002_create_vipclubv1_facilities_table.php | ⏳ 待检查 | - | - |
| VipClubV1_2025_11_02_000004_create_vipclubv1_vip_cards_table.php | ⏳ 待检查 | - | - |
| VipClubV1_2025_11_02_000005_create_vipclubv1_points_transactions_table.php | ⏳ 待检查 | - | - |
| VipClubV1_2025_11_02_000006_create_vipclubv1_articles_table.php | ⏳ 待检查 | - | - |
| VipClubV1_2025_11_02_000007_create_vipclubv1_payments_table.php | ⏳ 待检查 | - | - |
| VipClubV1_2025_11_02_000008_create_vipclubv1_support_messages_table.php | ⏳ 待检查 | - | - |

### Global Migrations

| 文件 | 状态 | 问题 | 修复 |
|------|------|------|------|
| global_2025_04_03_140552_create_personal_access_tokens_table.php | ⏳ 待检查 | - | - |
| global_2025_04_19_064603_create_admin_user.php | ⏳ 待检查 | - | - |
| global_2025_11_29_000000_create_global_tasks_table.php | ⏳ 待检查 | - | - |
| mcpv1_placeholder_images_table.php | ⏳ 待检查 | - | - |

## 状态说明
- ✅ 已检查，安全
- ⚠️ 已检查，有问题需要修复
- ❌ 已检查，严重问题
- ⏳ 待检查

## 修复记录
- 2026-01-26: 开始全面审计
- 2026-01-26: 创建SafeMigrationHelper类库，提供安全的迁移辅助方法
- 2026-01-26: 创建CheckMigrationSafety命令，用于自动检查所有迁移文件
- 2026-01-26: 修复AppQyV1_2025_12_01_072228_add_cover_processing_columns_and_indexes.php，添加表存在性检查

## SafeMigrationHelper 使用说明

### 核心方法：alignTableStructureFromArray（推荐）

这是最强大的方法，可以：
1. ✅ 表不存在则创建
2. ✅ 添加缺失字段
3. ✅ 收缩多余字段（可选，默认关闭）
4. ✅ 修正字段属性（类型、长度、nullable、default等）
5. ✅ 添加缺失索引

```php
use App\Services\SafeMigrationHelper;

public function up(): void
{
    $connection = 'appqyv1';
    $tableName = 'app_qy_v1_example';
    
    // 定义完整的表结构
    $tableStructure = [
        'columns' => [
            'id' => [
                'type' => 'bigIncrements',
                'comment' => 'Primary key',
            ],
            'name' => [
                'type' => 'string',
                'length' => 255,
                'nullable' => false,
                'comment' => 'Name field',
            ],
            'status' => [
                'type' => 'string',
                'length' => 50,
                'nullable' => false,
                'default' => 'active',
            ],
            'created_at' => [
                'type' => 'timestamp',
                'nullable' => true,
            ],
            'updated_at' => [
                'type' => 'timestamp',
                'nullable' => true,
            ],
        ],
        'indexes' => [
            ['columns' => ['name'], 'name' => 'idx_example_name'],
            ['columns' => ['status'], 'name' => 'idx_example_status'],
        ],
    ];
    
    // 对齐表结构
    $result = SafeMigrationHelper::alignTableStructureFromArray(
        $connection,
        $tableName,
        $tableStructure,
        [
            'shrink_columns' => false, // false=不删除多余字段（安全），true=删除多余字段（危险）
            'modify_columns' => true,  // 修正字段属性
            'add_indexes' => true,    // 添加缺失索引
        ]
    );
}
```

### 支持的字段类型

- `bigIncrements` - 自增主键
- `increments` - 自增整数
- `string` - 字符串（可指定length）
- `text` - 文本
- `integer` - 整数
- `bigInteger` - 大整数
- `boolean` - 布尔值
- `timestamp` - 时间戳
- `json` - JSON
- `decimal` - 小数（需要precision和scale）

### 字段属性

- `type` - 字段类型（必需）
- `length` - 长度（string类型）
- `nullable` - 是否允许NULL（默认true）
- `default` - 默认值
- `unsigned` - 无符号（整数类型）
- `comment` - 注释
- `after` - 在哪个字段之后（MySQL）
- `unique` - 是否唯一
- `index` - 是否创建索引

### 基本方法（单独使用）

```php
// 1. 安全创建表
SafeMigrationHelper::safeCreateTable($connection, $tableName, function (Blueprint $table) {
    $table->id();
    $table->string('name');
});

// 2. 安全添加字段
SafeMigrationHelper::safeAddColumn($connection, $tableName, 'new_column', function (Blueprint $table, string $columnName) {
    $table->string($columnName)->nullable();
});

// 3. 安全添加索引
SafeMigrationHelper::safeAddIndex($connection, $tableName, 'column_name', 'index_name');

// 4. 安全添加外键
SafeMigrationHelper::safeAddForeignKey($connection, $tableName, 'user_id', 'users', 'id');
```

### 完整示例

参考文件：`database/migrations/EXAMPLE_using_SafeMigrationHelper.php`
