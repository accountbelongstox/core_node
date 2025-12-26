# WebView 闪屏问题分析与优化方案

## 综合调研报告（基于 Qt/PySide6 官方文档）

---

## 一、问题现状

### 1.1 症状描述
- WebView 在加载时出现白屏/空白闪烁
- Loading page 到实际内容切换时有明显闪屏
- 视觉上不流畅，用户体验差

### 1.2 当前实现架构

**文件位置**: `pycore/pyutils/native_ui/step5_main_ui/pyside6/webview.py`

```python
# 当前切换机制 (Line 282-285)
def hide_loading_page(self):
    """Hide loading page and show web view."""
    self.loading_widget.hide()
    self.web_view.show()

# 延迟切换 (Line 358-364)
@Slot(bool)
def _on_load_finished(self, success: bool):
    if success:
        QTimer.singleShot(500, self.hide_loading_page)  # 500ms 延迟
    self.load_finished.emit(success)
```

**文件位置**: `pycore/pyutils/native_ui/step5_main_ui/pyside6/framework.py`

```python
# URL 加载延迟 (Line 441)
QTimer.singleShot(500, lambda: self.webview.load_url(self.config.webview_url))
```

---

## 二、根本原因分析（基于官方文档）

### 2.1 **Widget 切换机制问题**

**文档来源**: [QWidget.update() - Qt for Python](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QWidget)

> **关键发现**: `update()` 不会立即重绘，而是调度一个 paint event
> - `hide()` 和 `show()` 之间可能有渲染间隙
> - 两个 widget 在同一 layout 中切换可能触发 layout 重新计算

```python
# 当前实现的问题
layout.addWidget(self.loading_widget)  # Widget 1
layout.addWidget(self.web_view)         # Widget 2
# hide()/show() 切换时可能有空白帧
```

### 2.2 **QWebEngineView 默认背景**

**文档来源**: [QWebEnginePage.setBackgroundColor() - Qt for Python](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEnginePage)

> **关键发现**: QWebEnginePage 有独立的背景色设置
> - 未设置时可能显示白色或系统默认背景
> - 与应用主题不匹配导致视觉闪烁

```python
# 文档示例
page.setBackgroundColor(QColor("#1e1e1e"))  # 设置匹配主题的背景色
```

### 2.3 **双重延迟问题**

**总延迟链路**:
1. `framework.py:441` - URL 加载前延迟 **500ms**
2. 页面加载时间（网络/渲染）
3. `webview.py:362` - loadFinished 后再延迟 **500ms**
4. **总计**: 1000ms+ 的空白时间

### 2.4 **硬件加速与渲染进程**

**文档来源**: [Qt WebEngine Hardware Acceleration](https://doc.qt.io/qtforpython-6/overviews/qtwebengine-features)

> **关键发现**: 硬件加速可能影响渲染时序
> - 环境变量 `QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu` 可禁用 GPU
> - GPU 渲染可能导致首帧延迟

**文档来源**: [QWebEnginePage.RenderProcessTerminationStatus](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEnginePage)

> 渲染进程独立运行，可能有启动延迟

### 2.5 **Widget 更新与重绘优化缺失**

**文档来源**: [QWidget.setUpdatesEnabled() - Qt for Python](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QWidget)

> **推荐方法**: 临时禁用更新以防止闪烁

```python
# 文档示例
widget.setUpdatesEnabled(False)
# ... 进行视觉更改 ...
widget.setUpdatesEnabled(True)
```

**当前实现未使用此优化**。

---

## 三、技术方案（基于文档调研）

### 方案 A：设置 WebEngine 背景色（最简单）

**优先级**: ⭐⭐⭐⭐⭐ (立即实施)

**实现位置**: `webview.py:_setup_ui()`

```python
def _setup_ui(self):
    # ... 现有代码 ...

    # 设置 WebEngine 背景色匹配应用主题
    self.web_view = QWebEngineView()
    page = self.web_view.page()
    page.setBackgroundColor(QColor("#1e1e1e"))  # 匹配 loading 背景

    # ... 其余代码 ...
```

**预期效果**: 消除白屏闪烁，即使加载失败也不显示白色背景

---

### 方案 B：使用 QStackedWidget 替代 hide/show（推荐）

**优先级**: ⭐⭐⭐⭐

**文档来源**: [QStackedWidget - Qt for Python](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QStackedWidget)

> **优势**: 平滑切换，无重绘闪烁，内置过渡支持

**实现位置**: `webview.py:_setup_ui()`

```python
from PySide6.QtWidgets import QStackedWidget

def _setup_ui(self):
    """Setup WebView UI using QStackedWidget."""
    # Main layout
    layout = QVBoxLayout(self)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.setSpacing(0)

    # Create stacked widget
    self.stacked_widget = QStackedWidget()

    # Create web view
    self.web_view = QWebEngineView()
    page = self.web_view.page()
    page.setBackgroundColor(QColor("#1e1e1e"))

    # Configure settings
    settings = self.web_view.settings()
    settings.setAttribute(
        QWebEngineSettings.JavascriptEnabled,
        self.enable_javascript
    )

    if self.enable_dev_tools:
        settings.setAttribute(
            QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled,
            True
        )

    # Connect signals
    self.web_view.loadStarted.connect(self._on_load_started)
    self.web_view.loadFinished.connect(self._on_load_finished)
    self.web_view.loadProgress.connect(self.load_progress.emit)
    self.web_view.urlChanged.connect(self.url_changed.emit)
    self.web_view.titleChanged.connect(self.title_changed.emit)

    # Create loading widget
    self._create_loading_widget()

    # Add widgets to stacked widget
    self.stacked_widget.addWidget(self.loading_widget)  # Index 0
    self.stacked_widget.addWidget(self.web_view)        # Index 1

    # Show loading widget initially
    self.stacked_widget.setCurrentIndex(0)

    # Add stacked widget to layout
    layout.addWidget(self.stacked_widget)

def hide_loading_page(self):
    """Hide loading page and show web view."""
    # 禁用更新以防止闪烁
    self.stacked_widget.setUpdatesEnabled(False)

    # 切换到 webview
    self.stacked_widget.setCurrentIndex(1)

    # 重新启用更新
    self.stacked_widget.setUpdatesEnabled(True)

def show_loading_page(self, html_path=None, style=1, text="Loading...", background="#1e1e1e"):
    """Show loading page."""
    # ... 现有加载页面创建逻辑 ...

    # 切换到 loading widget
    self.stacked_widget.setCurrentIndex(0)
```

**预期效果**:
- 无闪烁的平滑切换
- 减少 layout 重新计算
- 更好的性能

---

### 方案 C：移除/减少延迟（性能优化）

**优先级**: ⭐⭐⭐⭐

**实现位置 1**: `webview.py:_on_load_finished()`

```python
@Slot(bool)
def _on_load_finished(self, success: bool):
    """Handle load finished."""
    if success:
        # 移除不必要的延迟，立即切换
        self.hide_loading_page()
        # 或者减少延迟到最小
        # QTimer.singleShot(100, self.hide_loading_page)  # 100ms 足够了

    self.load_finished.emit(success)
```

**实现位置 2**: `framework.py` (可选)

```python
# 减少初始加载延迟
if self.config.webview_url:
    # 从 500ms 减少到 100ms 或立即加载
    QTimer.singleShot(100, lambda: self.webview.load_url(self.config.webview_url))
    # 或者完全移除延迟:
    # self.webview.load_url(self.config.webview_url)
```

**预期效果**: 减少 500-1000ms 的等待时间

---

### 方案 D：添加淡入淡出动画（用户体验增强）

**优先级**: ⭐⭐⭐ (可选)

**文档来源**: [QPropertyAnimation - Qt for Python](https://doc.qt.io/qtforpython-6/overviews/qtcore-animation-overview)

```python
from PySide6.QtCore import QPropertyAnimation, QEasingCurve

def hide_loading_page(self):
    """Hide loading page with fade animation."""
    # 禁用更新
    self.stacked_widget.setUpdatesEnabled(False)

    # 切换 widget
    self.stacked_widget.setCurrentIndex(1)

    # 启用更新
    self.stacked_widget.setUpdatesEnabled(True)

    # 可选: 添加淡入动画
    animation = QPropertyAnimation(self.web_view, b"windowOpacity")
    animation.setDuration(200)  # 200ms
    animation.setStartValue(0.0)
    animation.setEndValue(1.0)
    animation.setEasingCurve(QEasingCurve.Type.OutCubic)
    animation.start()
```

**预期效果**: 平滑的视觉过渡

---

### 方案 E：监听首次绘制事件（高级）

**优先级**: ⭐⭐

**文档来源**: [QWebEnginePage signals](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEnginePage)

> 虽然没有 `firstPaint` 信号，但可以结合 `loadProgress` 优化

```python
def __init__(self, ...):
    # ... 现有代码 ...
    self._first_content_loaded = False

    # 监听加载进度
    self.web_view.loadProgress.connect(self._on_load_progress)

@Slot(int)
def _on_load_progress(self, progress):
    """Handle load progress - switch on first meaningful content."""
    # 当加载到 50% 时切换（DOM 已加载，但资源可能未完成）
    if progress >= 50 and not self._first_content_loaded:
        self._first_content_loaded = True
        self.hide_loading_page()

@Slot()
def _on_load_started(self):
    """Handle load started."""
    self._first_content_loaded = False
    self.load_started.emit()
```

**预期效果**: 更早的内容展示，减少感知延迟

---

## 四、推荐实施顺序

### Phase 1: 立即修复（10 分钟）

✅ **方案 A**: 设置 WebEngine 背景色
- 修改 1 处代码
- 零风险
- 立即消除白屏

### Phase 2: 核心优化（30 分钟）

✅ **方案 B**: 使用 QStackedWidget
✅ **方案 C**: 移除/减少延迟

**预期结果**:
- 闪烁基本消除
- 性能提升 50%+
- 流畅的用户体验

### Phase 3: 锦上添花（可选）

🔲 **方案 D**: 淡入淡出动画
🔲 **方案 E**: 首次绘制优化

---

## 五、测试验证方案

### 5.1 视觉测试
```python
# 测试场景 1: 快速切换
for i in range(10):
    webview.load_url("http://localhost:38007")
    time.sleep(2)
    webview.reload()

# 测试场景 2: 慢速网络模拟
# 在浏览器开发者工具中设置网络限速
```

### 5.2 性能指标

**当前性能（预估）**:
- 白屏时间: 500-1000ms
- 切换闪烁: 明显
- 用户满意度: ⭐⭐

**优化后性能（预期）**:
- 白屏时间: 100-200ms
- 切换闪烁: 无
- 用户满意度: ⭐⭐⭐⭐⭐

---

## 六、风险评估

### 6.1 方案 A（背景色）
- **风险**: 无
- **回滚**: 一行代码

### 6.2 方案 B（QStackedWidget）
- **风险**: 低（Qt 标准组件）
- **回滚**: 保留旧代码，切换回 hide/show

### 6.3 方案 C（移除延迟）
- **风险**: 极低
- **注意**: 确保 URL 已 ready

### 6.4 方案 D/E（动画/首次绘制）
- **风险**: 低到中
- **建议**: 充分测试后再部署到生产环境

---

## 七、相关文档引用

### Qt/PySide6 官方文档
1. [QWebEnginePage - Background Color](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEnginePage)
2. [QWidget - Update and Repaint](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QWidget)
3. [QStackedWidget - Container](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QStackedWidget)
4. [Qt WebEngine - Hardware Acceleration](https://doc.qt.io/qtforpython-6/overviews/qtwebengine-features)
5. [QPropertyAnimation - Smooth Transitions](https://doc.qt.io/qtforpython-6/overviews/qtcore-animation-overview)

### 代码位置参考
- `pycore/pyutils/native_ui/step5_main_ui/pyside6/webview.py`
- `pycore/pyutils/native_ui/step5_main_ui/pyside6/framework.py`

---

## 八、后续优化方向

### 8.1 前端优化（与本文档无关，但可改善体验）
- React: 使用 Suspense + lazy loading
- Vite: 优化 build 配置，减少首屏加载时间
- 添加骨架屏（Skeleton Screen）

### 8.2 后端优化
- 优化 API 响应时间
- 使用 HTTP/2 或 HTTP/3
- CDN 加速静态资源

---

**最后更新**: 2025-12-07
**作者**: Claude (基于 Qt/PySide6 官方文档调研)
**状态**: 待实施
