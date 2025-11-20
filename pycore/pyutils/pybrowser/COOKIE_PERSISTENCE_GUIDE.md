# Cookie Persistence Guide

## 📋 概述

pybrowser 现已支持完整的 Cookie 持久化功能，包括：
- [OK] 自动加载历史 cookies
- [OK] 实时保存 cookies
- [OK] 多 profile 支持
- [OK] 灵活的加载/保存策略
- [OK] 统一的配置参数
- [OK] **Session/Persistent Cookie 分离** (v2.1.0+)
- [OK] **域名分组优化加载** (v2.1.0+)

## 📦 存储路径

Cookies 默认存储在：
```
Windows: D:\www\pycore_db\cookies\
Linux:   /mnt/d/www/pycore_db/cookies/ (或 /www/pycore_db/cookies/)
```

使用 `map_web_path('www', 'pycore_db')` 自动适配不同平台。

## 🎯 基本使用

### 1. 默认配置（推荐）

```python
from pycore.pyutils.pybrowser import BrowserFactory

# 默认启用 cookie 持久化，自动加载/保存 default profile
# 默认行为：加载和保存所有 cookies（包括 session cookies）
browser = BrowserFactory.create('chrome', config={
    'headless': False
})

browser.start()
browser.wait_until_ready()

# 浏览器会自动加载 default.json 中的所有 cookies（包括 session）
browser.navigate('https://example.com')

# 浏览器关闭时自动保存所有 cookies 到 default.json
browser.stop()
browser.join()
```

### 2. 载入最新 Cookies

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'latest',  # 载入最近修改的 cookie profile
        'auto_save': True
    }
})
```

### 3. 载入指定 Profile

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'specified',
        'load_profile': 'user_session_1',  # 载入指定的 cookie profile
        'auto_save': True
    }
})
```

### 4. 只载入 Persistent Cookies（高安全场景）

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'default',
        'include_session_cookies': False,  # 只加载 persistent cookies
        'save_session_cookies': True       # 但仍保存 session cookies 用于分析
    }
})
```

### 5. 不载入 Cookies（从零开始）

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'none',  # 不载入任何 cookies
        'save_strategy': 'new',   # 保存到新 profile（带时间戳）
        'auto_save': True
    }
})
```

### 6. 实时保存 Cookies

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'default',
        'auto_save': True,
        'realtime_save': True  # 每次导航后自动保存 cookies
    }
})

browser.start()
browser.wait_until_ready()

# 每次导航都会自动保存 cookies
browser.navigate('https://example.com/login')
browser.navigate('https://example.com/dashboard')
```

### 7. 禁用 Cookie 持久化

```python
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'enabled': False  # 完全禁用 cookie 持久化
    }
})
```

## 🔧 高级用法

### 手动保存 Cookies

```python
# 保存到默认 profile
profile_name = browser.save_cookies_manual()
print(f"Cookies saved to: {profile_name}")

# 保存到指定 profile
browser.save_cookies_manual('my_session_backup')
```

### 手动加载 Cookies

```python
# 运行时切换 cookie profile
success = browser.load_cookies_manual('another_session')
if success:
    print("Cookies loaded successfully")
```

### 列出所有 Cookie Profiles

```python
profiles = browser.list_cookie_profiles()
print(f"Available profiles: {profiles}")
# 输出: ['default', 'session_20250117_143022', 'user_session_1', ...]
```

### 删除 Cookie Profile

```python
browser.delete_cookie_profile('old_session')
```

### 查看 Profile 信息

```python
if browser.cookie_manager:
    info = browser.cookie_manager.get_profile_info('default')
    print(f"Profile info: {info}")
    # 输出: {'profile_name': 'default', 'cookie_count': 25, 'created_at': '...', ...}
```

## 📖 配置参数详解

### `cookie_config` 完整参数

```python
cookie_config = {
    # 是否启用 cookie 持久化
    'enabled': True,  # bool, default: True

    # 自定义存储目录（可选）
    'storage_dir': None,  # str, default: wwwr/pycore_db/cookies/

    # 加载策略
    'load_strategy': 'default',  # 'default' | 'latest' | 'specified' | 'none'
    #   - 'default': 载入 default profile
    #   - 'latest': 载入最近修改的 profile
    #   - 'specified': 载入指定 profile（需要 load_profile）
    #   - 'none': 不载入任何 cookies

    # 载入的 profile 名称（load_strategy='specified' 时必需）
    'load_profile': None,  # str

    # 保存策略
    'save_strategy': 'default',  # 'default' | 'new' | 'specified'
    #   - 'default': 保存到 default profile（覆盖）
    #   - 'new': 创建新 profile（带时间戳）
    #   - 'specified': 保存到指定 profile（需要 save_profile）

    # 保存的 profile 名称（save_strategy='specified' 时必需）
    'save_profile': None,  # str

    # 浏览器关闭时自动保存
    'auto_save': True,  # bool, default: True

    # 每次导航后实时保存
    'realtime_save': False,  # bool, default: False

    # Session Cookie 处理 (v2.1.0+)
    'include_session_cookies': True,  # bool, default: True
    #   - True: 加载时包含 session cookies（默认，最大兼容性）
    #   - False: 只加载 persistent cookies

    'save_session_cookies': True  # bool, default: True
    #   - True: 保存 session cookies（默认）
    #   - False: 完全不保存 session cookies
}
```

## 🌟 使用场景

### 场景 1：多账号管理

```python
# 账号 1
browser1 = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'specified',
        'load_profile': 'account1',
        'save_strategy': 'specified',
        'save_profile': 'account1'
    }
})

# 账号 2
browser2 = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'specified',
        'load_profile': 'account2',
        'save_strategy': 'specified',
        'save_profile': 'account2'
    }
})
```

### 场景 2：爬虫会话保持

```python
# 首次运行：登录并保存 cookies
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'none',  # 首次运行不加载
        'save_strategy': 'specified',
        'save_profile': 'spider_session',
        'auto_save': True
    }
})

# 后续运行：直接使用已登录的 cookies
browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_strategy': 'specified',
        'load_profile': 'spider_session',
        'save_strategy': 'specified',
        'save_profile': 'spider_session',
        'realtime_save': True  # 实时更新 session
    }
})
```

### 场景 3：测试环境隔离

```python
# 开发环境
dev_browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_profile': 'dev_cookies',
        'save_profile': 'dev_cookies'
    }
})

# 生产环境
prod_browser = BrowserFactory.create('chrome', config={
    'cookie_config': {
        'load_profile': 'prod_cookies',
        'save_profile': 'prod_cookies'
    }
})
```

## [STATS] Cookie 文件格式

### Cookie 数据文件（`*.json`） - 新格式 (v2.1.0+)

```json
{
  "persistent_cookies": [
    {
      "name": "remember_token",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "expiry": 1735689600,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "session_cookies": [
    {
      "name": "SESSIONID",
      "value": "xyz789",
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
  "last_updated": "2025-11-17T15:45:33.654321",
  "strategy": "default"
}
```

**说明**:
- `persistent_cookies`: 有过期时间的 cookies（会持久化）
- `session_cookies`: 没有过期时间的 cookies（浏览器关闭后应删除）
- 新格式自动区分两种类型，提供更精确的控制

### 旧格式（仍然支持）

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "expires": 1735689600,
      "httpOnly": true,
      "secure": true
    }
  ],
  "count": 1,
  "saved_at": "2025-01-17T14:30:22.123456"
}
```

**向后兼容**: 新版本可以读取旧格式文件，加载时会自动分离 session/persistent cookies。

### 元数据文件（`*.meta.json`）

```json
{
  "profile_name": "default",
  "cookie_count": 25,
  "created_at": "2025-01-17T14:30:22.123456",
  "last_updated": "2025-01-17T15:45:33.654321",
  "strategy": "default",
  "browser_type": "chrome",
  "browser_version": "131.0.6778.86",
  "thread_name": "ChromeBrowser"
}
```

## 🔄 Cookie Manager API

### 直接使用 CookieManager

```python
from pycore.pyutils.pybrowser.utils.cookie_manager import CookieManager

# 创建 Cookie Manager
manager = CookieManager()

# 保存 cookies
cookies = [
    {'name': 'token', 'value': 'xyz', 'domain': '.example.com', 'path': '/'}
]
profile_name = manager.save_cookies(cookies, strategy='new')

# 加载 cookies
loaded_cookies = manager.load_cookies(strategy='latest')

# 列出 profiles
profiles = manager.list_profiles()

# 获取 profile 信息
info = manager.get_profile_info('default')

# 删除 profile
manager.delete_profile('old_session')

# 清理旧 profiles（保留最近 10 个）
deleted_count = manager.cleanup_old_profiles(keep_count=10)

# 导出 profile
manager.export_profile('my_session', Path('backup/cookies.json'))

# 导入 profile
manager.import_profile(Path('backup/cookies.json'), 'imported_session')
```

## 🚀 迁移指南

### 从旧版本迁移

旧代码：
```python
# 旧版：需要手动处理 cookies
browser = ChromeBrowser()
browser.start()
# ... 登录操作 ...
cookies = browser.get_cookies()
with open('cookies.json', 'w') as f:
    json.dump(cookies, f)
```

新代码：
```python
# 新版：自动处理 cookies
browser = BrowserFactory.create('chrome')  # 默认启用 cookie 持久化
browser.start()
# ... 登录操作 ...
# Cookies 会在浏览器关闭时自动保存
browser.stop()
```

## [WARN] 注意事项

1. **Session Cookies 处理** (v2.1.0+)：
   - **默认配置：加载和保存所有 cookies（包括 session cookies）**
   - 这确保了最大的兼容性和会话持久性
   - 如需更高安全性，可设置 `include_session_cookies: False`
   - 详见：[SESSION_COOKIES_GUIDE.md](./SESSION_COOKIES_GUIDE.md)

2. **Cookie 加载优化** (v2.1.0+)：
   - 新版本按域名分组加载 cookies，提高加载成功率
   - 跳过的 cookies 会记录在日志中（debug 级别）
   - Selenium 要求当前页面域名与 cookie 域名匹配

3. **首次加载 cookies 需要域名匹配**：
   - Selenium 添加 cookie 需要当前页面的域名与 cookie 的 domain 匹配
   - 首次启动时，浏览器会先导航到 `about:blank`，然后添加 cookies
   - 部分 cookies 可能因域名不匹配而跳过

4. **realtime_save 性能影响**：
   - 启用 `realtime_save` 会在每次导航后保存 cookies 到磁盘
   - 频繁导航时可能影响性能
   - 建议仅在需要实时同步时启用

5. **profile 名称限制**：
   - Profile 名称会用作文件名
   - 避免使用特殊字符（如 `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`）

6. **安全性**：
   - Cookie 文件以明文 JSON 格式存储
   - 敏感环境建议加密存储目录或使用其他加密方案
   - 不要将 cookie 文件提交到版本控制系统
   - Session cookies 可能包含敏感会话令牌

## 🔍 常见问题

### Q: Cookie 没有被加载？

A: 检查以下几点：
1. 确认 `cookie_config.enabled` 为 `True`
2. 确认 cookie 文件存在：`browser.list_cookie_profiles()`
3. 检查加载策略和 profile 名称是否正确
4. 查看日志输出，确认是否有加载失败的提示

### Q: 如何在多个浏览器实例间共享 cookies？

A: 使用相同的 `load_profile` 和 `save_profile`：
```python
config = {
    'cookie_config': {
        'load_profile': 'shared_session',
        'save_profile': 'shared_session',
        'realtime_save': True  # 实时同步
    }
}
browser1 = BrowserFactory.create('chrome', config=config)
browser2 = BrowserFactory.create('edge', config=config)
```

### Q: 如何清理过期的 cookie profiles？

A:
```python
if browser.cookie_manager:
    # 保留最近 10 个 profiles，删除其他
    deleted = browser.cookie_manager.cleanup_old_profiles(keep_count=10)
    print(f"Cleaned up {deleted} old profiles")
```

## 📝 变更总结

### v2.1.0 新增功能 (2025-11-17)
- [OK] **Session/Persistent Cookie 分离存储**
- [OK] **域名分组优化 Cookie 加载**
- [OK] 新增 `include_session_cookies` 配置（默认 False）
- [OK] 新增 `save_session_cookies` 配置（默认 True）
- [OK] 向后兼容旧格式 cookie 文件
- [OK] 增强的日志输出（显示 session/persistent 分布）

### v2.0.0 功能 (2025-01-17)
- [OK] `CookieManager` 类：完整的 cookie 持久化管理
- [OK] 自动加载/保存 cookies
- [OK] 多 profile 支持
- [OK] 实时 cookie 更新
- [OK] Cookie 元数据跟踪

### 优化改进
- [OK] 统一配置参数（`profile_dir` 替代 `user_data_dir`/`profile_dir`）
- [OK] 重构 `ThreadedBrowser` 基类，消除代码重复
- [OK] 统一错误消息生成
- [OK] 所有通用方法移至基类

### 破坏性变更
- [WARN] 推荐使用统一的 `profile_dir` 参数（仍向后兼容 `user_data_dir`）
- [WARN] Cookie 配置现在嵌套在 `cookie_config` 下

## 🎉 开始使用

```python
from pycore.pyutils.pybrowser import BrowserFactory

# 创建浏览器（自动启用 cookie 持久化）
browser = BrowserFactory.create('chrome', config={
    'headless': False
})

browser.start()
browser.wait_until_ready()

# 导航（cookies 会自动加载）
browser.navigate('https://example.com')

# 关闭（cookies 会自动保存）
browser.stop()
browser.join()

print("Cookies saved automatically!")
```

---

**祝您使用愉快！** 🚀

## 📚 相关文档

- [Session Cookies 处理指南](./SESSION_COOKIES_GUIDE.md) - 详细说明 session/persistent cookie 处理
- [重构总结](./REFACTORING_SUMMARY.md) - 代码重构和优化记录

如有问题，请查看 `pycore/pyutils/pybrowser/utils/cookie_manager.py` 源码或提交 Issue。
