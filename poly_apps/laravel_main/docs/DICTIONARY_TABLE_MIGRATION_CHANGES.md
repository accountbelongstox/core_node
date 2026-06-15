# 词典表重命名 - artisan sys:init 修改摘要

> ⚠️ **已废弃 / SUPERSEDED (2026-05)。** 表族已统一为单一真实来源 **`{prefix}_tts_cache_{lang}`**（多语言，经 `AppQyV1LangDictionaryModel` 访问；`AppQyV1TableMaps::getDictionaryTableName($lang)` 返回 `{prefix}_tts_cache_{langCode}`）。生命周期：txt → 临时/staging (`_staging`) → 提升为正式 `tts_cache_{lang}` → 运行时实时更新（如客户端补充缺失翻译）。`app_qy_v1_words_*` / `app_qy_v1_*_dictionaries` / `AppQyV1MultiLangDictionaryModel` 已废弃。外部数据根目录改为 `<www>/wwwroot/laravel_db/external_data`。下列重命名映射与表结构仅作历史记录。

## 📋 概述

已完成 `artisan sys:init` 命令的更新，使其符合新的词典表命名规范。

## 🔄 表名映射

### 旧表命名 → 新表命名

| 旧表名 | 新表名 | 语言代码 |
|--------|--------|----------|
| `app_qy_v1_words_english` | `app_qy_v1_en_dictionaries` | `en` |
| `app_qy_v1_words_japanese` | `app_qy_v1_ja_dictionaries` | `ja` |
| `app_qy_v1_words_lao` | `app_qy_v1_lo_dictionaries` | `lo` |
| `app_qy_v1_words_vietnamese` | `app_qy_v1_vi_dictionaries` | `vi` |

## ✅ 已修改的文件

### 1. `app/Services/UserSyncService.php`

#### a) `ensureMultilingualWordTablesExist()` 方法（行 383-496）

**修改内容：**
- ✅ 将表名从 `app_qy_v1_words_*` 改为 `app_qy_v1_*_dictionaries`
- ✅ 更新表结构以匹配新的字典表标准
- ✅ 添加 `content`, `md5`, `has_translation` 等标准字段
- ✅ 移除 `word_id` 字段（不再需要）
- ✅ `word` 字段重命名为 `content`
- ✅ `translation` 字段重命名为 `translations`
- ✅ `sample_images` 字段重命名为 `image_files`

**新表结构：**
```sql
-- 英语字典表（完整结构）
CREATE TABLE app_qy_v1_en_dictionaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    md5 VARCHAR NOT NULL,
    translations TEXT,
    has_translation TINYINT(1) DEFAULT 0,
    translation_provider VARCHAR,
    phonetic TEXT,
    us_phonetic TEXT,
    uk_phonetic TEXT,
    tts_files TEXT,
    tts_provider VARCHAR,
    image_files TEXT,
    image_provider VARCHAR,
    word_details TEXT,
    is_exist_local TINYINT(1) DEFAULT 0,
    has_operations TINYINT(1) DEFAULT 1,
    query_count INTEGER DEFAULT 0,
    last_modified DATETIME,
    last_query_time DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);

-- 其他语言字典表（简化结构）
CREATE TABLE app_qy_v1_{lang}_dictionaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    md5 VARCHAR NOT NULL,
    pronunciation TEXT,
    meaning_en TEXT,
    meaning_zh TEXT,
    translations TEXT,
    has_translation TINYINT(1) DEFAULT 0,
    phonetic TEXT,
    tts_files TEXT,
    image_files TEXT,
    word_details TEXT,
    query_count INTEGER DEFAULT 0,
    last_query_time DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);
```

#### b) `importMultilingualWordsFromMd()` 方法（行 498-633）

**修改内容：**
- ✅ 检查表数据时使用 `app_qy_v1_en_dictionaries`（行 518）
- ✅ 数据字段映射更新（行 570-604）：
  ```php
  // 旧字段
  'word_id' => $wordId,
  'word' => $lao,
  'ai_reviewed' => 0,

  // 新字段
  'content' => $lao,
  'md5' => md5($lao),
  'has_translation' => !empty($meaningZh) ? 1 : 0,
  'query_count' => 0,
  ```
- ✅ 插入数据时使用新表名（行 613-623）：
  ```php
  DB::table('app_qy_v1_lo_dictionaries')->insert($chunk);
  DB::table('app_qy_v1_ja_dictionaries')->insert($chunk);
  DB::table('app_qy_v1_vi_dictionaries')->insert($chunk);
  ```

#### c) `importTranslationsFromJson()` 方法（行 654-761）

**修改内容：**
- ✅ 批处理数据字段映射（行 726-734）：
  ```php
  [
      'content' => $word,
      'md5' => md5($word),
      'us_phonetic' => $usPhonetic,
      'uk_phonetic' => $ukPhonetic,
      'translations' => json_encode($translation, JSON_UNESCAPED_UNICODE),
      'image_files' => json_encode($sampleImages, JSON_UNESCAPED_UNICODE),
      'has_translation' => !empty($translation) ? 1 : 0,
  ]
  ```

#### d) `upsertTranslationBatch()` 方法（行 763-809）

**修改内容：**
- ✅ 使用新表名 `app_qy_v1_en_dictionaries`（行 771, 778, 791）
- ✅ 查询条件改为 `content` + `md5`（行 772-773）
- ✅ 更新和插入字段使用新结构（行 780-803）
- ✅ 移除 `word_id` 字段逻辑

#### e) `importDictionaryWords()` 方法（行 890-949）

**修改内容：**
- ✅ 表名改为 `app_qy_v1_en_dictionaries`（行 899, 936, 943）
- ✅ 字段映射更新（行 922-933）：
  ```php
  [
      'content' => $word,
      'md5' => md5($word),
      'us_phonetic' => null,
      'uk_phonetic' => null,
      'translations' => null,
      'image_files' => null,
      'has_translation' => 0,
      'query_count' => 0,
      'created_at' => $now,
      'updated_at' => $now,
  ]
  ```
- ✅ 移除 `word_id` 相关逻辑

### 2. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`

#### `getLibraryWords()` 方法（行 138-155）

**修改内容：**
- ✅ 表名从 `app_qy_v1_words_{$languageCode}` 改为 `app_qy_v1_{$languageCode}_dictionaries`
- ✅ JOIN 别名从 `lw` 改为 `d`
- ✅ JOIN 条件从 `w.word = lw.word` 改为 `w.word = d.content`
- ✅ 选择字段更新：
  ```php
  // 旧字段
  'lw.translation as translations',
  'lw.sample_images as word_details',

  // 新字段
  'd.translations',
  'd.image_files as word_details',
  ```

## 🎯 字段映射总表

| 旧字段名 | 新字段名 | 数据类型 | 说明 |
|----------|----------|----------|------|
| `word_id` | **移除** | - | 不再使用顺序ID |
| `word` | `content` | TEXT | 单词内容 |
| - | `md5` | VARCHAR | 新增：单词MD5值 |
| `translation` | `translations` | TEXT | JSON格式翻译数据 |
| - | `has_translation` | TINYINT | 新增：是否有翻译标记 |
| `sample_images` | `image_files` | TEXT | JSON格式图片文件列表 |
| `ai_reviewed` | **移除** | - | 英语表不再使用 |
| `tts_generated` | **移除** | - | 改用 `tts_files` 字段 |
| - | `query_count` | INTEGER | 新增：查询次数统计 |
| - | `last_query_time` | DATETIME | 新增：最后查询时间 |

## 📊 数据迁移影响

### 旧数据表状态
- `app_qy_v1_words_english`: 233,197 条记录
- `app_qy_v1_words_japanese`: 8,033 条记录
- `app_qy_v1_words_lao`: 8,028 条记录
- `app_qy_v1_words_vietnamese`: 8,028 条记录

**总计：257,286 条记录需要迁移**

### 迁移策略

**情况 1：全新初始化（推荐）**
- 运行 `php artisan sys:init`
- 会自动创建新表结构
- 从原始数据文件导入到新表

**情况 2：已有旧表数据**
- 运行 `php artisan dict:migrate` 迁移现有数据
- 或手动使用 SQL 迁移（见 `DICTIONARY_MIGRATION_REPORT.md`）

## ⚠️ 重要注意事项

### 1. 向后兼容性
- ❌ **不兼容**旧表结构
- ⚠️ 如果系统已有旧表数据，需要先迁移
- ✅ 新初始化的系统直接使用新结构

### 2. 数据完整性
- ✅ 所有翻译数据将保留在 `translations` 字段
- ✅ 音标数据（`us_phonetic`, `uk_phonetic`）完整保留
- ✅ 示例图片数据保留在 `image_files` 字段

### 3. API 影响
- ✅ 前端 API 响应格式保持不变
- ✅ 后端自动适配新表结构
- ✅ 已更新 `AppQyV1VocabularyLibraryPublicController`

## 🚀 使用说明

### 全新安装
```bash
cd /www/programing/core_node/poly_apps/laravel_main
php artisan sys:init
```

### 已有系统升级
```bash
# 1. 备份数据库
cp /www/wwwroot/laravel_db/app_qy_v1_database.sqlite /www/wwwroot/laravel_db/app_qy_v1_database.sqlite.bak

# 2. 迁移旧数据到新表（如果有权限问题，需要先修复）
php artisan dict:migrate

# 3. 验证迁移结果
php artisan dict:migrate --dry-run

# 4. 重启 Octane
curl -X POST http://localhost:9000/api/server-manager/restart
```

## 📝 相关文档

- `DICTIONARY_MIGRATION_REPORT.md` - 详细的迁移报告和方案
- `app/Console/Commands/MigrateWordsToDictionaries.php` - 数据迁移命令
- `DICTIONARY_TABLE_MIGRATION_CHANGES.md` - 本文档

## ✅ 测试检查清单

- [ ] 运行 `php artisan sys:init` 成功
- [ ] 新表 `app_qy_v1_*_dictionaries` 已创建
- [ ] 表结构包含所有必要字段
- [ ] 导入测试数据成功
- [ ] API 返回正确的翻译数据
- [ ] 前端显示音标和翻译正常
- [ ] 绿色 ✓ 标记显示后端数据

---

**修改日期：** 2025-12-19
**修改人：** Claude Code
**状态：** ✅ 已完成并准备测试
