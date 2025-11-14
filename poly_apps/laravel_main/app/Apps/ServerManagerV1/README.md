# ServerManagerV1

## 系统概述

ServerManagerV1 是一个服务器管理应用，提供域名管理、SSL 证书管理、Nginx 配置管理等核心功能。系统采用环境感知设计，能够自动适配 WSL 开发环境和生产环境，通过统一的路径映射机制确保跨环境的一致性。

## 设计思路

### 核心设计理念

1. **环境感知架构**
   - 系统能够自动检测运行环境（WSL/Production/Development）
   - 通过 `PathMapper` 统一管理路径映射，实现跨环境透明访问
   - 避免硬编码路径，所有路径通过配置类动态解析

2. **配置与代码分离**
   - 使用 JSON 文件存储配置数据，而非数据库
   - 配置数据存储在环境感知的路径下，自动适配不同环境
   - 支持配置文件的备份和恢复机制

3. **统一路径管理**
   - 所有路径访问通过 `ServerManagerV1PathConfig` 统一管理
   - 路径配置基于 `PathMapper` 实现环境感知
   - 确保路径在不同环境下的一致性

4. **安全优先**
   - 敏感信息（API 密钥、证书等）通过 `GlobalSecretReader` 统一读取
   - 文件访问采用白名单机制，限制可访问的路径范围
   - 命令执行限制在预定义的安全脚本范围内

## 目录结构

### ServerManagerV1CLI
命令行接口层，提供 Artisan 命令封装。

**Commands/**
- `ServerManagerV1BaseCommand`: 基础命令类，提供通用功能
- `ServerManagerV1CertificateCommand`: SSL 证书管理命令
- `ServerManagerV1WebsiteCommand`: 网站管理命令（已集成域名冲突检测）
- `ServerManagerV1DeployCommand`: 部署管理命令
- `ServerManagerV1DeploySelfCommand`: 快速部署本项目命令（poly 类型快捷方式）
- `ServerManagerV1SSLCommand`: SSL 配置管理命令
- `ServerManagerV1SyncCommand`: 双向配置同步命令（nginx ↔ database）
- `ServerManagerV1NginxInspectCommand`: Nginx 配置检查命令（只读，不修改数据库）
- `ServerManagerV1AdvancedCommand`: 高级管理命令（搜索、验证、备份、批量操作等）

**Templates/**
- Nginx 配置模板文件，用于生成不同类型的网站配置

### ServerManagerV1Config
配置管理层，集中管理所有路径和配置常量。

- `ServerManagerV1PathConfig`: 路径配置类，提供环境感知的路径访问方法

### ServerManagerV1Controllers
Web API 控制器层，提供 HTTP 接口。

- `ServerManagerV1BaseCtl`: 基础控制器，提供通用功能和响应格式
- `ServerManagerV1CertificateManagerCtl`: 证书管理 API
- `ServerManagerV1DomainManagerCtl`: 域名管理 API（通过 DomainManager 实现）
- `ServerManagerV1NginxManagerCtl`: Nginx 配置管理 API
- `ServerManagerV1SystemInfoCtl`: 系统信息查询 API
- `ServerManagerV1FileManagerCtl`: 文件管理 API
- `ServerManagerV1CodeExecutorCtl`: 代码执行 API（受限）
- `ServerManagerV1UnifiedManagerCtl`: 统一管理器 API

### ServerManagerV1Utils
工具类层，提供核心业务逻辑。

- `ServerManagerV1DomainManager`: 域名配置管理，使用 JSON 文件存储
- `ServerManagerV1CertificateManager`: 证书管理，支持通配符和子域名扩展
- `ServerManagerV1SSLConfigReader`: SSL 配置读取器，从加密配置中读取
- `ServerManagerV1Utils`: 通用工具方法
- `ServerManagerV1PathResolver`: 路径解析器（已废弃，使用 PathMapper）
- `ServerManagerV1SecretReader`: 密钥读取器（已废弃，使用 GlobalSecretReader）

### ServerManagerV1Gvar
全局变量和常量定义。

- `ServerManagerV1Constants`: 应用常量，包括安全配置、路径白名单等

### ServerManagerV1TablesMaps
数据表映射定义（用于未来可能的数据库迁移）。

## 路径映射机制

### 设计思路

系统通过 `PathMapper` 实现环境感知的路径映射：

1. **基础路径映射**
   - `wwwroot`: Web 根目录
   - `nginxconfig`: Nginx 配置目录
   - `shared-data`: 共享数据目录
   - `backup`: 备份目录
   - `laravel_data_dir`: Laravel 数据目录

2. **环境检测**
   - WSL 环境：检测 `/mnt/c/Users` 目录存在
   - 生产环境：非 WSL 且无桌面环境
   - 开发环境：其他情况

3. **路径解析流程**
   - 首先通过 `PathMapper::getCoreNodeDir()` 获取核心目录
   - 然后通过 `PathMapper::mapWebPath()` 映射具体路径
   - 所有路径访问统一通过 `ServerManagerV1PathConfig` 方法

### 路径配置原则

- 所有路径必须通过配置类访问，禁止硬编码
- 系统路径（如 `/etc/nginx`）使用 `findActualPath()` 动态查找
- 应用路径通过 `mapWebPath()` 映射，确保跨环境一致性

## 配置管理

### 配置文件存储

1. **域名配置**
   - 存储位置：`laravel_data_dir/servermanager/domains/domains.json`
   - 格式：JSON 格式，包含域名、SSL 配置、部署信息等

2. **证书配置**
   - 存储位置：`laravel_data_dir/servermanager/certificates/certificates.json`
   - 格式：JSON 格式，包含证书信息、域名列表、过期时间等

3. **SSL 配置**
   - 存储位置：`.secret_keys/.secret_ignore/` 目录下的加密文件
   - 读取：通过 `GlobalSecretReader` 读取，支持加密文件

### 配置读取流程

1. SSL 配置通过 `ServerManagerV1SSLConfigReader` 读取
2. 域名配置通过 `ServerManagerV1DomainManager` 管理
3. 证书配置通过 `ServerManagerV1CertificateManager` 管理
4. 所有配置支持缓存机制，提高读取效率

## 安全设计

### 文件访问控制

1. **白名单机制**
   - 通过 `ServerManagerV1Constants::getAllowedDownloadPaths()` 定义可访问路径
   - 文件访问前必须验证路径在白名单内
   - 支持环境感知的路径验证

2. **命令执行限制**
   - 仅允许执行预定义的脚本
   - 通过 `ServerManagerV1Constants::SYSTEM_COMMANDS` 定义允许的命令
   - 命令执行前进行参数验证

3. **敏感信息管理**
   - 所有密钥通过 `GlobalSecretReader` 统一读取
   - 支持加密存储，读取时自动处理
   - 密钥文件存储在 `.secret_keys` 目录下

## 扩展性设计

### 新增功能模块

1. **添加新的 CLI 命令**
   - 继承 `ServerManagerV1BaseCommand`
   - 实现具体的业务逻辑
   - 在 `routes/console.php` 中注册命令

2. **添加新的 API 接口**
   - 继承 `ServerManagerV1BaseCtl`
   - 实现标准的响应格式
   - 在 `routes/api.php` 中注册路由

3. **添加新的工具类**
   - 放置在 `ServerManagerV1Utils` 目录
   - 遵循单一职责原则
   - 使用统一的路径配置和错误处理

### 路径扩展

1. **新增路径映射**
   - 在 `PathMapper::mapWebPath()` 中添加新的映射规则
   - 在 `ServerManagerV1PathConfig` 中添加对应的访问方法
   - 更新路径白名单（如需要）

2. **环境适配**
   - 在 `PathMapper` 中添加环境检测逻辑
   - 确保新路径在不同环境下正确映射

## 数据存储策略

### JSON 文件存储

系统采用 JSON 文件而非数据库存储配置，原因：

1. **简化部署**：无需数据库迁移，配置文件可直接备份
2. **版本控制**：配置文件可纳入版本控制
3. **易于调试**：可直接查看和编辑配置文件
4. **性能考虑**：小规模配置数据，文件读取性能足够

### 存储位置

- 所有配置存储在 `laravel_data_dir/servermanager/` 目录下
- 通过 `PathMapper` 确保路径在不同环境下正确解析
- 支持配置文件的自动创建和目录初始化

## 错误处理

### 统一错误响应

1. **API 错误响应**
   - 通过 `ServerManagerV1BaseCtl` 提供统一的错误响应格式
   - 包含错误码、错误消息、详细信息
   - 支持异常捕获和日志记录

2. **CLI 错误处理**
   - 通过 `ServerManagerV1BaseCommand` 提供统一的错误输出
   - 支持详细的错误信息和堆栈跟踪
   - 提供修复建议

### 日志记录

- 所有关键操作记录日志
- 错误信息包含上下文信息
- 支持不同级别的日志输出

## 依赖关系

### 核心依赖

1. **PathMapper**: 路径映射核心类，提供环境感知的路径解析
2. **GlobalSecretReader**: 密钥读取类，统一管理敏感信息
3. **ServerManagerV1PathConfig**: 路径配置类，提供统一的路径访问接口

### 废弃的类

以下类已废弃，不应继续使用：

- `ServerManagerV1PathResolver`: 已由 `PathMapper` 替代
- `ServerManagerV1SecretReader`: 已由 `GlobalSecretReader` 替代

## 开发规范

### 路径访问规范

- 禁止硬编码路径，必须使用 `ServerManagerV1PathConfig` 方法
- 新增路径必须在 `ServerManagerV1PathConfig` 中添加对应方法
- 路径访问前应检查路径是否存在

### 配置访问规范

- 使用对应的 Manager 类访问配置（DomainManager、CertificateManager）
- 配置修改后必须调用保存方法
- 配置读取支持缓存，避免频繁文件操作

### 安全规范

- 文件访问前必须验证路径在白名单内
- 命令执行前必须验证命令在允许列表中
- 敏感信息必须通过 `GlobalSecretReader` 读取

## 命令示例

**更新日期：2025-01-27**

### SSL 证书管理

```bash
# 添加证书（自动生成通配符和子域名证书）
php artisan servermanager:certificate add example.com

# 添加证书并指定子域名前缀
php artisan servermanager:certificate add example.com --prefixes=si,sz,local,api

# 查找证书
php artisan servermanager:certificate find api.example.com

# 列出所有证书
php artisan servermanager:certificate list

# 显示证书摘要
php artisan servermanager:certificate summary

# 更新证书状态
php artisan servermanager:certificate update example.com --status=active
```

### 网站管理

#### 网站类型说明

ServerManagerV1 支持三种网站类型：

- **html**: 静态 HTML 网站
  - 用于部署纯静态内容（HTML、CSS、JS、图片等）
  - 文档根目录：`/www/wwwroot/domain/`
  - 不需要 PHP 支持

- **laravel**: 独立的 Laravel 项目
  - 用于部署一个独立的 Laravel 应用
  - 文档根目录：`/www/wwwroot/domain/public/`
  - 需要完整的 Laravel 项目结构
  - 配置 PHP-FPM 支持

- **poly**: Laravel Main 项目（本项目）
  - 用于将当前的 ServerManagerV1 所在的 Laravel 项目部署为网站
  - 文档根目录：`/www/programing/core_node/poly_apps/laravel_main/public/`
  - 所有 poly 类型的域名共享同一个 Laravel 项目
  - 适合 API 端点、管理后台等场景

#### 基本操作

```bash
# 添加 Laravel 网站（独立项目）
php artisan servermanager:website add example.com --type=laravel

# 添加静态 HTML 网站
php artisan servermanager:website add local.example.com --type=html

# 添加 Poly 应用网站（Laravel Main 项目）
php artisan servermanager:website add api.example.com --type=poly

# 添加网站并指定 PHP 版本
php artisan servermanager:website add example.com --type=laravel --php-version=8.2

# 添加网站并启用 SSL（自动模式）
php artisan servermanager:website add example.com --type=laravel --ssl=auto

# 列出所有网站
php artisan servermanager:website list

# 查看网站状态
php artisan servermanager:website status example.com

# 显示网站摘要
php artisan servermanager:website summary

# 删除网站
php artisan servermanager:website remove example.com
```

### SSL 配置管理

```bash
# 生成 SSL 证书
php artisan servermanager:ssl generate example.com --email=admin@example.com

# 续期特定证书
php artisan servermanager:ssl renew example.com

# 续期所有证书
php artisan servermanager:ssl renew --all

# 列出所有证书
php artisan servermanager:ssl list

# 查看证书状态
php artisan servermanager:ssl status example.com

# 查看 SSL 配置
php artisan servermanager:ssl config
```

### 部署管理

#### 快速部署本项目

```bash
# 快速部署当前 Laravel Main 项目为 nginx 网站
# 这是 --type=poly 的快捷方式
php artisan servermanager:deploy-self api.example.com

# 指定 SSL 模式和 PHP 版本
php artisan servermanager:deploy-self api.example.com --ssl=auto --php-version=8.4

# 预览部署（不实际执行）
php artisan servermanager:deploy-self api.example.com --dry-run

# 部署但不重载 nginx
php artisan servermanager:deploy-self api.example.com --no-reload
```

**说明**：
- `deploy-self` 命令是 `website add --type=poly` 的快捷方式
- 自动将域名指向当前 Laravel 项目的 public 目录
- 所有使用 `deploy-self` 部署的域名共享同一个 Laravel 项目
- 适合部署 API 端点、管理后台等场景

#### 部署其他应用

```bash
# 部署独立的 Laravel 应用（创建新项目目录）
php artisan servermanager:deploy example.com laravel

# 部署 Poly 应用
php artisan servermanager:deploy example.com poly-app

# 部署 Ncore 应用
php artisan servermanager:deploy example.com ncore-app

# 部署静态网站
php artisan servermanager:deploy example.com static

# 部署代理网站
php artisan servermanager:deploy example.com proxy
```

### 配置同步与 Nginx 检查

**更新日期：2025-01-27**

ServerManagerV1 支持双向配置同步和独立的 Nginx 配置检查功能。

#### 双向配置同步

系统支持两个方向的配置同步：

1. **DATABASE → NGINX**：从数据库重新生成所有 nginx 配置（默认行为）
2. **NGINX → DATABASE**：从现有 nginx 配置导入到数据库（新功能）

```bash
# 查看当前同步状态
php artisan servermanager:sync --status

# ========================================
# 方向 1: DATABASE → NGINX（默认）
# ========================================

# 从数据库同步到 nginx（预览模式）
php artisan servermanager:sync --dry-run

# 从数据库同步到 nginx（执行）
php artisan servermanager:sync
# 或明确指定方向
php artisan servermanager:sync --to-nginx

# 此操作会：
# 1. 删除所有现有的 nginx 配置文件（除了 default）
# 2. 根据数据库中的域名配置重新生成 nginx 配置
# 3. 为 nginx_enabled=true 的域名创建启用链接

# ========================================
# 方向 2: NGINX → DATABASE（新功能）
# ========================================

# 从 nginx 导入到数据库（预览模式）
php artisan servermanager:sync --from-nginx --dry-run

# 从 nginx 导入到数据库（合并模式，跳过已存在的域名）
php artisan servermanager:sync --from-nginx

# 从 nginx 导入到数据库（覆盖模式，更新已存在的域名）
php artisan servermanager:sync --from-nginx --overwrite

# 此操作会：
# 1. 扫描 nginx sites-available 目录中的所有配置文件
# 2. 解析每个配置文件，提取域名信息（server_name、root、SSL、PHP版本等）
# 3. 将解析的信息导入到数据库
# 4. 默认使用合并模式（--merge），跳过已存在的域名
# 5. 使用 --overwrite 可以更新已存在的域名配置
```

#### Nginx 配置检查（独立功能）

使用 `servermanager:nginx-inspect` 命令可以检查 nginx 配置而不修改数据库。

```bash
# 查看所有 nginx 配置（表格形式）
php artisan servermanager:nginx-inspect

# 查看摘要信息
php artisan servermanager:nginx-inspect --summary

# 查看详细信息（包含摘要）
php artisan servermanager:nginx-inspect --detailed

# 查看特定域名的详细配置
php artisan servermanager:nginx-inspect local.api.12gm.com

# 按类型过滤
php artisan servermanager:nginx-inspect --type=laravel
php artisan servermanager:nginx-inspect --type=poly
php artisan servermanager:nginx-inspect --type=html

# 按 SSL 状态过滤
php artisan servermanager:nginx-inspect --ssl         # 只显示启用 SSL 的站点
php artisan servermanager:nginx-inspect --no-ssl      # 只显示未启用 SSL 的站点

# 按启用状态过滤
php artisan servermanager:nginx-inspect --enabled     # 只显示已启用的站点
php artisan servermanager:nginx-inspect --disabled    # 只显示已禁用的站点

# 组合过滤
php artisan servermanager:nginx-inspect --type=poly --ssl --enabled

# 输出为 JSON 格式
php artisan servermanager:nginx-inspect --json
php artisan servermanager:nginx-inspect local.api.12gm.com --json
```

#### 典型使用场景

##### 场景 1：从头开始导入现有 nginx 配置

```bash
# 1. 检查当前 nginx 配置
php artisan servermanager:nginx-inspect --summary

# 2. 预览导入结果
php artisan servermanager:sync --from-nginx --dry-run

# 3. 执行导入
php artisan servermanager:sync --from-nginx

# 4. 验证导入结果
php artisan servermanager:website list
```

##### 场景 2：从数据库重建所有 nginx 配置

```bash
# 1. 备份当前配置（可选）
php artisan servermanager:advanced backup

# 2. 查看同步状态
php artisan servermanager:sync --status

# 3. 预览同步操作
php artisan servermanager:sync --dry-run

# 4. 执行同步
php artisan servermanager:sync

# 5. 重载 nginx
sudo systemctl reload nginx
```

##### 场景 3：比对 nginx 和数据库的差异

```bash
# 查看同步状态（显示孤立配置和缺失配置）
php artisan servermanager:sync --status

# 查看 nginx 中的所有配置
php artisan servermanager:nginx-inspect

# 查看数据库中的所有域名
php artisan servermanager:website list
```

#### 配置解析说明

`parseNginxConfig()` 方法可以从 nginx 配置文件中提取以下信息：

- **域名**：从文件名提取
- **server_name**：从 `server_name` 指令提取
- **root**：从 `root` 指令提取文档根目录
- **SSL 状态**：检测 `listen 443 ssl` 指令
- **SSL 证书路径**：提取 `ssl_certificate` 和 `ssl_certificate_key`
- **PHP 版本**：从 `fastcgi_pass unix:/var/run/php/php8.4-fpm.sock` 提取
- **网站类型**：
  - 检测 `try_files $uri $uri/ /index.php` → `laravel`
  - 检测路径包含 `/poly_apps/laravel_main` → `poly`
  - 默认 → `html`
- **监听端口**：从 `listen` 指令提取

#### 注意事项

1. **DATABASE → NGINX 同步会删除所有现有配置**：此操作会清除所有 nginx 配置文件（除了 default 和 ssl-challenges），然后重新生成。建议先使用 `--dry-run` 预览。

2. **NGINX → DATABASE 同步默认使用合并模式**：已存在的域名会被跳过，使用 `--overwrite` 可以更新现有域名。

3. **同步后需要重载 nginx**：配置修改后需要执行 `sudo systemctl reload nginx` 使配置生效。

4. **nginx-inspect 是只读操作**：此命令不会修改任何配置，可以安全地用于检查和诊断。

### 高级管理操作

**更新日期：2025-01-27**

ServerManagerV1 提供高级管理命令 `servermanager:advanced`，支持搜索、验证、备份、批量操作等功能。

#### 域名搜索与查询

```bash
# 搜索所有 Laravel 类型的网站
php artisan servermanager:advanced search --type=laravel

# 搜索启用 SSL 的活跃网站
php artisan servermanager:advanced search --status=active --ssl=true

# 搜索特定 PHP 版本的网站
php artisan servermanager:advanced search --php-version=8.4

# 按关键词搜索（域名或目录）
php artisan servermanager:advanced search --search=example

# 组合搜索
php artisan servermanager:advanced search --type=poly --status=active --ssl=true

# 查看按站点分组的域名（多域名站点）
php artisan servermanager:advanced grouped
```

#### 配置验证

```bash
# 验证所有域名配置
# 检查：目录存在性、nginx配置文件、SSL证书、PHP-FPM socket等
php artisan servermanager:advanced validate
```

#### 备份与恢复

```bash
# 备份所有域名配置
php artisan servermanager:advanced backup

# 列出可用备份（在 restore 时如果不指定文件会自动显示）
php artisan servermanager:advanced restore

# 从备份恢复（替换模式 - 删除所有现有域名）
php artisan servermanager:advanced restore --file=/path/to/backup.json

# 从备份恢复（合并模式 - 保留现有域名）
php artisan servermanager:advanced restore --file=/path/to/backup.json --merge
```

#### 导入与导出

```bash
# 导出为 JSON 格式
php artisan servermanager:advanced export --format=json

# 导出为 CSV 格式
php artisan servermanager:advanced export --format=csv

# 导出为 Nginx 列表格式
php artisan servermanager:advanced export --format=nginx

# 从文件导入（合并模式）
php artisan servermanager:advanced import --file=/path/to/domains.json --format=json --merge

# 从文件导入（替换模式）
php artisan servermanager:advanced import --file=/path/to/domains.json --format=json
```

#### 批量操作

```bash
# 批量启用域名
php artisan servermanager:advanced batch-enable \
    --domains=example.com \
    --domains=test.com \
    --domains=staging.com

# 批量禁用域名（保留文件，移除 nginx 链接）
php artisan servermanager:advanced batch-disable \
    --domains=example.com \
    --domains=test.com \
    --reason="Maintenance"

# 说明：批量禁用后：
#   - nginx 配置文件保留
#   - sites-enabled 中的符号链接被删除
#   - 网站文件完全保留
#   - 域名状态更新为 disabled
```

#### 域名历史记录

```bash
# 查看所有域名操作历史（最近50条）
php artisan servermanager:advanced history

# 查看特定域名的历史
php artisan servermanager:advanced history --search=example.com

# 查看更多历史记录
php artisan servermanager:advanced history --limit=100
```

#### 域名别名与重定向

```bash
# 添加 www 重定向（301 永久重定向）
php artisan servermanager:advanced alias \
    --source=www.example.com \
    --target=example.com \
    --redirect-code=301

# 添加临时重定向（302 临时重定向）
php artisan servermanager:advanced alias \
    --source=old.example.com \
    --target=new.example.com \
    --redirect-code=302

# 说明：
#   - 自动生成 nginx 重定向配置
#   - 支持 HTTP 和 HTTPS 重定向
#   - 如果目标域名启用了 SSL，源域名也会使用相同证书
```

#### 站点模板

```bash
# 查看可用模板
php artisan servermanager:advanced templates

# 可用模板：
#   - laravel_api: Laravel API 应用（API + CORS + 限流）
#   - laravel_full: Laravel 全栈应用（Web + API + Auth）
#   - static_spa: 静态 SPA（Vue/React）
#   - wordpress: WordPress CMS 站点
```

## 扩展功能详解

### 域名冲突检测

`ServerManagerV1WebsiteCommand` 已集成自动冲突检测功能：

```bash
# 添加域名时自动检测冲突
php artisan servermanager:website add example.com --type=laravel

# 如果域名已存在，系统会：
# 1. 显示当前配置信息
# 2. 分析变更影响（是否是站点迁移）
# 3. 检查旧站点是否还有其他域名
# 4. 询问是否继续
```

**冲突检测场景**：

1. **配置更新**（相同目录）：
   - 只更新域名配置
   - 不影响其他域名

2. **站点迁移**（不同目录）：
   - 域名从旧站点迁移到新站点
   - 如果旧站点只有这一个域名，会有警告
   - 旧站点文件会被保留

### 多域名站点管理

多个域名可以指向同一个站点目录：

```bash
# example.com 和 www.example.com 共享同一目录
php artisan servermanager:website add example.com --type=laravel
php artisan servermanager:website add www.example.com --type=laravel

# 查看按站点分组的域名
php artisan servermanager:advanced grouped

# 输出示例：
# 📁 /www/wwwroot/example.com (laravel)
#    Domains: 2
#    ✅ 🔒 example.com
#    ✅ 🔒 www.example.com
```

### 站点启用/禁用

启用和禁用功能通过 `ServerManagerV1DomainManager` 提供：

```php
// 禁用站点（保留文件和配置，仅删除 nginx 启用链接）
ServerManagerV1DomainManager::disableSite('example.com', [
    'reason' => 'Maintenance'
]);

// 重新启用站点（重新生成 nginx 配置和链接）
ServerManagerV1DomainManager::enableSite('example.com');
```

### 配置验证

自动验证所有域名配置的完整性：

- ✅ 检查 www_dir 目录是否存在
- ✅ 检查 nginx 配置文件
- ✅ 检查 sites-enabled 符号链接
- ✅ 检查 SSL 证书文件
- ✅ 检查 PHP-FPM socket

### 数据一致性保障

所有扩展功能遵循以下原则：

1. **路径映射**：使用 `PathMapper::mapWebPath()` 动态解析路径
2. **统一配置**：通过 `ServerManagerV1PathConfig` 访问路径
3. **操作日志**：所有操作记录到 Laravel 日志
4. **历史记录**：关键操作保存到 `history.json`
5. **原子操作**：配置修改采用先验证后保存的方式

### API 接口

所有功能均可通过 `ServerManagerV1DomainManager` 类在代码中调用：

```php
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;

// 域名冲突检测
$conflict = ServerManagerV1DomainManager::checkDomainConflict('example.com');

// 查找站点的所有域名
$domains = ServerManagerV1DomainManager::findSitesByDirectory('/www/wwwroot/example.com');

// 搜索域名
$results = ServerManagerV1DomainManager::searchDomains([
    'type' => 'laravel',
    'status' => 'active',
    'ssl_enabled' => true
]);

// 批量操作
$results = ServerManagerV1DomainManager::batchEnableSites(['domain1.com', 'domain2.com']);
$results = ServerManagerV1DomainManager::batchDisableSites(['domain3.com'], ['reason' => 'Test']);

// 备份与恢复
$backup = ServerManagerV1DomainManager::backupDomains();
$restore = ServerManagerV1DomainManager::restoreDomains('/path/to/backup.json', true);

// 导入导出
$export = ServerManagerV1DomainManager::exportDomains('csv');
$import = ServerManagerV1DomainManager::importDomains('/path/to/file.json', 'json', true);

// 配置验证
$validation = ServerManagerV1DomainManager::validateAllConfigurations();

// 域名历史
$history = ServerManagerV1DomainManager::getHistory('example.com', 50);

// 域名别名
ServerManagerV1DomainManager::addDomainAlias('www.example.com', 'example.com', 301);

// 站点模板
$templates = ServerManagerV1DomainManager::getTemplates();
ServerManagerV1DomainManager::applyTemplate('api.example.com', 'laravel_api');
```

## 未来规划

1. **数据库迁移支持**: 通过 `ServerManagerV1TablesMaps` 定义表结构，支持未来迁移到数据库
2. **配置验证增强**: 添加更严格的配置验证机制
3. **性能优化**: 优化配置读取和缓存机制
4. **监控和告警**: 添加系统监控和告警功能

