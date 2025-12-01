# Voice Subtitle V1 - Laravel MCP Integration

## 完成内容

### 1. AI 服务统一分发器 ✅
- **位置**: `app/Services/AIServiceDispatcher.php`
- **功能**: 整合 Gemini、OpenRouter、DeepSeek 三个 AI 服务
- **特性**:
  - 支持 AUTO 模式自动选择最佳 AI 提供商
  - 统一的 chat 接口
  - 文本总结和组织功能
  - 提供商状态检查

### 2. TTS 缓存管理器 ✅
- **位置**: `app/Services/TTSCacheManager.php`
- **缓存目录**: `/www/wwwroot/laravel_db/cache/tts` (站外目录)
- **功能**:
  - SQLite 数据库管理缓存
  - 基于 MD5 哈希的段落级缓存
  - 自动清理过期缓存
  - 段落分割和批量生成

### 3. VoiceSubtitleV1 应用 ✅
- **位置**: `app/Apps/McpV1/VoiceSubtitleV1/`
- **结构**:
  ```
  VoiceSubtitleV1/
  ├── VoiceSubtitleV1Controllers/
  │   └── VoiceSubtitleV1MainController.php
  ├── VoiceSubtitleV1Utils/
  │   ├── VoiceSubtitleProcessor.php (核心处理器)
  │   └── SubtitleQueueManager.php (队列管理)
  ├── VoiceSubtitleV1ApiInfo.php
  └── routes/VoiceSubtitleV1Router/
      └── api.php
  ```

### 4. 功能特性 ✅
- **多输入类型支持**:
  - 文本 (text)
  - 图片 (image) - OCR + AI 总结
  - URL (url) - 自动提取文本内容
  - 语音 (voice)
  - 文档 (file)

- **AI 集成**:
  - OCR 识别图片文字
  - Gemini AI 总结提取内容
  - Google Translate 多语言翻译
  - Edge TTS 语音合成

- **队列系统**:
  - 持久化队列（JSON 文件）
  - 支持前进/后退导航
  - 索引跳转
  - 单项删除/全部清空

### 5. API 端点 ✅
基础路径: `/api/voice-subtitle/v1`

- `POST /add` - 添加到队列
- `GET /queue` - 获取队列
- `GET /current` - 获取当前项
- `POST /next` - 下一项
- `POST /previous` - 上一项
- `POST /set-index` - 设置索引
- `DELETE /remove` - 删除项
- `DELETE /clear` - 清空队列
- `GET /stats` - 缓存统计

### 6. 前端界面 ✅
- **位置**: `public/voice-subtitle.html`
- **集成到**: `app/Http/EnvironmentApiInfo/debug_interface_template.html`
- **菜单位置**: API Debug Center → Voice Subtitle (🎙️)
- **功能**:
  - 多输入类型表单
  - 队列可视化
  - 播放控制面板
  - 实时统计显示

## 访问方式

1. **直接访问**: http://localhost:8000/voice-subtitle.html
2. **通过 Debug Center**: http://localhost:8000/api_info → Voice Subtitle 菜单
3. **API 测试**: http://localhost:8000/api_info → API Testing Dashboard → VoiceSubtitleV1

## 使用示例

### 添加文本到队列
```bash
curl -X POST http://localhost:8000/api/voice-subtitle/v1/add \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Hello, this is a test message.",
    "language": "en",
    "voice": "en-US-AriaNeural"
  }'
```

### 获取队列
```bash
curl http://localhost:8000/api/voice-subtitle/v1/queue
```

### 获取统计
```bash
curl http://localhost:8000/api/voice-subtitle/v1/stats
```

## 技术架构

### 数据流
```
用户输入 → VoiceSubtitleProcessor → AI Services (OCR/Gemini/Translate)
                                    ↓
                             TTSCacheManager (段落级缓存)
                                    ↓
                             Edge TTS (pycore)
                                    ↓
                           SubtitleQueueManager (持久化队列)
                                    ↓
                              前端播放界面
```

### 缓存策略
- **段落分割**: 使用 `\n` 分割文本为段落
- **缓存键**: `MD5(text) + language + voice`
- **存储位置**: `/www/wwwroot/laravel_db/cache/tts/*.mp3`
- **数据库**: `/www/wwwroot/laravel_db/cache/tts/tts_cache.sqlite`

## 依赖服务

1. **pycore Module Caller** (端口 59000)
   - OCR 服务
   - Gemini API
   - Edge TTS
   - Google Translate

2. **外部 API**
   - OpenRouter (可选)
   - DeepSeek (可选)

## 文件清单

### 核心服务
- `app/Services/AIServiceDispatcher.php`
- `app/Services/TTSCacheManager.php`

### VoiceSubtitleV1 应用
- `app/Apps/McpV1/VoiceSubtitleV1/VoiceSubtitleV1Controllers/VoiceSubtitleV1MainController.php`
- `app/Apps/McpV1/VoiceSubtitleV1/VoiceSubtitleV1Utils/VoiceSubtitleProcessor.php`
- `app/Apps/McpV1/VoiceSubtitleV1/VoiceSubtitleV1Utils/SubtitleQueueManager.php`
- `app/Apps/McpV1/VoiceSubtitleV1/VoiceSubtitleV1ApiInfo.php`
- `app/Apps/McpV1/VoiceSubtitleV1/routes/VoiceSubtitleV1Router/api.php`

### 前端
- `public/voice-subtitle.html`
- `app/Http/EnvironmentApiInfo/debug_interface_template.html` (已添加菜单项)

### 路由
- `routes/api.php` (已注册 VoiceSubtitleV1 路由)

## 后续扩展建议

1. **音频播放**: 实现文件服务和 HTML5 音频播放器
2. **PDF/Word 支持**: 集成文档解析库
3. **语音识别**: 添加 STT (Speech-to-Text) 功能
4. **实时字幕**: WebSocket 推送实时字幕
5. **多用户支持**: 用户隔离的队列和缓存
6. **导出功能**: 导出字幕文件 (SRT/VTT)

---

生成时间: 2025-11-29
版本: 1.0.0
