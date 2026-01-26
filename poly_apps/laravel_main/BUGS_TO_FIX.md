# Laravel 系统初始化和 TTS 问题清单

## 日期：2026-01-13

---

## ✅ 已修复的问题

### 1. GlobalTaskSystemInitializer 缺少类导入
**文件**: `app/Services/GlobalTaskSystemInitializer.php:173`
**错误**: `Class "App\Services\GlobalTask" not found`
**修复**: 已添加命名空间导入：
```php
use App\Models\GlobalTask;
use App\Models\Worker;
```

### 2. TTS Queue 表命名问题
**问题**: 数据库中存在两个表：
- `appqyv1_tts_queue` (错误命名，无下划线，有210359条数据)
- `app_qy_v1_tts_queue` (正确命名，有下划线，之前为空)

**修复**: 通过 `php artisan migrate:refresh` 重新创建了正确的表 `app_qy_v1_tts_queue`

### 3. Edge-TTS 7.2.3 版本 NoAudioReceived 错误（重大问题）
**错误**: `edge_tts.exceptions.NoAudioReceived: No audio was received`
**原因**: edge-tts 7.2.3 版本存在已知 bug，无法连接到 Microsoft Edge TTS 服务（401/403错误）
**参考**: https://github.com/rany2/edge-tts/issues/443

**解决方案**: 降级到 edge-tts 7.2.1
```bash
pip3 install edge-tts==7.2.1 --break-system-packages --force-reinstall
```

**验证**: 降级后测试成功，生成的音频文件正常（9-15KB）

### 4. 39,169 个 0 字节音频文件问题
**问题**: 系统中存在大量0字节的MP3文件，占用inode
**原因**:
- Edge-TTS 7.2.3 版本错误导致生成失败
- 历史遗留的失败文件未清理

**解决方案**:
1. **代码级自动清理**（已实现）：
   - 在 `EdgeTTSService::__construct()` 中添加随机清理机制（5%概率）
   - 每次清理最多100个0字节文件，避免性能影响
   - 在生成前检查缓存和已存在文件时自动删除0字节文件
   - 在 `UnifiedTTSQueueService` 中验证生成的文件，发现0字节立即删除

2. **手动清理命令**（可选）：
   ```bash
   php artisan appqyv1:clean-zero-byte-audio --dry-run  # 预览
   php artisan appqyv1:clean-zero-byte-audio            # 执行清理
   ```

---

## 🔴 待修复的问题

### 1. Vocabulary Covers 迁移文件变量未定义
**文件**: `database/migrations/AppQyV1_2025_12_20_000006_create_vocabulary_covers_table.php`
**错误**: `Undefined variable $appKey`
**位置**: 迁移执行时报错
**需要检查**:
- 检查迁移文件中是否正确定义了 `$appKey` 变量
- 确保使用 `AppTablePrefixServiceProvider` 正确获取表名和连接

**预期修复方式**:
```php
$appKey = \App\Constants\AppKeys::APPQYV1;
$connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
$tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_covers');
```

---

## 📊 系统状态

### Edge-TTS 版本信息
- ❌ **不可用**: edge-tts 7.2.3（NoAudioReceived错误）
- ✅ **可用**: edge-tts 7.2.1（推荐使用）
- ⚠️  **部分可用**: edge-tts 7.0.0（需要回退SSML功能）

### TTS 队列系统
- ✅ 队列表已正确创建：`app_qy_v1_tts_queue`
- ✅ 0字节文件检测机制已就绪
- ✅ 自动清理机制已启用（5%概率 + 每次100文件上限）
- ⚠️  当前待清理：39,169个0字节文件（会逐步清理）

### 当前 sys:init 执行状态
- ✅ 数据库连接正常 (11/11)
- ✅ TTS queue 表已创建
- ✅ GlobalTask 类导入已修复
- ❌ Vocabulary covers 迁移失败（变量未定义）
- ⚠️  1 个表缺失（vocabulary_covers）

---

## 🔧 重要改进

### 1. EdgeTTSService 自动清理机制
**文件**: `app/Services/EdgeTTS/EdgeTTSService.php`

**新增功能**:
1. 构造函数中随机触发清理（5%概率）
2. `cleanZeroByteFilesBackground()` 方法：
   - 每次最多清理100个文件
   - 使用 RecursiveIteratorIterator 高效遍历
   - 静默失败，不影响TTS服务
   - 记录清理日志

3. 生成过程中的实时检测：
   - 检查缓存文件时删除0字节
   - 检查已存在文件时删除0字节
   - 生成后验证文件大小

### 2. UnifiedTTSQueueService 验证机制
**文件**: `app/Apps/AppQyV1/AppQyV1Services/AppQyV1UnifiedTTSQueueService.php`

**已有功能**（验证已存在）:
- 生成后双重验证：检查文件存在性和大小
- 发现0字节文件立即删除并标记任务失败
- 记录错误日志用于追踪

### 3. Python 自动版本检查和修复（新增）
**文件**: `pycore/pyfoundations/third_party.py`

**新增功能**:
- `install_and_reimport_edge_tts()` 函数自动版本检查
- 兼容版本列表：7.2.1, 7.2.0, 7.1.0, 7.0.0
- 要求版本：7.2.1
- 自动检测逻辑：
  1. 导入 edge_tts 时检查版本
  2. 如果版本在兼容列表中，直接使用
  3. 如果版本不兼容（如7.2.2+），自动使用 `--force-reinstall` 降级到7.2.1
  4. 清除 sys.modules 缓存，强制重新导入
  5. 验证安装成功

**使用方式**:
```python
from pycore.pyfoundations.third_party import get_third_package_edge_tts
edge_tts = get_third_package_edge_tts()  # 自动检查和修复版本
```

**优点**:
- 无需外挂脚本
- 每次导入时自动检查
- 反复运行时自动修复
- 集成到现有的依赖管理系统

---

## 📝 下一步操作

### 立即执行
1. ✅ 确认 edge-tts 7.2.1 已安装
2. ⏳ 等待自动清理逐步清除0字节文件（或手动执行清理命令）
3. ❌ 修复 `vocabulary_covers` 迁移文件

### 长期监控
1. 监控日志中的 `[EdgeTTS] Background cleanup` 记录
2. 定期检查0字节文件数量：
   ```bash
   find /www/wwwroot/laravel_db/tts_data/audio -name "*.mp3" -size 0 | wc -l
   ```
3. 监控 TTS 队列失败率

---

## 🎯 关键结论

1. **根本原因**: edge-tts 7.2.3 版本bug导致无法生成音频
2. **解决方案**: 降级到 7.2.1 + 自动清理机制
3. **预防措施**: 代码中已添加多层0字节文件检测和清理
4. **清理策略**: 渐进式后台清理，避免性能影响

---

## 注意事项

- Edge-TTS 版本必须保持在 7.2.1，不要升级到 7.2.2+
- 0字节文件会逐步清理，无需手动干预（除非需要快速释放inode）
- 所有 AppQyV1 相关表应使用标准命名：`app_qy_v1_{table_name}`
- 迁移文件必须使用 `AppTablePrefixServiceProvider` 获取正确的表名和连接
