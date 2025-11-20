# AI 功能模块架构设计

## 1. 概述

扩展 `pycore/pyutils/openrouter_sdk`，为语音/文本内容提供 AI 处理功能。

### 功能列表
1. **AI 对话** - 基础聊天对话
2. **AI 解析（基础版）** - 快速内容分析（摘要、关键词、情感）
3. **AI 解析（高级版）** - 深度内容分析（主题、实体、意图、结构化数据）
4. **AI 扩写** - 内容扩展和丰富
5. **AI 翻译** - 多语言翻译

## 2. 架构设计

### 2.1 目录结构

```
pycore/pyctl/speech/ai/
├── __init__.py                    # 模块导出
├── ai_manager.py                  # AI 功能管理器（核心）
├── prompt_templates.py            # 提示词模板系统
├── response_parser.py             # AI 响应解析器
├── language_processor.py          # 语言处理器
├── models/
│   ├── __init__.py
│   ├── ai_request.py              # 请求数据模型
│   └── ai_response.py             # 响应数据模型
└── prompts/
    ├── __init__.py
    ├── chat_prompts.py            # 对话提示词
    ├── parse_prompts.py           # 解析提示词
    ├── expand_prompts.py          # 扩写提示词
    └── translate_prompts.py       # 翻译提示词
```

### 2.2 核心组件

#### AIManager (ai_manager.py)
AI 功能的核心管理器，负责：
- 调用 OpenRouter API
- 管理会话上下文
- 处理流式响应
- 错误处理和重试
- 结果缓存

#### PromptTemplates (prompt_templates.py)
提示词模板系统，负责：
- 根据功能类型生成提示词
- 支持多语言提示词
- 动态参数注入
- 模板版本管理

#### ResponseParser (response_parser.py)
AI 响应解析器，负责：
- 解析 AI 返回的结构化数据
- 提取关键信息
- 格式化输出
- 错误处理

#### LanguageProcessor (language_processor.py)
语言处理器，负责：
- 语言检测
- 语言命名空间管理
- 多语言内容处理

## 3. RPC API 设计

### 3.1 API 端点

```python
# AI 对话
POST /rpc/ai_chat
{
    "message": "你好，我想了解一下...",
    "language": "zh-CN",
    "context": [...],  # 可选：历史对话
    "session_id": "xxx"  # 可选：会话 ID
}

# AI 解析（基础版）
POST /rpc/ai_parse_basic
{
    "content": "要分析的文本内容",
    "language": "zh-CN",
    "parse_type": "summary"  # summary, keywords, sentiment
}

# AI 解析（高级版）
POST /rpc/ai_parse_advanced
{
    "content": "要分析的文本内容",
    "language": "zh-CN",
    "analysis_types": ["topic", "entity", "intent", "structure"]
}

# AI 扩写
POST /rpc/ai_expand
{
    "content": "原始内容",
    "language": "zh-CN",
    "expansion_type": "detail",  # detail, elaborate, examples
    "target_length": "medium"  # short, medium, long
}

# AI 翻译
POST /rpc/ai_translate
{
    "content": "要翻译的内容",
    "source_language": "zh-CN",
    "target_language": "en-US",
    "tone": "formal"  # formal, casual, technical
}
```

### 3.2 统一响应格式

```json
{
    "success": true,
    "data": {
        "result": "AI 处理后的结果",
        "metadata": {
            "model": "gpt-4o",
            "tokens_used": 150,
            "processing_time": 1.23,
            "confidence": 0.95
        }
    },
    "timestamp": 1234567890.123
}
```

## 4. 提示词系统设计

### 4.1 提示词模板结构

```python
class PromptTemplate:
    """提示词模板基类"""

    def __init__(self, language: str = "zh-CN"):
        self.language = language

    def build(self, **kwargs) -> str:
        """构建提示词"""
        pass

    def get_system_prompt(self) -> str:
        """获取系统提示词"""
        pass

    def get_user_prompt(self, **kwargs) -> str:
        """获取用户提示词"""
        pass
```

### 4.2 提示词分类

#### 对话提示词 (chat_prompts.py)
```python
CHAT_SYSTEM_PROMPTS = {
    "zh-CN": "你是一个智能助手，擅长理解和回答各种问题。请用简洁、准确的中文回答。",
    "en-US": "You are an intelligent assistant. Please provide clear and concise answers.",
    "ja-JP": "あなたは知的なアシスタントです。明確で簡潔な回答を提供してください。"
}
```

#### 解析提示词 (parse_prompts.py)
```python
# 基础解析
BASIC_PARSE_PROMPTS = {
    "summary": {
        "zh-CN": "请用1-2句话总结以下内容的核心要点：\n\n{content}",
        "en-US": "Summarize the key points of the following content in 1-2 sentences:\n\n{content}"
    },
    "keywords": {
        "zh-CN": "提取以下内容的5个关键词（用逗号分隔）：\n\n{content}",
        "en-US": "Extract 5 keywords from the following content (comma-separated):\n\n{content}"
    },
    "sentiment": {
        "zh-CN": "分析以下内容的情感倾向（积极/中性/消极）并说明理由：\n\n{content}",
        "en-US": "Analyze the sentiment (positive/neutral/negative) and explain:\n\n{content}"
    }
}

# 高级解析
ADVANCED_PARSE_PROMPTS = {
    "topic": "识别主题和分类",
    "entity": "提取实体（人名、地名、组织等）",
    "intent": "识别用户意图",
    "structure": "分析内容结构"
}
```

#### 扩写提示词 (expand_prompts.py)
```python
EXPAND_PROMPTS = {
    "detail": {
        "zh-CN": "请将以下内容扩展，添加更多细节和例子：\n\n{content}",
        "en-US": "Expand the following content with more details and examples:\n\n{content}"
    },
    "elaborate": {
        "zh-CN": "请详细阐述以下内容，使其更加深入和全面：\n\n{content}",
        "en-US": "Elaborate on the following content to make it more thorough:\n\n{content}"
    }
}
```

#### 翻译提示词 (translate_prompts.py)
```python
TRANSLATE_PROMPTS = {
    "formal": {
        "zh-CN": "请将以下内容翻译成{target_language}，使用正式语气：\n\n{content}",
        "en-US": "Translate to {target_language} using formal tone:\n\n{content}"
    },
    "casual": {
        "zh-CN": "请将以下内容翻译成{target_language}，使用口语化表达：\n\n{content}",
        "en-US": "Translate to {target_language} using casual tone:\n\n{content}"
    }
}
```

## 5. 数据模型设计

### 5.1 请求模型 (ai_request.py)

```python
@dataclass
class AIRequest:
    """AI 请求基类"""
    content: str
    language: str = "zh-CN"
    request_type: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ChatRequest(AIRequest):
    """对话请求"""
    context: List[Dict[str, str]] = field(default_factory=list)
    session_id: Optional[str] = None

@dataclass
class ParseRequest(AIRequest):
    """解析请求"""
    parse_type: str = "summary"
    analysis_types: List[str] = field(default_factory=list)

@dataclass
class ExpandRequest(AIRequest):
    """扩写请求"""
    expansion_type: str = "detail"
    target_length: str = "medium"

@dataclass
class TranslateRequest(AIRequest):
    """翻译请求"""
    source_language: str = "auto"
    target_language: str = "en-US"
    tone: str = "formal"
```

### 5.2 响应模型 (ai_response.py)

```python
@dataclass
class AIResponse:
    """AI 响应基类"""
    result: str
    model: str
    tokens_used: int
    processing_time: float
    confidence: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ParseResponse(AIResponse):
    """解析响应"""
    summary: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    sentiment: Optional[str] = None
    entities: Dict[str, List[str]] = field(default_factory=dict)
    topics: List[str] = field(default_factory=list)
```

## 6. 数据库设计

### 6.1 AI 对话历史表

```sql
CREATE TABLE ai_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,  -- user, assistant, system
    content TEXT NOT NULL,
    language VARCHAR(10),
    model VARCHAR(50),
    tokens_used INTEGER,
    timestamp REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_timestamp (timestamp)
);
```

### 6.2 AI 处理记录表

```sql
CREATE TABLE ai_processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_type VARCHAR(50) NOT NULL,  -- chat, parse, expand, translate
    input_content TEXT NOT NULL,
    output_result TEXT NOT NULL,
    language VARCHAR(10),
    model VARCHAR(50),
    tokens_used INTEGER,
    processing_time REAL,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    metadata TEXT,  -- JSON
    timestamp REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (request_type),
    INDEX idx_timestamp (timestamp)
);
```

## 7. 集成设计

### 7.1 与 RPC Manager 集成

```python
# 在 rpc_manager.py 中注册路由
self.server.route('ai_chat', self._handle_ai_chat)
self.server.route('ai_parse_basic', self._handle_ai_parse_basic)
self.server.route('ai_parse_advanced', self._handle_ai_parse_advanced)
self.server.route('ai_expand', self._handle_ai_expand)
self.server.route('ai_translate', self._handle_ai_translate)
```

### 7.2 与配置系统集成

```python
# 使用 global_config_cache 存储配置
{
    "ai_default_model": "gpt-4o",
    "ai_temperature": 0.7,
    "ai_max_tokens": 2000,
    "ai_enable_cache": true,
    "ai_cache_ttl": 3600
}
```

### 7.3 与语音识别集成

```python
# 语音识别结果自动触发 AI 解析
def on_recognized(text, confidence):
    # 1. 保存识别结果
    save_to_clipboard(text)

    # 2. 如果启用 AI 自动解析
    if config.get('ai_auto_parse'):
        result = ai_manager.parse_basic(text, parse_type='summary')
        display_ai_result(result)
```

## 8. Web 界面设计

### 8.1 新增 AI 标签页

```html
<!-- AI Tab -->
<div id="ai-panel" class="panel">
    <!-- AI Chat -->
    <div class="ai-section">
        <h3>AI Chat</h3>
        <textarea id="ai-chat-input"></textarea>
        <button onclick="sendAIChat()">Send</button>
        <div id="ai-chat-history"></div>
    </div>

    <!-- AI Parse -->
    <div class="ai-section">
        <h3>AI Parse</h3>
        <textarea id="ai-parse-input"></textarea>
        <select id="parse-type">
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
        </select>
        <button onclick="parseContent()">Parse</button>
        <div id="ai-parse-result"></div>
    </div>

    <!-- AI Expand -->
    <div class="ai-section">
        <h3>AI Expand</h3>
        <textarea id="ai-expand-input"></textarea>
        <button onclick="expandContent()">Expand</button>
        <div id="ai-expand-result"></div>
    </div>

    <!-- AI Translate -->
    <div class="ai-section">
        <h3>AI Translate</h3>
        <textarea id="ai-translate-input"></textarea>
        <select id="target-language">
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
            <option value="ja-JP">日本語</option>
        </select>
        <button onclick="translateContent()">Translate</button>
        <div id="ai-translate-result"></div>
    </div>
</div>
```

### 8.2 JavaScript 集成

```javascript
// AI Chat
async function sendAIChat() {
    const message = document.getElementById('ai-chat-input').value;
    const result = await apiCall('ai_chat', {
        message: message,
        language: 'zh-CN'
    });
    displayChatMessage(result.data.result);
}

// AI Parse
async function parseContent() {
    const content = document.getElementById('ai-parse-input').value;
    const parseType = document.getElementById('parse-type').value;

    const route = parseType === 'basic' ? 'ai_parse_basic' : 'ai_parse_advanced';
    const result = await apiCall(route, {
        content: content,
        language: 'zh-CN'
    });

    displayParseResult(result.data);
}
```

## 9. 性能优化

### 9.1 缓存策略
- 使用内存缓存存储常见查询结果
- 缓存过期时间：1小时
- 基于内容哈希的缓存键

### 9.2 流式响应
- 对长内容使用流式处理
- 实时显示 AI 生成内容
- 减少首字节时间

### 9.3 批处理
- 多个翻译请求批量处理
- 降低 API 调用成本

## 10. 错误处理

### 10.1 常见错误
- API 密钥无效
- 请求超时
- 模型不可用
- 内容违规

### 10.2 错误处理策略
```python
try:
    result = ai_manager.chat(message)
except APIKeyError:
    return create_error("API key not configured")
except TimeoutError:
    return create_error("Request timeout, please try again")
except ContentPolicyError:
    return create_error("Content violates policy")
except Exception as e:
    logger.error(f"AI processing error: {e}")
    return create_error("Processing failed")
```

## 11. 安全性

### 11.1 输入验证
- 内容长度限制
- 敏感词过滤
- 注入攻击防护

### 11.2 API 密钥管理
- 从 secret manager 读取
- 不在日志中暴露
- 支持密钥轮换

### 11.3 访问控制
- 请求频率限制
- 用户配额管理
- 会话超时控制

## 12. 监控和日志

### 12.1 指标收集
- API 调用次数
- Token 使用量
- 响应时间
- 错误率

### 12.2 日志记录
```python
logger.info(f"[AI] {request_type} - Model: {model}, Tokens: {tokens}, Time: {time}s")
logger.error(f"[AI] Error: {error_message}")
```

## 13. 实施计划

### Phase 1: 核心基础（Week 1）
- [ ] 创建目录结构
- [ ] 实现 AIManager
- [ ] 实现 PromptTemplates
- [ ] 集成 OpenRouter SDK

### Phase 2: 基础功能（Week 2）
- [ ] 实现 AI 对话
- [ ] 实现 AI 解析（基础版）
- [ ] 实现响应解析器
- [ ] 添加 RPC 路由

### Phase 3: 高级功能（Week 3）
- [ ] 实现 AI 解析（高级版）
- [ ] 实现 AI 扩写
- [ ] 实现 AI 翻译
- [ ] 添加数据库存储

### Phase 4: Web 集成（Week 4）
- [ ] 创建 Web UI
- [ ] 实现前端交互
- [ ] 添加实时流式显示
- [ ] 完善错误处理

### Phase 5: 优化和测试（Week 5）
- [ ] 性能优化
- [ ] 缓存实现
- [ ] 完整测试
- [ ] 文档完善

## 14. 总结

本架构设计提供了一个完整的 AI 功能模块，具有以下特点：

1. **模块化设计** - 清晰的组件分离，易于维护和扩展
2. **统一接口** - 所有功能使用统一的 RPC API
3. **多语言支持** - 提示词系统支持多语言
4. **可扩展性** - 易于添加新的 AI 功能
5. **性能优化** - 缓存、流式处理、批处理
6. **安全可靠** - 完善的错误处理和安全机制

通过这个架构，可以为语音识别系统提供强大的 AI 增强功能。
