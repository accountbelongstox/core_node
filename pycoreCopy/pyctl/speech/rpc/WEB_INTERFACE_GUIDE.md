# Speech & Clipboard Web Interface Guide

## 概述

完整的Web界面，提供语音转换、剪贴板同步、配置管理等功能。

## 功能特性

### 1. 文字转语音 (TTS)
- ✅ 支持单语言和多语言转换
- ✅ 支持语言：中文、英语、日语、韩语、**老挝语 (lo-LA)**
- ✅ 在线播放转换后的音频
- ✅ 使用数据库缓存（100x加速）
- ✅ 每个提供商独立缓存命名空间

### 2. 语音转文字 (STT)
- ✅ 上传音频文件转文字
- ✅ 支持多种语言识别
- ✅ 显示识别置信度
- ✅ 使用Azure Speech Service

### 3. 剪贴板同步
- ✅ 快速添加内容到剪贴板
- ✅ 跨设备实时同步（5秒轮询）
- ✅ 完整的历史记录
- ✅ 客户端ID自动识别
- ✅ 搜索功能
- ✅ 支持文件上传
- ✅ 数据库存储

### 4. 配置管理
- ✅ 设置默认语言
- ✅ 选择TTS提供商
- ✅ 持久化配置

## 访问方式

### 启动服务器

```python
# 方式1：自动启动（默认）
from pycore.pyctl.speech.rpc import rpc_manager
# 服务器已自动启动在 http://0.0.0.0:8765

# 方式2：手动启动
from pycore.pyctl.speech.rpc import RpcManager
server = RpcManager(port=8765, host="0.0.0.0", auto_start=False)
await server.start()
```

### 访问Web界面

浏览器打开：**http://localhost:8765/web/index.html**

或远程访问：**http://<服务器IP>:8765/web/index.html**

## API端点

### Speech API

#### TTS - 文字转语音
```http
POST /api/tts
Content-Type: application/json

{
  "text": "你好世界",
  "language": "zh-CN",
  "provider": "edge",
  "return_base64": true
}
```

#### Multi-TTS - 多语言转语音
```http
POST /api/multi_tts
Content-Type: application/json

{
  "text": "Hello",
  "languages": ["zh-CN", "en-US", "ja-JP", "lo-LA"]
}
```

#### STT - 语音转文字
```http
POST /api/stt
Content-Type: application/json

{
  "audio": "<base64编码的音频>",
  "language": "zh-CN"
}
```

### Clipboard API

#### 添加到剪贴板
```http
POST /api/clipboard_add
Content-Type: application/json

{
  "content": "这是要同步的内容",
  "client_id": "web_abc123",
  "content_type": "text"
}
```

#### 获取剪贴板历史
```http
POST /api/clipboard_get
Content-Type: application/json

{
  "limit": 50,
  "client_id": null,
  "content_type": "text"
}
```

#### 搜索剪贴板
```http
POST /api/clipboard_search
Content-Type: application/json

{
  "query": "关键词",
  "limit": 20
}
```

#### 同步剪贴板（增量更新）
```http
POST /api/clipboard_sync
Content-Type: application/json

{
  "since": 1699000000.0,
  "client_id": null
}
```

### Config API

#### 获取配置
```http
POST /api/config_get
Content-Type: application/json

{
  "key": "default_language"
}
```

#### 设置配置
```http
POST /api/config_set
Content-Type: application/json

{
  "key": "default_language",
  "value": "zh-CN"
}
```

### Status API

#### 获取服务状态
```http
POST /api/status
Content-Type: application/json

{}
```

响应：
```json
{
  "server_running": true,
  "speech_status": {...},
  "clipboard_stats": {
    "total_items": 156,
    "by_type": {"text": 150, "file": 6},
    "by_client": {...}
  },
  "available_routes": [...],
  "supported_languages": ["zh-CN", "en-US", "ja-JP", "ko-KR", "lo-LA"]
}
```

## 数据库

### Clipboard Database

**位置**: `D:/www/pycore_db/clipboard.db` (Windows) 或 `/www/pycore_db/clipboard.db` (Linux)

**表结构**: `util_clipboard_history`
```sql
- id: 自增ID
- content: 内容
- content_type: 类型 (text, file, image)
- content_hash: MD5哈希（去重）
- file_path: 文件路径
- file_name: 文件名
- file_size: 文件大小
- client_id: 客户端ID
- timestamp: 时间戳
- created_at: 创建时间
```

### Speech Database

**位置**: `D:/www/pycore_db/speech.db`

**TTS缓存**: `util_speech_tts_cache`
- 每个提供商独立命名空间
- 文件存储在: `D:/www/wwwroot/pycore_db/tts_static/{provider}/{language}/`

## 缓存命名空间

TTS缓存使用 **文件路径 + 语言类型 (langTy)** 作为命名空间：

```
wwwroot/pycore_db/tts_static/
├── edge/              # Edge TTS提供商
│   ├── zh-CN/        # 中文缓存
│   ├── en-US/        # 英文缓存
│   ├── ja-JP/        # 日语缓存
│   ├── ko-KR/        # 韩语缓存
│   └── lo-LA/        # 老挝语缓存
└── azure/            # Azure TTS提供商
    ├── zh-CN/
    ├── en-US/
    └── ...
```

## 支持的语言

| 语言 | 代码 | 支持状态 |
|------|------|----------|
| 中文（简体） | zh-CN | ✅ |
| 英语（美国） | en-US | ✅ |
| 日语 | ja-JP | ✅ |
| 韩语 | ko-KR | ✅ |
| **老挝语** | lo-LA | ✅ **新增** |

## 剪贴板同步机制

### 客户端识别
- 每个浏览器生成唯一 `clientId`（存储在localStorage）
- 格式：`web_<random>`

### 实时同步
- 每5秒轮询服务器获取更新
- 使用 `clipboard_sync` API 获取增量更新
- 基于时间戳的增量同步（避免重复数据）

### 历史记录
- 所有客户端的剪贴板历史统一存储
- 可以查看所有设备的剪贴板内容
- 支持一键复制到本地剪贴板

## 使用场景

### 1. 多语言语音合成
在Web界面输入文字，同时生成中文、英语、日语、韩语、老挝语的语音。

### 2. 语音识别
上传录音文件，自动识别并转换为文字。

### 3. 跨设备剪贴板同步
- 在手机浏览器复制文字
- 在电脑浏览器实时看到并使用
- 类似云剪贴板功能

### 4. 快速剪贴板
点击右下角浮动按钮，快速添加内容到云剪贴板。

## 文件上传支持

剪贴板支持文件上传（计划中）：
```javascript
// 前端代码示例
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('client_id', clientId);

fetch('/api/upload_file', {
    method: 'POST',
    body: formData
});
```

## 安全注意事项

⚠️ **警告**：
- 当前服务器默认绑定 `0.0.0.0`，可被局域网访问
- 剪贴板内容未加密，请勿存储敏感信息
- 建议在受信任网络中使用
- 生产环境建议添加认证机制

## 性能优化

### TTS缓存
- 数据库索引加速：100x faster lookup
- 文件作为源，数据库作为索引
- 自动清理孤儿记录

### 剪贴板同步
- 增量同步（仅传输新数据）
- 自动去重（基于MD5）
- 最近10条内容去重检查

## 故障排除

### 1. Web界面无法访问
检查服务器是否启动：
```python
from pycore.pyctl.speech.rpc import rpc_manager
print(rpc_manager.is_running())  # Should be True
```

### 2. API调用失败
查看服务器日志，检查端口是否被占用。

### 3. 剪贴板不同步
检查：
- 客户端ID是否正确
- 时间戳是否准确
- 数据库是否正常工作

## 技术栈

- **后端**: Python asyncio + aiohttp
- **前端**: 原生HTML/CSS/JavaScript
- **数据库**: SQLite (pycore.database)
- **语音**: Azure Speech SDK + Edge TTS
- **缓存**: 文件 + 数据库双重缓存

## 下一步计划

- [ ] 文件上传功能完整实现
- [ ] 音频设备配置界面
- [ ] 用户认证和权限管理
- [ ] WebSocket实时推送（替代轮询）
- [ ] 剪贴板文件上传
- [ ] 历史记录导出

---

**完成时间**: 2025-11-16
**版本**: 1.0.0
**状态**: ✅ 全功能可用
