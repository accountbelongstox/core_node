# Native UI 多语言统一架构

## 当前状态分析

### ✅ 已正确实现的部分

1. **I18nManager 单例**
   - 文件: `pycore/pyutils/native_ui/step0_i18n/i18n_manager.py`
   - 正确的单例模式（线程安全）
   - 全局实例：`i18n` (在 `step0_i18n/__init__.py:33`)

2. **THREAD_BUS 事件集成**
   - `I18N_SET_LANGUAGE`: 请求切换语言
   - `I18N_LANGUAGE_CHANGED`: 语言切换通知
   - I18nManager 已注册事件处理器

3. **TkinterStartupThread (Debug 窗口)**
   - ✅ 已使用 `i18n` 单例
   - ✅ 有多语言选择器
   - ✅ 部分文本已多语言化（app.name, window.title.initializing）
   - ✅ 托盘菜单使用 `i18n.get(text_key)`

### ❌ 需要修复的问题

1. **硬编码文本**

   **title_bar.py**:
   - Line 199: `"Menu"`
   - Line 240: `"Minimize"` (tooltip)
   - Line 250: `"Maximize"` (tooltip)
   - Line 260: `"Close"` (tooltip)
   - Line 285: `"Restore"` (tooltip)
   - Line 288: `"Maximize"` (tooltip)

   **startup_window_thread.py**:
   - Line 187, 338: `"Initializing..."`
   - Line 800: `"Ready!"`

2. **title_bar.py 未监听语言切换事件**
   - 当用户在 Debug 窗口切换语言时
   - title_bar 的 tooltip 不会更新

3. **system_tray.py 未监听语言切换事件**
   - 托盘菜单虽然使用了 `i18n.get()`
   - 但切换语言后不会重建菜单

## 统一架构设计

### 设计原则

1. **单一全局实例**
   - 所有组件使用 `from pycore.pyutils.native_ui.step0_i18n import i18n`
   - 禁止创建新的 I18nManager 实例

2. **事件驱动更新**
   - 语言切换通过 THREAD_BUS 的 `I18N_SET_LANGUAGE` 事件
   - 所有 UI 组件监听 `I18N_LANGUAGE_CHANGED` 事件
   - 收到事件后更新自身 UI 文本

3. **统一的 Key 定义**
   - 所有 i18n key 定义在 `step0_i18n/i18n_keys.py`
   - 使用常量类 `I18nKeys`

4. **无硬编码**
   - 所有用户可见文本必须使用 `i18n.get(key)`
   - 日志和调试信息可以保留英文

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│             I18nManager (Singleton)                          │
│  - 全局实例: i18n                                             │
│  - 管理所有语言翻译                                            │
│  - 监听 THREAD_BUS 的 I18N_SET_LANGUAGE 事件                  │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ 语言切换流程
               ├──> 1. 用户在 Debug 窗口选择语言
               │    └─> THREAD_BUS.trigger_event('I18N_SET_LANGUAGE', {'language': 'zh'})
               │
               ├──> 2. I18nManager 收到事件
               │    └─> i18n.set_language('zh')
               │    └─> 更新内部状态
               │    └─> THREAD_BUS.trigger_event('I18N_LANGUAGE_CHANGED', {'language': 'zh'})
               │
               └──> 3. 所有 UI 组件收到 I18N_LANGUAGE_CHANGED 事件
                    ├─> TkinterStartupThread: 更新窗口标题、状态文本
                    ├─> PySide6TitleBar: 更新按钮 tooltip
                    ├─> PySide6SystemTray: 重建托盘菜单
                    └─> 其他组件...

┌──────────────────────────────────────────────────────────────┐
│                    UI 组件多语言集成                          │
└──────────────────────────────────────────────────────────────┘

组件初始化：
  1. 导入 i18n 和 I18nKeys
  2. 使用 i18n.get(I18nKeys.XXX) 获取文本
  3. 注册 I18N_LANGUAGE_CHANGED 事件处理器

组件更新：
  1. 收到 I18N_LANGUAGE_CHANGED 事件
  2. 重新调用 i18n.get(I18nKeys.XXX)
  3. 更新 UI 文本（setText, setToolTip, setWindowTitle）
```

## 实施方案

### 1. 扩展基础翻译文件

**文件**: `pycore/pyutils/native_ui/step0_i18n/translations/translations_en.json`

新增 key:
```json
{
  "ui": {
    "title_bar": {
      "menu": "Menu",
      "minimize": "Minimize",
      "maximize": "Maximize",
      "restore": "Restore",
      "close": "Close"
    },
    "status": {
      "initializing": "Initializing...",
      "ready": "Ready!",
      "loading": "Loading...",
      "error": "Error"
    }
  }
}
```

**文件**: `pycore/pyutils/native_ui/step0_i18n/translations/translations_zh.json`

```json
{
  "ui": {
    "title_bar": {
      "menu": "菜单",
      "minimize": "最小化",
      "maximize": "最大化",
      "restore": "还原",
      "close": "关闭"
    },
    "status": {
      "initializing": "初始化中...",
      "ready": "就绪！",
      "loading": "加载中...",
      "error": "错误"
    }
  }
}
```

**文件**: `pycore/pyutils/native_ui/step0_i18n/translations/translations_ja.json`

```json
{
  "ui": {
    "title_bar": {
      "menu": "メニュー",
      "minimize": "最小化",
      "maximize": "最大化",
      "restore": "元に戻す",
      "close": "閉じる"
    },
    "status": {
      "initializing": "初期化中...",
      "ready": "準備完了！",
      "loading": "読み込み中...",
      "error": "エラー"
    }
  }
}
```

### 2. 扩展 I18nKeys 常量类

**文件**: `pycore/pyutils/native_ui/step0_i18n/i18n_keys.py`

添加新常量：
```python
class I18nKeys:
    # ... 现有的 key ...

    # Title Bar
    UI_TITLE_BAR_MENU = "ui.title_bar.menu"
    UI_TITLE_BAR_MINIMIZE = "ui.title_bar.minimize"
    UI_TITLE_BAR_MAXIMIZE = "ui.title_bar.maximize"
    UI_TITLE_BAR_RESTORE = "ui.title_bar.restore"
    UI_TITLE_BAR_CLOSE = "ui.title_bar.close"

    # Status
    UI_STATUS_INITIALIZING = "ui.status.initializing"
    UI_STATUS_READY = "ui.status.ready"
    UI_STATUS_LOADING = "ui.status.loading"
    UI_STATUS_ERROR = "ui.status.error"
```

### 3. 修改 title_bar.py

**关键改动**:

1. **导入 i18n**:
```python
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.step0_i18n import i18n, I18nKeys
```

2. **初始化时使用 i18n.get()**:
```python
def _setup_ui(self):
    # ...
    if self.show_menu:
        self.menu_btn = TitleBarButton("☰", self.styles.menu_icon, parent=self)
        self.menu_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MENU))

    # ...
    self.min_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MINIMIZE))
    self.max_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MAXIMIZE))
    self.close_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_CLOSE))
```

3. **注册语言切换事件**:
```python
def __init__(self, ...):
    # ... 现有初始化 ...

    # Register language change handler
    def handle_language_change(event_data):
        """Update UI text when language changes"""
        self._update_ui_text()

    THREAD_BUS.register_event_handler(
        BusSignals.I18N_LANGUAGE_CHANGED,
        handle_language_change,
        priority=50
    )

def _update_ui_text(self):
    """Update all UI text with current language"""
    if self.menu_btn:
        self.menu_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MENU))

    self.min_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MINIMIZE))

    # Update maximize button tooltip based on state
    if self.parent().isMaximized():
        self.max_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_RESTORE))
    else:
        self.max_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_MAXIMIZE))

    self.close_btn.setToolTip(i18n.get(I18nKeys.UI_TITLE_BAR_CLOSE))
```

### 4. 修改 startup_window_thread.py

**关键改动**:

1. **替换硬编码**:
```python
# Line 187
self.root.title(f"{self.app_name} - {i18n.get(I18nKeys.UI_STATUS_INITIALIZING)}")

# Line 338
text=i18n.get(I18nKeys.UI_STATUS_INITIALIZING),

# Line 800
startup.set_status(i18n.get(I18nKeys.UI_STATUS_READY))
```

2. **语言切换时更新窗口**:
```python
def _on_language_changed(self, selected):
    """Handle language selection change"""
    # ... 现有逻辑 ...

    # Update window title
    title_text = i18n.get("window.title.initializing",
                         default=f"{new_app_name} - {i18n.get(I18nKeys.UI_STATUS_INITIALIZING)}")
    self.root.title(title_text)

    # Update status label
    if self.status_label:
        current_status = self.status_label.cget("text")
        # Re-translate current status if it's a known key
        if "Initializing" in current_status:
            self.set_status(i18n.get(I18nKeys.UI_STATUS_INITIALIZING))
        elif "Ready" in current_status:
            self.set_status(i18n.get(I18nKeys.UI_STATUS_READY))
```

### 5. 修改 system_tray.py

**关键改动**:

注册语言切换事件，重建托盘菜单：
```python
def __init__(self, ...):
    # ... 现有初始化 ...

    # Register language change handler
    def handle_language_change(event_data):
        """Rebuild tray menu when language changes"""
        self._rebuild_menu()

    THREAD_BUS.register_event_handler(
        BusSignals.I18N_LANGUAGE_CHANGED,
        handle_language_change,
        priority=50
    )

def _rebuild_menu(self):
    """Rebuild tray menu with current language"""
    # Clear existing menu
    self.tray_menu.clear()

    # Recreate menu with updated translations
    self._create_menu()
```

## 测试场景

### 场景 1：启动时语言检测
```
启动 → I18nManager 检测系统语言 → 设置为默认语言 → 所有 UI 显示对应语言
```

### 场景 2：Debug 窗口切换语言
```
点击 Debug 窗口语言选择器 → 选择中文 →
  ├─> Debug 窗口标题更新："初始化中..."
  ├─> 状态文本更新："初始化中..."
  ├─> 主窗口 title bar tooltip 更新："最小化", "最大化", "关闭"
  └─> 托盘菜单更新（如果启用）
```

### 场景 3：运行时切换语言
```
应用运行中 → 通过 THREAD_BUS 触发语言切换 →
  THREAD_BUS.trigger_event('I18N_SET_LANGUAGE', {'language': 'ja'})
  ├─> 所有 UI 组件收到 I18N_LANGUAGE_CHANGED 事件
  └─> 所有文本实时更新为日语
```

## 预期效果

1. **✅ 无硬编码文本**（除日志）
2. **✅ 语言实时切换**（无需重启）
3. **✅ 全局单例管理**（无重复实例）
4. **✅ 事件驱动更新**（统一机制）
5. **✅ 易于扩展**（添加新语言只需翻译文件）
6. **✅ 类型安全**（使用 I18nKeys 常量）

## 开发规范

### DO ✅
- 使用 `from pycore.pyutils.native_ui.step0_i18n import i18n, I18nKeys`
- 使用 `i18n.get(I18nKeys.XXX)` 获取文本
- 在组件初始化时注册 `I18N_LANGUAGE_CHANGED` 事件处理器
- 在处理器中更新所有可见文本
- 新增 key 时同时更新所有语言的翻译文件

### DON'T ❌
- ❌ 不要创建新的 I18nManager 实例（`I18nManager()`）
- ❌ 不要硬编码用户可见的文本
- ❌ 不要直接操作 `i18n._translations`（使用公共 API）
- ❌ 不要忘记注册语言切换事件处理器
- ❌ 不要在翻译文件中使用未定义的 key

## 实施检查清单

- [ ] 扩展基础翻译文件（en, zh, ja）
- [ ] 扩展 I18nKeys 常量类
- [ ] 修改 title_bar.py（替换硬编码 + 注册事件）
- [ ] 修改 startup_window_thread.py（替换硬编码）
- [ ] 修改 system_tray.py（注册事件 + 重建菜单）
- [ ] 测试语言切换功能
- [ ] 更新文档
