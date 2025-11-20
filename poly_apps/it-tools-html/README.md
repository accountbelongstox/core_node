# IT Tools - Static Frontend

**Version**: 1.0.0
**Date**: 2025-01-07

> 纯静态前端版本的IT Tools，包含88+开发者工具，通过API与后端通信。

---

## 📋 目录

1. [概述](#概述)
2. [功能特性](#功能特性)
3. [技术栈](#技术栈)
4. [快速开始](#快速开始)
5. [API配置](#api配置)
6. [项目结构](#项目结构)
7. [工具列表](#工具列表)
8. [开发指南](#开发指南)
9. [API文档](#api文档)
10. [部署](#部署)

---

## 概述

这是IT Tools的纯静态HTML/JavaScript版本，所有业务逻辑通过RESTful API调用后端服务处理。相比原版Vue动态应用，本版本：

- ✅ **零依赖构建** - 无需Node.js运行时，直接在浏览器运行
- ✅ **后端分离** - 所有计算密集型操作在服务器端处理
- ✅ **资源占用低** - 纯静态文件，可部署到任何静态托管服务
- ✅ **快速部署** - 上传即用，无需编译或构建过程
- ✅ **易于维护** - 前后端完全分离，职责清晰

---

## 功能特性

### 核心功能

- 🔐 **15个加密安全工具** - 哈希、加密、密钥生成、OTP、密码分析等
- 🔄 **13个格式转换器** - JSON/YAML/CSV/Base64/颜色/温度等格式互转
- 🌐 **15个Web开发工具** - JSON处理、JWT解析、QR码、HTTP状态码等
- 🔢 **3个数学计算工具** - 表达式计算、百分比、ETA
- 🖥️ **6个网络工具** - IP计算、子网分析、MAC地址、权限计算等
- 📝 **14个文本处理工具** - 统计、对比、正则测试、IBAN、电话等
- 🎥 **媒体工具** - 图片/视频压缩（计划中）

**已实现后端API**: 66个核心端点

### UI特性

- 🎨 **现代化界面** - 使用Tailwind CSS设计
- 🔍 **实时搜索** - 快速查找所需工具
- 📁 **分类筛选** - 按类别浏览工具
- 📋 **一键复制** - 快速复制结果
- ⚙️ **可配置API** - 支持自定义后端地址
- 📱 **响应式设计** - 完美适配移动设备

---

## 技术栈

### 前端框架

- **Alpine.js 3.x** - 轻量级响应式框架 (~15KB)
- **Tailwind CSS** - 实用优先的CSS框架
- **Font Awesome 6** - 图标库

### 特点

- **完全离线** - 所有依赖已本地化，无需CDN
- **无构建步骤** - 开箱即用
- **浏览器原生** - ES6+ JavaScript
- **RESTful API** - 标准HTTP通信
- **LocalStorage** - 本地设置保存
- **集中配置** - 所有API端点和参数统一管理

---

## 快速开始

### 方式一：本地文件访问

```bash
# 克隆或下载项目
cd it-tools-html

# 使用任意HTTP服务器
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

访问 `http://localhost:8000`

### 方式二：直接打开

双击 `index.html` 文件，在浏览器中打开（某些功能可能需要HTTP服务器）。

### 方式三：部署到服务器

```bash
# 将所有文件上传到Web服务器
# Nginx配置示例
server {
    listen 80;
    server_name tools.example.com;
    root /var/www/it-tools-html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## API配置

### 默认API地址

```
https://api.si.12gm.com/it-tools/v1
```

### 修改API地址

1. **通过界面设置**（推荐）
   - 点击右上角设置图标 ⚙️
   - 输入新的API Base URL
   - 点击"Save Settings"

2. **修改配置文件**
   ```javascript
   // 在 config.js 中修改（第6行）
   API_BASE_URL: 'https://your-api.com/it-tools/v1'
   ```

3. **环境变量**（需要自行实现）
   ```javascript
   // 在 config.js 中修改
   API_BASE_URL: window.ENV?.API_BASE_URL || 'https://api.si.12gm.com/it-tools/v1'
   ```

**注意**: 所有API端点和配置现已集中在 `config.js` 文件中，无需在多个文件中修改。

---

## 项目结构

```
it-tools-html/
├── index.html                          # 主页面
├── config.js                          # 集中配置文件（API端点、参数定义）
├── app.js                             # 应用主逻辑
├── tools.js                           # 工具数据生成器
├── tool-implementations.js            # 工具实现（第1部分）
├── tool-implementations-extended.js   # 工具实现（第2部分）
├── API_DOCUMENTATION.md               # API完整文档
├── README.md                          # 本文件
└── assets/                            # 本地静态资源
    ├── js/                            # JavaScript库
    │   ├── alpine.min.js              # Alpine.js 3.13.3
    │   └── tailwind.min.js            # Tailwind CSS 3.4.1
    ├── css/                           # CSS样式
    │   └── fontawesome.min.css        # Font Awesome 6.5.1
    └── webfonts/                      # 字体文件
        ├── fa-brands-400.woff2
        ├── fa-regular-400.woff2
        └── fa-solid-900.woff2
```

### 文件说明

| 文件 | 说明 | 大小 |
|------|------|------|
| `index.html` | 主HTML页面，包含布局和模态框 | ~8KB |
| `config.js` | 集中配置（API端点、工具定义、参数） | ~10KB |
| `app.js` | Alpine.js应用逻辑，API调用封装 | ~5KB |
| `tools.js` | 从config.js生成工具数据 | ~1KB |
| `tool-implementations.js` | 核心工具UI实现 | ~18KB |
| `tool-implementations-extended.js` | 扩展工具UI实现 | ~14KB |
| `assets/` | 本地静态资源（JS、CSS、字体） | ~841KB |

**总大小**: ~897KB（未压缩，完全离线可用）

---

## 工具列表

### 🔐 加密与安全 (12个)

1. **Token Generator** - 生成随机令牌
2. **Hash Text** - MD5/SHA1/SHA256/SHA512哈希
3. **Bcrypt** - 密码哈希与验证
4. **UUID Generator** - UUID v4生成
5. **ULID Generator** - ULID生成
6. **Encryption** - AES/DES加密解密
7. **BIP39 Generator** - 助记词生成
8. **Basic Auth Generator** - Basic认证头生成
9. **RSA Key Pair** - RSA密钥对生成
10. **HMAC Generator** - HMAC签名生成
11. **OTP Generator** - TOTP/HOTP生成
12. **Password Strength** - 密码强度分析

### 🔄 格式转换器 (25个)

13. **Base64 String** - Base64编码/解码
14. **Base64 File** - 文件Base64转换
15. **Color Converter** - 颜色格式转换
16. **Case Converter** - 文本大小写转换
17. **Date Time** - 日期时间转换
18. **Integer Base** - 进制转换
19. **Roman Numeral** - 罗马数字转换
20. **Temperature** - 温度单位转换
21-37. **JSON/YAML/XML/TOML/CSV** - 各种格式互转
38. **Docker Run to Compose** - Docker命令转换
39. **Text to Binary** - 文本转二进制
40. **Text to Unicode** - Unicode转换
41. **Text to NATO** - NATO音标转换
42. **URL Encoder** - URL编码/解码
43. **HTML Entities** - HTML实体转换
44. **List Converter** - 列表格式转换
45. **Slugify** - URL友好化

### 🌐 Web开发 (15个)

46. **JSON Viewer** - JSON查看器
47. **JSON Minify** - JSON压缩
48. **JSON Diff** - JSON对比
49. **JWT Parser** - JWT解析
50. **HTML WYSIWYG** - HTML编辑器
51. **Markdown to HTML** - Markdown转换
52. **SQL Prettify** - SQL格式化
53. **XML Formatter** - XML格式化
54. **YAML Viewer** - YAML查看器
55. **HTTP Status Codes** - HTTP状态码参考
56. **MIME Types** - MIME类型查询
57. **Meta Tag Generator** - SEO标签生成
58. **QR Code Generator** - 二维码生成
59. **WiFi QR Code** - WiFi二维码生成
60. **SVG Placeholder** - SVG占位图生成

### 🔢 数学计算 (5个)

61. **Math Evaluator** - 数学表达式计算
62. **Percentage** - 百分比计算
63. **ETA Calculator** - 到达时间估算
64. **Chronometer** - 计时器
65. **Benchmark** - 性能基准测试

### 🖥️ 网络与系统 (11个)

66. **IPv4 Converter** - IPv4格式转换
67. **IPv4 Subnet** - 子网计算
68. **IPv4 Range** - IP范围展开
69. **IPv6 ULA** - IPv6 ULA生成
70. **MAC Generator** - MAC地址生成
71. **MAC Lookup** - MAC地址查询
72. **User Agent Parser** - UA解析
73. **Device Info** - 设备信息
74. **Chmod Calculator** - 文件权限计算
75. **Port Generator** - 随机端口生成
76. **Keycode Info** - 键码信息

### 📝 文本处理 (18个)

77. **Text Statistics** - 文本统计
78. **Text Diff** - 文本对比
79. **Lorem Ipsum** - 占位文本生成
80. **ASCII Art** - ASCII艺术字
81. **String Obfuscator** - 字符串混淆
82. **Regex Tester** - 正则表达式测试
83. **Regex Memo** - 正则速查表
84. **Crontab Generator** - Cron表达式生成
85. **Email Normalizer** - 邮箱标准化
86. **Phone Parser** - 电话号码解析
87. **Numeronym** - 数字缩写生成
88. **Safelink Decoder** - 安全链接解码
89. **IBAN Validator** - IBAN验证
90. **URL Parser** - URL解析
91. **Emoji Picker** - Emoji选择器
92. **Git Memo** - Git命令速查

### 🎥 媒体工具 (3个)

93. **Camera Recorder** - 摄像头录制（客户端）
94. **Image Compressor** - 图片压缩
95. **Video Compressor** - 视频压缩

---

## 开发指南

### 添加新工具

#### 1. 在 `config.js` 中定义工具和端点

```javascript
// 在 CONFIG.ENDPOINTS 中添加端点
CONVERTER: {
    MY_TOOL: '/converter/my-tool'
}

// 在 CONFIG.TOOLS 中定义工具
'my_new_tool': {
    name: 'My New Tool',
    description: 'Description of what it does',
    category: 'converter',
    icon: '<i class="fas fa-magic"></i>',
    endpoint: 'CONVERTER.MY_TOOL',  // 使用key引用
    method: 'POST',
    params: {
        input: { type: 'string', required: true }
    },
    keywords: ['keyword1', 'keyword2']
}
```

#### 2. 创建工具实现函数

在 `tool-implementations.js` 或新文件中：

```javascript
window.render_my_new_tool = function() {
    return `
        <div x-data="myNewToolData()" class="space-y-4">
            <!-- 工具UI -->
            <input type="text" x-model="input" class="w-full px-3 py-2 border rounded-md">
            <button @click="process()" class="bg-blue-600 text-white px-4 py-2 rounded-md">
                Process
            </button>
            <div x-show="result" x-text="result"></div>
        </div>

        <script>
            function myNewToolData() {
                return {
                    input: '',
                    result: '',

                    async process() {
                        const response = await fetch(CONFIG.getEndpointUrl('CONVERTER.MY_TOOL'), {
                            method: 'POST',
                            headers: CONFIG.REQUEST.HEADERS,
                            body: JSON.stringify({ input: this.input })
                        });
                        const data = await response.json();
                        this.result = data.data.result;
                    }
                };
            }
        </script>
    `;
};
```

#### 3. 在 `index.html` 中引入实现文件

```html
<script src="my-tool-implementations.js"></script>
```

### 自定义样式

修改 `index.html` 中的 `<style>` 标签或添加外部CSS文件：

```css
.custom-tool-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}
```

---

## API文档

完整的API文档请查看 [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

### API端点格式

```
POST https://api.si.12gm.com/it-tools/v1/{category}/{tool}
```

### 请求示例

```javascript
// Hash Text
POST /crypto/hash
{
  "text": "hello world",
  "algorithm": "sha256"
}

// Response
{
  "success": true,
  "data": {
    "algorithm": "sha256",
    "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### 错误处理

```javascript
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input provided",
    "details": {}
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

---

## 部署

### 静态托管服务

#### Netlify

```bash
# 1. 安装Netlify CLI
npm install -g netlify-cli

# 2. 登录
netlify login

# 3. 部署
netlify deploy --prod --dir=.
```

#### Vercel

```bash
# 1. 安装Vercel CLI
npm install -g vercel

# 2. 部署
vercel --prod
```

#### GitHub Pages

```bash
# 1. 推送到GitHub仓库
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/it-tools-html.git
git push -u origin main

# 2. 在仓库Settings -> Pages中启用GitHub Pages
# 选择main分支，根目录
```

#### CloudFlare Pages

1. 登录CloudFlare Dashboard
2. Pages -> Create a project
3. 连接Git仓库或上传文件
4. 部署设置：
   - Build command: (留空)
   - Build output directory: /
   - Root directory: /

### 自托管（Nginx）

```nginx
server {
    listen 80;
    server_name tools.yourdomain.com;

    root /var/www/it-tools-html;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # CORS（如果API在不同域名）
    add_header Access-Control-Allow-Origin *;
}
```

### Docker部署

```dockerfile
FROM nginx:alpine

COPY . /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```bash
# 构建
docker build -t it-tools-html .

# 运行
docker run -d -p 80:80 it-tools-html
```

---

## 后端对接指南

### 后端开发者须知

1. **API规范**
   - 遵循 `API_DOCUMENTATION.md` 中的接口定义
   - 返回标准JSON格式
   - 实现CORS支持
   - 添加速率限制（推荐100请求/分钟）

2. **推荐技术栈**
   - Node.js (Express/Fastify)
   - Python (FastAPI/Flask)
   - Go (Gin/Echo)
   - Java (Spring Boot)

3. **示例实现**（Node.js + Express）

```javascript
const express = require('express');
const app = express();

app.use(express.json());
app.use(cors());

// Hash endpoint
app.post('/crypto/hash', async (req, res) => {
    const { text, algorithm } = req.body;

    const crypto = require('crypto');
    const hash = crypto.createHash(algorithm).update(text).digest('hex');

    res.json({
        success: true,
        data: {
            algorithm,
            hash
        },
        timestamp: new Date().toISOString()
    });
});

app.listen(3000);
```

---

## 浏览器兼容性

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+
- ⚠️ IE 11 (不支持)

---

## 性能优化

### 已实现

- ✅ 本地资源（Tailwind CSS, Alpine.js, Font Awesome）
- ✅ 防抖处理（搜索、实时计算）
- ✅ 懒加载（工具内容按需渲染）
- ✅ LocalStorage缓存（设置保存）
- ✅ 集中配置管理（config.js）

### 可优化

- 📦 **代码分割** - 按工具类别拆分JS文件
- 🗜️ **压缩** - 使用Terser压缩JavaScript
- 🖼️ **图片优化** - 使用WebP格式
- 🚀 **Service Worker** - 离线支持与缓存

---

## 许可证

GNU General Public License v3.0

基于原项目: [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools)

---

## 贡献

欢迎提交Issue和Pull Request！

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 更新日志

### v1.0.0 (2025-01-07)

- ✨ 初始版本发布
- ✅ 88+工具定义
- ✅ 完整API文档
- ✅ 核心工具实现
- ✅ 响应式UI设计
- ✅ 搜索与分类功能
- ✅ 完全离线支持（本地资源）
- ✅ 集中配置管理（config.js）

---

## 联系方式

- **项目主页**: https://github.com/your-username/it-tools-html
- **API文档**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **问题反馈**: https://github.com/your-username/it-tools-html/issues

---

**Made with ❤️ for developers**

**版本**: 1.0.0
**最后更新**: 2025-01-07
