# DocumentOffline

一个基于ncore的CLI工具，用于将网页文档离线下载到本地缓存。

## 功能特性

- 🔗 递归下载网页链接
- 🌐 智能同源URL过滤
- 📁 自动UTF-8编码转换
- 💾 本地缓存管理
- 📊 下载进度显示
- ⚙️ 可配置参数

## 安装

```bash
# 安装第三方依赖包
yarn add iconv-lite jsdom

# 或者使用npm
npm install iconv-lite jsdom
```

## Usage

### Basic Usage

```bash
# Install dependencies first
yarn add iconv-lite jsdom

# Start the application
node main.js app=DocumentOffline <url> [depth]

# Examples
node main.js app=DocumentOffline https://example.com 3
node main.js app=DocumentOffline www.baidu.com 2
node main.js app=DocumentOffline https://github.com 1
```

### Parameters

- **url**: The URL to start downloading from (required)
  - Can be with or without protocol (https:// will be added automatically if missing)
  - Examples: `https://example.com`, `www.baidu.com`, `github.com`
- **depth**: Recursion depth (optional, default: 3)
  - How many levels deep to follow links
  - Range: 1-10 (recommended)

### Examples

```bash
# Download a single page
node main.js app=DocumentOffline https://example.com 1

# Download with 3 levels of recursion (default)
node main.js app=DocumentOffline https://example.com

# Download with custom depth
node main.js app=DocumentOffline https://example.com 5

# Download from domain without protocol
node main.js app=DocumentOffline www.baidu.com 2
```

## 项目结构

```
DocumentOffline/
├── main.js                 # 应用入口
├── package.json            # 项目配置
├── README.md              # 项目文档
├── controller/            # 控制器目录
│   ├── main.js           # 主控制器
│   ├── download_manager.js # 下载管理器
│   ├── url_processor.js   # URL处理器
│   ├── file_manager.js    # 文件管理器
│   ├── http_downloader.js # HTTP下载器
│   ├── html_parser.js     # HTML解析器
│   └── config_manager.js  # 配置管理器
├── config/               # 配置目录
│   └── config.json       # 配置文件
├── utils/                # 工具目录
│   ├── logger.js         # 日志工具
│   └── progress.js       # 进度显示
├── cache/                # 缓存目录（自动创建）
└── logs/                 # 日志目录（自动创建）
```

## 配置说明

配置文件位于 `config/config.json`，包含以下设置：

### 下载配置
- `timeout`: 请求超时时间（毫秒）
- `maxRetries`: 最大重试次数
- `maxRedirects`: 最大重定向次数
- `userAgent`: 用户代理字符串
- `delay`: 请求间隔延迟（毫秒）

### 解析配置
- `ignoredExtensions`: 忽略的文件扩展名
- `maxLinksPerPage`: 每页最大链接数

### 文件配置
- `cacheDir`: 缓存目录
- `maxFileSize`: 最大文件大小（字节）
- `encoding`: 文件编码

### 限制配置
- `maxDepth`: 最大递归深度
- `maxPages`: 最大页面数
- `maxConcurrent`: 最大并发数

## 开发计划

### 第一阶段：基础功能 ✅
- [x] CLI参数解析
- [x] HTTP下载器
- [x] URL处理器
- [x] 文件管理器
- [x] HTML解析器
- [x] 配置管理

### 第二阶段：增强功能 🔄
- [ ] 并发下载支持
- [ ] 断点续传
- [ ] 压缩文件支持
- [ ] 更多文件格式支持
- [ ] 下载历史记录

### 第三阶段：高级功能 📋
- [ ] Web界面
- [ ] 搜索功能
- [ ] 导出功能
- [ ] 插件系统
- [ ] 性能优化

## 技术栈

- Node.js
- iconv-lite (编码转换)
- jsdom (HTML解析)
- 原生HTTP/HTTPS模块

## 许可证

MIT License 
