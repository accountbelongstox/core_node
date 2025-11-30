# 系统服务配置指南

## 概述

本文档提供了寸止分布式系统各组件的系统服务配置，包括 systemd 服务文件、Docker 配置和 Nginx 反向代理配置。

## Systemd 服务配置

### 1. Rust MCP 服务

**cunzhi-mcp.service**
```ini
[Unit]
Description=寸止 MCP 服务
Documentation=https://github.com/imhuso/cunzhi
After=network.target
Wants=network.target

[Service]
Type=simple
User=cunzhi
Group=cunzhi
WorkingDirectory=/opt/cunzhi/mcp-server
ExecStart=/opt/cunzhi/mcp-server/target/release/cunzhi-mcp-server
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cunzhi-mcp

# 环境变量
Environment=RUST_LOG=info
Environment=LARAVEL_API_URL=http://127.0.0.1:8000
Environment=MCP_HEARTBEAT_INTERVAL=30

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/cunzhi/mcp-server/logs

# 资源限制
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### 2. Laravel 后端服务

**cunzhi-laravel.service**
```ini
[Unit]
Description=寸止 Laravel 后端服务
Documentation=https://github.com/imhuso/cunzhi
After=network.target mysql.service redis.service
Wants=network.target
Requires=mysql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/cunzhi/laravel_bridge
ExecStart=/usr/bin/php artisan serve --host=127.0.0.1 --port=8000
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cunzhi-laravel

# 环境变量
Environment=APP_ENV=production
Environment=APP_DEBUG=false

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/cunzhi/laravel_bridge/storage
ReadWritePaths=/var/www/cunzhi/laravel_bridge/bootstrap/cache

[Install]
WantedBy=multi-user.target
```

### 3. Laravel 队列处理器

**cunzhi-queue.service**
```ini
[Unit]
Description=寸止 Laravel 队列处理器
Documentation=https://github.com/imhuso/cunzhi
After=network.target mysql.service redis.service
Wants=network.target
Requires=mysql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/cunzhi/laravel_bridge
ExecStart=/usr/bin/php artisan queue:work --daemon --sleep=3 --tries=3 --max-time=3600
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cunzhi-queue

# 环境变量
Environment=APP_ENV=production

[Install]
WantedBy=multi-user.target
```

### 4. WebSocket 服务

**cunzhi-websocket.service**
```ini
[Unit]
Description=寸止 WebSocket 服务
Documentation=https://github.com/imhuso/cunzhi
After=network.target redis.service
Wants=network.target
Requires=redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/cunzhi/laravel_bridge
ExecStart=/usr/bin/php artisan websockets:serve --host=127.0.0.1 --port=6001
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cunzhi-websocket

# 环境变量
Environment=APP_ENV=production

[Install]
WantedBy=multi-user.target
```

## Docker 配置

### 1. Docker Compose 主配置

**docker-compose.yml**
```yaml
version: '3.8'

services:
  # MySQL 数据库
  mysql:
    image: mysql:8.0
    container_name: cunzhi-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/init:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"
    networks:
      - cunzhi-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  # Redis 缓存
  redis:
    image: redis:6.0-alpine
    container_name: cunzhi-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - cunzhi-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      timeout: 10s
      retries: 5

  # Laravel 后端
  laravel:
    build:
      context: .
      dockerfile: docker/laravel/Dockerfile
    container_name: cunzhi-laravel
    restart: unless-stopped
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_HOST=mysql
      - REDIS_HOST=redis
    volumes:
      - ./src/laravel_bridge:/var/www/html
      - laravel_storage:/var/www/html/storage
    ports:
      - "8000:8000"
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - cunzhi-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      timeout: 10s
      retries: 5

  # Laravel 队列处理器
  queue:
    build:
      context: .
      dockerfile: docker/laravel/Dockerfile
    container_name: cunzhi-queue
    restart: unless-stopped
    command: php artisan queue:work --daemon
    environment:
      - APP_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    volumes:
      - ./src/laravel_bridge:/var/www/html
    depends_on:
      laravel:
        condition: service_healthy
    networks:
      - cunzhi-network

  # WebSocket 服务
  websocket:
    build:
      context: .
      dockerfile: docker/laravel/Dockerfile
    container_name: cunzhi-websocket
    restart: unless-stopped
    command: php artisan websockets:serve --host=0.0.0.0 --port=6001
    environment:
      - APP_ENV=production
      - REDIS_HOST=redis
    volumes:
      - ./src/laravel_bridge:/var/www/html
    ports:
      - "6001:6001"
    depends_on:
      laravel:
        condition: service_healthy
    networks:
      - cunzhi-network

  # Rust MCP 服务
  mcp-server:
    build:
      context: .
      dockerfile: docker/rust/Dockerfile
    container_name: cunzhi-mcp-server
    restart: unless-stopped
    environment:
      - RUST_LOG=info
      - LARAVEL_API_URL=http://laravel:8000
    volumes:
      - ./src/rust:/app
      - mcp_logs:/app/logs
    ports:
      - "8080:8080"
    depends_on:
      laravel:
        condition: service_healthy
    networks:
      - cunzhi-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      timeout: 10s
      retries: 5

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: cunzhi-nginx
    restart: unless-stopped
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/conf.d:/etc/nginx/conf.d
      - ./ssl:/etc/nginx/ssl
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - laravel
      - websocket
      - mcp-server
    networks:
      - cunzhi-network

volumes:
  mysql_data:
  redis_data:
  laravel_storage:
  mcp_logs:

networks:
  cunzhi-network:
    driver: bridge
```

### 2. Laravel Dockerfile

**docker/laravel/Dockerfile**
```dockerfile
FROM php:8.2-fpm-alpine

# 安装系统依赖
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    oniguruma-dev \
    mysql-client \
    nginx \
    supervisor

# 安装 PHP 扩展
RUN docker-php-ext-install \
    pdo_mysql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    xml \
    soap

# 安装 Redis 扩展
RUN pecl install redis && docker-php-ext-enable redis

# 安装 Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 设置工作目录
WORKDIR /var/www/html

# 复制应用代码
COPY src/laravel_bridge .

# 安装 PHP 依赖
RUN composer install --no-dev --optimize-autoloader

# 设置权限
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# 复制配置文件
COPY docker/laravel/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/laravel/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### 3. Rust MCP Dockerfile

**docker/rust/Dockerfile**
```dockerfile
FROM rust:1.70-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    pkgconfig

# 设置工作目录
WORKDIR /app

# 复制 Cargo 文件
COPY src/rust/Cargo.toml src/rust/Cargo.lock ./

# 预构建依赖
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/cunzhi_mcp_server*

# 复制源代码
COPY src/rust/src ./src

# 构建应用
RUN cargo build --release

# 运行时镜像
FROM alpine:latest

# 安装运行时依赖
RUN apk add --no-cache \
    ca-certificates \
    curl

# 创建用户
RUN addgroup -g 1000 cunzhi && \
    adduser -D -s /bin/sh -u 1000 -G cunzhi cunzhi

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/target/release/cunzhi-mcp-server /app/

# 创建日志目录
RUN mkdir -p /app/logs && chown -R cunzhi:cunzhi /app

# 切换用户
USER cunzhi

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 启动命令
CMD ["./cunzhi-mcp-server"]
```

## 服务管理命令

### 安装和启动服务

```bash
# 复制服务文件
sudo cp cunzhi-*.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启用服务
sudo systemctl enable cunzhi-mcp.service
sudo systemctl enable cunzhi-laravel.service
sudo systemctl enable cunzhi-queue.service
sudo systemctl enable cunzhi-websocket.service

# 启动服务
sudo systemctl start cunzhi-mcp.service
sudo systemctl start cunzhi-laravel.service
sudo systemctl start cunzhi-queue.service
sudo systemctl start cunzhi-websocket.service

# 检查服务状态
sudo systemctl status cunzhi-mcp.service
sudo systemctl status cunzhi-laravel.service
sudo systemctl status cunzhi-queue.service
sudo systemctl status cunzhi-websocket.service
```

### 日志查看

```bash
# 查看服务日志
sudo journalctl -u cunzhi-mcp.service -f
sudo journalctl -u cunzhi-laravel.service -f
sudo journalctl -u cunzhi-queue.service -f
sudo journalctl -u cunzhi-websocket.service -f

# 查看所有寸止相关日志
sudo journalctl -u cunzhi-* -f
```

### Docker 管理

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启特定服务
docker-compose restart laravel

# 停止所有服务
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v
```

这些配置文件提供了完整的系统服务管理方案，支持传统的 systemd 部署和现代的 Docker 容器化部署。
