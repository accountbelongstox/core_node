# OpenRouter SDK

Python SDK for OpenRouter API - Access 100+ AI models through a single unified API.

## Features

- ✅ **100+ AI Models** - OpenAI, Anthropic, Google, Meta, DeepSeek, and more
- ✅ **Free Models Available** - DeepSeek R1T2 Chimera (671B MoE) completely free
- ✅ **Streaming Support** - Real-time streaming responses
- ✅ **Automatic Key Management** - Integrated with secret manager
- ✅ **Simple Interface** - Easy-to-use chat methods
- ✅ **Singleton Pattern** - Global client instance ready to use
- ✅ **Chat Session Manager** - Conversation history, caching, and state tracking
- ✅ **Auto Model Selection** - Automatically selects free DeepSeek models

## Installation

No additional dependencies required! Uses existing `requests` library.

```bash
pip install requests  # If not already installed
```

## Quick Start

### 1. Get API Key

Get your free API key from: https://openrouter.ai/keys

### 2. Store API Key

Store your API key in the secret manager:

```python
# Add to .secret_keys/.secret_ignore/OPENROUTER_API_KEY
sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Use the SDK

```python
from pycore.pyutils.openrouter_sdk import openrouter_client

# Simple chat
response = openrouter_client.chat("Hello, how are you?")
print(response)

# Streaming chat
openrouter_client.chat_stream(
    "Write a poem about AI",
    on_chunk=lambda chunk: print(chunk, end='', flush=True)
)
```

## Usage Examples

### Quick Start with ChatSession (Recommended)

```python
from pycore.pyutils.openrouter_sdk import ChatSession

# Create session (auto-selects free model)
session = ChatSession()

# Send message and get response
response = session.send("Hello!")
print(response)

# Streaming response
for chunk in session.send_stream("Tell me a joke"):
    print(chunk, end='', flush=True)

# Check state
print(session.get_state())  # idle, processing, completed, error
print(session.is_completed())
```

### Simple Chat

```python
from pycore.pyutils.openrouter_sdk import openrouter_client

response = openrouter_client.chat(
    prompt="What is the capital of France?",
    model="free",  # DeepSeek R1T2 Chimera (free)
    max_tokens=100
)
print(response)
```

### Streaming Chat

```python
def on_chunk(chunk):
    print(chunk, end='', flush=True)

response = openrouter_client.chat_stream(
    prompt="Write a haiku about coding",
    model="deepseek-r1t2-chimera",
    on_chunk=on_chunk
)
```

### Chat with System Prompt

```python
response = openrouter_client.chat(
    prompt="What's 25 * 4?",
    system_prompt="You are a helpful math tutor.",
    model="free",
    temperature=0.3
)
```

### Advanced Chat Completion

```python
response = openrouter_client.chat_completion(
    messages=[
        {"role": "system", "content": "You are a creative writer."},
        {"role": "user", "content": "Write a story opening."}
    ],
    model="free",
    temperature=0.9,
    max_tokens=200
)

content = response['choices'][0]['message']['content']
print(content)
```

### Multi-turn Conversation

```python
messages = [
    {"role": "user", "content": "What's the largest planet?"}
]

# First response
response1 = openrouter_client.chat_completion(messages=messages, model="free")
assistant_msg = response1['choices'][0]['message']['content']

# Continue conversation
messages.append({"role": "assistant", "content": assistant_msg})
messages.append({"role": "user", "content": "How big is it?"})

response2 = openrouter_client.chat_completion(messages=messages, model="free")
```

## Available Models

The SDK provides convenient shortcuts for popular models:

```python
# List all available shortcuts
models = openrouter_client.list_available_models()
print(models)
```

### Free Models
- `free` or `deepseek-r1t2-chimera` - DeepSeek R1T2 Chimera (671B MoE, completely free)

### OpenAI Models
- `gpt-4o` - GPT-4 Optimized
- `gpt-4o-mini` - GPT-4 Optimized Mini
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### Anthropic Models
- `claude-3.5-sonnet` - Claude 3.5 Sonnet
- `claude-3-opus` - Claude 3 Opus
- `claude-3-haiku` - Claude 3 Haiku

### Google Models
- `gemini-pro` - Gemini Pro
- `gemini-flash` - Gemini Flash

### Meta Models
- `llama-3.3-70b` - Llama 3.3 70B Instruct
- `llama-3.1-405b` - Llama 3.1 405B Instruct

### DeepSeek Models
- `deepseek-r1` - DeepSeek R1
- `deepseek-v3` - DeepSeek V3

## API Methods

### `chat(prompt, model=None, system_prompt=None, **kwargs)`

Simple chat interface (non-streaming).

**Parameters:**
- `prompt` (str): User message
- `model` (str, optional): Model shortcut or full ID (default: "free")
- `system_prompt` (str, optional): System message
- `**kwargs`: Additional parameters (temperature, max_tokens, etc.)

**Returns:** `str` - Assistant response

### `chat_stream(prompt, model=None, system_prompt=None, on_chunk=None, **kwargs)`

Simple chat interface with streaming.

**Parameters:**
- `prompt` (str): User message
- `model` (str, optional): Model shortcut or full ID
- `system_prompt` (str, optional): System message
- `on_chunk` (callable, optional): Callback for each chunk
- `**kwargs`: Additional parameters

**Returns:** `str` - Complete response

### `chat_completion(messages, model=None, temperature=1.0, max_tokens=None, **kwargs)`

Advanced chat completion interface.

**Parameters:**
- `messages` (list): List of message dicts with 'role' and 'content'
- `model` (str, optional): Model shortcut or full ID
- `temperature` (float): Sampling temperature (0.0-2.0)
- `max_tokens` (int, optional): Maximum tokens to generate
- `**kwargs`: Additional parameters

**Returns:** `dict` - API response

### `chat_completion_stream(messages, model=None, on_chunk=None, **kwargs)`

Advanced chat completion with streaming.

**Parameters:**
- `messages` (list): List of message dicts
- `model` (str, optional): Model shortcut or full ID
- `on_chunk` (callable, optional): Callback for each chunk
- `**kwargs`: Additional parameters

**Yields:** `str` - Content chunks

## Model Information

### DeepSeek R1T2 Chimera (Free)

- **Parameters:** 671B MoE (Mixture-of-Experts)
- **Context:** 163,840 tokens (60k standard, tested to ~130k)
- **Cost:** $0/M tokens (completely free!)
- **Speed:** ~20% faster than R1, 2× faster than R1-0528
- **Features:** Strong reasoning, long-context analysis, <think> tokens

Perfect for:
- Development and testing
- Long-context analysis
- Reasoning tasks
- Dialogue systems

## Configuration

### Using Secret Manager (Recommended)

Create file: `.secret_keys/.secret_ignore/OPENROUTER_API_KEY`

```
sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Using Direct API Key

```python
from pycore.pyutils.openrouter_sdk import get_openrouter_client

client = get_openrouter_client(
    api_key="sk-or-v1-...",
    site_url="https://myapp.com",  # Optional
    site_name="My App"  # Optional
)
```

## Error Handling

```python
response = openrouter_client.chat("Hello!")

if response.startswith("Error:"):
    print(f"Request failed: {response}")
else:
    print(f"Success: {response}")
```

Or with chat_completion:

```python
response = openrouter_client.chat_completion(
    messages=[{"role": "user", "content": "Hello!"}]
)

if 'error' in response:
    print(f"Error: {response['error']}")
else:
    content = response['choices'][0]['message']['content']
    print(content)
```

## Testing

Run the test suite:

```bash
python pyapps/test_openrouter.py
```

Run examples:

```bash
python scripts/openrouter_examples.py
```

## Links

- OpenRouter Website: https://openrouter.ai
- Get API Keys: https://openrouter.ai/keys
- API Documentation: https://openrouter.ai/docs
- Model Explorer: https://openrouter.ai/models

## Architecture

```
pycore/pyutils/openrouter_sdk/
├── __init__.py                  # Public exports
├── openrouter_client.py         # Main client implementation
└── README.md                    # This file

pyapps/
└── test_openrouter.py           # Test suite

scripts/
└── openrouter_examples.py       # Usage examples
```

## ChatSession API

### `ChatSession(model=None, system_prompt=None, max_history=100, auto_cache=True)`

High-level chat session manager with conversation history and caching.

**Parameters:**
- `model` (str, optional): Model to use (default: auto-select free DeepSeek model)
- `system_prompt` (str, optional): System prompt for the conversation
- `max_history` (int): Maximum messages to keep in history (default: 100)
- `auto_cache` (bool): Enable automatic response caching (default: True)

**Methods:**

#### `send(message, temperature=0.7, max_tokens=500, **kwargs) -> str`

Send message and get complete response (batch mode).

```python
response = session.send("What is AI?")
```

#### `send_stream(message, temperature=0.7, max_tokens=500, **kwargs) -> Iterator[str]`

Send message and get streaming response.

```python
for chunk in session.send_stream("Write a poem"):
    print(chunk, end='')
```

#### `get_state() -> SessionState`

Get current session state: `IDLE`, `PROCESSING`, `COMPLETED`, `ERROR`

#### `is_idle() -> bool`
#### `is_processing() -> bool`
#### `is_completed() -> bool`
#### `is_error() -> bool`

Check session state.

#### `get_history() -> List[Dict[str, str]]`

Get conversation history.

```python
history = session.get_history()
for msg in history:
    print(f"{msg['role']}: {msg['content']}")
```

#### `clear_history()`

Clear conversation history (keeps system prompt).

#### `get_statistics() -> Dict[str, Any]`

Get session statistics.

```python
stats = session.get_statistics()
# {'model': '...', 'state': '...', 'total_messages': 5, ...}
```

#### `add_on_chunk_callback(callback: Callable[[str], None])`

Add callback for streaming chunks.

```python
session.add_on_chunk_callback(lambda chunk: print(chunk))
```

#### `add_on_complete_callback(callback: Callable[[str], None])`

Add callback for complete responses.

```python
session.add_on_complete_callback(lambda response: save_to_file(response))
```

## Examples

### Interactive Chat

```bash
python scripts/interactive_chat.py
```

### Chat Session Examples

```bash
python scripts/chat_session_examples.py
```

### Run Tests

```bash
python pyapps/test_chat_session.py
```

## License

Part of the core_node project.
