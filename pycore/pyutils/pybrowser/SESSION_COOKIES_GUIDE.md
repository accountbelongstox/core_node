# Session Cookies 处理指南

## 📋 概述

pybrowser 现在支持区分和分别处理 **Session Cookies** 和 **Persistent Cookies**。

### 什么是 Session Cookies？

- **Session Cookies**: 没有 `expires` 或 `expiry` 属性的 cookie
- 浏览器关闭后自动删除
- 用于临时会话状态（如登录状态）
- **标准行为**: 不应该持久化到磁盘

### 什么是 Persistent Cookies？

- **Persistent Cookies**: 有明确的过期时间（`expires` 或 `expiry`）
- 存储在磁盘上，浏览器重启后仍然有效
- 用于长期状态（如用户偏好、记住我等）

## ⚙️ 默认行为

**v2.1.0+ 默认配置：加载和保存所有 cookies（包括 session cookies）**

这确保了：
- ✅ 最大的兼容性
- ✅ 会话持久性（无需重复登录）
- ✅ 与 v2.0.0 行为一致

如果您需要更高的安全性或符合浏览器标准行为，可以设置 `include_session_cookies: False`。

## 🆕 新功能

### 1. 自动分离存储

Cookie 数据文件格式（新版）：

```json
{
  "persistent_cookies": [
    {
      "name": "remember_token",
      "value": "xyz123",
      "domain": ".example.com",
      "path": "/",
      "expiry": 1735689600,
      "httpOnly": true,
      "secure": true
    }
  ],
  "session_cookies": [
    {
      "name": "SESSIONID",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "httpOnly": true,
      "secure": true
    }
  ],
  "total_count": 2,
  "persistent_count": 1,
  "session_count": 1,
  "session_saved": true,
  "saved_at": "2025-11-17T14:30:22.123456",
  "strategy": "default"
}
```

### 2. 灵活的加载/保存控制

**新增配置参数**:

```python
cookie_config = {
    # 加载时是否包含 session cookies (默认: True - 最大兼容性)
    'include_session_cookies': True,

    # 保存时是否保存 session cookies (默认: True)
    'save_session_cookies': True
}
```

## 🎯 使用场景

### 场景 1: 默认用法 - 加载所有 Cookies（包括 Session）

这是默认配置，确保最大兼容性：

```python
from pycore.pyutils.pybrowser import BrowserFactory

# 默认配置：加载和保存所有 cookies（包括 session）
browser = BrowserFactory.create('chrome', config={
    'headless': False
    # cookie_config 使用默认值，加载所有 cookies
})

browser.start()
browser.wait_until_ready()

# 首次访问，执行登录
browser.navigate('https://example.com/login')
# ... 登录操作 ...

# 浏览器关闭时：
# - Persistent cookies 会被保存和加载
# - Session cookies 会被保存但不会加载
browser.stop()
browser.join()
```

**行为**:
- ✅ 所有 cookies（包括 session）都会被保存
- ✅ 下次启动时，所有 cookies（包括 session）都会被加载
- ✅ 无需重复登录，保持会话状态
- ✅ 最大兼容性和便利性

### 场景 2: 高安全模式 - 只加载 Persistent Cookies

如果需要更高的安全性或符合浏览器标准行为：

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'default',
        'include_session_cookies': False,  # ← 只加载 persistent cookies
        'save_session_cookies': True       # ← 但仍保存 session cookies 用于分析
    }
})

browser.start()
browser.wait_until_ready()

# 只会载入 persistent cookies，session cookies 需要重新登录
browser.navigate('https://example.com/login')
# ... 执行登录操作 ...
```

**特点**:
- ✅ 更符合浏览器标准行为
- ✅ Session cookies 需要重新获取（更安全）
- ✅ 但仍保存 session cookies 用于调试分析

### 场景 3: 完全不保存 Session Cookies

最严格的模式，完全不持久化 session cookies：

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'default',
        'include_session_cookies': False,  # 不载入
        'save_session_cookies': False      # ← 也不保存
    }
})
```

**行为**:
- ✅ 只保存/加载 persistent cookies
- ✅ Session cookies 完全不触及磁盘
- ✅ 最符合隐私和安全标准

### 场景 4: 调试模式 - 查看 Session Cookie 内容

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'save_session_cookies': True  # 保存 session cookies 用于调试
    }
})

browser.start()
browser.wait_until_ready()

# ... 操作 ...

# 手动保存以查看
browser.save_cookies_manual('debug_session', save_session=True)

# 查看文件内容
import json
with open('D:/www/pycore_db/cookies/debug_session.json') as f:
    data = json.load(f)
    print(f"Session cookies: {data['session_cookies']}")
    print(f"Persistent cookies: {data['persistent_cookies']}")
```

## 🔧 API 参考

### 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `include_session_cookies` | bool | `False` | 加载时是否包含 session cookies |
| `save_session_cookies` | bool | `True` | 保存时是否保存 session cookies |

### 方法签名更新

#### `save_cookies_manual(profile_name, save_session)`

```python
def save_cookies_manual(
    self,
    profile_name: Optional[str] = None,
    save_session: Optional[bool] = None
) -> str:
    """
    手动保存 cookies

    Args:
        profile_name: 目标 profile 名称
        save_session: 是否保存 session cookies (None = 使用配置值)

    Returns:
        保存的 profile 名称
    """
```

**示例**:

```python
# 保存所有 cookies（包括 session）
browser.save_cookies_manual('full_backup', save_session=True)

# 只保存 persistent cookies
browser.save_cookies_manual('persistent_only', save_session=False)

# 使用配置的默认值
browser.save_cookies_manual('default_behavior')
```

#### `load_cookies_manual(profile_name, include_session)`

```python
def load_cookies_manual(
    self,
    profile_name: str,
    include_session: Optional[bool] = None
) -> bool:
    """
    手动加载 cookies

    Args:
        profile_name: 源 profile 名称
        include_session: 是否加载 session cookies (None = 使用配置值)

    Returns:
        是否成功
    """
```

**示例**:

```python
# 只加载 persistent cookies（推荐）
browser.load_cookies_manual('my_profile', include_session=False)

# 加载所有 cookies（包括 session）
browser.load_cookies_manual('my_profile', include_session=True)

# 使用配置的默认值
browser.load_cookies_manual('my_profile')
```

## 📊 文件格式兼容性

### 向后兼容

新版本 **完全兼容** 旧格式的 cookie 文件：

**旧格式**（所有 cookies 混在一起）:
```json
{
  "cookies": [
    {"name": "token", "value": "...", "expiry": 123456},
    {"name": "session", "value": "..."}
  ],
  "count": 2,
  "saved_at": "..."
}
```

**行为**:
- 加载时会自动识别并分离 session/persistent cookies
- 如果 `include_session_cookies=False`，会自动过滤掉 session cookies
- 会显示警告信息："Legacy format detected"

### 新格式（推荐）

```json
{
  "persistent_cookies": [...],
  "session_cookies": [...],
  "total_count": 10,
  "persistent_count": 8,
  "session_count": 2,
  "session_saved": true,
  "saved_at": "..."
}
```

## ⚠️ 最佳实践

### ✅ 推荐做法

1. **默认配置（最大兼容性）**
   ```python
   # 使用默认配置，加载所有 cookies
   browser = BrowserFactory.create('chrome')
   ```

2. **高安全场景（只加载 persistent cookies）**
   ```python
   cookie_config = {
       'include_session_cookies': False,  # 符合浏览器标准
       'save_session_cookies': True       # 但保存用于调试
   }
   ```

3. **根据需求选择**
   - 一般用途：使用默认配置（加载所有 cookies）
   - 高安全要求：设置 `include_session_cookies: False`

### ❌ 不推荐做法

1. **在多实例环境中共享 session cookies**
   - 可能导致会话冲突
   - 服务器端会话可能已失效

2. **将 session cookies 提交到版本控制**
   - 包含敏感信息
   - 可能泄露会话令牌

3. **长期依赖 session cookies**
   - Session cookies 本质上是临时的
   - 应该使用 persistent cookies 实现长期状态

## 🔍 调试技巧

### 查看 Cookie 类型分布

```python
cookies = browser.get_cookies()

session_count = 0
persistent_count = 0

for cookie in cookies:
    if 'expiry' in cookie:
        persistent_count += 1
        print(f"[Persistent] {cookie['name']}: expires at {cookie['expiry']}")
    else:
        session_count += 1
        print(f"[Session] {cookie['name']}: no expiry")

print(f"\nTotal: {len(cookies)}, Session: {session_count}, Persistent: {persistent_count}")
```

### 检查保存的 Cookie 文件

```python
import json
from pathlib import Path

profile_path = Path('D:/www/pycore_db/cookies/default.json')
with open(profile_path) as f:
    data = json.load(f)

if 'persistent_cookies' in data:
    print("✅ New format detected")
    print(f"Persistent: {data['persistent_count']}")
    print(f"Session: {data['session_count']}")
    print(f"Session saved: {data['session_saved']}")
else:
    print("⚠️ Legacy format detected")
    print(f"Total cookies: {data['count']}")
```

## 📝 迁移指南

### 从旧版本迁移

如果您之前使用的是 v2.0.0 或更早版本：

**无需任何修改**，新版本会：
1. ✅ 自动读取旧格式文件
2. ✅ **默认加载所有 cookies（包括 session）- 与 v2.0.0 行为一致**
3. ✅ 保存时使用新格式（自动分离存储）

**完全向后兼容**:

```python
# 旧代码（v2.0.0）
browser = BrowserFactory.create('chrome')
# 行为：加载所有 cookies

# 新代码（v2.1.0）
browser = BrowserFactory.create('chrome')
# 行为：仍然加载所有 cookies（完全一致）

# 如需更高安全性（可选）
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'include_session_cookies': False  # 只加载 persistent
    }
})
```

---

**更新日期**: 2025-11-17
**版本**: v2.1.0
**相关文档**: [COOKIE_PERSISTENCE_GUIDE.md](./COOKIE_PERSISTENCE_GUIDE.md)
