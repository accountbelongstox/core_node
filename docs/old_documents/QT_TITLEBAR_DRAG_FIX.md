# Qt 标题栏拖动修复

生成时间: 2025-12-18
问题: PySide6 frameless 窗口的 Qt 原生标题栏无法拖动

## 问题根本原因

**错误实现**: 使用自定义的手动拖动逻辑 (start_drag/do_drag/end_drag)

```python
# BEFORE (错误的实现)
def mousePressEvent(self, event: QMouseEvent):
    if event.button() == Qt.LeftButton:
        self._drag_position = event.globalPos()
        self._dragging = True
        # 调用父窗口的自定义拖动方法
        parent.start_drag(event.pos())

def mouseMoveEvent(self, event: QMouseEvent):
    if self._dragging and self._drag_position:
        # 手动计算并移动窗口位置
        parent.do_drag(event.globalPos())
```

**问题**:
1. 手动计算窗口位置不够精确
2. 不支持系统级的窗口吸附、边缘检测等特性
3. 在某些桌面环境下可能不工作

## 正确的解决方案

**使用 Qt 原生的 `windowHandle().startSystemMove()` 方法**

根据 Qt 官方文档 (https://doc.qt.io/qtforpython-6/PySide6/QtGui/QWindow):
> **startSystemMove()**: Initiates an interactive system-specific resize operation for the window.

### 修复代码

**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step5_main_ui/pyside6/title_bar.py`

#### 1. mousePressEvent (Lines 324-336)

```python
# AFTER (正确的实现)
def mousePressEvent(self, event: QMouseEvent):
    """Handle mouse press for window dragging."""
    if event.button() == Qt.LeftButton:
        self._drag_position = event.globalPos()
        self._dragging = True

        # Use Qt's native system move for frameless window
        parent = self.window()
        if parent and parent.windowHandle():
            # Call startSystemMove() - Qt handles everything
            parent.windowHandle().startSystemMove()

    super().mousePressEvent(event)
```

#### 2. mouseMoveEvent (Lines 338-342)

```python
# AFTER (简化 - 不需要手动处理)
def mouseMoveEvent(self, event: QMouseEvent):
    """Handle mouse move for window dragging."""
    # startSystemMove() handles the actual dragging,
    # so we don't need to manually move the window here
    super().mouseMoveEvent(event)
```

#### 3. mouseReleaseEvent (Lines 344-350)

```python
# AFTER (简化)
def mouseReleaseEvent(self, event: QMouseEvent):
    """Handle mouse release to end dragging."""
    if event.button() == Qt.LeftButton:
        self._dragging = False
        self._drag_position = None

    super().mouseReleaseEvent(event)
```

## 技术细节

### `windowHandle().startSystemMove()` 的优势

1. **系统级集成**: 使用操作系统原生的窗口移动机制
2. **完整支持**:
   - 窗口吸附 (snap to edges)
   - 多显示器支持
   - 触摸屏/触控板手势
   - 系统动画效果
3. **跨平台**: Windows/Linux/macOS 统一 API
4. **性能优化**: 由系统处理,无需 Python 计算

### 工作原理

```
用户点击标题栏
  ↓
mousePressEvent 触发
  ↓
调用 parent.windowHandle().startSystemMove()
  ↓
Qt 将事件传递给操作系统的窗口管理器
  ↓
系统接管窗口拖动 (用户移动鼠标时窗口跟随)
  ↓
用户释放鼠标
  ↓
系统完成拖动并返回控制权给 Qt
```

### 与手动实现的对比

| 特性 | 手动实现 (旧) | startSystemMove (新) |
|------|--------------|---------------------|
| 代码复杂度 | 高 (需要计算位置) | 低 (一行代码) |
| 系统集成 | 无 | 完整支持 |
| 窗口吸附 | 不支持 | 自动支持 |
| 多显示器 | 可能有问题 | 完美支持 |
| 触摸支持 | 不支持 | 自动支持 |
| 性能 | 差 (Python 计算) | 优秀 (系统级) |

## 测试验证

### 测试 1: 基本拖动

```bash
python pycore_module_caller.py
```

**操作**:
1. 点击窗口顶部的标题栏 (深色区域,有最小化/最大化/关闭按钮)
2. 按住鼠标左键并拖动
3. 窗口应该跟随鼠标移动

**预期结果**: ✅ 窗口平滑拖动

### 测试 2: 窗口吸附

**操作**:
1. 拖动窗口到屏幕边缘
2. 松开鼠标

**预期结果**:
- ✅ Linux (X11): 窗口可能吸附到屏幕边缘 (取决于桌面环境)
- ✅ Windows: 窗口吸附并可能半屏/全屏显示 (Aero Snap)

### 测试 3: 双击最大化

**操作**:
1. 双击标题栏

**预期结果**: ✅ 窗口最大化/还原

### 测试 4: 按钮功能

**操作**:
1. 点击最小化按钮 (-)
2. 点击最大化按钮 (□)
3. 点击关闭按钮 (×)

**预期结果**:
- ✅ 最小化: 窗口最小化到任务栏
- ✅ 最大化: 窗口全屏
- ✅ 关闭: 窗口关闭

## 相关 Qt API

### QWindow.startSystemMove()

```python
# 获取窗口句柄
window = widget.window()
window_handle = window.windowHandle()

# 启动系统级窗口移动
window_handle.startSystemMove()
```

**返回值**: `bool` - 如果系统支持并成功启动移动操作则返回 `True`

**支持平台**:
- ✅ Windows 7+
- ✅ Linux (X11)
- ✅ Linux (Wayland) - 部分支持
- ✅ macOS

### QWindow.startSystemResize()

类似的API,用于调整窗口大小:

```python
# 启动系统级窗口调整大小
window_handle.startSystemResize(Qt.Edge)
```

## 排查指南

### 问题 1: 标题栏仍然无法拖动

**检查**:
1. 确认窗口是 frameless: `frameless=True`
2. 确认标题栏已创建: 启动日志中有 `[PySide6Framework] Title bar created`
3. 检查 Python 版本和 PySide6 版本:
```bash
python --version  # 需要 3.8+
pip show PySide6  # 需要 6.0+
```

**解决**:
```bash
pip install --upgrade PySide6
```

### 问题 2: Wayland 下不工作

**原因**: Wayland 对 `startSystemMove()` 的支持有限

**解决**:
1. 使用 X11 后端:
```bash
export QT_QPA_PLATFORM=xcb
python pycore_module_caller.py
```

2. 或者回退到手动实现 (不推荐)

### 问题 3: 按钮无法点击

**原因**: 鼠标事件被标题栏拦截

**检查**: 确保按钮的事件处理正确:

```python
# 按钮应该有自己的 clicked 信号连接
self.close_btn.clicked.connect(self.close_clicked.emit)
```

## 总结

✅ **修复内容**:
1. 将自定义拖动逻辑替换为 `windowHandle().startSystemMove()`
2. 简化 `mouseMoveEvent` 和 `mouseReleaseEvent`
3. 使用系统级 API,获得完整的窗口管理器支持

✅ **优势**:
- 代码更简洁 (从 30+ 行减少到 5 行)
- 支持系统特性 (窗口吸附、触摸等)
- 跨平台兼容性更好
- 性能更优

🎯 **现在 Qt 原生标题栏应该可以正常拖动了！**
