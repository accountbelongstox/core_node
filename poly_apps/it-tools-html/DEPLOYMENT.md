# Deployment Guide

> IT Tools Static Frontend 部署完整指南

---

## 目录

1. [快速部署](#快速部署)
2. [CDN部署](#cdn部署)
3. [服务器部署](#服务器部署)
4. [容器化部署](#容器化部署)
5. [CI/CD自动部署](#cicd自动部署)

---

## 快速部署

### 本地开发服务器

```bash
# 方式1: Python
cd D:\programing\core_node\poly_apps\it-tools-html
python -m http.server 8000

# 方式2: Node.js http-server
npx http-server -p 8000

# 方式3: PHP
php -S localhost:8000

# 访问 http://localhost:8000
```

---

## CDN部署

### Netlify

#### 方式1: 拖拽部署

1. 访问 https://app.netlify.com
2. 注册/登录账号
3. 点击 "Add new site" > "Deploy manually"
4. 将 `it-tools-html` 文件夹拖拽到上传区域
5. 等待部署完成，获得 `*.netlify.app` 域名

#### 方式2: Git部署

```bash
# 1. 推送到GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/it-tools-html.git
git push -u origin main

# 2. 在Netlify连接仓库
# Settings:
# - Build command: (留空)
# - Publish directory: /
```

#### 方式3: CLI部署

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

#### netlify.toml配置

```toml
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

### Vercel

#### 部署步骤

```bash
# 1. 安装CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 部署
cd it-tools-html
vercel --prod
```

#### vercel.json配置

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

---

### CloudFlare Pages

#### 部署步骤

1. 登录 https://dash.cloudflare.com
2. Pages -> Create a project
3. 选择连接Git或上传文件
4. 配置:
   - Build command: (留空)
   - Build output directory: /
   - Root directory: /
5. 保存并部署

#### _headers配置

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable
```

---

### GitHub Pages

```bash
# 1. 创建仓库
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/it-tools-html.git
git push -u origin main

# 2. 在仓库Settings -> Pages中:
# - Source: Deploy from a branch
# - Branch: main
# - Folder: / (root)

# 访问: https://username.github.io/it-tools-html/
```

---

## 服务器部署

### Nginx部署

#### 1. 上传文件

```bash
# 上传到服务器
scp -r it-tools-html/* user@server:/var/www/it-tools
```

#### 2. Nginx配置

```nginx
# /etc/nginx/sites-available/it-tools
server {
    listen 80;
    server_name tools.yourdomain.com;

    root /var/www/it-tools;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/json application/javascript;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### 3. 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/it-tools /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. SSL证书（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tools.yourdomain.com
```

---

### Apache部署

#### .htaccess配置

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# 缓存设置
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Gzip压缩
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
  AddOutputFilterByType DEFLATE application/javascript application/json
</IfModule>

# 安全头
<IfModule mod_headers.c>
  Header set X-Frame-Options "DENY"
  Header set X-Content-Type-Options "nosniff"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

---

## 容器化部署

### Docker部署

#### Dockerfile

```dockerfile
FROM nginx:alpine

# 复制文件
COPY . /usr/share/nginx/html

# 自定义Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf（用于Docker）

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 构建和运行

```bash
# 构建镜像
docker build -t it-tools-html:latest .

# 运行容器
docker run -d -p 8080:80 --name it-tools it-tools-html:latest

# 访问 http://localhost:8080
```

#### Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
    environment:
      - TZ=Asia/Shanghai
```

```bash
docker-compose up -d
```

---

### Kubernetes部署

#### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: it-tools-frontend
  labels:
    app: it-tools
spec:
  replicas: 3
  selector:
    matchLabels:
      app: it-tools
  template:
    metadata:
      labels:
        app: it-tools
    spec:
      containers:
      - name: frontend
        image: it-tools-html:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: it-tools-service
spec:
  selector:
    app: it-tools
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: LoadBalancer
```

```bash
kubectl apply -f deployment.yaml
kubectl get services
```

---

## CI/CD自动部署

### GitHub Actions

#### .github/workflows/deploy.yml

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    # 部署到Netlify
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v2.0
      with:
        publish-dir: '.'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

    # 或部署到服务器
    - name: Deploy to Server
      uses: appleboy/scp-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        source: "."
        target: "/var/www/it-tools"
```

### GitLab CI/CD

#### .gitlab-ci.yml

```yaml
stages:
  - deploy

deploy_production:
  stage: deploy
  only:
    - main
  script:
    - apt-get update -qq && apt-get install -y -qq sshpass
    - sshpass -p "$SERVER_PASSWORD" scp -r -o StrictHostKeyChecking=no ./* $SERVER_USER@$SERVER_HOST:/var/www/it-tools
  environment:
    name: production
    url: https://tools.yourdomain.com
```

---

## 性能优化

### 1. 启用Gzip/Brotli压缩

```nginx
# Nginx Brotli
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### 2. CDN加速

将静态资源推送到CDN：

```javascript
// 在app.js中修改CDN URL
const CDN_BASE = 'https://cdn.yourdomain.com';
```

### 3. HTTP/2

```nginx
server {
    listen 443 ssl http2;
    # ...
}
```

### 4. 预加载关键资源

```html
<link rel="preconnect" href="https://cdn.tailwindcss.com">
<link rel="preload" href="app.js" as="script">
```

---

## 监控和日志

### Nginx访问日志

```nginx
access_log /var/log/nginx/it-tools-access.log combined;
error_log /var/log/nginx/it-tools-error.log;
```

### 集成Google Analytics

```html
<!-- 在index.html的</head>前添加 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 故障排除

### 1. 404错误

确保配置了SPA路由重定向：
```nginx
try_files $uri $uri/ /index.html;
```

### 2. API CORS错误

在API服务器添加CORS头或使用代理。

### 3. 缓存问题

强制刷新: `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)

---

## 安全检查清单

- [ ] 启用HTTPS
- [ ] 配置安全头
- [ ] 禁用目录浏览
- [ ] 设置合理的文件权限
- [ ] 定期更新依赖
- [ ] 配置防火墙
- [ ] 实施速率限制

---

**Last Updated**: 2025-01-07
