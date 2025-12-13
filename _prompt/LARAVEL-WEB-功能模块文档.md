# Laravel API Debug Interface - 功能模块文档

## 概述

Laravel API Debug Interface 是一个综合性的开发调试平台，提供多个功能模块用于 API 测试、系统管理、代码浏览和资源管理。

访问地址：`http://192.168.50.2:9000/#`

---

## 1. 🚀 API Testing Dashboard（API 测试仪表板）

### 功能描述
在浏览器中直接测试 Laravel API，无需 Postman 等外部工具。

### 核心功能

#### 1.1 应用选择
- **位置**：顶部下拉菜单
- **选项**：
  - AChatV1
  - AppQyV1
  - AwyV0
  - BankV1
  - ItToolsV1
  - McpV1
  - ServerManagerV1
  - Common（通用 API）
- **行为**：选择后自动加载该应用的 API 列表

#### 1.2 API 搜索
- **功能**：快速定位 API
- **搜索方式**：
  - API 编号（如 "1"）
  - 路径（如 "initialize"）
  - 描述关键词
- **特性**：自动高亮匹配项并滚动到对应位置

#### 1.3 共享请求头管理
- **作用域**：每个应用独立配置
- **支持的请求头**：
  - `Authorization`：Bearer token 认证
  - `Content-Type`：请求内容类型
  - `Accept`：响应内容类型
  - `Client-Token`：客户端标识令牌
  - `Auth-User-Token`：用户认证令牌
- **操作**：
  - 保存所有请求头（自动缓存）
  - 重置为默认值
  - 复制请求头 JSON

#### 1.4 API 列表展示
每个 API 卡片显示：
- **编号**：#1, #2, #3...
- **HTTP 方法**：POST、GET、PUT、DELETE
- **端点路径**：完整 API 路径
- **简短描述**：API 功能说明
- **展开/折叠**：点击查看详细信息

#### 1.5 API 详情面板
展开后包含：

**基本信息**：
- 认证要求（Required/Optional）
- HTTP 方法
- 功能描述
- 控制器名称

**参数信息**：
- 参数列表（类型、必填/可选、示例值）
- 参数格式说明

**响应信息**：
- 响应字段列表
- 响应格式说明

**交互功能**：
- **API Endpoint URL**：可编辑的端点地址
- **Request Parameters (JSON)**：JSON 参数输入框（预填充示例）
- **操作按钮**：
  - `Send Request`：发送请求并显示响应
  - `Save Params`：保存参数到本地存储
  - `Load Params`：从本地存储加载参数
  - `Copy Headers`：复制请求头到剪贴板
- **Response Area**：显示 API 响应结果

#### 1.6 工作流程
1. 选择目标应用
2. 配置共享请求头（如 Authorization token）
3. 使用搜索快速定位 API 或直接浏览列表
4. 展开目标 API 查看详情
5. 编辑请求参数（JSON 格式）
6. 点击 "Send Request" 发送请求
7. 在响应区域查看结果
8. 可选：保存参数供后续使用

#### 1.7 数据持久化
- **存储位置**：浏览器 LocalStorage
- **存储内容**：
  - 每个 API 的参数配置
  - 应用的共享请求头
- **特性**：支持跨会话恢复，刷新页面后数据保留

---

## 2. 🛠️ Development Tools（开发工具）

### 功能描述
提供丰富的在线开发工具集合，涵盖文本处理、编码转换、加密解密、格式化等多种实用工具。

### 工具分类

#### 2.1 📋 Online Clipboard（在线剪贴板）
- **功能**：跨设备剪贴板同步
- **工具**：
  - Online Clipboard

#### 2.2 🤖 AI Tools（AI 工具）
- **功能**：AI 辅助工具
- **工具**：
  - AI Translation（AI 翻译）

#### 2.3 🖼️ Image Tools（图片工具）
- **功能**：图片处理和转换
- **工具**：
  - Image Converter（图片格式转换）
  - Image Compressor（图片压缩）
  - Image Resizer（图片尺寸调整）
  - Image Cropper（图片裁剪）
  - Image Rotator/Flipper（图片旋转/翻转）
  - Color Picker from Image（从图片提取颜色）

#### 2.4 📄 PDF & Document Tools（PDF 和文档工具）
- **功能**：PDF 文件处理
- **工具**：
  - PDF Merger（PDF 合并）
  - PDF Splitter（PDF 分割）
  - PDF Compressor（PDF 压缩）
  - PDF Password Protector（PDF 密码保护）
  - Unlock PDF（PDF 解锁）
  - PDF Watermark（PDF 水印）
  - PDF Page Rotator（PDF 页面旋转）
  - PDF to JPG/PNG（PDF 转图片）
  - Image to PDF（图片转 PDF）

#### 2.5 🧮 Calculator Tools（计算器工具）
- **功能**：各种计算工具
- **工具**：
  - Age Calculator（年龄计算器）
  - BMI Calculator（BMI 计算器）
  - Loan EMI Calculator（贷款月供计算器）
  - GST Calculator（GST 计算器）
  - Percentage Calculator（百分比计算器）
  - Number to Words（数字转文字）
  - Unit Converter（单位转换器）
  - Currency Converter（货币转换器）

#### 2.6 🎨 Color Tools（颜色工具）
- **功能**：颜色相关工具
- **工具**：
  - HEX to RGB Converter（HEX 转 RGB）
  - Gradient Generator（渐变生成器）
  - Contrast Checker（对比度检查器）
  - Palette Generator（调色板生成器）
  - Color Blindness Simulator（色盲模拟器）

#### 2.7 ✍️ Text Tools Advanced（高级文本工具）
- **功能**：文本处理和 SEO 工具
- **工具**：
  - Remove Duplicate Lines（移除重复行）
  - Text Sorter（文本排序）
  - Text Reverser（文本反转）
  - Word Counter (SEO)（SEO 字数统计）
  - Keyword Density Checker（关键词密度检查）
  - Text Encryptor/Decryptor（文本加密/解密）

#### 2.8 📈 SEO & Marketing（SEO 和营销工具）
- **功能**：SEO 分析工具
- **工具**：
  - Meta Tag Analyzer（Meta 标签分析器）
  - Keyword Density Checker（关键词密度检查器）
  - Word Counter (Blog)（博客字数统计）

#### 2.9 🔧 Utility Tools（实用工具）
- **功能**：日常实用工具
- **工具**：
  - QR Code Scanner（二维码扫描器）
  - Barcode Generator（条形码生成器）
  - Time Zone Converter（时区转换器）
  - Password Generator（密码生成器）
  - Password Strength Checker（密码强度检查器）

#### 2.10 🔐 Crypto & Security（加密和安全工具）
- **功能**：加密和安全相关工具
- **工具**：
  - Token Generator（令牌生成器）
  - Hash Generator（哈希生成器）
  - Bcrypt Hash/Verify（Bcrypt 哈希/验证）
  - UUID Generator（UUID 生成器）
  - ULID Generator（ULID 生成器）
  - HMAC Generator（HMAC 生成器）
  - Password Strength Analyzer（密码强度分析器）
  - Basic Auth Generator（Basic 认证生成器）
  - BIP39 Passphrase（BIP39 助记词）
  - RSA Key Pair（RSA 密钥对生成器）

#### 2.11 🔄 Converters（转换器）
- **功能**：各种格式转换
- **工具**：
  - Base64 Encoder/Decoder（Base64 编码/解码）
  - URL Encoder/Decoder（URL 编码/解码）
  - HTML Entities Encoder（HTML 实体编码）
  - Case Converter（大小写转换）
  - Color Converter（颜色格式转换）
  - Timestamp Converter（时间戳转换）
  - Integer Base Converter（整数进制转换）
  - Roman Numeral Converter（罗马数字转换）
  - Text to NATO Alphabet（文本转 NATO 字母）
  - Text to ASCII Binary（文本转 ASCII 二进制）
  - JSON ⇄ YAML（JSON 与 YAML 互转）
  - JSON ⇄ XML（JSON 与 XML 互转）
  - Markdown to HTML（Markdown 转 HTML）

#### 2.12 📝 Text Tools（文本工具）
- **功能**：基础文本处理
- **工具**：
  - Text Diff（文本差异对比）
  - Text Statistics（文本统计）
  - Lorem Ipsum Generator（Lorem Ipsum 生成器）
  - Slugify String（字符串 Slug 化）
  - Emoji Picker（表情符号选择器）
  - String Obfuscator（字符串混淆器）
  - Numeronym Generator（数字缩写生成器）
  - ASCII Art Generator（ASCII 艺术生成器）

#### 2.13 ✨ Formatters（格式化工具）
- **功能**：代码和文本格式化
- **工具**：
  - JSON Formatter（JSON 格式化）
  - XML Formatter（XML 格式化）
  - YAML Formatter（YAML 格式化）
  - SQL Formatter（SQL 格式化）
  - HTML Formatter（HTML 格式化）
  - CSS Formatter（CSS 格式化）

#### 2.14 🌐 Web Tools（Web 工具）
- **功能**：Web 开发相关工具
- **工具**：
  - URL Parser（URL 解析器）
  - Query String Parser（查询字符串解析器）
  - JWT Parser（JWT 解析器）
  - User Agent Parser（User Agent 解析器）
  - HTTP Status Codes（HTTP 状态码参考）
  - MIME Types（MIME 类型参考）
  - Device Information（设备信息）
  - Keycode Info（按键码信息）

#### 2.15 🎲 Generators（生成器）
- **功能**：各种内容生成工具
- **工具**：
  - QR Code Generator（二维码生成器）
  - WiFi QR Code（WiFi 二维码）
  - SVG Placeholder（SVG 占位符）
  - Random Port（随机端口）
  - Crontab Generator（Crontab 生成器）
  - Open Graph Meta（Open Graph Meta 标签生成器）
  - OTP Code Generator（OTP 验证码生成器）

#### 2.16 🔢 Math & Calc（数学和计算工具）
- **功能**：数学计算工具
- **工具**：
  - Math Evaluator（数学表达式计算器）
  - Percentage Calculator（百分比计算器）
  - ETA Calculator（预计到达时间计算器）
  - Temperature Converter（温度转换器）
  - Unit Converter（单位转换器）

#### 2.17 🌍 Network Tools（网络工具）
- **功能**：网络相关工具
- **工具**：
  - IPv4 Subnet Calculator（IPv4 子网计算器）
  - IPv4 Converter（IPv4 转换器）
  - IPv6 ULA Generator（IPv6 ULA 生成器）
  - MAC Address Lookup（MAC 地址查询）
  - MAC Generator（MAC 地址生成器）

#### 2.18 💻 Development（开发工具）
- **功能**：开发辅助工具
- **工具**：
  - Regex Tester（正则表达式测试器）
  - Regex Cheatsheet（正则表达式速查表）
  - Git Cheatsheet（Git 速查表）
  - Chmod Calculator（Chmod 权限计算器）
  - Docker Run → Compose（Docker 命令转 Compose）
  - JSON Diff（JSON 差异对比）
  - JSON to CSV（JSON 转 CSV）

#### 2.19 📊 Data Tools（数据工具）
- **功能**：数据处理工具
- **工具**：
  - Phone Parser（电话号码解析器）
  - IBAN Validator（IBAN 验证器）
  - Email Normalizer（邮箱标准化器）

### 界面特性
- **顶部菜单**：Tools、Favorites、Recent 三个标签
- **搜索功能**：快速搜索工具
- **左侧菜单**：分类导航，可折叠/展开
- **主内容区**：工具操作界面
- **右侧面板**：工具信息说明（可切换）
- **历史记录**：显示最近使用的工具
- **收藏功能**：收藏常用工具

---

## 3. 📊 System Information（系统信息）

### 功能描述
显示完整的系统信息，包括 Laravel 配置、数据库信息、系统资源使用情况等。

### 显示内容

#### 3.1 核心信息
- **PHP 版本**：8.4.15
- **Laravel 版本**：12.38.1
- **环境**：local
- **调试模式**：Enabled
- **时区**：UTC

#### 3.2 Laravel 配置摘要
- **应用模式**：Headless API（保留 Web 路由用于调试）
- **数据库连接**：
  - 默认连接：sqlite
  - 已配置连接数：15
  - 连接列表：sqlite, mysql, mariadb, pgsql, sqlsrv, AppQyV1, AwyV0, VipClubV1, ServerManagerV1, AChatV1, CodeMartV1, McpV1, ItToolsV1, BankV1
- **外部存储路径**：
  - public_path_external：项目目录外配置，便于部署灵活性
  - storage_path_external：项目目录外配置，共享存储
  - uploads_path：用户上传和媒体文件外部路径
  - temp_path：外部临时文件处理位置
- **驱动配置**：
  - Cache Driver：database
  - Session Driver：file
  - Queue Driver：database
  - Mail Driver：log
- **日志通道**：
  - 默认通道：syslog
  - 已配置通道：stack, single, daily, slack, papertrail, stderr, syslog, errorlog, null, emergency
  - 总通道数：10
- **路由文件**：
  - 主路由文件：ai.php, api.php, api_ocr.php, console.php, settings.php, web.php
  - 应用特定路由目录：AppQyV1Router/, AwyV0Router/, BankV1Router/, CodeMartV1Router/, ItToolsV1Router/, McpV1Router/, ServerManagerV1Router/, VipClubV1Router/
  - 总路由文件数：6
  - 总应用路由目录数：8

#### 3.3 应用概览
- **总应用数**：7
- **所有应用 API 总数**：174
- **应用列表**：
  - AChatV1：0 个 API，状态：active
  - AppQyV1：63 个 API，状态：active
  - AwyV0：24 个 API，状态：active
  - BankV1：16 个 API，状态：active
  - ItToolsV1：8 个 API，状态：active
  - McpV1：39 个 API，状态：active
  - ServerManagerV1：24 个 API，状态：active

#### 3.4 PHP 配置
- **内存限制**：512M
- **最大执行时间**：0s（无限制）
- **上传文件大小限制**：64M
- **POST 数据大小限制**：64M
- **错误显示**：On
- **命令执行**：已启用

#### 3.5 数据库信息
- **状态**：已连接
- **连接驱动**：sqlite
- **数据库名称**：/www/wwwroot/laravel_db/database.sqlite
- **数据库版本**：3.45.1

#### 3.6 系统资源
- **CPU 使用率**：
  - 1 分钟：1.6494140625%
  - 5 分钟：1.71728515625%
  - 15 分钟：1.705078125%
- **内存使用**：2.64 GB / 7.5 GB (35.13%)
- **磁盘使用**：139.32 GB / 467.35 GB (29.81%)
- **负载平均值**：1.6494140625, 1.71728515625, 1.705078125

#### 3.7 系统信息
- **操作系统**：Linux
- **架构**：x86_64
- **服务器软件**：Unknown
- **服务器 IP**：Unknown

#### 3.8 外部工具
- **Git**：git version 2.43.0
- **Node**：v24.11.1
- **Python**：Python 3.12.3
- **Go**：未安装
- **Curl**：curl 8.5.0
- **7z**：7-Zip 23.01
- **FFmpeg**：ffmpeg version 6.1.1-3ubuntu5

#### 3.9 API 参考信息
显示所有应用的详细 API 信息，包括：
- 应用名称和版本
- 基础 URL 和 API 前缀
- 端点列表（路径、方法、功能、参数、响应）
- 支持的请求头
- 认证方式

---

## 4. 📚 Vocabulary Learning（词汇学习）

### 功能描述
词汇学习系统相关功能（基于 AppQyV1 应用）。

### 主要功能
- 用户注册/登录
- 系统初始化
- 词汇库管理
- 学习进度跟踪
- 词汇卡片学习
- 文档上传和词汇提取
- 翻译工具集成
- TTS（文本转语音）功能

### API 端点示例
- `/api/dict/v1/register`：用户注册
- `/api/dict/v1/login`：用户登录
- `/api/dict/v1/system/initialize`：系统初始化
- `/api/dict/v1/learning/words`：获取学习词汇
- `/api/dict/v1/learning/progress`：更新学习进度
- `/api/dict/v1/learning/upload`：上传文档提取词汇

---

## 5. 💻 Code Browser（代码浏览器）

### 功能描述
在线代码浏览和编辑工具，支持文件管理、代码编辑、任务/提示管理。

### 核心功能

#### 5.1 文件树面板
- **根目录**：core_node
- **功能**：
  - 浏览项目文件结构
  - 文件/文件夹操作
  - 刷新文件树
- **操作**：
  - 右键菜单支持：
    - 复制相对路径
    - 复制绝对路径
    - 重命名
    - 自动重命名为英文
    - 翻译中文行
    - 删除
    - 恢复

#### 5.2 代码编辑器
- **功能**：
  - 查看和编辑代码文件
  - 语法高亮
  - 文件保存
- **操作**：
  - 选择文件自动加载内容
  - 编辑后保存
  - 关闭文件

#### 5.3 任务/提示管理面板
- **功能**：管理开发任务和提示词
- **分类**：
  - Global（全局）
  - MCP Development（MCP 开发）
  - NCORE Development（NCORE 开发）
  - PYCORE Development（PYCORE 开发）
  - Laravel Main（Laravel 主应用）
  - NUXT Development（NUXT 开发）
- **操作**：
  - 新建任务
  - 刷新列表
  - 按分类查看

#### 5.4 提示映射面板
- **功能**：管理提示词映射关系

### 认证要求
- **访问限制**：需要登录才能使用
- **登录提示**：未登录时显示登录按钮

---

## 6. 🎬 Static Resources（静态资源管理）

### 功能描述
静态资源（媒体文件）浏览器和管理工具，支持图片、视频、音频、文本文件的预览和管理。

### 核心功能

#### 6.1 文件列表面板
- **功能**：
  - 浏览静态资源目录结构
  - 文件/文件夹导航
  - 显示当前目录路径
- **操作按钮**：
  - 📁+：新建文件夹
  - 🔄：刷新列表
  - 📤：上传文件/文件夹
- **特性**：
  - 支持递归上传整个文件夹
  - 可折叠/展开文件夹

#### 6.2 文件预览面板
- **支持的文件类型**：
  - 图片（JPG, PNG, GIF, WebP 等）
  - 视频（MP4, AVI, MOV 等）
  - 音频（MP3, WAV, OGG 等）
  - 文本文件（TXT, MD, JSON 等）
- **视频播放功能**：
  - 自动播放下一集
  - 跳过片头设置（秒数）
  - 播放列表管理
  - 播放列表计数显示
  - 左右浮动按钮（上一集/下一集）
- **文件信息显示**：
  - 文件名
  - 文件元数据（大小、类型等）

#### 6.3 文件排序
- **排序规则**：按以下关键字升序排序
  - 中文数字：第一、一、二、三...
  - 阿拉伯数字：1, 2, 3...
  - 英文格式：lesson_1, lesson_2...
- **作用范围**：同一目录下的资源

#### 6.4 文件操作
- **右键菜单**：
  - 📂 Enter this folder：进入文件夹
  - ⬇️ Expand all subfolders：展开所有子文件夹
  - ⬆️ Collapse all subfolders：折叠所有子文件夹
  - 📤 Upload to this folder：上传到此文件夹
  - 🌐 Rename to English：重命名为英文
  - 🗑️ Delete：删除文件/文件夹

#### 6.5 上传功能
- **上传对话框**：
  - 拖拽上传支持
  - 点击浏览文件
  - 支持多文件选择
  - 支持文件夹递归上传
  - 显示目标路径
  - 显示上传文件列表
- **上传方式**：
  - 单文件上传
  - 多文件上传
  - 文件夹递归上传（保留目录结构）

#### 6.6 删除功能
- **删除确认对话框**：
  - 显示删除摘要
  - 安全确认：需要输入"确认"才能删除
  - 显示待删除文件列表

#### 6.7 创建文件夹
- **创建对话框**：
  - 输入文件夹名称
  - 自动翻译为英文选项
  - 显示父目录路径

### 界面特性
- **响应式设计**：支持移动端和桌面端
- **文件列表可折叠**：节省屏幕空间
- **视频播放列表**：底部可展开/折叠
- **浮动控制按钮**：视频播放时的导航按钮

---

## 7. 📸 MCP Manager（MCP 管理器）

### 功能描述
管理 MCP（Model Context Protocol）功能和资源。

### 功能模块
- **菜单系统**：左侧菜单导航
- **内容区域**：动态加载 MCP 相关内容
- **资源管理**：管理 MCP 相关资源

### 相关 API（McpV1 应用）
- OCR 识别相关 API
- 截图上传和管理 API
- 任务分发队列 API
- 占位符图片生成 API

---

## 通用功能

### 用户认证
- **登录/注册**：模态对话框
- **登录方式**：用户名/密码
- **注册要求**：需要邀请码
- **会话管理**：登录状态持久化

### 界面布局
- **侧边栏**：可折叠/展开
- **主内容区**：动态加载不同模块
- **响应式设计**：适配不同屏幕尺寸
- **移动端支持**：移动设备优化

### 数据存储
- **LocalStorage**：浏览器本地存储
- **存储内容**：
  - API 测试参数
  - 请求头配置
  - 工具使用历史
  - 用户偏好设置

---

## 技术栈

- **后端**：Laravel 12.38.1
- **PHP 版本**：8.4.15
- **前端**：原生 JavaScript + HTML/CSS
- **数据库**：SQLite（多数据库连接支持）
- **认证**：Laravel Sanctum

---

## 使用建议

1. **API 测试**：使用 API Testing Dashboard 进行快速 API 调试
2. **工具使用**：Development Tools 提供丰富的在线工具，无需安装额外软件
3. **系统监控**：System Information 查看系统状态和配置
4. **代码管理**：Code Browser 在线浏览和编辑代码
5. **资源管理**：Static Resources 管理媒体文件，支持批量操作

---

## 注意事项

1. **认证要求**：部分功能（如 Code Browser）需要登录
2. **数据持久化**：使用浏览器 LocalStorage，清除浏览器数据会丢失配置
3. **文件上传**：Static Resources 支持大文件上传，注意网络稳定性
4. **API 测试**：确保后端服务正常运行
5. **系统信息**：System Information 显示实时系统状态，数据会定期更新

