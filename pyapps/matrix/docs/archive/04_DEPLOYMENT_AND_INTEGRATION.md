# pyMatrix 部署与集成指南

## 概述

pyMatrix 采用 **Python 后端 + Nuxt 前端一体化部署** 架构。Nuxt 编译后的静态文件会被集成到 Python 项目中，实现单一服务部署。

---

## 一、项目结构

```
pyMatrix/
├── core/                           # Python 后端核心
│   ├── adb/
│   ├── device/
│   ├── stream/
│   ├── control/
│   ├── render/
│   ├── group/
│   └── web/                        # Web API 层
│       ├── fastapi_app.py          # FastAPI 应用
│       ├── video_stream_server.py  # MSE 视频流服务
│       └── websocket_handler.py    # WebSocket 事件处理
├── resources/                      # 资源文件
│   ├── adb/                        # ADB 可执行文件
│   └── scrcpy-server.jar          # Android 服务端
├── static/                         # Nuxt 编译输出目录 ⚠️
│   ├── _nuxt/                      # Nuxt 资源
│   ├── index.html                  # 前端入口
│   └── ...
├── pyMatrix-web/                   # Nuxt 源码目录
│   ├── components/
│   ├── composables/
│   ├── pages/
│   ├── stores/
│   ├── nuxt.config.ts
│   └── package.json
├── main.py                         # 程序入口
├── requirements.txt                # Python 依赖
├── requirements-web.txt            # Web 模式额外依赖
└── 00_PROJECT_OVERVIEW.md          # 项目文档（按序号阅读）
```

---

## 二、开发模式运行

### 2.1 桌面端开发（PyQt6）

```bash
# 1. 安装 Python 依赖
pip install -r requirements.txt

# 2. 运行桌面端
python main.py

# 或指定设备
python main.py --serial ABC123DEF456 --max-size 720
```

**特点**：
- 低延迟（30-70ms）
- 原生 OpenGL 渲染
- 适合单用户本地使用

---

### 2.2 Web端开发（Nuxt + FastAPI）

#### 方式一：分离开发（推荐开发阶段）

**终端 1 - 启动 Python 后端**：
```bash
# 安装依赖
pip install -r requirements.txt -r requirements-web.txt

# 启动后端 API
python main.py --mode web --port 8000

# 后端运行在: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

**终端 2 - 启动 Nuxt 前端**：
```bash
# 进入前端目录
cd pyMatrix-web

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev

# 前端运行在: http://localhost:3000
```

**配置 API 地址**：
```typescript
// pyMatrix-web/nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8000',
      wsUrl: 'ws://localhost:8000'
    }
  }
})
```

---

#### 方式二：集成开发

```bash
# 1. 编译 Nuxt 前端
cd pyMatrix-web
npm run generate

# 输出到: pyMatrix-web/.output/public/

# 2. 复制到 Python 静态目录
# Windows PowerShell
Copy-Item -Recurse -Force pyMatrix-web/.output/public/* ../static/

# Linux/macOS
cp -r pyMatrix-web/.output/public/* ../static/

# 3. 启动集成服务
cd ..
python main.py --mode web --port 8000

# 访问: http://localhost:8000
```

---

## 三、生产环境部署

### 3.1 方案一：单机部署（Docker）

#### Dockerfile（多阶段构建）

```dockerfile
# ===== Stage 1: 构建 Nuxt 前端 =====
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY pyMatrix-web/package*.json ./
RUN npm ci

COPY pyMatrix-web/ ./
RUN npm run generate

# ===== Stage 2: Python 后端 + 静态文件 =====
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-web.txt

# 复制应用代码
COPY core/ ./core/
COPY resources/ ./resources/
COPY main.py ./

# 复制 Nuxt 编译产物
COPY --from=frontend-builder /app/frontend/.output/public ./static

# 暴露端口
EXPOSE 8000

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV APP_MODE=web

# 启动服务
CMD ["python", "main.py", "--mode", "web", "--host", "0.0.0.0", "--port", "8000"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  pymatrix:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./resources:/app/resources:ro
      - /dev/bus/usb:/dev/bus/usb    # USB 设备访问
    devices:
      - /dev/bus/usb
    privileged: true                  # 需要访问 USB 设备
    environment:
      - PYTHONUNBUFFERED=1
      - MAX_DEVICES=100
      - LOG_LEVEL=info
    restart: unless-stopped
```

**构建和运行**：
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 访问
# http://localhost:8000
```

---

### 3.2 方案二：前后端分离部署

#### 后端部署（Python + FastAPI）

```bash
# 1. 安装依赖
pip install -r requirements.txt -r requirements-web.txt

# 2. 使用 Gunicorn + Uvicorn 部署
pip install gunicorn uvicorn[standard]

# 3. 启动服务
gunicorn -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 300 \
  core.web.fastapi_app:app

# 或使用 systemd 服务
cat > /etc/systemd/system/pymatrix.service <<EOF
[Unit]
Description=pyMatrix Backend Service
After=network.target

[Service]
Type=notify
User=pymatrix
WorkingDirectory=/opt/pymatrix
ExecStart=/opt/pymatrix/venv/bin/gunicorn \\
  -w 4 \\
  -k uvicorn.workers.UvicornWorker \\
  --bind 0.0.0.0:8000 \\
  core.web.fastapi_app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable pymatrix
systemctl start pymatrix
```

#### 前端部署（Nuxt Static）

```bash
# 1. 编译 Nuxt
cd pyMatrix-web
npm run generate

# 2. 部署到 Nginx
# 输出目录: .output/public/

# Nginx 配置
server {
    listen 80;
    server_name pymatrix.example.com;

    root /var/www/pymatrix/static;
    index index.html;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

---

## 四、Nuxt 编译集成流程

### 4.1 自动化集成脚本

#### build_and_integrate.py

```python
#!/usr/bin/env python3
"""
Nuxt 编译并集成到 Python 项目的自动化脚本
"""
import os
import shutil
import subprocess
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent
NUXT_DIR = PROJECT_ROOT / "pyMatrix-web"
NUXT_OUTPUT = NUXT_DIR / ".output" / "public"
PYTHON_STATIC = PROJECT_ROOT / "static"

def build_nuxt():
    """编译 Nuxt 项目"""
    print("📦 正在编译 Nuxt 前端...")

    # 检查 Node 环境
    try:
        subprocess.run(["node", "--version"], check=True, capture_output=True)
    except FileNotFoundError:
        print("❌ 未找到 Node.js，请先安装")
        return False

    # 进入 Nuxt 目录
    os.chdir(NUXT_DIR)

    # 安装依赖（如果需要）
    if not (NUXT_DIR / "node_modules").exists():
        print("📥 正在安装 npm 依赖...")
        subprocess.run(["npm", "install"], check=True)

    # 执行编译
    subprocess.run(["npm", "run", "generate"], check=True)

    print("✅ Nuxt 编译完成")
    return True

def integrate_static():
    """将 Nuxt 编译产物复制到 Python 静态目录"""
    print(f"📁 正在集成静态文件到 {PYTHON_STATIC}...")

    # 清空旧的静态文件
    if PYTHON_STATIC.exists():
        shutil.rmtree(PYTHON_STATIC)

    # 复制新的编译产物
    shutil.copytree(NUXT_OUTPUT, PYTHON_STATIC)

    print(f"✅ 静态文件已集成，共 {len(list(PYTHON_STATIC.rglob('*')))} 个文件")

def main():
    print("🚀 pyMatrix 前端编译集成工具\n")

    # 1. 编译 Nuxt
    if not build_nuxt():
        return

    # 2. 集成静态文件
    os.chdir(PROJECT_ROOT)
    integrate_static()

    print("\n🎉 集成完成！现在可以运行:")
    print("   python main.py --mode web --port 8000")

if __name__ == "__main__":
    main()
```

**使用方法**：
```bash
# 一键编译并集成
python build_and_integrate.py

# 启动集成服务
python main.py --mode web
```

---

### 4.2 FastAPI 静态文件配置

#### core/web/fastapi_app.py

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

app = FastAPI(
    title="pyMatrix API",
    version="1.0.0",
    docs_url="/api/docs",  # API 文档移到 /api/docs 避免冲突
    redoc_url="/api/redoc"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# ... 其他 API 路由 ...

# 挂载 Nuxt 静态文件（必须放在最后）
STATIC_DIR = Path(__file__).parent.parent.parent / "static"

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
    print(f"✅ 已挂载静态文件目录: {STATIC_DIR}")
else:
    print(f"⚠️  静态文件目录不存在: {STATIC_DIR}")
    print("   请先运行: python build_and_integrate.py")
```

---

## 五、环境变量配置

### 5.1 开发环境（.env.development）

```bash
# Python 后端
APP_MODE=web
APP_HOST=0.0.0.0
APP_PORT=8000
LOG_LEVEL=debug
MAX_DEVICES=10

# Nuxt 前端
NUXT_PUBLIC_API_BASE=http://localhost:8000
NUXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 5.2 生产环境（.env.production）

```bash
# Python 后端
APP_MODE=web
APP_HOST=0.0.0.0
APP_PORT=8000
LOG_LEVEL=info
MAX_DEVICES=100

# Nuxt 前端
NUXT_PUBLIC_API_BASE=https://pymatrix.example.com
NUXT_PUBLIC_WS_URL=wss://pymatrix.example.com
```

---

## 六、性能优化建议

### 6.1 Nuxt 编译优化

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // 启用 SSG 静态生成
  ssr: false,

  // 压缩优化
  vite: {
    build: {
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'video-player': ['./components/VideoPlayer.vue'],
            'device-grid': ['./components/DeviceGrid.vue']
          }
        }
      }
    }
  },

  // 预渲染路由
  nitro: {
    prerender: {
      routes: ['/']
    }
  }
})
```

### 6.2 Python 静态文件缓存

```python
from fastapi.staticfiles import StaticFiles

# 添加缓存头
app.mount(
    "/",
    StaticFiles(
        directory=str(STATIC_DIR),
        html=True,
        check_dir=False  # 生产环境关闭目录检查提升性能
    ),
    name="static"
)
```

### 6.3 Nginx 缓存配置

```nginx
server {
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

---

## 七、监控与日志

### 7.1 日志配置

```python
# core/utils/logger.py
from loguru import logger
import sys

def setup_logger(log_level: str = "INFO"):
    """配置日志系统"""
    logger.remove()  # 移除默认处理器

    # 控制台输出
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level=log_level
    )

    # 文件输出
    logger.add(
        "logs/pymatrix_{time}.log",
        rotation="500 MB",
        retention="10 days",
        level=log_level
    )
```

### 7.2 健康检查端点

```python
@app.get("/api/health")
async def health_check():
    """健康检查"""
    from core.device.device_manager import DeviceManager

    device_count = len(DeviceManager.instance().get_all_devices())

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "devices": {
            "total": device_count,
            "connected": device_count
        },
        "version": "1.0.0"
    }
```

---

## 八、故障排查

### 8.1 常见问题

#### 问题 1: 静态文件 404

**症状**：访问 `http://localhost:8000` 显示 404

**解决**：
```bash
# 检查静态目录是否存在
ls -la static/

# 如果不存在，运行编译脚本
python build_and_integrate.py
```

#### 问题 2: WebSocket 连接失败

**症状**：前端无法连接 WebSocket

**解决**：
```typescript
// 检查 Nuxt 配置的 WebSocket URL
// pyMatrix-web/.env
NUXT_PUBLIC_WS_URL=ws://localhost:8000

// 确保后端 WebSocket 服务已启动
// 查看后端日志
```

#### 问题 3: USB 设备无法访问

**症状**：Docker 容器内无法检测到 USB 设备

**解决**：
```yaml
# docker-compose.yml
services:
  pymatrix:
    privileged: true  # 必须启用特权模式
    volumes:
      - /dev/bus/usb:/dev/bus/usb  # 挂载 USB 设备
```

---

## 九、版本升级指南

### 9.1 升级 Nuxt 版本

```bash
cd pyMatrix-web

# 更新依赖
npm update nuxt

# 重新编译
npm run generate

# 重新集成
cd ..
python build_and_integrate.py
```

### 9.2 升级 Python 依赖

```bash
# 更新依赖
pip install --upgrade -r requirements.txt -r requirements-web.txt

# 重启服务
docker-compose restart  # Docker 部署
# 或
systemctl restart pymatrix  # systemd 部署
```

---

## 十、总结

### 关键流程回顾

1. **开发阶段**: 前后端分离运行（Nuxt dev server + Python backend）
2. **构建阶段**: `npm run generate` 编译 Nuxt → `.output/public/`
3. **集成阶段**: 复制编译产物到 `static/` 目录
4. **部署阶段**: Python FastAPI 挂载 `static/` 作为静态文件服务
5. **访问方式**: 单一端口（8000）同时提供前端和 API

### 推荐工作流

```bash
# 1. 日常开发（分离模式）
Terminal 1: python main.py --mode web --port 8000
Terminal 2: cd pyMatrix-web && npm run dev

# 2. 测试集成
python build_and_integrate.py
python main.py --mode web

# 3. 生产部署
docker-compose up -d
```

---

**文档版本**: 1.0
**创建时间**: 2025-10-30
**适用版本**: pyMatrix 1.0+
