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

---

## ✅ 已修复的问题（2026-05-18）

### N. queue:listen 在 WSL/Linux 下崩溃 + 任务系统从不运行

**现象**: `scripts/start.sh` 在所有系统（含 WSL/Ubuntu）都跑 `composer dev:win`
（`php artisan serve` + `queue:listen`），从不启动 Octane。`sys:init` 日志
`[OCTANE_FIX] Swoole not installed, skipping`、`Octane timer is not running /
Heartbeat file missing`；`queue:listen` 因一个超过 60s 的任务抛
`Symfony ... ProcessTimedOutException` 整体 exit 1 且无人重启。

**根本原因**:
1. 文档既定架构（`MIGRATION_PASSIVEQUEUE_TO_OCTANE_TIMER.md` +
   `development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md`）规定任务系统由
   **单一 Octane(Swoole) 定时器**驱动；但 WSL 未安装 Swoole 扩展，且 `start.sh`
   从不调用 `octane:start`，两个设计内驱动全部缺席。
2. `routes/console.php` 把 `TimerTasks/*` 又注册成 Laravel Scheduler（重复的第二
   驱动，违反“单实例”规范，且 `schedule:work` 也没启动）。
3. 唯一的队列生产者 `CodeMartV1AIAnalysisCtl::performAIAnalysis()` 的
   `dispatch(closure)->afterCommit()` 超时拖垮 `queue:listen`。

**修复**:
- `scripts/start.sh`: 新增 Swoole ensure（缺失时调用
  `scripts/shells/linux/debian/install_shells/32_install_swoole.sh`），Linux/WSL
  改为 `php artisan octane:start --server=swoole --host=0.0.0.0 --port=9000
  [--watch]`；Swoole 不可用时降级回 `serve + queue:listen --timeout=0` 并明确告警。
- `app/Console/Commands/InitializeApps.php`: `swoole_not_installed` 分支在
  非 Windows 下自动调用安装脚本并重试兼容补丁（`ensureSwooleThenRefix`）。
- `routes/console.php`: 删除 TimerTasks 的 Scheduler 重复注册，仅保留
  `mcpv1:placeholder-cleanup` 真·cron 与 `inspire`。
- CodeMart 改造为
  `app/Services/TimerTasks/CodeMartV1AIAnalysisTask.php`（事务+行锁轮询，离队列），
  控制器仅置状态 `processing`/`revising`；全应用已无 `dispatch(`。
- `composer.json` 三处 `queue:listen` 加 `--timeout=0` 加固 Windows 回退。

**端口已统一（2026-05-19）**:
- 调查结论：`18000` 并非为规避端口冲突而引入，而是历史 squash 导入时泄漏进
  dev 启动脚本（`start.sh`/`start.ps1`/`composer dev:win`/`startDev*`）。规范
  `LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md` 及全部生产基建
  （`start_service.sh`/`restart_octane.sh`/ServerManagerV1/`app_config.sh`/
  systemd `octane-poly-9000.service`）一直用 `9000`。
- 处理：已将 dev 启动脚本、`composer.json`(dev/dev:win/dev:ssr)、相关文档与
  前端 `qy_capacitor` 全部恢复 `9000`，与锁定规范一致（锁定文件本就为 `9000`，
  无需也未编辑）。
- 注意（设计如此）：同机若生产 Octane 已占用 `9000`，再跑 dev `start.sh` 会端口
  冲突；用 `PORT=<n>` 环境变量覆盖即可。

**控制器层多余 catch 清理（2026-05-19，规范：控制器不写 try-catch）**:
- 移除：`SetLocale.php`、`System/StatusController.php::index()`、
  `StaticServer/DownloadController.php`、`StaticServer/UploadController.php`
  （checkExists+upload）、`StaticServer/StaticFileController.php::saveContent()`
  的多余 try/catch —— 它们只是把异常重新包成 500，框架本就会处理。
- **保留（判断后不删）**：`StatusController::getDatabaseStatus/getStorageStatus`
  的 catch —— 它们把基础设施故障转成状态数据返回，是健康端点的功能本身，
  不是“吞异常”；删除会让状态接口在 DB 宕机时 500 而非报告 disconnected。
- 计时器/服务事务类 catch 一律保留（COMMON_TIMER_DESIGN_SPECIFICATION 强制的
  错误隔离 / Service 事务回滚），删除会违规并使定时器崩溃。
