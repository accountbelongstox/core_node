# Matrix Configuration Fix Summary

## 修复的问题

### 1. 前端端口配置不一致

**问题**:
- `config.py` 中定义 `FRONTEND_PORT = 3000`
- 实际 matrix 前端运行在端口 `3007`（定义在 `app-config.json`）
- 导致后端启动时显示错误的前端 URL

**修复前**:
```python
FRONTEND_PORT = 3000  # Nuxt dev server port
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}/pymatrix"
# 结果: http://localhost:3000/pymatrix (错误)
```

**修复后**:
```python
FRONTEND_PORT = 3007  # Matrix frontend port (from app-config.json)
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
# 结果: http://localhost:3007 (正确)
```

### 2. CORS 配置优化

**修复前**:
```python
CORS_ALLOW_ORIGINS = [
    f"http://localhost:{FRONTEND_PORT}",  # 3000 (错误)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3007",  # 重复且不使用变量
    "http://127.0.0.1:3007",
]
```

**修复后**:
```python
CORS_ALLOW_ORIGINS = [
    f"http://localhost:{FRONTEND_PORT}",  # 3007 (正确)
    f"http://127.0.0.1:{FRONTEND_PORT}",  # 3007 (正确)
    "http://localhost:3000",  # Fallback for other Nuxt apps
    "http://127.0.0.1:3000",  # Fallback for other Nuxt apps
]
```

## 正确的配置

### Matrix Frontend (Nuxt)
- **端口**: 3007
- **URL**: http://localhost:3007
- **配置文件**: `poly_apps/nuxt_main/apps/app_pymatrix/app-config.json`

### Matrix Backend (FastAPI)
- **端口**: 8000
- **URL**: http://0.0.0.0:8000
- **API 文档**: http://0.0.0.0:8000/docs
- **配置文件**: `pyapps/matrix/config.py`

## 启动输出验证

### 修复后的正确输出

```
======================================================================
 Matrix API Server - Starting
======================================================================
  Mode: dev
  Host: 0.0.0.0:8000
  API Docs: http://0.0.0.0:8000/docs
  Frontend: http://localhost:3007  ✓ (正确)
======================================================================
```

### 修复前的错误输出

```
======================================================================
 Matrix API Server - Starting
======================================================================
  Mode: dev
  Host: 0.0.0.0:8000
  API Docs: http://0.0.0.0:8000/docs
  Frontend: http://localhost:3000/pymatrix  ✗ (错误)
======================================================================
```

## 配置文件对应关系

### app-config.json (前端配置)
```json
{
  "displayName": "pyMatrix",
  "port": 3007,
  "devCommand": "dev:pymatrix",
  "buildCommand": "build:pymatrix"
}
```

### config.py (后端配置)
```python
class Config:
    # Backend
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 8000

    # Frontend (must match app-config.json)
    FRONTEND_PORT = 3007
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # CORS (allow frontend to access backend)
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",  # 3007
        f"http://127.0.0.1:{FRONTEND_PORT}",  # 3007
    ]
```

## 重要提醒

1. **前端端口必须与 app-config.json 一致**
   - app-config.json: `"port": 3007`
   - config.py: `FRONTEND_PORT = 3007`

2. **不要在 URL 中添加路径前缀**
   - ✓ 正确: `http://localhost:3007`
   - ✗ 错误: `http://localhost:3007/pymatrix`
   - 说明: Nuxt 路由已在应用内部处理

3. **CORS 配置必须包含前端 URL**
   - 必须允许 `http://localhost:3007` 访问后端
   - 建议同时允许 `http://127.0.0.1:3007`

4. **后端 API 前缀在路由中配置**
   - API 路由自动添加 `/api` 前缀
   - 访问: `http://localhost:8000/api/devices`
   - 不需要在 `FRONTEND_URL` 中配置

## 测试验证

### 1. 检查配置是否正确

```bash
# 启动应用
python ./pymain.py app=matrix

# 检查输出中的 URL 是否正确
# 应该看到:
# Frontend: http://localhost:3007  ✓
```

### 2. 验证服务可访问性

```bash
# 前端
curl http://localhost:3007

# 后端 API
curl http://localhost:8000/api/health

# API 文档
# 浏览器访问: http://localhost:8000/docs
```

### 3. 验证 CORS

```bash
# 从前端发起请求应该成功
# 浏览器控制台不应该有 CORS 错误
```

## 修复文件列表

1. `pyapps/matrix/config.py`
   - 修正 `FRONTEND_PORT` 从 3000 → 3007
   - 修正 `FRONTEND_URL` 移除路径前缀
   - 优化 `CORS_ALLOW_ORIGINS` 使用变量

2. `pyapps/matrix/frontend_launcher.py`
   - 添加详细的启动流程输出
   - 改进等待连接的用户体验

3. `pyapps/matrix/matrix_main.py`
   - 添加清晰的启动阶段划分
   - 优化输出信息展示

## 相关文档

- `STARTUP_FLOW.md` - 完整启动流程文档
- `STARTUP_OUTPUT_EXAMPLE.md` - 输出示例
- `MIGRATION_TO_PYMAIN.md` - 迁移指南
