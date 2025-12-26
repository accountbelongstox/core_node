# HTML 标题栏拖动问题解决方案

生成时间: 2025-12-18
问题: PySide6 frameless 窗口中,HTML header 无法拖动窗口

## 问题分析

### 窗口结构

```
PySide6 Main Window (frameless)
├── Qt 原生标题栏 (enable_title_bar=True, 可拖动)  ← 在 WebView 上方
└── QWebEngineView
    └── HTML Content
        ├── DraggableHeader (App header, 本次添加) ← **新增可拖动**
        ├── Sidebar
        └── Main Content
```

### 为什么 HTML header 不能拖动?

1. **默认情况**: HTML 元素在 WebView 内部,鼠标事件被 WebView 拦截
2. **Qt 原生标题栏**: 在 WebView 上方,可以拖动,但可能被禁用或隐藏
3. **需求**: 让 HTML header 像原生标题栏一样可以拖动窗口

## 解决方案

### 方案 1: 使用 `-webkit-app-region` CSS 属性 (推荐)

Qt WebEngine 5.13+ 支持 `-webkit-app-region` CSS 属性,这是最简单的方案。

#### 实现

**文件**: `/www/programing/core_node/poly_apps/pycore-management/components/DraggableHeader.tsx`

```tsx
<div
  style={{
    WebkitAppRegion: 'drag',  // 整个区域可拖动
    userSelect: 'none',       // 禁止文本选择
    cursor: 'grab'
  }}
>
  <div style={{ WebkitAppRegion: 'no-drag' }}>
    {/* 按钮等交互元素设为 no-drag */}
    <button>...</button>
  </div>
</div>
```

#### 已修改的文件

1. ✅ **创建**: `components/DraggableHeader.tsx` - 可拖动 header 组件
2. ✅ **修改**: `App.tsx` - 导入并使用 DraggableHeader 包裹 header

```tsx
// BEFORE
<header className="h-16 ...">
  {/* header content */}
</header>

// AFTER
<DraggableHeader className="h-16 ...">
  {/* header content */}
</DraggableHeader>
```

### 方案 2: 禁用 Qt 原生标题栏 (可选)

如果只想用 HTML header,可以禁用 Qt 原生标题栏:

**文件**: `pycore/callmodule/callmodule_main.py`

```python
config = NativeUIConfig(
    # ... other config
    enable_title_bar=False,  # 禁用 Qt 原生标题栏
    frameless=True,          # 保持 frameless
)
```

### 方案 3: Qt Bridge (高级方案)

如果需要更精细的控制,可以通过 Qt-JavaScript bridge 通信:

```python
# webview.py
class PySide6WebView(QWebEngineView):
    def setup_bridge(self):
        channel = QWebChannel()
        self.page().setWebChannel(channel)
        # Register Qt object for JS to call
```

```javascript
// JavaScript
window.qtBridge.startWindowDrag();
```

## 测试验证

### 测试 1: 检查 `-webkit-app-region` 支持

```bash
# 启动应用
python pycore_module_caller.py

# 观察 Console
# 应该看到: [DraggableHeader] Qt WebView detected, window dragging enabled
```

### 测试 2: 验证拖动功能

1. 启动窗口
2. 鼠标移到 header 区域 (页面标题所在行)
3. 按住鼠标左键拖动
4. 窗口应该跟随鼠标移动

### 测试 3: 验证按钮可点击

1. 点击 header 中的按钮 (通知、用户头像)
2. 应该可以点击,不会触发拖动

## 技术细节

### `-webkit-app-region` CSS 属性

**支持版本**: Qt WebEngine 5.13+

**值**:
- `drag`: 该区域可拖动窗口
- `no-drag`: 该区域不可拖动 (用于按钮等交互元素)

**工作原理**:
- Chromium 引擎原生支持
- Qt WebEngine 直接映射到 Qt 窗口拖动 API
- 无需额外 C++ 代码

**限制**:
- 仅在 frameless 窗口中生效
- 需要 Qt WebEngine 5.13+

### 光标样式

```css
/* 拖动区域 */
cursor: grab;          /* 可拖动 */
cursor: grabbing;      /* 拖动中 */

/* 交互元素 */
cursor: pointer;       /* 按钮 */
cursor: default;       /* 普通元素 */
```

## 优势对比

| 方案 | 优势 | 劣势 |
|------|------|------|
| **-webkit-app-region** | 简单、原生支持、无需额外代码 | 需要 Qt 5.13+ |
| **禁用原生标题栏** | 完全自定义 UI | 失去最小化/最大化/关闭按钮 (需自行实现) |
| **Qt Bridge** | 最大灵活性 | 复杂、需要 C++ 代码 |

## 推荐方案

**使用 `-webkit-app-region` + Qt 原生标题栏**:
- ✅ Qt 原生标题栏: 提供最小化/最大化/关闭按钮
- ✅ HTML Header: 也可以拖动 (通过 `-webkit-app-region`)
- ✅ 最佳用户体验: 两个标题栏都能拖动

## 排查指南

### 问题 1: Header 仍然无法拖动

**检查**:
1. Qt WebEngine 版本: `pip show PySide6` (需要 6.2+)
2. `frameless=True` 设置
3. CSS 是否正确应用: 开发者工具 → Elements → 查看 computed styles

**解决**:
```bash
# 确保 PySide6 是最新版
pip install --upgrade PySide6
```

### 问题 2: 按钮无法点击

**原因**: 按钮没有设置 `WebkitAppRegion: 'no-drag'`

**解决**: 确保 DraggableHeader 组件内部的 `<div>` 有 `no-drag` 样式:

```tsx
<div style={{ WebkitAppRegion: 'no-drag' }}>
  {children}
</div>
```

### 问题 3: 光标样式不对

**解决**: 添加 `cursor: grab` 样式到 header:

```tsx
cursor: isDragging ? 'grabbing' : 'grab'
```

## 示例代码

### 完整的 DraggableHeader 组件

见: `/www/programing/core_node/poly_apps/pycore-management/components/DraggableHeader.tsx`

### 集成到 App.tsx

见: `/www/programing/core_node/poly_apps/pycore-management/App.tsx` (lines 87-110)

## 总结

1. ✅ **创建** `DraggableHeader.tsx` 组件,使用 `-webkit-app-region: drag`
2. ✅ **修改** `App.tsx`,用 `DraggableHeader` 包裹 header
3. ✅ **保留** Qt 原生标题栏,提供系统级控制
4. ✅ **结果**: 两个标题栏都可以拖动窗口

**现在 HTML header 应该可以拖动了!** 🎉

## 扩展阅读

- [Qt WebEngine Features](https://doc.qt.io/qt-6/qtwebengine-features.html)
- [Chromium -webkit-app-region](https://developer.chrome.com/docs/extensions/reference/app_window/)
- [Frameless Window Dragging](https://www.electronjs.org/docs/latest/tutorial/window-customization)
