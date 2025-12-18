# AI 功能快速参考

## 目录结构

```
pycore/pyctl/speech/ai/
├── ARCHITECTURE_DESIGN.md      # 📘 完整架构设计（详细）
├── ARCHITECTURE_OVERVIEW.md    # 📊 架构概览图（可视化）
├── IMPLEMENTATION_PLAN.md      # ✅ 实施计划清单
├── QUICK_REFERENCE.md          # ⚡ 快速参考（本文件）
│
├── __init__.py
├── ai_manager.py               # 核心: AI 管理器
├── prompt_templates.py         # 提示词模板系统
├── response_parser.py          # 响应解析器
├── language_processor.py       # 语言处理器
│
├── models/
│   ├── __init__.py
│   ├── ai_request.py          # 请求数据模型
│   └── ai_response.py         # 响应数据模型
│
└── prompts/
    ├── __init__.py
    ├── chat_prompts.py        # 对话提示词
    ├── parse_prompts.py       # 解析提示词
    ├── expand_prompts.py      # 扩写提示词
    └── translate_prompts.py   # 翻译提示词
```

## 5 大核心功能

| 功能 | RPC 端点 | 用途 | 示例 |
|-----|---------|-----|------|
| 🗨️ **AI 对话** | `/rpc/ai_chat` | 基础聊天对话 | "解释量子计算" |
| 📊 **AI 解析（基础）** | `/rpc/ai_parse_basic` | 摘要/关键词/情感 | 总结会议记录 |
| 🔬 **AI 解析（高级）** | `/rpc/ai_parse_advanced` | 主题/实体/意图/结构 | 分析新闻文章 |
| ✍️ **AI 扩写** | `/rpc/ai_expand` | 内容扩展和丰富 | 扩写文章大纲 |
| 🌐 **AI 翻译** | `/rpc/ai_translate` | 多语言翻译 | 中文→英文 |

## API 快速示例

### 1. AI 对话

```python
# Python
from pycore.pyctl.ai import ai_manager

response = ai_manager.chat(
    message="什么是机器学习？",
    language="zh-CN"
)
print(response.result)
```

```javascript
// JavaScript
const result = await apiCall('ai_chat', {
    message: "What is machine learning?",
    language: "en-US"
});
console.log(result.data.result);
```

### 2. AI 解析（基础）

```python
# Python
response = ai_manager.parse_basic(
    content="今天天气很好，我去公园散步了...",
    parse_type="summary"  # summary, keywords, sentiment
)
print(response.summary)
```

```javascript
// JavaScript
const result = await apiCall('ai_parse_basic', {
    content: "今天天气很好，我去公园散步了...",
    parse_type: "summary"
});
console.log(result.data.summary);
```

### 3. AI 解析（高级）

```python
# Python
response = ai_manager.parse_advanced(
    content="苹果公司今天在美国加州发布了新产品...",
    analysis_types=["topic", "entity", "intent"]
)
print(response.entities)  # {'组织': ['苹果公司'], '地点': ['美国', '加州']}
```

```javascript
// JavaScript
const result = await apiCall('ai_parse_advanced', {
    content: "苹果公司今天在美国加州发布了新产品...",
    analysis_types: ["topic", "entity", "intent"]
});
console.log(result.data.entities);
```

### 4. AI 扩写

```python
# Python
response = ai_manager.expand(
    content="机器学习是人工智能的一个分支。",
    expansion_type="detail",  # detail, elaborate, examples
    target_length="medium"     # short, medium, long
)
print(response.result)
```

```javascript
// JavaScript
const result = await apiCall('ai_expand', {
    content: "机器学习是人工智能的一个分支。",
    expansion_type: "detail",
    target_length: "medium"
});
console.log(result.data.result);
```

### 5. AI 翻译

```python
# Python
response = ai_manager.translate(
    content="你好，世界！",
    source_language="zh-CN",
    target_language="en-US",
    tone="casual"  # formal, casual, technical
)
print(response.result)  # "Hello, world!"
```

```javascript
// JavaScript
const result = await apiCall('ai_translate', {
    content: "你好，世界！",
    source_language: "zh-CN",
    target_language: "en-US",
    tone: "casual"
});
console.log(result.data.result);
```

## 核心类快速参考

### AIManager

```python
class AIManager:
    def chat(self, message: str, language: str = "zh-CN", context: List = None) -> ChatResponse
    def parse_basic(self, content: str, parse_type: str = "summary") -> ParseResponse
    def parse_advanced(self, content: str, analysis_types: List[str]) -> ParseResponse
    def expand(self, content: str, expansion_type: str = "detail") -> ExpandResponse
    def translate(self, content: str, target_language: str) -> TranslateResponse
```

### PromptTemplates

```python
class PromptTemplate:
    def build(self, **kwargs) -> str
    def get_system_prompt(self) -> str
    def get_user_prompt(self, **kwargs) -> str

# 使用示例
template = ChatPromptTemplate(language="zh-CN")
prompt = template.build(message="你好")
```

### ResponseParser

```python
class ResponseParser:
    def parse_chat(self, response: str) -> ChatResponse
    def parse_analysis(self, response: str) -> ParseResponse
    def extract_entities(self, response: str) -> Dict[str, List[str]]
```

## 提示词示例

### 对话提示词

```python
# chat_prompts.py
CHAT_SYSTEM_PROMPTS = {
    "zh-CN": "你是一个智能助手，擅长理解和回答各种问题。",
    "en-US": "You are an intelligent assistant.",
    "ja-JP": "あなたは知的なアシスタントです。"
}
```

### 解析提示词

```python
# parse_prompts.py
SUMMARY_PROMPT = {
    "zh-CN": "请用1-2句话总结以下内容：\n\n{content}",
    "en-US": "Summarize in 1-2 sentences:\n\n{content}"
}

KEYWORDS_PROMPT = {
    "zh-CN": "提取5个关键词：\n\n{content}",
    "en-US": "Extract 5 keywords:\n\n{content}"
}
```

## 配置参数

```python
# global_config_cache
{
    "ai_enabled": True,
    "ai_default_model": "gpt-4o",           # 默认模型
    "ai_temperature": 0.7,                   # 创造性 (0-1)
    "ai_max_tokens": 2000,                   # 最大 token 数
    "ai_enable_cache": True,                 # 启用缓存
    "ai_cache_ttl": 3600,                    # 缓存过期时间（秒）
    "ai_auto_parse": False,                  # 自动解析语音识别结果
    "ai_parse_languages": ["zh-CN", "en-US"], # 支持的语言
    "ai_translate_default_target": "en-US"   # 默认翻译目标语言
}
```

## 错误处理

```python
from pycore.pyctl.ai import AIManager, AIError

try:
    response = ai_manager.chat("你好")
except AIError as e:
    if e.code == "API_KEY_MISSING":
        print("请配置 OpenRouter API 密钥")
    elif e.code == "TIMEOUT":
        print("请求超时，请重试")
    else:
        print(f"AI 处理失败: {e.message}")
```

## 统一响应格式

```json
{
    "success": true,
    "data": {
        "result": "AI 处理结果",
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

## 数据库表

### ai_chat_history

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| session_id | VARCHAR(100) | 会话 ID |
| role | VARCHAR(20) | user/assistant/system |
| content | TEXT | 消息内容 |
| language | VARCHAR(10) | 语言代码 |
| model | VARCHAR(50) | 使用的模型 |
| tokens_used | INTEGER | Token 使用量 |
| timestamp | REAL | Unix 时间戳 |

### ai_processing_history

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| request_type | VARCHAR(50) | 请求类型 |
| input_content | TEXT | 输入内容 |
| output_result | TEXT | 输出结果 |
| language | VARCHAR(10) | 语言代码 |
| model | VARCHAR(50) | 使用的模型 |
| tokens_used | INTEGER | Token 使用量 |
| processing_time | REAL | 处理时间（秒） |
| success | BOOLEAN | 是否成功 |
| error_message | TEXT | 错误信息 |
| timestamp | REAL | Unix 时间戳 |

## 常用操作

### 获取 AI 管理器实例

```python
from pycore.pyctl.ai import get_ai_manager

ai_manager = get_ai_manager()
```

### 创建会话

```python
from pycore.pyctl.ai import ChatSession

session = ChatSession(language="zh-CN")
response1 = session.send("你好")
response2 = session.send("今天天气怎么样？")  # 包含上下文
```

### 批量处理

```python
# 批量翻译
contents = ["你好", "世界", "AI"]
results = ai_manager.batch_translate(
    contents=contents,
    target_language="en-US"
)
```

## Web 界面集成

### HTML 结构

```html
<!-- AI 标签页 -->
<div id="ai-panel" class="panel">
    <textarea id="ai-input"></textarea>
    <select id="ai-function">
        <option value="chat">对话</option>
        <option value="parse">解析</option>
        <option value="expand">扩写</option>
        <option value="translate">翻译</option>
    </select>
    <button onclick="processAI()">处理</button>
    <div id="ai-result"></div>
</div>
```

### JavaScript 集成

```javascript
async function processAI() {
    const input = document.getElementById('ai-input').value;
    const func = document.getElementById('ai-function').value;

    const result = await apiCall(`ai_${func}`, {
        content: input,
        language: 'zh-CN'
    });

    displayResult(result.data);
}
```

## 性能优化建议

1. **启用缓存**: 设置 `ai_enable_cache: true`
2. **使用流式响应**: 长内容使用 `stream: true`
3. **批量处理**: 多个请求合并处理
4. **选择合适模型**: 简单任务使用免费模型
5. **控制 Token 数**: 设置合理的 `max_tokens`

## 支持的语言

- 🇨🇳 中文 (zh-CN)
- 🇺🇸 英语 (en-US)
- 🇯🇵 日语 (ja-JP)
- 🇰🇷 韩语 (ko-KR)
- 🇱🇦 老挝语 (lo-LA)
- ... 更多语言

## 常见问题

**Q: 如何配置 API 密钥？**
A: 在 secret manager 中添加 `OPENROUTER_API_KEY`

**Q: 如何选择模型？**
A: 在配置中设置 `ai_default_model` 或请求时指定

**Q: 如何控制成本？**
A: 使用免费模型、启用缓存、限制 token 数量

**Q: 如何处理超时？**
A: 设置合理的 timeout，实现重试机制

## 开发流程

```
1. 设计提示词 (prompts/)
   ↓
2. 实现 AIManager 方法 (ai_manager.py)
   ↓
3. 添加 RPC 路由 (rpc_manager.py)
   ↓
4. 实现 Web 界面 (index.html)
   ↓
5. 测试和优化
```

## 下一步

- 阅读 `ARCHITECTURE_DESIGN.md` 了解详细设计
- 查看 `IMPLEMENTATION_PLAN.md` 了解开发计划
- 查看 `ARCHITECTURE_OVERVIEW.md` 了解系统架构

## 联系和支持

- 📖 文档: 参考架构设计文档
- 🐛 问题: 提交到 GitHub Issues
- 💬 讨论: 项目讨论区
