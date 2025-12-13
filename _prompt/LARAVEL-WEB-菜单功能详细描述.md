# Laravel API Debug Interface - 菜单功能详细描述

访问地址：`http://192.168.50.2:9000/#`

---

## 🚀 API Testing Dashboard（API 测试仪表板）

### 功能概述
API Testing Dashboard 是一个功能完整的 API 测试工具，允许开发者在浏览器中直接测试所有 Laravel 应用的 API 端点，无需使用 Postman、Insomnia 等外部工具。

### 详细功能说明

#### 1. 应用选择器
- **位置**：页面顶部下拉选择框
- **支持的应用**：
  - **AChatV1**：聊天应用 API（0 个端点）
  - **AppQyV1**：词汇学习系统（63 个端点）
  - **AwyV0**：社交应用 API（24 个端点）
  - **BankV1**：银行应用 API（16 个端点）
  - **ItToolsV1**：IT 工具 API（8 个端点）
  - **McpV1**：MCP 桥接应用（39 个端点）
  - **ServerManagerV1**：服务器管理 API（24 个端点）
  - **Common**：通用 API（12 个端点）
- **功能**：
  - 选择应用后自动加载该应用的所有 API 端点
  - 每个应用的 API 列表独立显示
  - 支持快速切换不同应用进行测试

#### 2. API 搜索功能
- **搜索框位置**：应用选择器下方
- **搜索方式**：
  - **按编号搜索**：输入 "1" 可定位到 #1 API
  - **按路径搜索**：输入 "initialize" 可找到包含该路径的 API
  - **按描述搜索**：输入关键词如 "login"、"register" 可找到相关 API
- **搜索特性**：
  - 实时搜索，输入即显示结果
  - 自动高亮匹配的 API 卡片
  - 自动滚动到匹配的 API 位置
  - 支持模糊匹配

#### 3. 共享请求头管理
- **功能说明**：为每个应用配置全局请求头，所有 API 请求都会自动携带这些请求头
- **配置位置**：每个 API 卡片上方或独立的请求头配置区域
- **支持的请求头类型**：
  - **Authorization**：Bearer token 认证
    - 格式：`Bearer {token}`
    - 用途：用户身份认证
  - **Content-Type**：请求内容类型
    - 默认值：`application/json`
  - **Accept**：响应内容类型
    - 默认值：`application/json`
  - **Client-Token**：客户端标识令牌
    - 用途：客户端应用识别
  - **Auth-User-Token**：用户认证令牌
    - 用途：用户级别的认证
  - **X-Requested-With**：请求标识
    - 默认值：`XMLHttpRequest`
- **操作功能**：
  - **保存请求头**：点击保存按钮，所有请求头配置保存到浏览器 LocalStorage
  - **重置请求头**：一键恢复默认值
  - **复制请求头 JSON**：复制所有请求头配置为 JSON 格式，方便在其他工具中使用
  - **自动加载**：页面刷新后自动恢复上次保存的请求头配置

#### 4. API 列表展示
- **显示格式**：每个 API 以卡片形式展示
- **卡片信息**：
  - **API 编号**：如 #1, #2, #3...（用于快速定位）
  - **HTTP 方法**：POST、GET、PUT、DELETE、ANY
  - **端点路径**：完整的 API 路径
  - **简短描述**：API 功能的一句话描述
  - **展开/折叠按钮**：点击查看详细信息
- **列表特性**：
  - 按编号顺序排列
  - 支持展开/折叠查看详情
  - 响应式设计，适配不同屏幕

#### 5. API 详情面板
展开 API 卡片后显示详细信息：

**基本信息区域**：
- **认证要求**：
  - Required：需要认证
  - Optional：可选认证
  - No Auth Required：无需认证
- **HTTP 方法**：POST、GET、PUT、DELETE 等
- **功能描述**：详细的 API 功能说明
- **控制器名称**：处理该 API 的控制器类名 

**参数信息区域**：
- **参数列表**：
  - 参数名称
  - 参数类型（string、int、boolean、array、object 等）
  - 是否必填（required/optional）
  - 示例值
  - 参数说明
- **参数格式**：
  - 路径参数（route_params）
  - 查询参数（query_params）
  - 请求体参数（body_params）
  - 请求头参数（headers）

**响应信息区域**：
- **响应字段列表**：返回数据的字段说明
- **响应格式**：JSON 结构示例
- **状态码说明**：成功/错误状态码

**交互功能区域**：
- **API Endpoint URL**：
  - 可编辑的输入框
  - 预填充完整的 API 路径
  - 支持修改为测试环境地址
- **Request Parameters (JSON)**：
  - JSON 格式的参数输入框
  - 自动预填充示例参数
  - 支持 JSON 格式验证
  - 语法高亮显示
- **操作按钮**：
  - **Send Request**：
    - 发送 HTTP 请求
    - 显示请求状态（loading、success、error）
    - 在响应区域显示结果
  - **Save Params**：
    - 保存当前参数到 LocalStorage
    - 按 API 编号存储
    - 支持跨会话恢复
  - **Load Params**：
    - 从 LocalStorage 加载已保存的参数
    - 自动填充到参数输入框
  - **Copy Headers**：
    - 复制当前配置的请求头
    - 格式化为 JSON 或 curl 命令格式

**响应显示区域**：
- **响应状态**：HTTP 状态码
- **响应头**：服务器返回的响应头信息
- **响应体**：
  - JSON 格式化显示
  - 语法高亮
  - 可折叠/展开
  - 支持复制响应内容
- **响应时间**：请求耗时显示

#### 6. 工作流程示例

**场景 1：测试用户登录 API**
1. 选择应用（如 AppQyV1）
2. 搜索 "login" 或直接找到登录 API
3. 展开 API 详情面板
4. 查看参数要求（email、password）
5. 在参数输入框填写 JSON：
   ```json
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```
6. 点击 "Send Request"
7. 查看响应，获取 token
8. 将 token 配置到共享请求头的 Authorization 字段
9. 保存请求头配置

**场景 2：测试需要认证的 API**
1. 确保已配置 Authorization 请求头
2. 选择目标 API
3. 加载已保存的参数（如有）
4. 修改参数值
5. 发送请求
6. 查看响应结果
7. 保存新的参数配置

#### 7. 数据持久化机制
- **存储位置**：浏览器 LocalStorage
- **存储内容**：
  - 每个 API 的参数配置（按应用和 API 编号存储）
  - 每个应用的共享请求头配置
  - 用户偏好设置
- **存储格式**：
  ```json
  {
    "api_params": {
      "AppQyV1": {
        "1": { "email": "user@example.com", "password": "..." }
      }
    },
    "shared_headers": {
      "AppQyV1": {
        "Authorization": "Bearer token...",
        "Content-Type": "application/json"
      }
    }
  }
  ```
- **特性**：
  - 跨会话持久化
  - 按应用隔离存储
  - 支持手动清除

#### 8. 使用优势
- **无需安装**：浏览器内直接使用，无需安装额外软件
- **实时测试**：快速验证 API 功能
- **参数模板**：预填充示例参数，减少输入
- **请求头管理**：统一管理认证信息
- **历史记录**：保存常用参数配置
- **多应用支持**：一个界面管理所有应用的 API

---

## 🛠️ Development Tools（开发工具）

### 功能概述
Development Tools 是一个综合性的在线开发工具集合，提供 100+ 种实用工具，涵盖文本处理、编码转换、加密解密、格式化、计算器、图片处理等多个领域。

### 工具分类详细说明

#### 1. 📋 Online Clipboard（在线剪贴板）
- **工具数量**：1 个
- **主要工具**：
  - **Online Clipboard**：跨设备剪贴板同步工具
    - 功能：在不同设备间同步剪贴板内容
    - 使用场景：多设备开发、远程协作

#### 2. 🤖 AI Tools（AI 工具）
- **工具数量**：1 个
- **主要工具**：
  - **AI Translation**：AI 翻译工具
    - 功能：使用 AI 进行文本翻译
    - 支持语言：多语言互译
    - 使用场景：代码注释翻译、文档翻译

#### 3. 🖼️ Image Tools（图片工具）
- **工具数量**：6 个
- **主要工具**：
  - **Image Converter**：图片格式转换
    - 支持格式：JPG、PNG、GIF、WebP、BMP、TIFF
    - 功能：批量转换、质量调整
  - **Image Compressor**：图片压缩
    - 功能：减小图片文件大小
    - 支持格式：JPG、PNG、WebP
  - **Image Resizer**：图片尺寸调整
    - 功能：调整图片宽高
    - 支持：按比例缩放、自定义尺寸
  - **Image Cropper**：图片裁剪
    - 功能：裁剪图片区域
    - 支持：自定义裁剪框
  - **Image Rotator/Flipper**：图片旋转/翻转
    - 功能：旋转、水平/垂直翻转
  - **Color Picker from Image**：从图片提取颜色
    - 功能：提取图片中的颜色值
    - 输出格式：HEX、RGB、HSL

#### 4. 📄 PDF & Document Tools（PDF 和文档工具）
- **工具数量**：9 个
- **主要工具**：
  - **PDF Merger**：PDF 合并
    - 功能：合并多个 PDF 文件
  - **PDF Splitter**：PDF 分割
    - 功能：将 PDF 分割为多个文件
  - **PDF Compressor**：PDF 压缩
    - 功能：减小 PDF 文件大小
  - **PDF Password Protector**：PDF 密码保护
    - 功能：为 PDF 添加密码
  - **Unlock PDF**：PDF 解锁
    - 功能：移除 PDF 密码（需知道密码）
  - **PDF Watermark**：PDF 水印
    - 功能：添加文字或图片水印
  - **PDF Page Rotator**：PDF 页面旋转
    - 功能：旋转 PDF 页面
  - **PDF to JPG/PNG**：PDF 转图片
    - 功能：将 PDF 页面转换为图片
  - **Image to PDF**：图片转 PDF
    - 功能：将图片合并为 PDF

#### 5. 🧮 Calculator Tools（计算器工具）
- **工具数量**：7 个
- **主要工具**：
  - **Age Calculator**：年龄计算器
    - 功能：根据出生日期计算年龄
  - **BMI Calculator**：BMI 计算器
    - 功能：计算身体质量指数
  - **Loan EMI Calculator**：贷款月供计算器
    - 功能：计算贷款月供金额
  - **GST Calculator**：GST 计算器
    - 功能：计算商品及服务税
  - **Percentage Calculator**：百分比计算器
    - 功能：百分比计算
  - **Number to Words**：数字转文字
    - 功能：将数字转换为文字描述
    - 支持语言：多语言
  - **Unit Converter**：单位转换器
    - 功能：长度、重量、体积等单位转换
  - **Currency Converter**：货币转换器
    - 功能：实时货币汇率转换

#### 6. 🎨 Color Tools（颜色工具）
- **工具数量**：5 个
- **主要工具**：
  - **HEX to RGB Converter**：HEX 转 RGB
    - 功能：颜色格式转换
  - **Gradient Generator**：渐变生成器
    - 功能：生成 CSS 渐变代码
  - **Contrast Checker**：对比度检查器
    - 功能：检查文字与背景对比度（WCAG 标准）
  - **Palette Generator**：调色板生成器
    - 功能：从图片或颜色生成调色板
  - **Color Blindness Simulator**：色盲模拟器
    - 功能：模拟不同色盲类型的效果

#### 7. ✍️ Text Tools Advanced（高级文本工具）
- **工具数量**：7 个
- **主要工具**：
  - **Remove Duplicate Lines**：移除重复行
    - 功能：去除文本中的重复行
  - **Text Sorter**：文本排序
    - 功能：按字母或数字排序
  - **Text Reverser**：文本反转
    - 功能：反转文本顺序
  - **Word Counter (SEO)**：SEO 字数统计
    - 功能：统计字数、字符数、关键词密度
  - **Keyword Density Checker**：关键词密度检查
    - 功能：分析文本关键词密度
  - **Text Encryptor/Decryptor**：文本加密/解密
    - 功能：加密或解密文本内容

#### 8. 📈 SEO & Marketing（SEO 和营销工具）
- **工具数量**：3 个
- **主要工具**：
  - **Meta Tag Analyzer**：Meta 标签分析器
    - 功能：分析网页 Meta 标签
  - **Keyword Density Checker**：关键词密度检查器
    - 功能：SEO 关键词分析
  - **Word Counter (Blog)**：博客字数统计
    - 功能：博客文章字数统计

#### 9. 🔧 Utility Tools（实用工具）
- **工具数量**：5 个
- **主要工具**：
  - **QR Code Scanner**：二维码扫描器
    - 功能：扫描二维码
  - **Barcode Generator**：条形码生成器
    - 功能：生成条形码
  - **Time Zone Converter**：时区转换器
    - 功能：转换不同时区时间
  - **Password Generator**：密码生成器
    - 功能：生成安全密码
    - 选项：长度、字符类型
  - **Password Strength Checker**：密码强度检查器
    - 功能：评估密码强度

#### 10. 🔐 Crypto & Security（加密和安全工具）
- **工具数量**：10 个
- **主要工具**：
  - **Token Generator**：令牌生成器
    - 功能：生成随机令牌
  - **Hash Generator**：哈希生成器
    - 支持算法：MD5、SHA1、SHA256、SHA512
  - **Bcrypt Hash/Verify**：Bcrypt 哈希/验证
    - 功能：生成和验证 Bcrypt 哈希
  - **UUID Generator**：UUID 生成器
    - 功能：生成 UUID v1/v4
  - **ULID Generator**：ULID 生成器
    - 功能：生成 ULID（时间排序的唯一 ID）
  - **HMAC Generator**：HMAC 生成器
    - 功能：生成 HMAC 签名
  - **Password Strength Analyzer**：密码强度分析器
    - 功能：详细分析密码安全性
  - **Basic Auth Generator**：Basic 认证生成器
    - 功能：生成 Basic Auth 字符串
  - **BIP39 Passphrase**：BIP39 助记词
    - 功能：生成和验证 BIP39 助记词
  - **RSA Key Pair**：RSA 密钥对生成器
    - 功能：生成 RSA 公钥/私钥对

#### 11. 🔄 Converters（转换器）
- **工具数量**：13 个
- **主要工具**：
  - **Base64 Encoder/Decoder**：Base64 编码/解码
    - 功能：Base64 编码解码
  - **URL Encoder/Decoder**：URL 编码/解码
    - 功能：URL 编码解码
  - **HTML Entities Encoder**：HTML 实体编码
    - 功能：HTML 实体编码/解码
  - **Case Converter**：大小写转换
    - 功能：转换文本大小写格式
  - **Color Converter**：颜色格式转换
    - 功能：HEX、RGB、HSL 互转
  - **Timestamp Converter**：时间戳转换
    - 功能：Unix 时间戳与日期互转
  - **Integer Base Converter**：整数进制转换
    - 功能：二进制、八进制、十进制、十六进制互转
  - **Roman Numeral Converter**：罗马数字转换
    - 功能：阿拉伯数字与罗马数字互转
  - **Text to NATO Alphabet**：文本转 NATO 字母
    - 功能：将文本转换为 NATO 音标字母
  - **Text to ASCII Binary**：文本转 ASCII 二进制
    - 功能：将文本转换为二进制表示
  - **JSON ⇄ YAML**：JSON 与 YAML 互转
    - 功能：JSON 和 YAML 格式互转
  - **JSON ⇄ XML**：JSON 与 XML 互转
    - 功能：JSON 和 XML 格式互转
  - **Markdown to HTML**：Markdown 转 HTML
    - 功能：将 Markdown 转换为 HTML

#### 12. 📝 Text Tools（文本工具）
- **工具数量**：8 个
- **主要工具**：
  - **Text Diff**：文本差异对比
    - 功能：对比两个文本的差异
  - **Text Statistics**：文本统计
    - 功能：统计字数、字符数、行数等
  - **Lorem Ipsum Generator**：Lorem Ipsum 生成器
    - 功能：生成占位文本
  - **Slugify String**：字符串 Slug 化
    - 功能：将文本转换为 URL 友好的 slug
  - **Emoji Picker**：表情符号选择器
    - 功能：选择和使用表情符号
  - **String Obfuscator**：字符串混淆器
    - 功能：混淆字符串内容
  - **Numeronym Generator**：数字缩写生成器
    - 功能：生成数字缩写（如 i18n）
  - **ASCII Art Generator**：ASCII 艺术生成器
    - 功能：生成 ASCII 艺术文字

#### 13. ✨ Formatters（格式化工具）
- **工具数量**：6 个
- **主要工具**：
  - **JSON Formatter**：JSON 格式化
    - 功能：格式化、验证 JSON
  - **XML Formatter**：XML 格式化
    - 功能：格式化、验证 XML
  - **YAML Formatter**：YAML 格式化
    - 功能：格式化、验证 YAML
  - **SQL Formatter**：SQL 格式化
    - 功能：格式化 SQL 语句
  - **HTML Formatter**：HTML 格式化
    - 功能：格式化 HTML 代码
  - **CSS Formatter**：CSS 格式化
    - 功能：格式化 CSS 代码

#### 14. 🌐 Web Tools（Web 工具）
- **工具数量**：8 个
- **主要工具**：
  - **URL Parser**：URL 解析器
    - 功能：解析 URL 各部分
  - **Query String Parser**：查询字符串解析器
    - 功能：解析 URL 查询参数
  - **JWT Parser**：JWT 解析器
    - 功能：解析和验证 JWT token
  - **User Agent Parser**：User Agent 解析器
    - 功能：解析 User Agent 字符串
  - **HTTP Status Codes**：HTTP 状态码参考
    - 功能：HTTP 状态码查询
  - **MIME Types**：MIME 类型参考
    - 功能：MIME 类型查询
  - **Device Information**：设备信息
    - 功能：显示当前设备信息
  - **Keycode Info**：按键码信息
    - 功能：键盘按键码查询

#### 15. 🎲 Generators（生成器）
- **工具数量**：7 个
- **主要工具**：
  - **QR Code Generator**：二维码生成器
    - 功能：生成二维码
  - **WiFi QR Code**：WiFi 二维码
    - 功能：生成 WiFi 连接二维码
  - **SVG Placeholder**：SVG 占位符
    - 功能：生成 SVG 占位图片
  - **Random Port**：随机端口
    - 功能：生成随机端口号
  - **Crontab Generator**：Crontab 生成器
    - 功能：生成 Crontab 表达式
  - **Open Graph Meta**：Open Graph Meta 标签生成器
    - 功能：生成 Open Graph Meta 标签
  - **OTP Code Generator**：OTP 验证码生成器
    - 功能：生成一次性密码

#### 16. 🔢 Math & Calc（数学和计算工具）
- **工具数量**：5 个
- **主要工具**：
  - **Math Evaluator**：数学表达式计算器
    - 功能：计算数学表达式
  - **Percentage Calculator**：百分比计算器
    - 功能：百分比相关计算
  - **ETA Calculator**：预计到达时间计算器
    - 功能：计算预计到达时间
  - **Temperature Converter**：温度转换器
    - 功能：摄氏度、华氏度、开尔文互转
  - **Unit Converter**：单位转换器
    - 功能：各种单位转换

#### 17. 🌍 Network Tools（网络工具）
- **工具数量**：5 个
- **主要工具**：
  - **IPv4 Subnet Calculator**：IPv4 子网计算器
    - 功能：计算子网信息
  - **IPv4 Converter**：IPv4 转换器
    - 功能：IP 地址格式转换
  - **IPv6 ULA Generator**：IPv6 ULA 生成器
    - 功能：生成 IPv6 ULA 地址
  - **MAC Address Lookup**：MAC 地址查询
    - 功能：查询 MAC 地址厂商信息
  - **MAC Generator**：MAC 地址生成器
    - 功能：生成随机 MAC 地址

#### 18. 💻 Development（开发工具）
- **工具数量**：7 个
- **主要工具**：
  - **Regex Tester**：正则表达式测试器
    - 功能：测试正则表达式
  - **Regex Cheatsheet**：正则表达式速查表
    - 功能：正则表达式语法参考
  - **Git Cheatsheet**：Git 速查表
    - 功能：Git 命令参考
  - **Chmod Calculator**：Chmod 权限计算器
    - 功能：计算文件权限
  - **Docker Run → Compose**：Docker 命令转 Compose
    - 功能：将 docker run 命令转换为 docker-compose.yml
  - **JSON Diff**：JSON 差异对比
    - 功能：对比两个 JSON 的差异
  - **JSON to CSV**：JSON 转 CSV
    - 功能：将 JSON 数据转换为 CSV

#### 19. 📊 Data Tools（数据工具）
- **工具数量**：3 个
- **主要工具**：
  - **Phone Parser**：电话号码解析器
    - 功能：解析电话号码格式
  - **IBAN Validator**：IBAN 验证器
    - 功能：验证 IBAN 银行账号
  - **Email Normalizer**：邮箱标准化器
    - 功能：标准化邮箱地址格式

### 界面特性
- **顶部标签**：
  - **Tools**：所有工具列表
  - **Favorites**：收藏的工具
  - **Recent**：最近使用的工具
- **左侧分类菜单**：
  - 19 个工具分类
  - 可折叠/展开
  - 点击分类显示该分类下的所有工具
- **搜索功能**：
  - 全局搜索工具
  - 实时过滤结果
- **主内容区**：
  - 工具操作界面
  - 输入/输出区域
  - 操作按钮
- **右侧信息面板**（可选）：
  - 工具使用说明
  - 示例和提示
  - 可切换显示/隐藏
- **历史记录**：
  - 自动记录最近使用的工具
  - 快速访问常用工具
- **收藏功能**：
  - 收藏常用工具
  - 快速访问收藏列表

### 使用场景
- **开发调试**：编码转换、格式化、正则测试
- **数据处理**：文本处理、格式转换
- **安全工具**：加密解密、哈希生成、密码生成
- **设计辅助**：颜色工具、图片处理
- **文档处理**：PDF 操作、格式转换
- **网络工具**：IP 计算、URL 解析
- **日常工具**：计算器、单位转换

---

## 📊 System Information（系统信息）

### 功能概述
System Information 提供完整的系统信息展示，包括 Laravel 配置、PHP 配置、数据库信息、系统资源使用情况、外部工具版本等，帮助开发者了解系统运行状态。

### 详细内容说明

#### 1. 核心信息（Core Information）
- **PHP 版本**：8.4.15
- **Laravel 版本**：12.38.1
- **运行环境**：local（本地开发环境）
- **调试模式**：Enabled（已启用）
- **时区设置**：UTC

#### 2. Laravel 配置摘要（Laravel Configuration Summary）

**应用模式**：
- **模式**：Headless API（无头 API 模式）
- **说明**：保留 Web 路由用于调试，主要作为 API 服务运行

**数据库连接配置**：
- **默认连接**：sqlite
- **已配置连接数**：15 个
- **连接列表**：
  - `sqlite`：默认 SQLite 数据库
  - `mysql`：MySQL 数据库
  - `mariadb`：MariaDB 数据库
  - `pgsql`：PostgreSQL 数据库
  - `sqlsrv`：SQL Server 数据库
  - `AppQyV1`：AppQyV1 应用数据库（SQLite）
  - `appqyv1`：AppQyV1 应用数据库（别名）
  - `awyv0`：AwyV0 应用数据库（SQLite）
  - `vipclubv1`：VipClubV1 应用数据库（SQLite）
  - `servermanagerv1`：ServerManagerV1 应用数据库（SQLite）
  - `achatv1`：AChatV1 应用数据库（SQLite）
  - `codemartv1`：CodeMartV1 应用数据库（SQLite）
  - `mcpv1`：McpV1 应用数据库（SQLite）
  - `ittoolsv1`：ItToolsV1 应用数据库（SQLite）
  - `bankv1`：BankV1 应用数据库（SQLite）

**外部存储路径**：
- **public_path_external**：公共资源外部路径（项目目录外，便于部署）
- **storage_path_external**：存储外部路径（项目目录外，共享存储）
- **uploads_path**：用户上传和媒体文件外部路径
- **temp_path**：外部临时文件处理位置

**驱动配置**：
- **Cache Driver**：database（数据库缓存）
- **Session Driver**：file（文件会话）
- **Queue Driver**：database（数据库队列）
- **Mail Driver**：log（日志邮件，开发环境）

**日志通道配置**：
- **默认通道**：syslog
- **已配置通道**：
  - stack：堆叠通道
  - single：单文件通道
  - daily：每日日志通道
  - slack：Slack 通知通道
  - papertrail：Papertrail 日志服务
  - stderr：标准错误输出
  - syslog：系统日志
  - errorlog：错误日志
  - null：空通道（禁用日志）
  - emergency：紧急日志
- **总通道数**：10 个

**中间件组**：
- **全局中间件数**：0
- **中间件组**：空数组
- **总组数**：0

**路由文件**：
- **主路由文件**：
  - ai.php：AI 相关路由
  - api.php：API 路由
  - api_ocr.php：OCR API 路由
  - console.php：控制台路由
  - settings.php：设置路由
  - web.php：Web 路由
- **应用特定路由目录**：
  - AppQyV1Router/：AppQyV1 路由
  - AwyV0Router/：AwyV0 路由
  - BankV1Router/：BankV1 路由
  - CodeMartV1Router/：CodeMartV1 路由
  - ItToolsV1Router/：ItToolsV1 路由
  - McpV1Router/：McpV1 路由
  - ServerManagerV1Router/：ServerManagerV1 路由
  - VipClubV1Router/：VipClubV1 路由
- **总路由文件数**：6 个
- **总应用路由目录数**：8 个

#### 3. 应用概览（Applications Overview）
- **总应用数**：7 个
- **所有应用 API 总数**：174 个
- **应用列表**：
  - **AChatV1**：
    - API 数量：0 个
    - 状态：active（活跃）
  - **AppQyV1**：
    - API 数量：63 个
    - 状态：active（活跃）
  - **AwyV0**：
    - API 数量：24 个
    - 状态：active（活跃）
  - **BankV1**：
    - API 数量：16 个
    - 状态：active（活跃）
  - **ItToolsV1**：
    - API 数量：8 个
    - 状态：active（活跃）
  - **McpV1**：
    - API 数量：39 个
    - 状态：active（活跃）
  - **ServerManagerV1**：
    - API 数量：24 个
    - 状态：active（活跃）

#### 4. PHP 配置（PHP Configuration）
- **内存限制**：512M
- **最大执行时间**：0s（无限制）
- **上传文件大小限制**：64M
- **POST 数据大小限制**：64M
- **错误显示**：On（开启）
- **命令执行**：已启用

#### 5. 数据库信息（Database Information）
- **连接状态**：Connected（已连接）
- **连接驱动**：sqlite
- **数据库名称**：/www/wwwroot/laravel_db/database.sqlite
- **数据库版本**：3.45.1

#### 6. 系统资源（System Resources）
- **CPU 使用率**：
  - 1 分钟平均：1.6494140625%
  - 5 分钟平均：1.71728515625%
  - 15 分钟平均：1.705078125%
- **内存使用**：
  - 已使用：2.64 GB
  - 总内存：7.5 GB
  - 使用率：35.13%
- **磁盘使用**：
  - 已使用：139.32 GB
  - 总容量：467.35 GB
  - 使用率：29.81%
- **负载平均值**：
  - 1 分钟：1.6494140625
  - 5 分钟：1.71728515625
  - 15 分钟：1.705078125

#### 7. 系统信息（System Information）
- **操作系统**：Linux
- **系统架构**：x86_64
- **服务器软件**：Unknown
- **服务器 IP**：Unknown

#### 8. 外部工具（External Tools）
- **Git**：
  - 版本：git version 2.43.0
  - 用途：版本控制
- **Node.js**：
  - 版本：v24.11.1
  - 用途：JavaScript 运行时
- **Python**：
  - 版本：Python 3.12.3
  - 用途：Python 脚本执行
- **Go**：
  - 状态：未安装（sh: 1: go: not found）
- **Curl**：
  - 版本：curl 8.5.0
  - 支持协议：HTTP/HTTPS、FTP、SFTP、SMTP 等
  - 特性：支持 HTTP/2、SSL/TLS、压缩等
- **7z**：
  - 版本：7-Zip 23.01
  - 用途：文件压缩/解压
- **FFmpeg**：
  - 版本：ffmpeg version 6.1.1-3ubuntu5
  - 用途：音视频处理
  - 支持格式：多种音视频格式
  - 特性：编码、解码、转码、滤镜等

#### 9. API 参考信息（API Reference）
显示所有应用的详细 API 信息，包括：
- **应用名称和版本**
- **基础 URL 和 API 前缀**
- **端点列表**：
  - 路径
  - HTTP 方法
  - 功能描述
  - 参数说明
  - 响应格式
- **支持的请求头**
- **认证方式**

### 使用场景
- **系统监控**：实时查看系统资源使用情况
- **配置检查**：验证 Laravel 和 PHP 配置
- **数据库状态**：检查数据库连接和版本
- **工具版本**：查看外部工具版本信息
- **API 文档**：查看所有应用的 API 参考
- **故障排查**：系统信息帮助定位问题

---

## 📚 Vocabulary Learning（词汇学习）

### 功能概述
Vocabulary Learning 是基于 AppQyV1 应用的词汇学习系统，提供完整的词汇学习功能，包括用户管理、词汇库管理、学习进度跟踪、文档上传和词汇提取等。

### 主要功能模块

#### 1. 用户认证和管理
- **用户注册**：`/api/dict/v1/register`
  - 参数：name、email、password
  - 功能：创建新用户账号
- **用户登录**：`/api/dict/v1/login`
  - 参数：email、password
  - 功能：用户身份认证
- **用户登出**：`/api/dict/v1/logout`
  - 功能：退出登录
- **获取当前用户**：`/api/dict/v1/user`
  - 功能：获取当前登录用户信息
- **密码重置**：
  - 请求重置：`/api/dict/v1/forgot-password`
  - 重置密码：`/api/dict/v1/reset-password`

#### 2. 系统初始化
- **系统初始化**：`/api/dict/v1/system/initialize`
  - 功能：初始化系统和词汇库
  - 说明：首次使用时需要初始化
- **初始化状态检查**：`/api/dict/v1/system/initialization-status`
  - 功能：检查系统初始化状态
- **处理词汇**：`/api/dict/v1/system/process-vocabulary`
  - 功能：处理词汇数据
- **词汇状态**：`/api/dict/v1/system/vocabulary-status`
  - 功能：获取词汇处理状态
- **词典统计**：`/api/dict/v1/system/dictionary-statistics`
  - 功能：获取词典统计信息

#### 3. 语言支持
- **支持的语言列表**：`/api/dict/v1/system/supported-languages`
  - 功能：获取系统支持的学习语言列表
- **语言详情**：`/api/dict/v1/system/supported-languages/{code}`
  - 功能：根据语言代码获取语言详情

#### 4. 词汇库管理
- **推荐词汇库**：`/api/dict/v1/vocabulary/libraries/recommended`
  - 参数：language、limit
  - 功能：获取推荐的词汇库
- **词汇库列表**：`/api/dict/v1/vocabulary/libraries`
  - 参数：page、per_page、language、category、difficulty、search
  - 功能：分页获取词汇库列表，支持筛选和搜索
- **删除词汇库**：`/api/dict/v1/learning/libraries/{library_id}`
  - 功能：删除指定的词汇库

#### 5. 学习语言设置
- **获取学习语言**：`/api/dict/v1/learning/languages` (GET)
  - 功能：获取用户设置的学习语言
- **设置学习语言**：`/api/dict/v1/learning/languages` (POST)
  - 参数：languages（数组）
  - 功能：设置或更新用户的学习语言

#### 6. 词汇库选择
- **获取词汇库**：`/api/dict/v1/learning/libraries`
  - 功能：获取用户的词汇库列表
- **选择词汇库**：`/api/dict/v1/learning/libraries/select`
  - 参数：library_id
  - 功能：选择要学习的词汇库

#### 7. 词汇集合管理
- **词汇推荐**：`/api/dict/v1/learning/recommendations`
  - 功能：根据学习语言获取推荐的词汇集合
- **选择词汇集合**：`/api/dict/v1/learning/collections/select`
  - 参数：collection_id
  - 功能：选择要学习的词汇集合
- **获取已选集合**：`/api/dict/v1/learning/collections/selected`
  - 功能：获取用户已选择的词汇集合

#### 8. 词汇学习
- **获取词汇卡片**：`/api/dict/v1/learning/words`
  - 参数：limit、offset
  - 功能：分页获取学习词汇卡片
- **更新学习进度**：`/api/dict/v1/learning/progress`
  - 参数：word_id、status
  - 功能：更新单词的学习状态（已学、复习等）
- **学习统计**：`/api/dict/v1/learning/stats`
  - 功能：获取用户的学习统计数据

#### 9. 文档上传和词汇提取
- **上传文档**：`/api/dict/v1/learning/upload`
  - 参数：file（文件）
  - 功能：上传文档，自动提取其中的词汇
  - 支持格式：PDF、Word、TXT 等

#### 10. 单词查询和管理
- **每日单词**：`/api/words/daily`
  - 功能：获取每日推荐单词
- **单词详情**：`/api/words/{id}`
  - 功能：获取单词的详细信息
- **标记已学**：`/api/words/{id}/learn`
  - 功能：标记单词为已学
- **标记复习**：`/api/words/{id}/review`
  - 功能：标记单词需要复习
- **收藏单词**：`/api/words/{id}/favorite`
  - 功能：收藏或取消收藏单词
- **搜索单词**：`/api/words/search/{query}`
  - 功能：搜索单词
- **公开单词查询**：`/api/words/public/{word}`
  - 功能：公开查询单词（无需认证）

#### 11. 增强单词查询
- **增强单词查询**：`/api/dict/v1/word/{word}/enhanced`
  - 功能：获取单词的完整数据（包括翻译、音频、图片等）

#### 12. 未翻译单词管理
- **获取未翻译单词**：`/api/dict/v1/untranslated`
  - 功能：获取未翻译的单词列表
- **按优先级获取**：`/api/dict/v1/untranslated/priority`
  - 功能：按优先级获取未翻译单词

#### 13. 单词内容提交
- **提交翻译**：`/api/dict/v1/word/{word}/translation`
  - 参数：word、translation
  - 功能：提交单词的翻译
- **提交音频**：`/api/dict/v1/word/{word}/audio`
  - 参数：word、audio
  - 功能：提交单词的音频文件
- **提交图片**：`/api/dict/v1/word/{word}/images`
  - 参数：word、images
  - 功能：提交单词的图片
- **提交完整数据**：`/api/dict/v1/word/{word}/complete`
  - 参数：word、data
  - 功能：提交单词的完整数据

#### 14. 用户初始化
- **用户初始化状态**：`/api/dict/v1/user/initialization-status`
  - 功能：检查用户是否完成初始设置
- **完成用户初始化**：`/api/dict/v1/user/initialize`
  - 参数：learning_languages、occupation、daily_words_target、daily_study_time、preferences
  - 功能：完成用户的初始设置（学习偏好、目标等）

#### 15. 用户进度和统计
- **用户进度**：`/api/user/progress`
  - 功能：获取用户的学习进度
- **用户统计**：`/api/user/stats`
  - 功能：获取用户的学习统计数据
- **用户资料**：`/api/user/profile` (GET)
  - 功能：获取用户资料
- **更新资料**：`/api/user/profile` (PUT)
  - 参数：displayName、avatar
  - 功能：更新用户资料

#### 16. AI 工具集成
- **翻译语言列表**：`/api/app_qy_v1/ai_tools/translation/languages`
  - 功能：获取支持的翻译语言
- **翻译类型**：`/api/app_qy_v1/ai_tools/translation/types`
  - 功能：获取翻译类型
- **翻译模型**：`/api/app_qy_v1/ai_tools/translation/models`
  - 功能：获取可用的翻译模型
- **翻译模板**：`/api/app_qy_v1/ai_tools/translation/templates`
  - 功能：获取翻译模板
- **翻译文本**：`/api/app_qy_v1/ai_tools/translation/translate`
  - 参数：text、source_lang、target_lang
  - 功能：翻译文本
- **批量翻译**：`/api/app_qy_v1/ai_tools/translation/batch`
  - 参数：texts、source_lang、target_lang
  - 功能：批量翻译文本
- **Google 翻译**：`/api/app_qy_v1/ai_tools/translation/simple/google`
  - 参数：text、target_lang
  - 功能：使用 Google 翻译
- **学习模式翻译**：`/api/app_qy_v1/ai_tools/translation/learning`
  - 参数：text、options
  - 功能：学习模式的翻译（带学习提示）
- **翻译任务状态**：`/api/app_qy_v1/ai_tools/translation/task/{taskId}`
  - 功能：获取翻译任务状态
- **处理下一个任务**：`/api/app_qy_v1/ai_tools/translation/process-next`
  - 功能：处理下一个翻译任务

#### 17. TTS（文本转语音）功能
- **TTS 语音列表**：`/api/app_qy_v1/ai_tools/tts/voices`
  - 功能：获取可用的 TTS 语音
- **音频服务（带速度）**：`/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{speed}/{filename}`
  - 功能：提供带速度控制的音频文件
- **音频服务**：`/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}`
  - 功能：提供音频文件
- **生成 TTS**：`/api/app_qy_v1/ai_tools/tts/generate`
  - 参数：text、language、voice
  - 功能：生成 TTS 音频
- **批量生成 TTS**：`/api/app_qy_v1/ai_tools/tts/batch-generate`
  - 参数：texts、language、voice
  - 功能：批量生成 TTS 音频

#### 18. 邀请码
- **获取邀请码**：`/api/app_qy_v1/invitation-code`
  - 功能：获取掩码显示的邀请码

### 使用流程
1. **注册/登录**：创建账号或登录
2. **系统初始化**：首次使用需要初始化系统
3. **设置学习语言**：选择要学习的语言
4. **选择词汇库**：从推荐或列表中选择词汇库
5. **选择词汇集合**：选择具体的词汇集合
6. **开始学习**：获取词汇卡片，进行学习
7. **更新进度**：标记学习状态
8. **查看统计**：查看学习进度和统计
9. **上传文档**：上传文档提取新词汇
10. **使用 AI 工具**：使用翻译和 TTS 功能辅助学习

---

## 💻 Code Browser（代码浏览器）

### 功能概述
Code Browser 是一个在线代码浏览和编辑工具，提供文件树浏览、代码编辑、任务/提示管理等功能。需要登录才能使用。

### 核心功能模块

#### 1. 文件树面板（File Tree Panel）
- **根目录**：core_node
- **功能**：
  - 浏览项目文件结构
  - 展开/折叠文件夹
  - 选择文件查看内容
- **文件操作**（右键菜单）：
  - **复制相对路径**：复制文件相对于项目根目录的路径
  - **复制绝对路径**：复制文件的完整绝对路径
  - **重命名**：重命名文件或文件夹
  - **自动重命名为英文**：将中文文件名自动转换为英文
  - **翻译中文行**：翻译文件中的中文注释或内容
  - **删除**：删除文件或文件夹
  - **恢复**：恢复已删除的文件（如果支持）
- **操作按钮**：
  - **刷新**：刷新文件树
  - **展开全部**：展开所有文件夹
  - **折叠全部**：折叠所有文件夹

#### 2. 代码编辑器（Code Editor）
- **功能**：
  - 查看代码文件内容
  - 编辑代码文件
  - 语法高亮显示
  - 代码格式化
- **支持的文件类型**：
  - 代码文件：.js、.ts、.php、.py、.java、.go 等
  - 配置文件：.json、.yaml、.xml、.ini 等
  - 文档文件：.md、.txt 等
- **编辑功能**：
  - 代码编辑
  - 保存文件
  - 撤销/重做
  - 查找/替换
  - 行号显示
- **文件操作**：
  - **打开文件**：点击文件树中的文件自动加载
  - **保存文件**：编辑后保存更改
  - **关闭文件**：关闭当前打开的文件

#### 3. 任务/提示管理面板（Tasks/Prompts Panel）
- **功能**：管理开发任务和提示词
- **分类系统**：
  - **Global**：全局任务和提示
  - **MCP Development**：MCP 开发相关
  - **NCORE Development**：NCORE 开发相关
  - **PYCORE Development**：PYCORE 开发相关
  - **Laravel Main**：Laravel 主应用相关
  - **NUXT Development**：NUXT 开发相关
- **操作功能**：
  - **新建任务**：创建新的开发任务
  - **刷新列表**：刷新任务列表
  - **按分类查看**：筛选特定分类的任务
  - **编辑任务**：修改任务内容
  - **删除任务**：删除不需要的任务
  - **标记完成**：标记任务为已完成

#### 4. 提示映射面板（Prompt Mappings Panel）
- **功能**：管理提示词映射关系
- **用途**：
  - 将提示词映射到特定的代码位置
  - 管理代码生成提示
  - 关联任务和代码文件

#### 5. 认证要求
- **访问限制**：需要登录才能使用
- **登录提示**：
  - 未登录时显示登录按钮
  - 点击登录按钮打开登录对话框
- **登录方式**：
  - 用户名/密码登录
  - 可能需要邀请码注册

### 使用场景
- **代码浏览**：快速浏览项目代码结构
- **代码编辑**：在线编辑代码文件
- **任务管理**：管理开发任务和提示词
- **代码审查**：查看和审查代码
- **快速定位**：通过文件树快速定位文件
- **路径复制**：快速复制文件路径用于其他工具

### 界面布局
- **左侧**：文件树面板（可调整宽度）
- **中间**：代码编辑器（主要工作区）
- **右侧**：任务/提示管理面板（可折叠）
- **顶部**：工具栏（保存、刷新等操作）
- **底部**：状态栏（显示文件信息、行号等）

---

## 🎬 Static Resources（静态资源管理）

### 功能概述
Static Resources 是一个功能完整的媒体文件浏览器和管理工具，支持图片、视频、音频、文本文件等多种静态资源的浏览、预览、上传和管理。

### 核心功能模块

#### 1. 文件列表面板（File List Panel）
- **功能**：
  - 浏览静态资源目录结构
  - 文件/文件夹导航
  - 显示当前目录路径
- **显示信息**：
  - 文件名
  - 文件类型图标
  - 文件大小
  - 修改时间
- **操作按钮**（顶部工具栏）：
  - **📁+**：新建文件夹
  - **🔄**：刷新文件列表
  - **📤**：上传文件/文件夹
- **文件夹操作**：
  - 点击文件夹进入
  - 支持嵌套文件夹
  - 可折叠/展开文件夹
- **文件操作**：
  - 点击文件预览
  - 右键菜单操作

#### 2. 文件预览面板（File Preview Panel）
- **支持的文件类型**：
  - **图片**：JPG、PNG、GIF、WebP、BMP、TIFF、SVG 等
  - **视频**：MP4、AVI、MOV、WMV、FLV、MKV 等
  - **音频**：MP3、WAV、OGG、AAC、FLAC 等
  - **文本**：TXT、MD、JSON、XML、CSV 等
  - **文档**：PDF、DOC、DOCX 等
- **预览功能**：
  - **图片预览**：
    - 原图显示
    - 缩放功能
    - 全屏查看
  - **视频播放**：
    - 内置视频播放器
    - 播放控制（播放/暂停、音量、全屏）
    - 进度条控制
    - 自动播放下一集功能
    - 跳过片头设置（秒数）
  - **音频播放**：
    - 内置音频播放器
    - 播放控制
    - 进度显示
  - **文本预览**：
    - 文本内容显示
    - 语法高亮（如 JSON、XML）
    - 代码格式化
- **文件信息显示**：
  - 文件名
  - 文件大小
  - 文件类型
  - 修改时间
  - 文件元数据（如视频分辨率、时长等）

#### 3. 视频播放列表功能
- **播放列表管理**：
  - 自动生成当前目录的视频播放列表
  - 显示播放列表计数（如 "1/10"）
  - 播放列表可展开/折叠
- **自动播放功能**：
  - 当前视频播放完成后自动播放下一个
  - 按文件排序规则自动选择下一个视频
- **导航控制**：
  - **上一集按钮**：播放上一个视频（浮动按钮，左侧）
  - **下一集按钮**：播放下一个视频（浮动按钮，右侧）
  - 按钮在视频播放时显示
- **跳过片头设置**：
  - 可设置跳过片头的秒数
  - 自动应用到所有视频

#### 4. 文件排序功能
- **排序规则**：按以下关键字升序排序
  - **中文数字**：第一、一、二、三、四、五...
  - **阿拉伯数字**：1、2、3、4、5...
  - **英文格式**：lesson_1、lesson_2、lesson_3...
- **排序范围**：同一目录下的所有资源
- **排序目的**：确保视频、课程等资源按正确顺序播放

#### 5. 文件上传功能
- **上传对话框**：
  - **拖拽上传**：支持拖拽文件到上传区域
  - **点击浏览**：点击按钮选择文件
  - **多文件选择**：支持同时选择多个文件
  - **文件夹上传**：支持选择整个文件夹
  - **递归上传**：文件夹上传时保留目录结构
- **上传信息显示**：
  - 目标路径显示
  - 上传文件列表
  - 上传进度显示
  - 上传状态（等待、上传中、完成、失败）
- **上传方式**：
  - **单文件上传**：上传单个文件
  - **多文件上传**：同时上传多个文件
  - **文件夹递归上传**：上传整个文件夹，保留目录结构
- **上传限制**：
  - 文件大小限制（根据服务器配置）
  - 文件类型限制（可选）

#### 6. 文件操作功能
- **右键菜单选项**：
  - **📂 Enter this folder**：进入文件夹
  - **⬇️ Expand all subfolders**：展开所有子文件夹
  - **⬆️ Collapse all subfolders**：折叠所有子文件夹
  - **📤 Upload to this folder**：上传文件到此文件夹
  - **🌐 Rename to English**：将文件名重命名为英文
  - **🗑️ Delete**：删除文件或文件夹
- **文件操作**：
  - **重命名**：重命名文件或文件夹
  - **删除**：删除文件或文件夹（需确认）
  - **复制**：复制文件路径或文件本身
  - **移动**：移动文件到其他目录

#### 7. 删除功能
- **删除确认对话框**：
  - **删除摘要**：显示要删除的文件/文件夹数量
  - **安全确认**：需要输入"确认"才能删除
  - **待删除列表**：显示所有待删除的文件
- **删除操作**：
  - 支持删除单个文件
  - 支持删除文件夹（递归删除）
  - 支持批量删除
- **删除恢复**：可能支持删除恢复功能（如回收站）

#### 8. 创建文件夹功能
- **创建对话框**：
  - **文件夹名称输入**：输入新文件夹名称
  - **自动翻译选项**：可选择自动将中文名称翻译为英文
  - **父目录显示**：显示父目录路径
- **创建操作**：
  - 在当前目录创建新文件夹
  - 支持嵌套文件夹创建

#### 9. 当前目录状态栏
- **显示内容**：
  - 当前目录路径
  - 文件数量统计
  - 文件夹数量统计
- **操作按钮**：
  - 返回上一级目录
  - 刷新当前目录
  - 上传文件

### 界面特性
- **响应式设计**：
  - 支持桌面端和移动端
  - 自适应屏幕尺寸
- **文件列表可折叠**：
  - 可调整文件列表宽度
  - 可完全隐藏文件列表（全屏预览模式）
- **视频播放列表**：
  - 底部可展开/折叠的播放列表
  - 显示当前播放位置
- **浮动控制按钮**：
  - 视频播放时的上一集/下一集按钮
  - 自动显示/隐藏
- **拖拽支持**：
  - 拖拽文件上传
  - 拖拽文件移动（如支持）

### 使用场景
- **媒体文件管理**：管理图片、视频、音频文件
- **课程视频播放**：播放学习课程视频，自动播放下一集
- **资源浏览**：浏览和预览各种静态资源
- **文件上传**：批量上传媒体文件
- **文件组织**：通过文件夹组织资源
- **资源分享**：通过 URL 分享资源

---

## 📸 MCP Manager（MCP 管理器）

### 功能概述
MCP Manager 是用于管理 MCP（Model Context Protocol）功能和资源的工具。MCP 是一个用于 AI 模型与外部系统交互的协议，该管理器提供了 MCP 相关的配置、监控和管理功能。

### 相关 API（基于 McpV1 应用）

#### 1. OCR（光学字符识别）功能
- **OCR 识别**：`/api/mcp/v1/ocr/recognize`
  - 功能：OCR 文本识别
  - 方法：POST
- **智能 OCR**：`/api/mcp/v1/ocr/smart-recognize`
  - 功能：智能 OCR，自动选择模型
  - 方法：POST
- **批量 OCR**：`/api/mcp/v1/ocr/batch`
  - 功能：批量 OCR 处理
  - 方法：POST
- **OCR 引擎列表**：`/api/mcp/v1/ocr/engines`
  - 功能：获取可用的 OCR 引擎
  - 方法：GET
- **OCR 引擎信息**：`/api/mcp/v1/ocr/engine-info`
  - 功能：获取 OCR 引擎详细信息
  - 方法：GET

#### 2. 截图管理功能
- **上传截图**：`/api/mcp/v1/screenshots/upload`
  - 功能：上传单个截图
  - 方法：POST
- **上传并合并截图**：`/api/mcp/v1/screenshots/upload-merge`
  - 功能：上传并合并多个截图
  - 方法：POST
- **批量上传截图**：`/api/mcp/v1/screenshots/upload-batch`
  - 功能：批量上传截图
  - 方法：POST
- **获取最新截图**：`/api/mcp/v1/screenshots/latest`
  - 功能：获取最新的截图
  - 方法：GET
- **搜索截图**：`/api/mcp/v1/screenshots/search`
  - 功能：搜索截图
  - 方法：GET
- **截图统计**：`/api/mcp/v1/screenshots/stats`
  - 功能：获取截图统计信息
  - 方法：GET
- **获取所有截图**：`/api/mcp/v1/screenshots`
  - 功能：获取所有截图列表
  - 方法：GET
- **获取截图详情**：`/api/mcp/v1/screenshots/{id}`
  - 功能：根据 ID 获取截图详情
  - 方法：GET
- **获取截图文件**：`/api/mcp/v1/screenshots/{id}/file`
  - 功能：流式传输截图文件
  - 方法：GET
- **获取截图文件（带扩展名）**：`/api/mcp/v1/screenshots/{id}.{ext}`
  - 功能：流式传输截图文件（指定扩展名）
  - 方法：GET
- **删除截图**：`/api/mcp/v1/screenshots/{id}`
  - 功能：删除指定截图
  - 方法：DELETE
- **清空所有截图**：`/api/mcp/v1/screenshots/clear-all/confirm`
  - 功能：清空所有截图（需要确认）
  - 方法：DELETE

#### 3. 任务分发队列功能
- **获取任务分类**：`/api/mcp/v1/task-dispatch/categories`
  - 功能：获取所有任务分类
  - 方法：GET
- **获取分类文件**：`/api/mcp/v1/task-dispatch/categories/{categoryId}/files`
  - 功能：获取分类中的文件
  - 方法：GET
- **创建任务分类**：`/api/mcp/v1/task-dispatch/categories`
  - 功能：创建新的任务分类
  - 方法：POST
- **添加文件到队列**：`/api/mcp/v1/task-dispatch/queue/add-file`
  - 功能：添加文件到任务队列
  - 方法：POST
- **获取队列任务**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/tasks`
  - 功能：获取分类队列中的所有任务
  - 方法：GET
- **获取最后任务**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/last-task`
  - 功能：获取分类队列中的最后一个任务
  - 方法：GET
- **检查最新任务**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest`
  - 功能：检查分类是否有最新任务
  - 方法：GET
- **搜索任务**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/search`
  - 功能：在分类中搜索任务
  - 方法：GET
- **更新任务状态**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status`
  - 功能：更新任务状态
  - 方法：PUT
- **获取队列统计**：`/api/mcp/v1/task-dispatch/queue/{categoryId}/stats`
  - 功能：获取队列统计信息
  - 方法：GET

#### 4. 提示映射管理功能
- **获取所有映射**：`/api/mcp/v1/task-dispatch/mappings`
  - 功能：获取所有提示映射
  - 方法：GET
- **获取分类映射**：`/api/mcp/v1/task-dispatch/mappings/{categoryId}`
  - 功能：获取分类的提示映射
  - 方法：GET
- **更新分类映射**：`/api/mcp/v1/task-dispatch/mappings/{categoryId}`
  - 功能：更新分类的提示映射
  - 方法：PUT
- **重置分类映射**：`/api/mcp/v1/task-dispatch/mappings/{categoryId}/reset`
  - 功能：重置分类的提示映射
  - 方法：POST
- **删除分类映射**：`/api/mcp/v1/task-dispatch/mappings/{categoryId}`
  - 功能：删除分类的提示映射
  - 方法：DELETE

#### 5. 占位符图片功能
- **生成占位符**：`/api/mcp/v1/placeholders/generate`
  - 功能：生成占位符图片
  - 方法：POST
- **获取占位符列表**：`/api/mcp/v1/placeholders`
  - 功能：获取占位符图片列表
  - 方法：GET
- **占位符统计**：`/api/mcp/v1/placeholders/stats`
  - 功能：获取占位符统计信息
  - 方法：GET
- **清理占位符**：`/api/mcp/v1/placeholders/cleanup`
  - 功能：清理旧的占位符
  - 方法：POST
- **下载占位符**：`/api/mcp/v1/placeholders/{uuid}/download`
  - 功能：下载占位符图片
  - 方法：GET
- **删除占位符**：`/api/mcp/v1/placeholders/{uuid}`
  - 功能：删除占位符图片
  - 方法：DELETE

#### 6. 健康检查
- **健康检查**：`/api/mcp/v1/health`
  - 功能：检查 MCP 服务健康状态
  - 方法：GET

### 功能模块说明

#### 1. OCR 管理
- **功能**：管理 OCR 识别服务
- **用途**：
  - 配置 OCR 引擎
  - 查看 OCR 引擎信息
  - 执行 OCR 识别任务
  - 批量处理 OCR 任务

#### 2. 截图管理
- **功能**：管理截图文件
- **用途**：
  - 上传和管理截图
  - 搜索和浏览截图
  - 查看截图统计
  - 清理旧截图

#### 3. 任务分发
- **功能**：管理任务分发队列
- **用途**：
  - 创建和管理任务分类
  - 添加文件到任务队列
  - 查看和处理任务
  - 监控任务状态
  - 查看队列统计

#### 4. 提示映射
- **功能**：管理提示词映射
- **用途**：
  - 将提示词映射到任务分类
  - 配置 AI 模型使用的提示
  - 管理提示模板

#### 5. 占位符管理
- **功能**：管理占位符图片
- **用途**：
  - 生成占位符图片
  - 管理占位符资源
  - 清理过期占位符

### 使用场景
- **OCR 处理**：使用 OCR 识别图片中的文字
- **截图管理**：管理 AI 处理过程中的截图
- **任务队列**：管理需要 AI 处理的任务队列
- **提示配置**：配置 AI 模型使用的提示词
- **资源管理**：管理 MCP 相关的资源文件
- **服务监控**：监控 MCP 服务健康状态

---

## 总结

Laravel API Debug Interface 提供了 7 个主要功能模块，每个模块都有其特定的用途：

1. **API Testing Dashboard**：API 测试和调试
2. **Development Tools**：100+ 在线开发工具
3. **System Information**：系统信息和监控
4. **Vocabulary Learning**：词汇学习系统
5. **Code Browser**：代码浏览和编辑
6. **Static Resources**：静态资源管理
7. **MCP Manager**：MCP 功能管理

这些模块共同构成了一个完整的开发调试平台，为开发者提供了从 API 测试到代码管理、从系统监控到资源管理的全方位支持。

