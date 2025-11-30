# Backend Implementation Guide

> IT Tools后端API实现指南

---

## 目录

1. [概述](#概述)
2. [技术选型](#技术选型)
3. [API规范](#api规范)
4. [实现示例](#实现示例)
5. [部署建议](#部署建议)
6. [测试](#测试)

---

## 概述

本文档为后端开发者提供IT Tools API的实现指南。前端通过RESTful API与后端通信，所有工具的业务逻辑在后端实现。

### 核心要求

- ✅ RESTful API设计
- ✅ JSON格式请求/响应
- ✅ CORS支持
- ✅ 错误处理
- ✅ 速率限制
- ✅ 输入验证
- ✅ 日志记录

---

## 技术选型

### 推荐技术栈

#### Option 1: Node.js

```json
{
  "runtime": "Node.js 18+",
  "framework": "Express / Fastify",
  "libraries": [
    "crypto-js",
    "bcrypt",
    "uuid",
    "js-yaml",
    "xml2js",
    "qrcode",
    "sharp"
  ]
}
```

#### Option 2: Python

```python
{
    "runtime": "Python 3.10+",
    "framework": "FastAPI / Flask",
    "libraries": [
        "cryptography",
        "bcrypt",
        "PyYAML",
        "xmltodict",
        "qrcode",
        "Pillow"
    ]
}
```

#### Option 3: Go

```go
{
    "runtime": "Go 1.20+",
    "framework": "Gin / Echo",
    "libraries": [
        "crypto",
        "bcrypt",
        "yaml.v3",
        "encoding/xml",
        "github.com/skip2/go-qrcode"
    ]
}
```

---

## API规范

### 基础URL

```
https://api.si.12gm.com/it-tools/v1
```

### 请求格式

```http
POST /crypto/hash HTTP/1.1
Host: api.si.12gm.com
Content-Type: application/json

{
  "text": "hello world",
  "algorithm": "sha256"
}
```

### 成功响应

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "algorithm": "sha256",
    "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### 错误响应

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Text is required",
    "details": {
      "field": "text"
    }
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### 错误代码

| 代码 | HTTP状态 | 说明 |
|------|----------|------|
| `INVALID_INPUT` | 400 | 输入验证失败 |
| `PROCESSING_ERROR` | 500 | 处理过程出错 |
| `UNSUPPORTED_FORMAT` | 400 | 不支持的格式 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过速率限制 |
| `AUTHENTICATION_REQUIRED` | 401 | 需要认证 |
| `AUTHORIZATION_FAILED` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |

---

## 实现示例

### Node.js + Express

#### 1. 项目初始化

```bash
mkdir it-tools-api
cd it-tools-api
npm init -y

npm install express cors helmet express-rate-limit
npm install crypto-js bcrypt uuid js-yaml xml2js qrcode sharp
npm install --save-dev nodemon
```

#### 2. 服务器设置

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 限制100个请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});
app.use(limiter);

// 路由
app.use('/crypto', require('./routes/crypto'));
app.use('/converter', require('./routes/converter'));
app.use('/web', require('./routes/web'));
app.use('/math', require('./routes/math'));
app.use('/network', require('./routes/network'));
app.use('/text', require('./routes/text'));
app.use('/media', require('./routes/media'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    },
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`IT Tools API running on port ${PORT}`);
});
```

#### 3. 加密路由示例

```javascript
// routes/crypto.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Hash Text
router.post('/hash', (req, res) => {
  try {
    const { text, algorithm = 'sha256' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Text is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const supportedAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!supportedAlgorithms.includes(algorithm)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: `Algorithm must be one of: ${supportedAlgorithms.join(', ')}`
        },
        timestamp: new Date().toISOString()
      });
    }

    const hash = crypto.createHash(algorithm).update(text).digest('hex');

    res.json({
      success: true,
      data: {
        algorithm,
        hash
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Bcrypt Hash
router.post('/bcrypt/hash', async (req, res) => {
  try {
    const { password, rounds = 10 } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Password is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const hash = await bcrypt.hash(password, rounds);

    res.json({
      success: true,
      data: { hash },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Bcrypt Verify
router.post('/bcrypt/verify', async (req, res) => {
  try {
    const { password, hash } = req.body;

    if (!password || !hash) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Password and hash are required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const valid = await bcrypt.compare(password, hash);

    res.json({
      success: true,
      data: { valid },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// UUID Generator
router.post('/uuid/generate', (req, res) => {
  try {
    const { count = 1, version = 4, uppercase = false } = req.body;

    if (count < 1 || count > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Count must be between 1 and 100'
        },
        timestamp: new Date().toISOString()
      });
    }

    const uuids = Array.from({ length: count }, () => {
      let uuid = uuidv4();
      return uppercase ? uuid.toUpperCase() : uuid;
    });

    res.json({
      success: true,
      data: { uuids },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Token Generator
router.post('/token/generate', (req, res) => {
  try {
    const { length = 32, charset = 'alphanumeric', includeSymbols = false, count = 1 } = req.body;

    const charsets = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      lowercase: 'abcdefghijklmnopqrstuvwxyz0123456789',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      hex: '0123456789abcdef'
    };

    let chars = charsets[charset] || charsets.alphanumeric;
    if (includeSymbols) {
      chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    const tokens = Array.from({ length: count }, () => {
      return Array.from({ length }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('');
    });

    res.json({
      success: true,
      data: { tokens },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
```

#### 4. 转换器路由示例

```javascript
// routes/converter.js
const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const xml2js = require('xml2js');

// Base64 Encode
router.post('/base64/encode', (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Text is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const encoded = Buffer.from(text).toString('base64');

    res.json({
      success: true,
      data: { encoded },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Base64 Decode
router.post('/base64/decode', (req, res) => {
  try {
    const { encoded } = req.body;

    if (!encoded) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Encoded text is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const decoded = Buffer.from(encoded, 'base64').toString('utf8');

    res.json({
      success: true,
      data: { decoded },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// JSON to YAML
router.post('/json-to-yaml', (req, res) => {
  try {
    const { json } = req.body;

    if (!json) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'JSON is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const obj = JSON.parse(json);
    const yamlStr = yaml.dump(obj);

    res.json({
      success: true,
      data: { yaml: yamlStr },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// YAML to JSON
router.post('/yaml-to-json', (req, res) => {
  try {
    const { yaml: yamlStr } = req.body;

    if (!yamlStr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'YAML is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const obj = yaml.load(yamlStr);
    const json = JSON.stringify(obj);

    res.json({
      success: true,
      data: { json },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Case Converter
router.post('/case', (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Text is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Helper functions
    const toCamelCase = str => str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    const toPascalCase = str => {
      const camel = toCamelCase(str);
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    };
    const toSnakeCase = str => str.replace(/[\s-]+/g, '_').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    const toKebabCase = str => str.replace(/[\s_]+/g, '-').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const toScreamingSnakeCase = str => toSnakeCase(str).toUpperCase();
    const toTitleCase = str => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

    res.json({
      success: true,
      data: {
        camelCase: toCamelCase(text),
        PascalCase: toPascalCase(text),
        snake_case: toSnakeCase(text),
        'kebab-case': toKebabCase(text),
        SCREAMING_SNAKE_CASE: toScreamingSnakeCase(text),
        lowercase: text.toLowerCase(),
        UPPERCASE: text.toUpperCase(),
        'Title Case': toTitleCase(text)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
```

---

## 部署建议

### 1. Docker部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

```bash
docker build -t it-tools-api .
docker run -d -p 3000:3000 --name it-tools-api it-tools-api
```

### 2. PM2部署

```bash
npm install -g pm2
pm2 start server.js --name it-tools-api
pm2 save
pm2 startup
```

### 3. Nginx反向代理

```nginx
location /it-tools/v1/ {
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 测试

### 使用cURL测试

```bash
# Hash Text
curl -X POST https://api.si.12gm.com/it-tools/v1/crypto/hash \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world","algorithm":"sha256"}'

# Base64 Encode
curl -X POST https://api.si.12gm.com/it-tools/v1/converter/base64/encode \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'

# UUID Generate
curl -X POST https://api.si.12gm.com/it-tools/v1/crypto/uuid/generate \
  -H "Content-Type: application/json" \
  -d '{"count":5}'
```

### 使用Postman

导入以下集合：

```json
{
  "info": {
    "name": "IT Tools API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Hash Text",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"text\":\"hello world\",\"algorithm\":\"sha256\"}"
        },
        "url": {
          "raw": "https://api.si.12gm.com/it-tools/v1/crypto/hash",
          "protocol": "https",
          "host": ["api", "si", "12gm", "com"],
          "path": ["it-tools", "v1", "crypto", "hash"]
        }
      }
    }
  ]
}
```

---

## 性能优化

1. **缓存** - 使用Redis缓存常见请求
2. **异步处理** - 大文件处理使用队列
3. **CDN** - 静态资源使用CDN
4. **负载均衡** - 多实例部署
5. **监控** - 使用APM工具监控性能

---

## 安全建议

1. ✅ 输入验证和净化
2. ✅ SQL注入防护（如使用数据库）
3. ✅ XSS防护
4. ✅ CSRF防护
5. ✅ 速率限制
6. ✅ HTTPS强制
7. ✅ API密钥认证（可选）
8. ✅ 日志记录和监控

---

## 完整API列表

请参考 [API_DOCUMENTATION.md](API_DOCUMENTATION.md) 获取所有88个工具的API端点详情。

---

**Last Updated**: 2025-01-07
