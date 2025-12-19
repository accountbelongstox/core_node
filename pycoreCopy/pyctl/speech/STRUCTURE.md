# Speech Module Structure

## 📁 Directory Structure

```
pycore/pyctl/speech/
├── __init__.py                 # Speech module exports
├── speech_manager.py           # Core TTS/STT functionality
├── speech_thread.py            # Speech threading support
├── transcription_app.py        # Real-time transcription app
├── STRUCTURE.md                # This file
│
├── rpc/                        # RPC Server Submodule
│   ├── __init__.py
│   ├── rpc_manager.py          # RPC API manager
│   ├── QUICK_START.md
│   ├── WEB_INTERFACE_GUIDE.md
│   ├── UNIFIED_RESPONSE_GUIDE.md
│   └── web/
│       └── index.html          # Web interface
│
└── ai/                         # AI Features Submodule
    ├── __init__.py
    ├── ai_manager.py           # AI功能管理器 (待实现)
    ├── prompt_templates.py     # 提示词模板系统 (待实现)
    ├── response_parser.py      # 响应解析器 (待实现)
    ├── language_processor.py   # 语言处理器 (待实现)
    ├── ARCHITECTURE_DESIGN.md  # 完整架构设计
    ├── ARCHITECTURE_OVERVIEW.md # 架构概览图
    ├── IMPLEMENTATION_PLAN.md  # 实施计划
    ├── QUICK_REFERENCE.md      # 快速参考
    ├── models/                 # 数据模型 (待实现)
    │   ├── __init__.py
    │   ├── ai_request.py
    │   └── ai_response.py
    └── prompts/                # 提示词库 (待实现)
        ├── __init__.py
        ├── chat_prompts.py
        ├── parse_prompts.py
        ├── expand_prompts.py
        └── translate_prompts.py
```

## 📦 Module Organization

### Core Speech Module
**Path**: `pycore.pyctl.speech`

Core speech processing functionality including:
- Text-to-Speech (TTS)
- Speech-to-Text (STT)
- Real-time transcription
- Speech threading support

### RPC Submodule
**Path**: `pycore.pyctl.speech.rpc`

Provides HTTP/WebSocket API endpoints for:
- TTS API
- STT API
- Clipboard sync
- Configuration management
- Web interface

### AI Submodule
**Path**: `pycore.pyctl.speech.ai`

AI-enhanced features (planned):
- AI Chat (对话)
- AI Parse Basic (基础解析)
- AI Parse Advanced (高级解析)
- AI Expand (扩写)
- AI Translate (翻译)

## 🔧 Import Paths

### Old Paths (Deprecated)
```python
# ❌ Old - DO NOT USE
from pycore.pyctl.rpc import rpc_manager
from pycore.pyctl.ai import ai_manager
```

### New Paths (Current)
```python
# ✅ New - USE THESE
from pycore.pyctl.speech import speech_manager
from pycore.pyctl.speech.rpc import rpc_manager
from pycore.pyctl.speech.ai import ai_manager  # (when implemented)
```

## 📚 Usage Examples

### Core Speech
```python
from pycore.pyctl.speech import speech_manager

# Initialize
speech_manager.initialize()

# TTS
speech_manager.synthesize_to_file("Hello world", "output.mp3")

# STT
result = speech_manager.recognize_from_file("audio.wav")
print(result['text'])
```

### RPC Server
```python
from pycore.pyctl.speech.rpc import rpc_manager

# Start server (auto-starts by default)
await rpc_manager.start()

# Server runs on http://localhost:8765
# Web interface: http://localhost:8765/web/index.html
```

### AI Features (Planned)
```python
from pycore.pyctl.speech.ai import ai_manager

# AI Chat
response = ai_manager.chat("你好")

# AI Parse
result = ai_manager.parse_basic(text, parse_type="summary")

# AI Translate
translation = ai_manager.translate(text, target_language="en-US")
```

## 🌐 API Endpoints

### RPC API Base URL
```
http://localhost:8765/rpc/
```

### Available Endpoints
```
POST /rpc/tts              # Text to Speech
POST /rpc/stt              # Speech to Text
POST /rpc/multi_tts        # Multi-language TTS
POST /rpc/multi_stt        # Multi-language STT
POST /rpc/clipboard_add    # Add to clipboard
POST /rpc/clipboard_get    # Get clipboard history
POST /rpc/clipboard_sync   # Sync clipboard
POST /rpc/config_get       # Get configuration
POST /rpc/config_set       # Set configuration
POST /rpc/status           # Server status

# AI Endpoints (Planned)
POST /rpc/ai_chat          # AI Chat
POST /rpc/ai_parse_basic   # AI Parse (Basic)
POST /rpc/ai_parse_advanced # AI Parse (Advanced)
POST /rpc/ai_expand        # AI Expand
POST /rpc/ai_translate     # AI Translate
```

### Web Interface
```
GET /web/index.html        # Main web interface
GET /health                # Health check
GET /rpc/status            # RPC status
GET /rpc/info              # RPC info
```

## 🔄 Migration Guide

### Step 1: Update Imports
Replace all old import statements:
```python
# Before
from pycore.pyctl.rpc import rpc_manager

# After
from pycore.pyctl.speech.rpc import rpc_manager
```

### Step 2: Update Documentation References
Update any documentation that references:
- `pycore/pyctl/rpc/` → `pycore/pyctl/speech/rpc/`
- `pycore/pyctl/ai/` → `pycore/pyctl/speech/ai/`

### Step 3: Update Configuration Paths
If you have any hardcoded paths in configuration files, update them to reflect the new structure.

## 📖 Documentation

### Core Documentation
- `pycore/pyctl/speech/STRUCTURE.md` - This file (module structure)

### RPC Documentation
- `pycore/pyctl/speech/rpc/QUICK_START.md` - Quick start guide
- `pycore/pyctl/speech/rpc/WEB_INTERFACE_GUIDE.md` - Web interface guide
- `pycore/pyctl/speech/rpc/UNIFIED_RESPONSE_GUIDE.md` - Response format guide

### AI Documentation
- `pycore/pyctl/speech/ai/ARCHITECTURE_DESIGN.md` - Complete architecture design
- `pycore/pyctl/speech/ai/ARCHITECTURE_OVERVIEW.md` - Architecture overview
- `pycore/pyctl/speech/ai/IMPLEMENTATION_PLAN.md` - Implementation plan
- `pycore/pyctl/speech/ai/QUICK_REFERENCE.md` - Quick reference

## 🎯 Module Philosophy

The Speech module follows a hierarchical organization:

1. **Core Layer** (`speech_manager`)
   - Fundamental TTS/STT operations
   - Direct integration with pyutils

2. **Service Layer** (`rpc`)
   - API endpoint exposure
   - Web interface
   - Network communication

3. **Enhancement Layer** (`ai`)
   - AI-powered features
   - Content analysis
   - Language processing

This structure allows:
- Clear separation of concerns
- Independent development of submodules
- Easy testing and maintenance
- Flexible deployment options

## 🚀 Next Steps

1. ✅ Directory structure migrated
2. ✅ Import paths updated
3. ✅ Documentation updated
4. ⏭️ Implement AI features (see `ai/IMPLEMENTATION_PLAN.md`)
5. ⏭️ Add integration tests
6. ⏭️ Deploy and monitor

## 📞 Support

For questions or issues:
- Check documentation in respective subdirectories
- Review architecture design documents
- Refer to quick start guides
