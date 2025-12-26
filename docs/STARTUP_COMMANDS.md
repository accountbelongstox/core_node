# Pycore Module Caller - Startup Commands

> **Updated**: 2025-12-07
> **Unified Entry**: `python pycore_module_caller.py` (NEVER separate this command)

---

## 🚀 启动命令

### 默认模式 (Native UI - 推荐)
```bash
# Windows: 显示UI窗口 + 系统托盘 + 前端启动
# Linux: 后台模式 (只启动前端，无UI窗口)
python pycore_module_caller.py

# 带调试信息
python pycore_module_caller.py --debug

# 自定义端口
python pycore_module_caller.py --host 0.0.0.0 --port 59000 --debug
```

### 传统模式 (ServiceLauncher - 用于对比)
```bash
# 使用旧的ServiceLauncher模式
python pycore_module_caller.py --legacy --debug
```

### 服务模式 (无UI - 用于CI/CD)
```bash
# 直接启动FastAPI服务器 (无UI，无前端集成)
python -m pycore.callmodule --service --debug
```

---

## 🌐 访问地址

### 开发模式 (FRONTEND_MODE = "dev")
- **前端**: http://localhost:3000 (Vite dev server)
- **后端**: http://localhost:59000 (RPC v2 API)
- **API文档**: http://localhost:59000/docs

### 生产模式 (FRONTEND_MODE = "production")
- **统一地址**: http://localhost:59000 (前端 + 后端)
- **API文档**: http://localhost:59000/docs

---

## 📊 平台差异

| 功能 | Windows | Linux |
|-----|---------|-------|
| 前端启动 | ✅ 自动 | ✅ 自动 |
| UI窗口 | ✅ 显示 (1400x900) | ❌ 后台模式 |
| 系统托盘 | ✅ 启用 | ❌ 禁用 |
| 访问方式 | UI窗口 | 浏览器 http://localhost:3000 |

---

## 🎯 启动流程

### Windows
```
1. Debug窗口显示
2. 前端Vite dev server启动 (port 3000)
3. 后端RPC v2启动 (port 59000)
4. 主UI窗口打开 (WebView加载 http://localhost:3000)
5. 系统托盘图标显示
6. Debug窗口自动关闭
```

### Linux
```
1. Debug窗口显示
2. 前端Vite dev server启动 (port 3000)
3. 后端RPC v2启动 (port 59000)
4. Debug窗口自动关闭
5. 浏览器访问: http://localhost:3000
```

---

## 📝 配置文件

修改前端模式: `pycore/callmodule/callmodule_config/config.py`

```python
# 开发模式 (热重载)
FRONTEND_MODE = "dev"

# 生产模式 (编译后的静态文件)
FRONTEND_MODE = "production"
```

---

## ✅ 快速测试

```bash
# 1. 启动服务 (Windows)
python pycore_module_caller.py --debug

# 预期结果:
# - Debug窗口出现
# - 前端启动: http://localhost:3000
# - 后端启动: http://localhost:59000
# - UI窗口打开显示管理界面
# - 系统托盘图标显示

# 2. 验证前端连接
# 打开 http://localhost:3000 查看管理界面

# 3. 验证后端API
# 打开 http://localhost:59000/docs 查看API文档

# 4. 验证系统状态
curl http://localhost:59000/api/manage/status
```

---

**永远使用统一入口**: `python pycore_module_caller.py`
