# 重复代码清理清单

## 统一架构完成后需要清理的旧代码

### 当前架构（保留）：

#### 核心文件：
- `ui/main.py` - 统一主入口
- `ui/tray.py` - 统一托盘菜单
- `server/unified.py` - 统一HTTP服务器（替代primary.py和secondary.py）
- `core/config.py` - 全局配置单例
- `core/scanner.py` - 网络扫描器
- `core/database.py` - SQLite数据库
- `core/logging.py` - 日志模块
- `core/ipc.py` - 进程间通信（如果仍需要）
- `network_cache.py` - 网络缓存

### 旧架构（待删除）：

#### 主要重复文件（已被unified.py替代）：
```
client/
├── secondary.py          [DELETE] - 旧SECONDARY客户端（被unified.py替代）
└── __init__.py           [UPDATE] - 移除secondary导入

server/
├── primary.py            [DELETE] - 旧PRIMARY服务器（被unified.py替代）
└── __init__.py           [UPDATE] - 移除primary导入

根目录：
├── simple_client.py      [DELETE] - 简化版客户端（重复）
├── simple_primary_server.py [DELETE] - 简化版服务器（重复）
├── simple_tray_menu.py   [DELETE] - 旧托盘菜单（被ui/tray.py替代）
├── ipc_server.py         [DELETE] - IPC服务器（重复）
├── global_config.py      [DELETE] - 旧全局配置（被core/config.py替代）
```

#### 已弃用目录（完全删除）：
```
_deprecated/              [DELETE ENTIRE DIR] - 已弃用的旧实现
├── _old_discovery/
├── _old_servers/
└── _tests/

_legacy/                  [DELETE ENTIRE DIR] - 遗留代码
├── device_discovery_scanner.py
├── device_manager.py
├── http_sync_client.py
├── tray_menu.py
└── unified_server.py
```

#### 文档文件（更新或删除）：
```
REFACTORING_V3.md         [UPDATE] - 更新为指向UNIFIED_ARCHITECTURE.md
API_CONTROL_AND_SCAN_OPTIONS.md [DELETE] - 功能已合并到unified
DATABASE_AND_WEB_ENHANCEMENTS.md [DELETE] - 功能已合并到unified
```

### 清理步骤：

1. **验证新架构工作正常**
   - 测试PRIMARY模式所有功能
   - 测试SECONDARY模式所有功能
   - 测试模式切换
   - 测试API访问控制
   - 测试文件同步

2. **删除旧代码**
   ```bash
   # 删除旧架构主要文件
   rm client/secondary.py
   rm server/primary.py
   rm simple_client.py
   rm simple_primary_server.py
   rm simple_tray_menu.py
   rm ipc_server.py
   rm global_config.py

   # 删除已弃用目录
   rm -rf _deprecated/
   rm -rf _legacy/

   # 删除过时文档
   rm API_CONTROL_AND_SCAN_OPTIONS.md
   rm DATABASE_AND_WEB_ENHANCEMENTS.md
   ```

3. **更新导入引用**
   - 更新 `client/__init__.py`
   - 更新 `server/__init__.py`
   - 搜索并替换所有旧导入

4. **更新文档**
   - 更新 README.md（如果有）
   - 保留 UNIFIED_ARCHITECTURE.md 作为主要架构文档
   - 更新 REFACTORING_V3.md 指向新文档

### 验证清理完成：

检查以下命令输出应为空：
```bash
# 检查是否还有对旧文件的导入
grep -r "from.*primary import SimplePrimaryServer" --include="*.py" | grep -v "^Binary"
grep -r "from.*secondary import SimpleClient" --include="*.py" | grep -v "^Binary"
grep -r "import simple_client" --include="*.py"
grep -r "import simple_primary_server" --include="*.py"

# 检查是否还有动态创建线程（应只有main.py和tray.py中启动时创建的线程）
grep -r "threading.Thread" --include="*.py" | grep -v "_deprecated" | grep -v "_legacy" | grep -v "Binary"
```

### 测试验证：

清理后必须通过的测试：
- [ ] HTTP服务器启动成功
- [ ] Web UI可访问
- [ ] PRIMARY模式：API访问控制正常
- [ ] PRIMARY模式：文件列表可获取
- [ ] PRIMARY模式：文件下载正常
- [ ] SECONDARY模式：自动网络扫描
- [ ] SECONDARY模式：单服务器验证
- [ ] SECONDARY模式：同步启用/禁用
- [ ] 模式切换不重启服务器
- [ ] SQLite记录正常
- [ ] 托盘菜单功能完整

## 总结

当前统一架构已完成，旧架构文件已成为技术债务。清理这些重复代码将：
- 减少代码库大小
- 避免维护多个实现
- 减少混淆和错误
- 提高代码可维护性

清理工作应在充分测试新架构后进行。
