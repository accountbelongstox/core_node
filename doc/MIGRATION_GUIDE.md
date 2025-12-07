# Native UI + RPC v2 整合迁移指南

## 迁移完成情况

✅ **Phase 1**: 扩展 NativeUIConfig 添加 RPC v2 配置字段
✅ **Phase 2**: 实现 Phase 4.7 RPC v2 集成
✅ **Phase 3**: 简化 Matrix 应用代码

## 代码简化统计

### Matrix 应用代码变化

| 项目 | 旧架构 | 新架构 | 变化 |
|-----|--------|--------|------|
| **matrix_main.py** | 100 行 | 149 行 | +49 行 (自包含配置) |
| **frontend_compiler.py** | 81 行 | ❌ 已删除 | -81 行 |
| **launcher_builder.py** | 207 行 | ❌ 已删除 | -207 行 |
| **controller/__init__.py** | 25 行 | 18 行 | -7 行 |
| **总计** | **388 行** | **149 行** | **↓ 61.6%** |

### 文件数量变化

| 类型 | 旧架构 | 新架构 | 变化 |
|-----|--------|--------|------|
| **核心文件** | 3 个文件 | 1 个文件 | ↓ 67% |
| **配置步骤** | 3 步 | 1 步 | ↓ 67% |

## 架构对比

### 旧架构（整合前）

```
matrix_main.py (100 行)
├─ compile_frontend_if_needed()          ← frontend_compiler.py (81 行)
├─ build_matrix_launcher_config()        ← launcher_builder.py (207 行)
├─ ServiceLauncher.start()
└─ register_matrix_event_handlers()
```

**特点**：
- 需要手动管理前端编译
- 需要手动构建 LauncherConfig
- 需要手动协调静态文件挂载
- 代码分散在 3 个文件中

### 新架构（整合后）

```
matrix_main.py (149 行，自包含)
└─ launch_native_app(NativeUIConfig)     ← native_ui 处理一切
    ├─ Phase 4.6: 自动前端编译/dev server
    ├─ Phase 4.7: 自动 RPC v2 + 静态挂载
    └─ Phase 7: PySide6 UI
```

**特点**：
- ✅ 单一配置入口
- ✅ 自动前端编译（生产模式）
- ✅ 自动 dev server（开发模式）
- ✅ 自动静态文件挂载协调
- ✅ 代码集中在 1 个文件

## 新架构的 NativeUIConfig 配置示例

```python
config = NativeUIConfig(
    # ========== 基础配置 ==========
    app_id="matrix",
    app_name="星灿传媒-云矩阵",
    main_entry=matrix_main_entry,
    project_root=PROJECT_ROOT,

    # ========== 前端配置 ==========
    frontend_enabled=True,
    frontend_framework="nuxt",
    frontend_app_dir=PROJECT_ROOT / "poly_apps" / "pymatrix",
    frontend_mode="production",  # or "dev"
    frontend_port=3000,
    frontend_auto_install=True,
    frontend_skip_build=False,

    # ========== RPC v2 配置 ==========
    rpc_enabled=True,
    rpc_port=8000,
    rpc_host="0.0.0.0",
    rpc_routers=[
        health_router,
        device_router,
        # ... more routers
    ],
    rpc_auto_mount_frontend=True,  # 自动挂载前端

    # ========== UI 配置 ==========
    window_size=(1400, 900),
    show_on_start=True,
    frameless=True,
)

# 一键启动
launch_native_app(config)
```

## 迁移步骤（其他应用）

### 1. 评估当前应用架构

检查应用是否有以下模式：
- ✅ 使用 `frontend_launcher` 进行前端编译
- ✅ 使用 `pylauncher.ServiceLauncher` 启动 RPC v2
- ✅ 手动构建 `LauncherConfig`
- ✅ 手动协调静态文件挂载

如果有以上模式，适合迁移到新架构。

### 2. 准备迁移

1. **备份现有代码**
   ```bash
   cp matrix_main.py matrix_main_old_backup.py
   cp controller/frontend_compiler.py controller/frontend_compiler_old_backup.py
   cp controller/launcher_builder.py controller/launcher_builder_old_backup.py
   ```

2. **确认前端项目路径**
   ```python
   frontend_app_dir = PROJECT_ROOT / "poly_apps" / "your_frontend_app"
   ```

3. **整理 API routers**
   ```python
   from your_app.api import (
       router1,
       router2,
       # ... all routers
   )
   ```

### 3. 创建新的主入口文件

参考 `pyapps/matrix/matrix_main.py`，创建简化的主入口：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Your Application - Simplified with Native UI Integration
"""
from pathlib import Path
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

PROJECT_ROOT = Path(__file__).parent.parent.parent

def your_app_main_entry():
    """应用主入口（在 native_ui 初始化后调用）"""
    # 注册事件处理器等初始化逻辑
    pass

def start():
    # 导入 API routers
    from your_app.api import router1, router2

    # 创建配置
    config = NativeUIConfig(
        app_id="your_app",
        app_name="Your Application",
        main_entry=your_app_main_entry,
        project_root=PROJECT_ROOT,

        # Frontend
        frontend_enabled=True,
        frontend_framework="nuxt",  # or "react", "vue", etc.
        frontend_app_dir=PROJECT_ROOT / "poly_apps" / "your_frontend",
        frontend_mode="production",

        # RPC v2
        rpc_enabled=True,
        rpc_port=8000,
        rpc_routers=[router1, router2],
        rpc_auto_mount_frontend=True,

        # UI
        window_size=(1280, 900),
        frameless=True,
    )

    # 启动
    launch_native_app(config)

if __name__ == '__main__':
    start()
```

### 4. 删除旧的辅助文件

```bash
# 备份后可以删除：
rm controller/frontend_compiler.py
rm controller/launcher_builder.py
```

### 5. 更新 controller/__init__.py

```python
"""Your App Controller Package"""

from your_app.controller.event_handlers import register_event_handlers

__all__ = [
    'register_event_handlers',
]
```

### 6. 测试验证

#### 生产模式测试
```bash
# 设置环境变量（如果需要）
export FRONTEND_MODE=production

# 启动应用
python pymain.py app=your_app
```

验证：
- ✅ 前端自动编译（如果需要）
- ✅ RPC v2 启动并挂载静态文件
- ✅ WebView 显示前端页面
- ✅ API 正常工作

#### 开发模式测试
```bash
# 设置环境变量
export FRONTEND_MODE=dev

# 启动应用
python pymain.py app=your_app
```

验证：
- ✅ 自动运行 `npm run dev`
- ✅ 等待 dev server 启动
- ✅ WebView 连接到 dev server
- ✅ 热重载工作正常

## 配置模式对比

### 模式 1: 生产模式（推荐）

```python
config = NativeUIConfig(
    # ...
    frontend_enabled=True,
    frontend_mode="production",
    rpc_enabled=True,
    rpc_auto_mount_frontend=True,
)
```

**行为**：
1. 检查前端编译输出是否存在
2. 如果不存在，阻塞并编译
3. RPC v2 挂载静态文件到 `/`
4. WebView 访问 `http://localhost:{rpc_port}`

**适用场景**：生产部署、最终用户使用

### 模式 2: 开发模式

```python
config = NativeUIConfig(
    # ...
    frontend_enabled=True,
    frontend_mode="dev",
    frontend_block_until_ready=True,
    rpc_enabled=True,
    rpc_auto_mount_frontend=False,  # dev 模式不需要挂载
)
```

**行为**：
1. 自动 `pnpm install`（如果需要）
2. 自动 `npm run dev`
3. 等待 dev server 启动
4. RPC v2 仅提供 API 服务
5. WebView 访问 `http://localhost:{frontend_port}`

**适用场景**：前端开发、热重载调试

### 模式 3: 仅 RPC（无 UI）

```python
config = NativeUIConfig(
    # ...
    frontend_enabled=False,
    rpc_enabled=True,
    url="",  # 不需要 UI
)
```

**行为**：
1. 仅启动 RPC v2 服务
2. 不启动前端
3. 不创建 WebView 窗口
4. 适合作为后台服务运行

**适用场景**：纯后端服务、API 测试

## 常见问题

### Q1: 如何跳过前端编译？

```python
config = NativeUIConfig(
    # ...
    frontend_skip_build=True,  # 使用已有的编译输出
)
```

### Q2: 如何强制重新编译？

在 Matrix 配置中添加：
```python
# matrix_config.py
FRONTEND_FORCE_REBUILD = True
```

然后在 main_entry 中手动触发编译，或者删除现有的 `.output` 目录。

### Q3: 如何调试 RPC v2？

```python
config = NativeUIConfig(
    # ...
    rpc_debug=True,  # 启用详细日志
    debug=True,      # 启用全局调试
)
```

### Q4: 静态文件挂载失败怎么办？

检查：
1. 前端是否成功编译（检查 `.output/public/` 目录）
2. `rpc_auto_mount_frontend` 是否为 `True`
3. 查看日志中的静态挂载信息

### Q5: 如何自定义静态文件挂载路径？

当前 native_ui 自动挂载到 `/`，如需自定义，可以：

1. 禁用自动挂载：
   ```python
   rpc_auto_mount_frontend=False
   ```

2. 在 `rpc_routers` 中手动挂载静态文件（需要修改 native_ui 或 RPC v2）

## 回滚步骤

如果迁移后遇到问题，可以回滚到旧架构：

```bash
# 恢复备份文件
mv matrix_main_old_backup.py matrix_main.py
mv controller/frontend_compiler_old_backup.py controller/frontend_compiler.py
mv controller/launcher_builder_old_backup.py controller/launcher_builder.py

# 恢复 controller/__init__.py
git checkout controller/__init__.py
```

## 后续改进建议

1. **日志优化**：添加更详细的阶段日志，便于调试
2. **错误处理**：增强前端编译失败的错误提示
3. **性能优化**：并行启动前端和 RPC v2（如果可能）
4. **配置验证**：添加更多配置冲突检查
5. **文档完善**：为每个框架提供详细的配置示例

## 相关文档

- [整合方案设计](./NATIVE_UI_RPC_V2_INTEGRATION.md)
- [架构流程图](./NATIVE_UI_RPC_V2_ARCHITECTURE_DIAGRAM.md)
- [前端集成文档](./NATIVE_UI_FRONTEND_INTEGRATION.md)
- [Python 开发规范](../development-guides/PYTHON_PYCORE.md)

---

**文档版本**: v1.0
**创建时间**: 2025-12-07
**作者**: Claude (AI Assistant)
**状态**: 迁移已完成，可用于生产
