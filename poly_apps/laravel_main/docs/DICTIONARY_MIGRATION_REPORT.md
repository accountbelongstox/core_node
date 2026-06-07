# 词典表重命名迁移报告

> ⚠️ **已废弃 / SUPERSEDED (2026-05)。** 本文档描述的 `app_qy_v1_words_*` → `app_qy_v1_*_dictionaries` 重命名迁移已被**统一设计**取代。现在唯一真实来源是多语言表族 **`{prefix}_tts_cache_{lang}`**（经 `AppQyV1LangDictionaryModel` / `AppQyV1TableMaps::getDictionaryTableName($lang)` 访问）。生命周期为 3 阶段：txt → 临时/staging 表 (`{prefix}_tts_cache_{lang}_staging`) → 提升(promote)为正式 `tts_cache_{lang}` → 运行时实时更新。`app_qy_v1_words_*` 与 `AppQyV1MultiLangDictionaryModel` 均已废弃。外部数据根目录现为 `<www>/wwwroot/laravel_db/external_data`（经 `PathMapper::mapWebPath('app_external_data')`，不再是 `storage/app/external_data`）。以下内容仅作历史记录保留。

## 📊 当前状况

### 旧表（需要重命名）

| 旧表名 | 记录数 | 新表名 | 状态 |
|--------|--------|--------|------|
| `app_qy_v1_words_english` | 233,197 | `app_qy_v1_en_dictionaries` | ✅ 新表已存在（空） |
| `app_qy_v1_words_japanese` | 8,033 | `app_qy_v1_ja_dictionaries` | ✅ 新表已存在（空） |
| `app_qy_v1_words_lao` | 8,028 | `app_qy_v1_lo_dictionaries` | ✅ 新表已存在（空） |
| `app_qy_v1_words_vietnamese` | 8,028 | `app_qy_v1_vi_dictionaries` | ✅ 新表已存在（空） |

**总计需要迁移：257,286 条记录**

### 表结构差异

#### 旧表字段（app_qy_v1_words_english）
```sql
- id (主键)
- word_id
- word (单词)
- us_phonetic (美式音标)
- uk_phonetic (英式音标)
- translation (翻译JSON)
- sample_images (示例图片JSON)
- ai_reviewed
- tts_generated
- created_at
- updated_at
```

#### 新表字段（app_qy_v1_en_dictionaries）
```sql
- id (主键)
- content (单词 ← word)
- md5 (单词MD5)
- translations (翻译 ← translation)
- has_translation
- translation_provider
- phonetic
- us_phonetic
- uk_phonetic
- tts_files
- tts_provider
- image_files (← sample_images)
- image_provider
- word_details
- is_exist_local
- has_operations
- query_count
- last_modified
- last_query_time
- created_at
- updated_at
```

## 🔍 代码引用情况

已创建扫描命令来检查哪些代码仍在使用旧表名，发现以下文件需要更新：

1. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`
2. `app/Apps/AppQyV1/AppQyV1Models/AppQyV1MultiLangDictionaryModel.php`
3. `app/Console/Commands/InitializeApps.php`
4. `app/Services/UserSyncService.php`
5. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordLookupController.php`
6. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1System/AppQyV1SystemInitializationController.php`
7. `app/Apps/AppQyV1/AppQyV1DBTablesBrige/AppQyV1TableMaps.php`

## ⚠️ 当前问题

### 数据库只读问题
```
SQLSTATE[HY000]: General error: 8 attempt to write a readonly database
```

**原因：**
- 数据库文件权限为 root:root
- 当前进程可能没有写入权限
- 或 SQLite 数据库文件被锁定

## ✅ 已完成的工作

1. ✅ 创建了迁移命令 `dict:migrate`
2. ✅ 分析了表结构差异
3. ✅ 映射了字段转换规则
4. ✅ 统计了需要迁移的数据量
5. ✅ 更新了 `AppQyV1VocabularyLibraryPublicController.php` 使用新表结构

## 🚀 解决方案

### 方案 1：修复数据库权限（推荐）

```bash
# 检查当前权限
ls -lah /www/wwwroot/laravel_db/app_qy_v1_database.sqlite

# 修改所有者为 Laravel 进程用户
sudo chown www-data:www-data /www/wwwroot/laravel_db/app_qy_v1_database.sqlite

# 或者修改权限
sudo chmod 664 /www/wwwroot/laravel_db/app_qy_v1_database.sqlite

# 然后执行迁移
cd /www/programing/core_node/poly_apps/laravel_main
php artisan dict:migrate
```

### 方案 2：直接重命名表（快速但需手动）

由于新表结构与旧表不兼容，不能直接 RENAME，需要：

```bash
# 1. 使用 root 权限执行 SQL
sudo sqlite3 /www/wwwroot/laravel_db/app_qy_v1_database.sqlite

# 2. 迁移数据（对每个表执行）
INSERT INTO app_qy_v1_en_dictionaries
  (content, md5, translations, has_translation, us_phonetic, uk_phonetic, image_files, created_at, updated_at)
SELECT
  word as content,
  hex(randomblob(16)) as md5,
  translation as translations,
  CASE WHEN translation IS NOT NULL AND translation != '' THEN 1 ELSE 0 END as has_translation,
  us_phonetic,
  uk_phonetic,
  sample_images as image_files,
  created_at,
  updated_at
FROM app_qy_v1_words_english;

# 3. 验证迁移
SELECT COUNT(*) FROM app_qy_v1_en_dictionaries;

# 4. 备份后删除旧表（可选）
-- DROP TABLE app_qy_v1_words_english;
```

### 方案 3：代码层面适配（临时方案）

目前我们已经更新了 `AppQyV1VocabularyLibraryPublicController.php`，将查询从：
- `app_qy_v1_en_dictionaries` (空表)

改回到：
- `app_qy_v1_words_english` (有数据的表)

这样可以立即使用现有数据，但不符合新的命名规范。

## 📝 迁移后需要做的事

1. ✅ **更新后端代码**
   - 已更新：`AppQyV1VocabularyLibraryPublicController.php`
   - 待更新：其他 7 个文件

2. ⏳ **测试功能**
   - 词汇库详情页显示翻译
   - 音标显示正确
   - 其他使用词典的功能

3. ⏳ **数据验证**
   - 验证所有 257,286 条记录都已迁移
   - 验证翻译数据完整性
   - 验证音标数据正确性

## 🎯 推荐执行步骤

1. **立即修复数据库权限**
   ```bash
   sudo chown -R www-data:www-data /www/wwwroot/laravel_db/
   ```

2. **执行迁移命令**
   ```bash
   php artisan dict:migrate
   ```

3. **验证迁移结果**
   ```bash
   php artisan dict:migrate --dry-run
   ```

4. **重启 Octane 服务**
   ```bash
   curl -X POST http://localhost:9000/api/server-manager/restart
   ```

5. **测试前端功能**
   - 访问 http://192.168.50.3:10029/vocabulary_library/6
   - 点击"全面显示"
   - 验证翻译和音标正确显示

## 📌 注意事项

- ⚠️ 迁移前请备份数据库
- ⚠️ 建议在低峰期执行迁移
- ⚠️ 迁移完成后测试所有依赖词典的功能
- ⚠️ 考虑保留旧表一段时间作为备份

## 📊 当前 API 状态

**前端已更新：** `pages/Vocabulary/LibraryDetail.tsx`
- ✅ 支持后端翻译数据
- ✅ 显示美式/英式音标
- ✅ 绿色 ✓ 标记后端数据

**后端已更新：** `AppQyV1VocabularyLibraryPublicController.php`
- ✅ 从 `app_qy_v1_words_english` 查询（临时）
- ✅ 返回翻译数组
- ✅ 返回音标数据
- ⏳ 待切换到 `app_qy_v1_*_dictionaries` 表

---

**创建时间：** 2025-12-19
**迁移命令位置：** `app/Console/Commands/MigrateWordsToDictionaries.php`
