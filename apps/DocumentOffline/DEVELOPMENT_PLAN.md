<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# DocumentOffline 开发计划

## 项目概述

DocumentOffline是一个基于ncore的CLI工具，用于将网页文档离线下载到本地缓存。该工具能够递归抓取同源URL，自动处理编码转换，并提供灵活的配置选项。

## 核心功能需求

### 1. CLI接口
- ✅ 接受URL参数作为输入
- ✅ 支持可选的递归深度参数（默认3层）
- ✅ 提供使用说明和错误处理

### 2. 网络下载
- ✅ HTTP/HTTPS支持
- ✅ 自动重定向处理
- ✅ 超时和重试机制
- ✅ 用户代理模拟

### 3. URL处理
- ✅ URL解析和验证
- ✅ 同源URL过滤
- ✅ 相对URL解析
- ✅ 文件名生成

### 4. 文件管理
- ✅ 自动创建缓存目录
- ✅ UTF-8编码转换
- ✅ 多编码格式支持
- ✅ 文件大小限制

### 5. HTML解析
- ✅ 链接提取
- ✅ 多种标签支持（a, link, script, img）
- ✅ 无效链接过滤
- ✅ 文件扩展名过滤

## 技术架构

### 模块设计

```
DocumentOffline/
├── main.js                    # 应用入口点
├── controller/                # 业务逻辑层
│   ├── main.js              # 主控制器
│   ├── download_manager.js   # 下载流程管理
│   ├── url_processor.js     # URL处理逻辑
│   ├── file_manager.js      # 文件操作
│   ├── http_downloader.js   # 网络请求
│   ├── html_parser.js       # HTML解析
│   └── config_manager.js    # 配置管理
├── utils/                    # 工具类
│   ├── logger.js            # 日志记录
│   └── progress.js          # 进度显示
└── config/                  # 配置文件
    └── config.json          # 应用配置
```

### 数据流

1. **输入处理**: CLI参数解析 → URL验证
2. **下载流程**: HTTP请求 → 内容获取 → 编码检测
3. **文件处理**: 编码转换 → 文件保存 → 缓存管理
4. **链接提取**: HTML解析 → 链接过滤 → 递归下载

## 开发阶段

### 第一阶段：基础功能实现 ✅

#### 已完成功能
- [x] 项目结构搭建
- [x] CLI参数处理
- [x] HTTP下载器实现
- [x] URL处理器
- [x] 文件管理器
- [x] HTML解析器
- [x] 配置管理系统
- [x] 日志和进度显示

#### 核心类实现
1. **DownloadManager**: 协调整个下载流程
2. **UrlProcessor**: 处理URL解析和域名比较
3. **FileManager**: 管理文件保存和编码转换
4. **HttpDownloader**: 处理网络请求
5. **HtmlParser**: 解析HTML并提取链接
6. **ConfigManager**: 管理应用配置

### 第二阶段：功能增强 🔄

#### 计划功能
- [ ] **并发下载支持**
  - 实现并发控制
  - 添加下载队列
  - 优化性能

- [ ] **断点续传**
  - 保存下载状态
  - 支持中断恢复
  - 增量下载

- [ ] **更多文件格式支持**
  - PDF文档处理
  - 图片文件下载
  - 压缩文件解压

- [ ] **下载历史记录**
  - 记录下载历史
  - 支持重复下载检测
  - 下载统计信息

### 第三阶段：高级功能 📋

#### 计划功能
- [ ] **Web界面**
  - 基于Express的Web服务
  - 可视化下载管理
  - 实时进度显示

- [ ] **搜索功能**
  - 本地文件搜索
  - 全文检索
  - 标签系统

- [ ] **导出功能**
  - 导出为PDF
  - 导出为EPUB
  - 导出为Markdown

- [ ] **插件系统**
  - 自定义解析器
  - 自定义下载器
  - 扩展点机制

## 技术实现细节

### 编码处理
```javascript
// 支持多种编码格式
const encodings = ['utf8', 'gbk', 'gb2312', 'big5', 'shift_jis', 'euc-jp', 'iso-8859-1'];
```

### URL过滤
```javascript
// 同源URL检测
const isSameDomain = (url1, url2) => {
  const domain1 = new URL(url1).hostname;
  const domain2 = new URL(url2).hostname;
  return domain1 === domain2;
};
```

### 文件命名
```javascript
// 安全的文件名生成
const safeFilename = (url) => {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}${parsed.pathname.replace(/[^a-zA-Z0-9./_-]/g, '_')}`;
};
```

## 性能优化策略

### 1. 内存管理
- 使用流式处理大文件
- 及时释放不需要的对象
- 限制并发下载数量

### 2. 网络优化
- 实现连接池
- 添加请求缓存
- 智能重试机制

### 3. 存储优化
- 文件去重
- 压缩存储
- 索引优化

## 测试策略

### 单元测试
- [ ] URL处理器测试
- [ ] 文件管理器测试
- [ ] HTML解析器测试
- [ ] 配置管理器测试

### 集成测试
- [ ] 完整下载流程测试
- [ ] 错误处理测试
- [ ] 性能测试

### 端到端测试
- [ ] CLI功能测试
- [ ] 多网站兼容性测试
- [ ] 编码转换测试

## 部署和发布

### 开发环境
```bash
npm install
npm start
```

### 生产环境
```bash
npm install --production
node main.js <url> [depth]
```

### Docker支持
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "main.js"]
```

## 维护计划

### 日常维护
- 监控错误日志
- 更新依赖包
- 性能监控

### 版本更新
- 功能增强
- 安全补丁
- 兼容性改进

### 用户反馈
- 问题跟踪
- 功能请求
- 文档更新

## 总结

DocumentOffline项目已经完成了基础功能的实现，具备了核心的文档离线下载能力。项目采用模块化设计，具有良好的可扩展性和维护性。后续开发将专注于性能优化和功能增强，为用户提供更好的使用体验。 