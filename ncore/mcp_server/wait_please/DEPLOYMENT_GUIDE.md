# 寸止分布式系统部署指南

## 部署架构概述

寸止系统采用分布式架构，包含三个主要组件：

1. **Rust MCP 服务**: 处理 MCP 协议和业务逻辑
2. **Laravel 后端**: 提供 API 服务、WebSocket 通信和数据管理
3. **Flutter 移动端**: 用户交互界面和推送通知接收

各组件可以独立部署在不同的服务器上，通过 HTTP API 和 WebSocket 进行通信。

## 环境要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+), macOS, Windows Server
- **内存**: 最低 2GB，推荐 4GB+
- **存储**: 最低 10GB 可用空间
- **网络**: 稳定的互联网连接，支持 HTTPS 和 WebSocket

### 软件依赖
- **Docker**: 20.10+ (推荐使用 Docker 部署)
- **Docker Compose**: 1.29+
- **Rust**: 1.70+ (如果从源码编译)
- **PHP**: 8.2+ (如果不使用 Docker)
- **Node.js**: 18+ (构建工具)
- **MySQL**: 8.0+ 或 PostgreSQL 13+
- **Redis**: 6.0+

## 部署方式

### 方式一：Docker Compose 一键部署（推荐）

#### 1. 准备部署文件

```bash
# 克隆项目
git clone https://github.com/imhuso/cunzhi.git
cd cunzhi

# 复制环境配置
cp .env.example .env
```

#### 2. 配置环境变量

编辑 `.env` 文件：

```bash
# 应用配置
APP_NAME="寸止"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# 数据库配置
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=cunzhi
DB_USERNAME=cunzhi_user
DB_PASSWORD=your_secure_password

# Redis 配置
REDIS_HOST=redis
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379

# WebSocket 配置
PUSHER_APP_ID=your_pusher_app_id
PUSHER_APP_KEY=your_pusher_key
PUSHER_APP_SECRET=your_pusher_secret
PUSHER_HOST=127.0.0.1
PUSHER_PORT=6001
PUSHER_SCHEME=http

# 推送通知配置
FCM_SERVER_KEY=your_fcm_server_key
APNS_CERTIFICATE_PATH=/path/to/apns.pem
APNS_PASSPHRASE=your_apns_passphrase

# MCP 服务配置
MCP_SERVER_URL=http://mcp-server:8080
MCP_HEARTBEAT_INTERVAL=30

# 日志配置
LOG_CHANNEL=stack
LOG_LEVEL=info
```

#### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 初始化数据库

```bash
# 运行数据库迁移
docker-compose exec laravel php artisan migrate

# 创建应用密钥
docker-compose exec laravel php artisan key:generate

# 清理缓存
docker-compose exec laravel php artisan config:cache
docker-compose exec laravel php artisan route:cache
```

### 方式二：分组件独立部署

#### 1. 部署 MySQL 数据库

```bash
# 使用 Docker 部署 MySQL
docker run -d \
  --name cunzhi-mysql \
  -e MYSQL_ROOT_PASSWORD=root_password \
  -e MYSQL_DATABASE=cunzhi \
  -e MYSQL_USER=cunzhi_user \
  -e MYSQL_PASSWORD=user_password \
  -p 3306:3306 \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0

# 或者使用现有的 MySQL 服务
# 创建数据库和用户
mysql -u root -p
CREATE DATABASE cunzhi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cunzhi_user'@'%' IDENTIFIED BY 'user_password';
GRANT ALL PRIVILEGES ON cunzhi.* TO 'cunzhi_user'@'%';
FLUSH PRIVILEGES;
```

#### 2. 部署 Redis

```bash
# 使用 Docker 部署 Redis
docker run -d \
  --name cunzhi-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:6.0 redis-server --requirepass your_redis_password
```

#### 3. 部署 Laravel 后端

```bash
# 进入 Laravel 目录
cd src/laravel_bridge

# 安装 PHP 依赖
composer install --no-dev --optimize-autoloader

# 配置环境
cp .env.example .env
# 编辑 .env 文件，配置数据库和 Redis 连接

# 生成应用密钥
php artisan key:generate

# 运行数据库迁移
php artisan migrate --force

# 优化性能
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 启动服务 (生产环境推荐使用 Nginx + PHP-FPM)
php artisan serve --host=0.0.0.0 --port=8000

# 启动队列处理器
php artisan queue:work --daemon

# 启动 WebSocket 服务器
php artisan websockets:serve
```

#### 4. 部署 Rust MCP 服务

```bash
# 进入 Rust 目录
cd src/rust

# 配置环境
cp .env.example .env
# 编辑 .env 文件，配置 Laravel 后端地址

# 编译发布版本
cargo build --release

# 启动服务
./target/release/cunzhi-mcp-server

# 或者使用 systemd 管理服务
sudo cp cunzhi-mcp.service /etc/systemd/system/
sudo systemctl enable cunzhi-mcp
sudo systemctl start cunzhi-mcp
```

#### 5. 配置 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/cunzhi
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Laravel API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # MCP 服务健康检查
    location /mcp/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Flutter 移动端部署

### 1. 配置构建环境

```bash
# 安装 Flutter SDK
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:`pwd`/flutter/bin"

# 验证安装
flutter doctor

# 进入 Flutter 项目目录
cd src/flutter_app
```

### 2. 配置应用

编辑 `lib/core/config/app_config.dart`：

```dart
class AppConfig {
  static const String baseUrl = 'https://your-domain.com';
  static const String wsUrl = 'wss://your-domain.com/ws';
  static const String appName = '寸止';
  static const String version = '1.0.0';
  
  // Firebase 配置
  static const String fcmSenderId = 'your_sender_id';
  static const String fcmProjectId = 'your_project_id';
}
```

### 3. 构建和发布

#### Android 发布

```bash
# 生成签名密钥
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload

# 配置签名 (android/key.properties)
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=upload
storeFile=/path/to/upload-keystore.jks

# 构建 APK
flutter build apk --release

# 构建 App Bundle (推荐)
flutter build appbundle --release

# 上传到 Google Play Console
```

#### iOS 发布

```bash
# 配置 iOS 签名和证书
# 在 Xcode 中配置 Team ID 和 Bundle Identifier

# 构建 iOS 应用
flutter build ios --release

# 在 Xcode 中打开项目并上传到 App Store Connect
open ios/Runner.xcworkspace
```

## 监控和维护

### 1. 健康检查

```bash
# 检查各服务状态
curl https://your-domain.com/api/health
curl https://your-domain.com/api/mcp/status
curl https://your-domain.com/api/clients/status
```

### 2. 日志管理

```bash
# 查看 Laravel 日志
tail -f storage/logs/laravel.log

# 查看 Docker 容器日志
docker-compose logs -f laravel
docker-compose logs -f mcp-server
docker-compose logs -f mysql
docker-compose logs -f redis
```

### 3. 备份策略

```bash
# 数据库备份
mysqldump -u cunzhi_user -p cunzhi > backup_$(date +%Y%m%d_%H%M%S).sql

# Redis 备份
redis-cli --rdb backup_$(date +%Y%m%d_%H%M%S).rdb

# 配置文件备份
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env docker-compose.yml
```

### 4. 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
docker-compose down
docker-compose build
docker-compose up -d

# 运行数据库迁移
docker-compose exec laravel php artisan migrate

# 清理缓存
docker-compose exec laravel php artisan cache:clear
docker-compose exec laravel php artisan config:cache
```

## 故障排除

### 常见问题

1. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确认 Nginx 配置正确
   - 验证 SSL 证书

2. **推送通知不工作**
   - 检查 FCM/APNS 配置
   - 验证设备 Token 注册
   - 查看推送服务日志

3. **MCP 服务无响应**
   - 检查 Rust 服务状态
   - 验证与 Laravel 的网络连接
   - 查看心跳日志

4. **数据库连接问题**
   - 检查数据库服务状态
   - 验证连接配置
   - 检查网络连通性

### 性能优化

1. **数据库优化**
   - 添加适当的索引
   - 定期清理过期数据
   - 配置查询缓存

2. **缓存策略**
   - 启用 Redis 缓存
   - 配置 CDN 加速
   - 使用浏览器缓存

3. **负载均衡**
   - 部署多个 Laravel 实例
   - 使用 Nginx 负载均衡
   - 配置数据库读写分离

这个部署指南提供了完整的部署流程，确保寸止系统能够在生产环境中稳定运行。
