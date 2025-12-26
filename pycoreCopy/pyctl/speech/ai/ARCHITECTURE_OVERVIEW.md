# AI 功能架构概览

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Interface                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │ AI Chat  │ AI Parse │ AI Parse │ AI Expand│ AI Trans │       │
│  │          │ (Basic)  │(Advanced)│          │  late    │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                        RPC Server                                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         RPC Manager (rpc_manager.py)                 │       │
│  │  ┌────────┬────────┬────────┬────────┬────────┐     │       │
│  │  │ai_chat │ai_parse│ai_parse│ai_     │ai_     │     │       │
│  │  │        │_basic  │_adv    │expand  │translate    │       │
│  │  └────────┴────────┴────────┴────────┴────────┘     │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AI Manager Layer                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              AIManager (ai_manager.py)               │       │
│  │                                                      │       │
│  │  • Session Management                                │       │
│  │  • Request Routing                                   │       │
│  │  • Response Processing                               │       │
│  │  • Cache Management                                  │       │
│  │  • Error Handling                                    │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Processing Layer                              │
│  ┌──────────────┬─────────────────┬──────────────────┐         │
│  │   Prompt     │   Response      │    Language      │         │
│  │  Templates   │    Parser       │   Processor      │         │
│  │              │                 │                  │         │
│  │ • Build      │ • Extract       │ • Detect Lang    │         │
│  │   prompts    │   structured    │ • Namespace      │         │
│  │ • Multi-lang │   data          │   management     │         │
│  │ • Dynamic    │ • Format        │ • Content        │         │
│  │   params     │   output        │   processing     │         │
│  └──────────────┴─────────────────┴──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OpenRouter SDK Layer                          │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         OpenRouterClient (openrouter_client.py)      │       │
│  │                                                      │       │
│  │  • API Communication                                 │       │
│  │  • Model Selection                                   │       │
│  │  • Streaming Support                                 │       │
│  │  • Error Handling                                    │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      OpenRouter API                              │
│            (GPT-4o, Claude, Gemini, etc.)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Storage Layer                               │
│  ┌──────────────┬─────────────────┬──────────────────┐         │
│  │   Chat       │   Processing    │    Config        │         │
│  │  History DB  │   History DB    │    Cache         │         │
│  │              │                 │                  │         │
│  │ • Sessions   │ • Requests      │ • AI settings    │         │
│  │ • Messages   │ • Results       │ • Model config   │         │
│  │ • Context    │ • Metrics       │ • Preferences    │         │
│  └──────────────┴─────────────────┴──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 核心流程

### 1. AI 对话流程

```
User Input → RPC → AIManager → PromptTemplates → OpenRouter
                                                      ↓
User Output ← RPC ← AIManager ← ResponseParser ← AI Response
```

### 2. AI 解析流程（基础版）

```
Content → ai_parse_basic → Build Prompt (summary/keywords/sentiment)
                              ↓
                         OpenRouter API
                              ↓
                         Parse Response → Extract structured data
                              ↓
                         Return result (summary, keywords, sentiment)
```

### 3. AI 解析流程（高级版）

```
Content → ai_parse_advanced → Build Complex Prompt
                                  ↓
                             OpenRouter API
                                  ↓
                             Parse Response → Extract:
                                              • Topics
                                              • Entities (人名/地名/组织)
                                              • Intent
                                              • Structure
                                  ↓
                             Return structured data
```

### 4. AI 扩写流程

```
Content → ai_expand → Build Expand Prompt (detail/elaborate/examples)
                          ↓
                     OpenRouter API
                          ↓
                     Get expanded content
                          ↓
                     Return expanded text
```

### 5. AI 翻译流程

```
Content → ai_translate → Build Translation Prompt
          + source_lang      ↓
          + target_lang  OpenRouter API
          + tone             ↓
                         Get translation
                             ↓
                         Return translated text
```

## 核心组件职责

### AIManager
- **输入**: 用户请求 (ChatRequest, ParseRequest, etc.)
- **处理**:
  - 验证请求参数
  - 选择合适的提示词模板
  - 调用 OpenRouter API
  - 解析响应
  - 保存历史记录
- **输出**: 统一响应格式 (AIResponse)

### PromptTemplates
- **输入**: 功能类型、语言、参数
- **处理**:
  - 根据功能类型选择模板
  - 注入动态参数
  - 多语言支持
- **输出**: 完整的提示词

### ResponseParser
- **输入**: AI 原始响应
- **处理**:
  - 提取结构化数据
  - 格式化输出
  - 错误检测
- **输出**: 解析后的结构化数据

### LanguageProcessor
- **输入**: 文本内容
- **处理**:
  - 检测语言
  - 管理语言命名空间
  - 处理多语言内容
- **输出**: 语言标识和处理后的内容

## 数据流

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   Web    │────▶│   RPC    │────▶│    AI    │
│ Interface│     │ Manager  │     │ Manager  │
└──────────┘     └──────────┘     └──────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ↓                      ↓                      ↓
         ┌───────────────┐    ┌─────────────────┐   ┌─────────────┐
         │    Prompt     │    │    Response     │   │  Language   │
         │   Templates   │    │     Parser      │   │  Processor  │
         └───────────────┘    └─────────────────┘   └─────────────┘
                 │                      ↑                      │
                 └──────────────────────┼──────────────────────┘
                                        ↓
                                ┌───────────────┐
                                │  OpenRouter   │
                                │     SDK       │
                                └───────────────┘
                                        ↓
                                ┌───────────────┐
                                │  OpenRouter   │
                                │     API       │
                                └───────────────┘
```

## API 端点映射

| Web 功能 | RPC 端点 | AIManager 方法 | 提示词模板 |
|---------|---------|---------------|-----------|
| AI 对话 | `/rpc/ai_chat` | `chat()` | `chat_prompts.py` |
| AI 解析（基础） | `/rpc/ai_parse_basic` | `parse_basic()` | `parse_prompts.py` |
| AI 解析（高级） | `/rpc/ai_parse_advanced` | `parse_advanced()` | `parse_prompts.py` |
| AI 扩写 | `/rpc/ai_expand` | `expand()` | `expand_prompts.py` |
| AI 翻译 | `/rpc/ai_translate` | `translate()` | `translate_prompts.py` |

## 配置管理

```python
# global_config_cache 中的 AI 配置
{
    "ai_enabled": true,
    "ai_default_model": "gpt-4o",
    "ai_temperature": 0.7,
    "ai_max_tokens": 2000,
    "ai_enable_cache": true,
    "ai_cache_ttl": 3600,
    "ai_auto_parse": false,  # 自动解析语音识别结果
    "ai_parse_languages": ["zh-CN", "en-US"],
    "ai_translate_default_target": "en-US"
}
```

## 错误处理流程

```
Request → Validation → API Call → Response
   ↓           ↓            ↓         ↓
   ✗ Error  ✗ Error    ✗ Error   ✗ Parse Error
   ↓           ↓            ↓         ↓
create_error("Invalid params")
create_error("API key missing")
create_error("Timeout")
create_error("Invalid response")
```

## 性能优化策略

### 1. 缓存层
```
Request → Check Cache → [HIT] Return cached result
             ↓ [MISS]
        API Call → Save to cache → Return result
```

### 2. 流式处理
```
Long content → Stream API → Yield chunks → Real-time display
```

### 3. 批处理
```
Multiple requests → Batch → Single API call → Parse batch response
```

## 安全机制

1. **输入验证**: 长度限制、格式检查
2. **API 密钥**: Secret manager 管理
3. **访问控制**: 请求频率限制
4. **内容过滤**: 敏感词检测
5. **会话管理**: 超时清理

## 监控指标

- API 调用次数
- Token 使用量
- 平均响应时间
- 错误率
- 缓存命中率
- 各功能使用频率

## 部署架构

```
┌─────────────────────────────────────────┐
│         Application Server               │
│  ┌────────────────────────────────┐     │
│  │      pycore/pyctl/rpc          │     │
│  │         (Port 8765)             │     │
│  └────────────────────────────────┘     │
│                 ↓                        │
│  ┌────────────────────────────────┐     │
│  │      pycore/pyctl/speech/ai           │     │
│  │      (AI Manager Layer)        │     │
│  └────────────────────────────────┘     │
│                 ↓                        │
│  ┌────────────────────────────────┐     │
│  │  pycore/pyutils/openrouter_sdk │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
                 ↓ HTTPS
┌─────────────────────────────────────────┐
│       OpenRouter API (External)          │
│  https://openrouter.ai/api/v1/chat       │
└─────────────────────────────────────────┘
```

## 下一步

参考 `ARCHITECTURE_DESIGN.md` 获取详细的实现计划和代码示例。
