# pyMatrix 启动指南

## ✅ 路径问题已修复！

所有相对导入问题已解决，现在可以直接运行pyMatrix。

---

## 🚀 启动方式

### 方式1：直接运行脚本（推荐）

```bash
# 在项目根目录运行
python poly_apps/pyMatrix/main.py --no-launcher
```

### 方式2：作为模块运行

```bash
python -m poly_apps.pyMatrix.main --no-launcher
```

### 方式3：使用test_system测试

```bash
# 测试架构（无需设备）
python -m poly_apps.pyMatrix.test_system --no-device

# 测试设备（需要连接Android设备）
python -m poly_apps.pyMatrix.test_system --serial <设备序列号>
```

---

## 📍 API端点

启动后，以下端点可用：

- **API文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/api/health
- **设备列表**: http://localhost:8000/api/devices/list
- **根路径**: http://localhost:8000/api/

### WebSocket端点

- **视频流**: ws://localhost:8000/ws/video/{serial}
- **控制**: ws://localhost:8000/ws/control/{serial}
- **群组**: ws://localhost:8000/ws/group

---

## 🔧 启动选项

```bash
python poly_apps/pyMatrix/main.py [选项]

选项:
  --host HOST       服务器地址 (默认: 0.0.0.0)
  --port PORT       服务器端口 (默认: 8000)
  --reload          开发模式（自动重载）
  --no-launcher     不启动UI启动器（仅启动API服务）
```

---

## 📝 启动输出示例

```
[INFO] Checking for required Python packages...
[INFO] Found installed packages: ...
[INFO] All required packages are available.

============================================================
[GPU MANAGER] Unified GPU Detection and Setup
============================================================
[INFO] No GPU detected - Using CPU
       Training will be slower but functional
============================================================

INFO:     Started server process [1234]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
============================================================
 pyMatrix API Server - Starting
============================================================
  Mode: dev
  Host: 0.0.0.0:8000
  API Docs: http://0.0.0.0:8000/docs
  Frontend: http://localhost:3000/pymatrix
============================================================
✓ ADB 可用: adb
✓ 发现 0 个设备
✓ pyMatrix API Server 启动完成
============================================================
```

---

## 🧪 快速测试

### 测试健康检查

```bash
curl http://localhost:8000/api/health
```

**预期响应**:
```json
{
  "status": "ok",
  "service": "pyMatrix",
  "version": "1.0.0"
}
```

### 测试设备列表

```bash
curl http://localhost:8000/api/devices/list
```

---

## 🔍 问题排查

### 问题1: 相对导入错误

**症状**:
```
ImportError: attempted relative import with no known parent package
```

**解决**: 已修复！所有文件都添加了路径设置。

### 问题2: 端口被占用

**症状**:
```
ERROR: [Errno 10048] Only one usage of each socket address
```

**解决**:
```bash
# 使用不同端口
python poly_apps/pyMatrix/main.py --no-launcher --port 8001
```

### 问题3: pycore导入失败

**症状**:
```
ModuleNotFoundError: No module named 'pycore'
```

**解决**: 确保在项目根目录运行：
```bash
cd D:\programing\core_node
python poly_apps/pyMatrix/main.py --no-launcher
```

---

## 📁 项目结构

```
D:\programing\core_node\
├── pycore/                      # 核心库
│   ├── pyfoundations/          # 基础组件
│   └── pyutils/                # 工具类
│
└── poly_apps/
    └── pyMatrix/                # pyMatrix应用
        ├── _path_setup.py       # ✅ 路径设置（新增）
        ├── main.py             # ✅ 已修复
        ├── config.py
        ├── api/
        │   ├── device_routes.py  # ✅ 已修复
        │   ├── ws_routes.py      # ✅ 已修复
        │   └── health_routes.py
        └── services/
            ├── device_service.py    # ✅ 已修复
            ├── video_stream_service.py  # ✅ 已修复
            ├── control_service.py   # ✅ 已修复
            └── group_service.py
```

---

## ✅ 修复内容

1. **_path_setup.py**: 通用路径设置模块
2. **main.py**: 添加sys.path设置，使用绝对导入
3. **api/*.py**: 添加路径设置，使用绝对导入
4. **services/*.py**: 添加路径设置，使用绝对导入

所有相对导入 (`from ..`) 都改为绝对导入 (`from poly_apps.pyMatrix`)。

---

## 🎯 下一步

1. **启动后端**:
   ```bash
   python poly_apps/pyMatrix/main.py --no-launcher
   ```

2. **启动前端** (另一个终端):
   ```bash
   cd poly_apps/nuxt_main
   set APP_ENTRY=pymatrix  # Windows
   yarn dev
   ```

3. **访问应用**:
   - 前端: http://localhost:3000/pymatrix
   - API文档: http://localhost:8000/docs

---

**最后更新**: 2025-10-31
**状态**: ✅ 路径问题已完全修复
