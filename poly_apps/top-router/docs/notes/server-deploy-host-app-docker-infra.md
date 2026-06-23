# 宿主机运行源码 + Docker 基础设施部署说明

适用场景：应用进程（Node.js）在宿主机运行，MySQL/Redis/Nginx/Certbot 在 Docker 中运行，方便持续改源码。

## 前置条件
- 域名解析到服务器公网 IP（本文示例：`www.toprouter.cn`）
- 服务器放通 80/443（Nginx/Certbot）、仅本机开放 3306/6379
- 安装：Docker + Docker Compose 插件、Node.js 18+

## 目录与文件
- `infra/docker-compose.yml`：MySQL/Redis/Nginx/Certbot 编排
- `infra/nginx.conf`：Nginx 反向代理与 HTTPS 配置
- `db/mysql/schema.sql`：MySQL 初始化 schema

## 一次性配置
1) 修改 `infra/nginx.conf`
- `server_name` 改为你的域名
- 证书路径保持 `/etc/letsencrypt/live/<域名>/...`

2) 修改 `infra/docker-compose.yml`
- 设置 MySQL 账号密码（`MYSQL_*`）
- 确认 MySQL/Redis 只绑定到 `127.0.0.1`

3) 修改宿主机 `.env`
- `DATASTORE_PROVIDER=mysql`
- `DB_HOST=127.0.0.1`、`DB_PORT=3306`
- `REDIS_HOST=127.0.0.1`、`REDIS_PORT=6379`
- 填写 `JWT_SECRET`、`ENCRYPTION_KEY`
- 建议：`HOST=0.0.0.0`（容器反代才能访问宿主机端口）

## 启动基础设施容器
```bash
# 仅启动 MySQL/Redis（首次签证书前不要启动 nginx）
docker compose -f infra/docker-compose.yml up -d mysql redis
```

## 初始化 MySQL schema
- 首次启动且 `mysql_data` 为空时，会自动执行 `db/mysql/schema.sql`
- 若已有数据卷，手工执行：
```bash
docker exec -i infra-mysql mysql -u crs -pcrs_pass claude_relay < db/mysql/schema.sql
```

## 启动宿主机应用
```bash
npm install
npm run install:web
npm run build:web
cp .env.server.example .env
cp ./config/config.example.js ./config/config.js
npm run setup
npm run service:start:daemon
```

## 启动 nginx：docker compose -f infra/docker-compose.yml up -d nginx

## 申请证书（首次）
> nginx 依赖证书文件，首次用 standalone 签发
```bash
 docker run --rm \
    -p 80:80 \
    -v /home/top-router/infra/certbot/conf:/etc/letsencrypt \
    -v /home/top-router/infra/certbot/www:/var/www/certbot \
    certbot/certbot:latest \
    certonly --standalone -d www.toprouter.cn --register-unsafely-without-email --agree-tos
```

## 启动 Nginx + Certbot 自动续期
```bash
docker compose -f infra/docker-compose.yml up -d nginx certbot
```

## 验证
- Web 管理端：`https://www.toprouter.cn/web`
- 健康检查：`http://127.0.0.1:3000/health`

## 常见注意事项
- 容器内访问宿主机：`host.docker.internal:3000`（Compose 已添加 `host-gateway`）。
  - 如果不生效，替换为 `172.17.0.1:3000` 或改用 `network_mode: host`。
- `underscores_in_headers on` 与 `X-Session-Hash` 透传已在 `infra/nginx.conf` 配置。
- `client_max_body_size` 已按 100M 设置；流式请求超时为 600s。

## 更新与回滚
- 更新代码：`git pull` → `npm run build:web` → `npm run service:restart`
- MySQL/Redis 数据备份：备份 `infra/mysql_data` 与 `infra/redis_data` 目录
