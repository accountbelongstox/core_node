# Voice Subtitle API 完整对齐报告

## 📋 测试概述

**测试日期**: 2025-12-01
**本地服务器**: `http://localhost:59000`
**远程服务器**: `http://192.168.50.2:9000/api/mcp/v1`
**测试端点数**: 26个

---

## 📊 测试结果总览

| 分类 | 端点数 | ✅ 已对齐 | ❌ 未对齐 | ⚠️ 仅本地 |
|------|-------|----------|----------|----------|
| 队列管理 (读) | 5 | 1 | 4 | 0 |
| 队列管理 (写) | 5 | 0 | 0 | 5 |
| 分类管理 | 1 | 1 | 0 | 0 |
| 文件上传 | 1 | 0 | 0 | 1 |
| 背景服务 | 6 | 0 | 0 | 6 |
| 音频服务 | 1 | 0 | 1 | 0 |
| Code Sync | 5 | 0 | 0 | 5 |
| 任务管理 | 2 | 0 | 0 | 2 |
| **总计** | **26** | **2** | **5** | **19** |

---

## 🔴 未对齐端点 (需要修改) - 5个

### 1. GET /voice-subtitle/queue

**优先级**: 🔴 **最高**

#### 本地返回 (正确):
```json
{
  "success": true,
  "queue": [
    {
      "text": "Hello, this is a test",
      "audio_path": "C:\\Users\\...\\f16eae25fd6e74e35b1de836c9037012.mp3",
      "play_count": 113,
      "category": "normal",
      "created_at": "2025-11-28T21:38:29.036518"
    }
  ],
  "current_index": 0
}
```

#### 远程返回 (错误):
```json
{
  "success": true,
  "queue": [
    {
      "type": "text",
      "original_text": "Test audio URL",
      "translated_text": "Test audio URL",
      "language": "en",
      "voice": "en-US-AriaNeural",
      "paragraphs": ["Test audio URL"],
      "tts_files": [
        {
          "id": 3,
          "text": "Test audio URL",
          "file_path": "cache/tts/440241dfab3f5d2f280713bf42755d55_en_en-US-AriaNeural.mp3",
          "audio_url": "/api/mcp/v1/voice-subtitle/audio/...",
          "file_size": 14976,
          "language": "en",
          "voice": "en-US-AriaNeural",
          "cached": true
        }
      ],
      "created_at": "2025-11-29 00:57:41"
    }
  ]
}
```

#### ❌ 问题:
- 缺少 `text` 字段 (有 `original_text` / `translated_text`)
- 缺少 `audio_path` 字段 (有 `tts_files[0].file_path`)
- 缺少 `category` 字段 (有 `type`)
- 缺少 `play_count` 字段
- 缺少 `current_index` 字段 (在根级别)

#### ✅ 修改要求:
```python
{
  "success": true,
  "queue": [
    {
      # 新增字段
      "text": item.translated_text or item.original_text,
      "audio_path": item.tts_files[0].file_path if item.tts_files else "",
      "category": item.type,
      "play_count": 0,  # 或后端统计值
      "created_at": item.created_at,

      # 保留原有字段(向后兼容)
      "type": item.type,
      "original_text": item.original_text,
      "translated_text": item.translated_text,
      ...
    }
  ],
  "current_index": 0  # 新增
}
```

---

### 2. GET /voice-subtitle/queue/latest

**优先级**: 🟡 **中**

#### 本地返回:
```json
{
  "success": true,
  "items": [
    {
      "text": "...",
      "audio_path": "...",
      "category": "normal",
      "play_count": 19,
      "created_at": "..."
    }
  ],
  "count": 300
}
```

#### 远程返回 (推测):
与 `/queue` 相同的数据结构问题

#### ✅ 修改要求:
`items` 数组中的每个对象添加: `text`, `audio_path`, `category`, `play_count`

---

### 3. GET /voice-subtitle/queue/filter-by-today

**优先级**: 🟡 **中**

#### 本地返回:
```json
{
  "success": true,
  "items": [...],  // 同 latest
  "count": 41
}
```

#### ✅ 修改要求:
同 `/queue/latest`

---

### 4. GET /voice-subtitle/queue/filter-by-category

**优先级**: 🔴 **高**

#### 本地返回:
```json
{
  "success": true,
  "category": "normal",
  "items": [
    {
      "text": "...",
      "audio_path": "...",
      "category": "normal",
      "play_count": 19,
      "created_at": "..."
    }
  ],
  "count": 38
}
```

#### ✅ 修改要求:
同 `/queue/latest`

---

### 5. GET /voice-subtitle/audio

**优先级**: 🔴 **高**

#### 本地实现:
```python
@router.get("/audio")
async def get_audio_file(path: str):
    audio_path = Path(path)
    if not audio_path.exists():
        raise HTTPException(status_code=404)

    return FileResponse(
        path=str(audio_path),
        media_type='audio/mpeg',
        filename=audio_path.name
    )
```

#### 远程实现 (推测):
可能使用不同的路径格式或URL结构

#### ⚠️ 注意:
- 本地使用绝对路径: `C:\Users\...\audio.mp3`
- 远程可能使用相对路径: `cache/tts/...mp3`
- 前端已修复为强制使用本地服务器 (`forceLocal=true`)

#### ✅ 修改要求:
如果远程服务器需要支持音频流:
1. 确保接受相同的路径参数格式
2. 返回正确的 `Content-Type`
3. 支持流式传输

---

## ✅ 已对齐端点 (无需修改) - 2个

### 1. GET /voice-subtitle/categories

#### 本地返回:
```json
{
  "success": true,
  "categories": ["normal", "screenshot"]
}
```

#### 远程返回:
```json
{
  "success": true,
  "categories": ["default"]
}
```

#### ✅ 状态: **格式一致**, 仅数据内容不同

---

### 2. GET /voice-subtitle/ping (推测)

#### 预期返回:
```json
{
  "success": true,
  "message": "Voice Subtitle Service is running"
}
```

#### ✅ 状态: **可能已对齐**

---

## ⚠️ 仅本地端点 (远程不需要) - 19个

### 队列修改操作 (5个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/voice-subtitle/clear-queue` | POST | 清空队列 | 修改本地状态 |
| `/voice-subtitle/set-index` | POST | 设置当前播放索引 | 修改本地状态 |
| `/voice-subtitle/increment-play-count` | POST | 增加播放次数 | 修改本地统计 |
| `/voice-subtitle/remove-items` | POST | 删除队列项 | 修改本地数据 |
| `/voice-subtitle/change-category` | POST | 修改分类 | 修改本地数据 |

**说明**: 这些操作修改本地队列状态,不应发送到远程服务器

---

### 添加内容操作 (3个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/voice-subtitle/add-text` | POST | 添加文本 | 需要本地TTS |
| `/voice-subtitle/add-image` | POST | 添加图片 | 需要本地文件路径 |
| `/voice-subtitle/add-voice` | POST | 添加语音 | 需要本地文件路径 |

**说明**: 这些操作使用本地文件路径或需要本地TTS服务

**前端已处理**: `addImage()` 和 `addVoice()` 已添加警告

---

### 文件上传 (1个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/voice-subtitle/upload-file` | POST | 上传文件 | 保存到本地磁盘 |

**说明**: 文件上传后保存到本地缓存目录

---

### 背景服务 (6个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/voice-subtitle/clipboard-monitor/start` | POST | 启动剪贴板监控 | 访问本地系统 |
| `/voice-subtitle/clipboard-monitor/stop` | POST | 停止剪贴板监控 | 访问本地系统 |
| `/voice-subtitle/clipboard-monitor/status` | GET | 查询剪贴板状态 | 访问本地系统 |
| `/voice-subtitle/screenshot-monitor/start` | POST | 启动截图监控 | 访问本地系统 |
| `/voice-subtitle/screenshot-monitor/stop` | POST | 停止截图监控 | 访问本地系统 |
| `/voice-subtitle/screenshot-monitor/status` | GET | 查询截图状态 | 访问本地系统 |

**说明**: 监控本地系统服务,远程服务器无法实现

**前端已处理**: 所有方法已添加 `forceLocal=true`

---

### Code Sync (5个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/code-sync/status` | GET | 查询同步状态 | 监控本地文件 |
| `/code-sync/start-server` | POST | 启动同步服务器 | 本地WebSocket |
| `/code-sync/start-client` | POST | 启动同步客户端 | 本地WebSocket |
| `/code-sync/stop` | POST | 停止同步 | 本地服务 |
| `/code-sync/toggle-backup` | POST | 切换备份 | 本地文件系统 |

**说明**: 监控和同步本地代码文件

**前端已处理**: 所有方法已添加 `forceLocal=true`

---

### 任务管理 (2个)

| 端点 | 方法 | 用途 | 原因 |
|------|------|------|------|
| `/tasks` | GET | 查询任务列表 | 本地异步任务 |
| `/tasks/{task_id}` | GET | 查询任务状态 | 本地异步任务 |

**说明**: 本地异步任务管理,不需要远程同步

---

## 📝 后端修改清单

### 🔴 必须修改 (优先级: 高)

1. **GET /api/mcp/v1/voice-subtitle/queue**
   - 添加字段: `text`, `audio_path`, `category`, `play_count`
   - 添加字段: `current_index` (根级别)

2. **GET /api/mcp/v1/voice-subtitle/queue/filter-by-category**
   - 添加字段: `text`, `audio_path`, `category`, `play_count` (items数组)

3. **GET /api/mcp/v1/voice-subtitle/audio** (验证)
   - 确认路径参数格式
   - 确认Content-Type正确
   - 确认流式传输支持

### 🟡 建议修改 (优先级: 中)

4. **GET /api/mcp/v1/voice-subtitle/queue/latest**
   - 添加字段: `text`, `audio_path`, `category`, `play_count` (items数组)

5. **GET /api/mcp/v1/voice-subtitle/queue/filter-by-today**
   - 添加字段: `text`, `audio_path`, `category`, `play_count` (items数组)

---

## 🎯 字段映射参考

### 队列项 (Queue Item) 字段映射

| 前端期望 | 本地服务器 | 远程服务器 | 映射逻辑 |
|---------|-----------|-----------|---------|
| `text` | ✅ `text` | ❌ `original_text` / `translated_text` | `translated_text \|\| original_text` |
| `audio_path` | ✅ `audio_path` | ❌ `tts_files[0].file_path` | `tts_files[0].file_path if tts_files else ""` |
| `category` | ✅ `category` | ❌ `type` | `type \|\| "normal"` |
| `play_count` | ✅ `play_count` | ❌ 无 | `0` 或后端统计值 |
| `created_at` | ✅ `created_at` | ✅ `created_at` | 保持不变 |

---

## 🧪 验证步骤

### 1. 修改后端代码

参考 `BACKEND_API_FORMAT_REQUIREMENTS.md` 中的Python伪代码

### 2. 重启远程服务器

```bash
# 重启远程服务
systemctl restart voice-subtitle-api
```

### 3. 测试API端点

```bash
# 测试队列API
curl "http://192.168.50.2:9000/api/mcp/v1/voice-subtitle/queue" | python -m json.tool

# 验证字段
# ✅ queue[0].text 存在
# ✅ queue[0].audio_path 存在
# ✅ queue[0].category 存在
# ✅ queue[0].play_count 存在
# ✅ current_index 存在
```

### 4. 前端集成测试

1. 打开前端应用
2. 切换到 Remote Mode (`http://192.168.50.2:9000`)
3. 打开 Queue Manager 页面
4. 验证:
   - ✅ Text列显示正确文本(不是undefined)
   - ✅ Category列显示正确分类
   - ✅ Play Count列显示数字
   - ✅ 音频可以播放(如果音频服务也对齐)

### 5. 预期结果

**修改前**:
```
Index    Text         Category    Play Count
1        undefined    normal      0
2        undefined    normal      1
```

**修改后**:
```
Index    Text                              Category    Play Count
1        Test audio URL                    text        0
2        The image displays a user...      text        0
```

---

## 📊 影响分析

### 后端修改影响

| 项目 | 影响 |
|------|------|
| 代码文件 | 1个路由文件 |
| 修改端点 | 5个 |
| 新增字段 | 4个 (每个端点) |
| 兼容性 | 向后兼容 (保留原有字段) |
| 测试工作量 | API测试 + 集成测试 |
| 预计时间 | 2-4小时 |

### 前端修改状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 音频播放 | ✅ 已修复 | 使用 `forceLocal=true` |
| Code Sync | ✅ 已修复 | 使用 `forceLocal=true` |
| 背景服务 | ✅ 已修复 | 使用 `forceLocal=true` |
| 文件路径方法 | ✅ 已警告 | 添加console.warn() |
| 队列显示 | ⚠️ 等待后端 | 等待后端添加字段 |

---

## 📚 相关文档

1. **BACKEND_API_FORMAT_REQUIREMENTS.md** - 后端修改详细需求
2. **DATA_ALIGNMENT_ISSUE.md** - 数据对齐问题详细分析
3. **LOCAL_REMOTE_ALIGNMENT_ANALYSIS.md** - 前端API方法对齐分析
4. **BACKEND_REPORT.md** - 后端API验证报告
5. **CHANGES_SUMMARY_V2.md** - 前端修复总结

---

## 📌 总结

### 核心问题
远程服务器返回的队列数据格式与前端期望不一致

### 根本原因
- 远程服务器使用 `original_text` / `translated_text` 代替 `text`
- 远程服务器使用 `tts_files` 数组代替 `audio_path`
- 远程服务器使用 `type` 代替 `category`
- 远程服务器缺少 `play_count` 字段

### 解决方案
后端API添加4个必须字段,同时保留原有字段确保向后兼容

### 修改范围
- **后端**: 5个API端点需要修改
- **前端**: 已完成所有必要修复

### 测试状态
- **本地测试**: ✅ 通过
- **远程测试**: ⚠️ 等待后端修改
- **集成测试**: ⚠️ 等待后端修改

---

**报告日期**: 2025-12-01
**分析人员**: Claude
**文档版本**: 1.0
**审阅状态**: 待后端团队确认
