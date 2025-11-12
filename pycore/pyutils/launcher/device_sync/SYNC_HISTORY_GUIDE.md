# 同步历史功能指南

**版本：** 3.1.0
**更新日期：** 2025-11-12

## 📊 功能概述

同步历史功能使用SQLite数据库记录Device Sync的所有同步活动，帮助您追踪和诊断同步问题。

### 核心特性

- ✅ **自动记录** - 所有同步事件自动记录到数据库
- ✅ **智能清理** - 自动删除3天前的旧记录
- ✅ **统计分析** - 提供事件统计和趋势分析
- ✅ **导出功能** - 可导出历史记录为文本文件
- ✅ **图形界面** - 通过托盘菜单一键查看历史

## 📁 数据存储

### 存储位置

```
Windows: C:\Users\{用户名}\.core_node\.cache\device_sync\sync_history.db
Linux:   ~/.core_node/.cache/device_sync/sync_history.db
Mac:     ~/.core_node/.cache/device_sync/sync_history.db
```

### 数据库结构

```sql
CREATE TABLE sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,           -- 事件时间
    event_type TEXT NOT NULL,             -- 事件类型
    device_id TEXT,                       -- 设备ID
    device_name TEXT,                     -- 设备主机名
    status TEXT NOT NULL,                 -- 状态 (success/failed/warning)
    message TEXT,                         -- 消息描述
    details TEXT,                         -- 详细信息 (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 📝 记录的事件类型

### 1. file_sync
文件同步事件
```
示例：Synced: config.json (size: 1024 bytes)
```

### 2. mode_change
设备模式切换
```
示例：Mode changed: secondary → primary
```

### 3. device_online
设备上线
```
示例：Device came online
设备：DESKTOP-ABC (192.168.1.100)
```

### 4. device_offline
设备离线
```
示例：Device went offline
设备：DESKTOP-ABC
```

### 5. sync_enable
同步启用
```
示例：Sync enabled (mode: secondary)
```

### 6. sync_disable
同步禁用
```
示例：Sync disabled: Mode switch
```

### 7. conflict_detected
冲突检测
```
示例：Conflict detected: 2 primary devices
```

### 8. primary_validation
主设备验证
```
示例：Primary validation: 1 primary device(s) found
```

## 🎯 使用方法

### 方法1: 托盘菜单

1. 右键点击系统托盘中的Device Sync图标
2. 选择 `Show Sync History`
3. 查看历史记录窗口

### 方法2: Web UI (未来版本)

```
http://localhost:58923/history
```

### 方法3: 直接导出

点击历史窗口中的 `Export to File` 按钮，导出为文本文件。

## 📊 历史窗口说明

### 统计信息
- **Total Events** - 总事件数
- **Last 24 Hours** - 最近24小时事件数
- **Retention** - 保留天数

### 事件列表
- **时间戳** - 事件发生时间
- **状态符号**:
  - ✓ - 成功 (success)
  - ✗ - 失败 (failed)
  - ⚠ - 警告 (warning)
- **事件类型** - 大写显示
- **消息** - 事件描述
- **设备** - 相关设备名称（如有）

## 🔧 高级功能

### 1. 自动清理

程序在关闭时自动清理超过3天的记录：

```python
# 默认保留3天
tracker = SyncHistoryTracker(retention_days=3)

# 手动触发清理
tracker.cleanup_old_records()
```

### 2. 查询过滤

```python
# 获取最近100条记录
history = tracker.get_recent_history(limit=100)

# 按事件类型过滤
history = tracker.get_recent_history(event_type='file_sync')

# 按状态过滤
history = tracker.get_recent_history(status='failed')
```

### 3. 导出历史

```python
# 导出到默认位置
output_path = tracker.export_to_text()

# 导出到指定位置
output_path = tracker.export_to_text(output_path='/path/to/export.txt')
```

## 📈 使用场景

### 场景1: 诊断同步失败

1. 打开同步历史
2. 查找 ✗ 标记的失败事件
3. 查看失败原因和时间
4. 检查是否有模式切换或冲突

### 场景2: 追踪设备状态

1. 查看 `device_online` 和 `device_offline` 事件
2. 了解设备连接历史
3. 识别网络问题

### 场景3: 审计模式切换

1. 查找 `mode_change` 事件
2. 确认何时切换了主/副设备
3. 验证同步是否相应关闭

### 场景4: 冲突分析

1. 查找 `conflict_detected` 事件
2. 查看冲突发生的时间和原因
3. 确认主设备数量

## 🎨 示例输出

```
================================================================================
Device Sync - History
================================================================================

Statistics:
  Total Events: 156
  Last 24 Hours: 42
  Retention: 3 days

Events by Type:
  mode_change: 4
  sync_enable: 3
  sync_disable: 3
  device_online: 12
  device_offline: 8
  primary_validation: 6
  file_sync: 120

Latest Event: Sync enabled (mode: secondary)
  Time: 2025-11-12 14:30:25

================================================================================
Recent History (50 entries)
================================================================================

[2025-11-12 14:30:25] ✓ SYNC_ENABLE
  Sync enabled (mode: secondary)

[2025-11-12 14:30:20] ✓ PRIMARY_VALIDATION
  Primary validation: 1 primary device(s) found

[2025-11-12 14:30:15] ✓ MODE_CHANGE
  Mode changed: NOT SET → secondary

[2025-11-12 14:28:10] ✓ DEVICE_ONLINE
  Device came online
  Device: DESKTOP-MAIN

[2025-11-12 14:25:05] ✓ FILE_SYNC
  Synced: config.json

[2025-11-12 13:45:30] ✗ CONFLICT_DETECTED
  Conflict detected: 2 primary devices

[2025-11-12 13:45:28] ✗ PRIMARY_VALIDATION
  Primary validation: 2 primary device(s) found

[2025-11-12 13:40:15] ⚠ DEVICE_OFFLINE
  Device went offline
  Device: LAPTOP-002

...
```

## 🛠️ 故障排查

### 问题1: 历史窗口无法打开

**检查：**
```bash
# 确认数据库文件存在
ls ~/.core_node/.cache/device_sync/sync_history.db

# 检查日志
cat ~/.device_sync/logs/device_sync_*.log | grep "history"
```

**解决：**
- 确保有写入权限
- 检查磁盘空间
- 重启Device Sync

### 问题2: 导出失败

**原因：**
- 目标目录不存在
- 权限不足
- 磁盘已满

**解决：**
- 检查缓存目录权限
- 清理磁盘空间
- 手动指定导出路径

### 问题3: 记录丢失

**说明：**
- 默认保留3天记录
- 程序关闭时自动清理
- 这是正常行为

**如需更长保留期：**
```python
# 修改 device_manager.py
self.history_tracker = SyncHistoryTracker(retention_days=7)  # 7天
```

## 🔍 数据隐私

### 记录的数据
- ✅ 事件时间和类型
- ✅ 设备ID和主机名
- ✅ 同步状态信息
- ✅ 文件名（仅名称，无内容）

### 不记录的数据
- ❌ 文件内容
- ❌ 用户密码
- ❌ 敏感配置
- ❌ 网络流量

### 本地存储
- 所有数据仅存储在本地
- 不上传到任何服务器
- 自动清理机制保护隐私

## 📚 API参考

### SyncHistoryTracker

```python
from pycore.pyutils.launcher.device_sync.sync_history import SyncHistoryTracker

# 初始化
tracker = SyncHistoryTracker(
    cache_dir=None,          # 默认: ~/.core_node/.cache/device_sync
    retention_days=3         # 保留天数
)

# 记录事件
tracker.record_event(
    event_type='file_sync',
    status='success',
    message='Synced: file.txt',
    device_id='device-uuid',
    device_name='DESKTOP-ABC',
    details={'size': 1024}
)

# 获取历史
history = tracker.get_recent_history(limit=100)

# 获取统计
stats = tracker.get_statistics()

# 导出
output_path = tracker.export_to_text()

# 清理
tracker.cleanup_old_records()

# 关闭
tracker.close()
```

### 便捷函数

```python
from pycore.pyutils.launcher.device_sync.sync_history import (
    record_file_sync,
    record_mode_change,
    record_device_online,
    record_device_offline,
    record_sync_enabled,
    record_sync_disabled,
    record_conflict,
    record_primary_validation
)

# 记录文件同步
record_file_sync(tracker, 'config.json', success=True, file_size=1024)

# 记录模式切换
record_mode_change(tracker, 'secondary', 'primary')

# 记录设备上线
record_device_online(tracker, device_info)
```

## 🚀 未来功能

### 计划中的功能
- [ ] Web UI历史查看
- [ ] 实时事件推送
- [ ] 图表和趋势分析
- [ ] 高级过滤和搜索
- [ ] 自定义保留策略
- [ ] 性能指标记录

## 📞 支持

遇到问题？

1. 查看日志：托盘菜单 → Show Logs
2. 检查历史：托盘菜单 → Show Sync History
3. 导出历史并分析
4. 查看文档：`START_V3.md`

---

**祝您使用愉快！** 🎉
