# Voice Subtitle - Subtitle Mode

## 功能概述

字幕模式是一个全屏字幕显示模式，提供简洁的播放界面和大字体字幕显示。

## 功能特性

### 前端（HTML/CSS/JS）

1. **一键切换**
   - 顶部菜单按钮：📺 Subtitle Mode
   - 快捷键：`Ctrl+M` 切换
   - 快捷键：`Esc` 退出

2. **界面变化**
   - 全黑背景
   - 隐藏左右侧边栏
   - 隐藏顶部菜单
   - 只显示：
     - 大字体字幕（48px，黑底白字）
     - 播放控制按钮（上一个、播放/暂停、下一个）
     - 右上角退出按钮

3. **CSS 样式**
   - 字幕文本：48px，居中，圆角背景
   - 播放按钮：圆形，半透明
   - 平滑动画过渡

### 后端（Python/PySide6）

1. **窗口调整（仅在 PySide6 模式下）**
   - Thread Bus 事件：`voice_subtitle.subtitle_mode_enter`
   - Thread Bus 事件：`voice_subtitle.subtitle_mode_exit`

2. **字幕模式窗口**
   - 大小：1200x200
   - 位置：屏幕底部居中
   - 距离任务栏：10px
   - 不遮挡任务栏

3. **还原模式**
   - 恢复进入前的窗口大小和位置
   - 如果没有保存，默认居中 1280x800

## 使用方式

### 浏览器模式（纯前端）

1. 访问 `http://localhost:59000/web/subtitle`
2. 点击右上角 "📺 Subtitle Mode" 按钮
3. 或按 `Ctrl+M` 进入字幕模式
4. 按 `Esc` 或点击右上角 ✕ 退出

### PySide6 窗口模式（前端 + 后端）

1. 启动带 PySide6 窗口的服务
2. 窗口中打开 voice subtitle 页面
3. 点击字幕模式按钮
4. 窗口会自动调整到屏幕底部（字幕条样式）
5. 退出时窗口恢复原始大小和位置

## 技术实现

### 前端实现

**HTML**:
```html
<!-- 按钮 -->
<button id="subtitleModeBtn">📺 Subtitle Mode</button>

<!-- 浮动退出按钮 -->
<button id="subtitleModeExitBtn" style="display: none;">✕</button>
```

**CSS**:
```css
/* 字幕模式样式 */
body.subtitle-mode {
    background: #000000;
}

body.subtitle-mode #subtitleText {
    font-size: 48px;
    text-align: center;
    color: #ffffff;
}
```

**JavaScript**:
```javascript
function enterSubtitleMode() {
    document.body.classList.add('subtitle-mode');

    // 发送 RPC 事件调整窗口
    rpcClient.call('thread_bus.trigger_event', {
        event_name: 'voice_subtitle.subtitle_mode_enter',
        data: {}
    });
}

function exitSubtitleMode() {
    document.body.classList.remove('subtitle-mode');

    // 发送 RPC 事件恢复窗口
    rpcClient.call('thread_bus.trigger_event', {
        event_name: 'voice_subtitle.subtitle_mode_exit',
        data: {}
    });
}
```

### 后端实现

**window_manager.py**:
```python
from pycore import THREAD_BUS
from PySide6.QtCore import QTimer

class VoiceSubtitleWindowManager:
    def _register_event_handlers(self):
        THREAD_BUS.register_event_handler(
            'voice_subtitle.subtitle_mode_enter',
            self._on_subtitle_mode_enter
        )

        THREAD_BUS.register_event_handler(
            'voice_subtitle.subtitle_mode_exit',
            self._on_subtitle_mode_exit
        )

    def _on_subtitle_mode_enter(self, event_data):
        # 保存当前窗口状态
        self._saved_geometry = self.window.geometry()

        # 计算字幕模式位置
        screen = QApplication.primaryScreen()
        available = screen.availableGeometry()

        # 1200x200，居中，贴底
        x = (screen.width() - 1200) // 2
        y = available.height() - 200 - 10

        # 调整窗口
        QTimer.singleShot(0, lambda: self.window.setGeometry(x, y, 1200, 200))
```

## 文件清单

### 前端文件
- `pycore/pyctl/voice_subtitle/ui/index.html` - 按钮 HTML
- `pycore/pyctl/voice_subtitle/ui/framework.css` - 字幕模式样式
- `pycore/pyctl/voice_subtitle/ui/framework.js` - 切换逻辑

### 后端文件
- `pycore/pyctl/voice_subtitle/window_manager.py` - 窗口管理器
- `pycore/callmodule/platform/server_setup.py` - 初始化窗口管理器

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+M` | 切换字幕模式 |
| `Esc` | 退出字幕模式 |

## 兼容性

- **浏览器模式**: 完全兼容，纯 CSS 切换
- **PySide6 模式**: 需要 PySide6 支持，窗口自动调整
- **降级处理**: 如果 PySide6 不可用，仍可使用前端样式切换

## 调试

### 前端调试
```javascript
console.log('[Subtitle Mode] Current state:', isSubtitleMode);
```

### 后端调试
```python
ColorPrint.blue(f"[VoiceSubtitle] Subtitle mode: {self._is_subtitle_mode}")
ColorPrint.blue(f"[VoiceSubtitle] Window geometry: {self.window.geometry()}")
```

## 注意事项

1. **任务栏检测**: 自动检测任务栏高度，确保不遮挡
2. **多屏幕**: 使用主屏幕（`primaryScreen()`）
3. **窗口保存**: 自动保存进入前的窗口状态
4. **线程安全**: 使用 `QTimer.singleShot(0)` 确保在 Qt 线程执行
