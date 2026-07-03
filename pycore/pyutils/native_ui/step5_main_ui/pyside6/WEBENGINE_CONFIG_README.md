# QtWebEngine Multi-Tier Redundant Configuration

## 概述

为了解决 PySide6 QtWebEngine 环境下 H.264 视频流和 WebCodecs API 支持问题，我们实现了一个**三层冗余配置系统**，确保在各种环境下都能最大程度启用硬件加速和现代 Web API。

## 问题背景

在使用 PySide6 QtWebEngine 开发包含 H.264 视频流的应用时，发现：

1. **浏览器环境正常**：Chrome/Firefox 等浏览器中视频流工作正常
2. **QtWebEngine 失败**：PySide6 的 QWebEngineView 中视频无法解码
3. **API 报告支持**：`typeof VideoDecoder !== 'undefined'` 返回 true，但实际使用失败

**根本原因**：QtWebEngine 基于 Chromium，但默认 Chromium flags 禁用了某些 GPU 加速和实验性 API（如 WebCodecs）。

## 解决方案：三层冗余配置

### Tier 1: 环境变量 (QTWEBENGINE_CHROMIUM_FLAGS)

**时机**：QApplication 创建之前
**可靠性**：⭐⭐⭐⭐⭐ 最可靠，在 Chromium 初始化前设置

```python
os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = '--enable-features=WebCodecs --enable-gpu ...'
```

**平台感知的 Chromium Flags**（由 `_build_chromium_flags()` 按操作系统生成，单一来源）：

- `--enable-features=WebCodecs` - WebCodecs API（H.264 解码，全平台）
- `--enable-gpu` / `--enable-gpu-rasterization` / `--enable-accelerated-2d-canvas` / `--enable-webgl` - 安全的跨平台 GPU 加速基线
- **Windows**：仅额外加 `D3D11VideoDecoder`（D3D11 硬件视频）+ `--enable-zero-copy`。默认走 ANGLE→D3D11 + DirectComposition，**绝不强制** `--enable-hardware-overlays` / `--enable-native-gpu-memory-buffers` / `--ignore-gpu-blocklist` / `--disable-gpu-sandbox`——强制这些会在混合显卡笔记本上触发 DirectComposition 覆盖层路径导致 GPU/进程初始化崩溃（`QueryInterface to IDCompositionDevice4 failed`）。
- **Linux**：`AcceleratedVideoDecodeLinuxGL,VaapiVideoDecodeLinuxGL,VaapiVideoEncoder` + `--enable-native-gpu-memory-buffers`（GBM）+ `--ignore-gpu-blocklist`；仅 root 时加 `--no-sandbox --disable-gpu-sandbox`。
- 已移除的死/有害 flag：`--enable-webgl2-compute-context`（Chromium 已删除）、`--ignore-gpu-blacklist`（弃用别名）。

> Qt 6 已移除内置 ANGLE，`QT_OPENGL=angle`、`Qt::AA_UseOpenGLES` 与强制 OpenGL ES `QSurfaceFormat` 均**已无效**（doc.qt.io/qt-6/opengl-changes-qt6.html），Tier 0 不再设置它们，仅保留必需的 `AA_ShareOpenGLContexts`；WebGL2 由 QtWebEngine 自带 ANGLE 提供。

#### GPU 回退开关：`PYCORE_WEBENGINE_GPU`

当某台机器显卡/驱动无法支持加速路径时，用环境变量强制回退（QApplication 之前读取）：

- `auto`（默认）- 正常加速
- `dcomp-off` - 保留 GPU 但关闭 DirectComposition（`--disable-features=DirectComposition`）
- `angle-sw` - 强制 ANGLE SwiftShader 软件 GL（`--use-angle=swiftshader`）
- `software` / `off` - 完全关闭 GPU（`--disable-gpu --disable-gpu-compositing` + `QT_OPENGL=software`）

连续多次渲染进程崩溃后会自动写入回退标记 `~/.core_node/webengine_gpu_fallback.flag`，下次启动自动软件渲染；删除该文件或设 `PYCORE_WEBENGINE_GPU=auto` 可恢复。

### Tier 2: Qt qputenv() API

**时机**：QApplication 创建之前
**可靠性**：⭐⭐⭐⭐ 程序化设置，作为 Tier 1 的补充

```python
from PySide6.QtCore import qputenv
qputenv('QTWEBENGINE_CHROMIUM_FLAGS', flags_str.encode('utf-8'))
```

这是一个冗余层，确保即使环境变量设置失败，也能通过 Qt API 设置。

### Tier 3: QWebEngineSettings 属性

**时机**：QWebEngineView 创建之后
**可靠性**：⭐⭐⭐ 细粒度控制，补充前两层

```python
from PySide6.QtWebEngineCore import QWebEngineSettings

settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
settings.setAttribute(QWebEngineSettings.WebGLEnabled, True)
settings.setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
settings.setAttribute(QWebEngineSettings.PluginsEnabled, True)
settings.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
```

## 自动集成

**无需任何额外配置！**所有现有的 PySide6 应用都会自动受益：

### 集成点 1: PySide6Framework (framework.py)

在 `framework.py` 的 `start()` 方法中，**QApplication 创建之前**自动调用：

```python
# framework.py, line 280-285
from .webengine_config import configure_webengine_all_tiers
webengine_results = configure_webengine_all_tiers()
```

### 集成点 2: PySide6WebView (webview.py)

在 `webview.py` 的 `_setup_ui()` 方法中，**WebEngineSettings 配置时**自动调用：

```python
# webview.py, line 96-99
from .webengine_config import configure_webengine_tier3_settings
configure_webengine_tier3_settings(settings)
```

## 验证配置是否生效

### 方法 1: 查看启动日志

启动应用时，会看到详细的配置日志：

```
================================================================================
[WebEngineConfig] Applying ALL configuration tiers (multi-redundant)
================================================================================

[WebEngineConfig] >>> Tier 1: QTWEBENGINE_CHROMIUM_FLAGS environment variable
[WebEngineConfig-Tier1] ✓ Environment variable set successfully
[WebEngineConfig-Tier1] QTWEBENGINE_CHROMIUM_FLAGS=--enable-features=WebCodecs ...

[WebEngineConfig] >>> Tier 2: Qt qputenv() API
[WebEngineConfig-Tier2] ✓ qputenv() successful

[WebEngineConfig] >>> Tier 3: QWebEngineSettings (will be applied in PySide6WebView)

================================================================================
[WebEngineConfig] Configuration Summary:
================================================================================
[WebEngineConfig] ✓ All pre-init tiers successful (2/2)
[WebEngineConfig] Tier 1 (env): ✓ OK
[WebEngineConfig] Tier 2 (qputenv): ✓ OK
[WebEngineConfig] Tier 3 (settings): Pending (will be applied in webview)
================================================================================
```

稍后在 WebView 创建时：

```
[WebEngineConfig-Tier3] JavascriptEnabled = True
[WebEngineConfig-Tier3] WebGLEnabled = True
[WebEngineConfig-Tier3] Accelerated2dCanvasEnabled = True
[WebEngineConfig-Tier3] PluginsEnabled = True
[WebEngineConfig-Tier3] LocalContentCanAccessRemoteUrls = True
[WebEngineConfig-Tier3] LocalContentCanAccessFileUrls = True
[WebEngineConfig-Tier3] ✓ QWebEngineSettings configured successfully
```

### 方法 2: 浏览器 DevTools 检查

如果启用了开发者工具 (`enable_dev_tools=True`)，可以在 Console 中检查：

```javascript
// 检查 WebCodecs 支持
console.log('VideoDecoder:', typeof VideoDecoder !== 'undefined');

// 检查 WebGL 支持
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');
console.log('WebGL:', !!gl);
```

### 方法 3: System Health 诊断页面

如果应用包含 System Health 页面（如 Matrix 应用），可以查看浏览器能力报告：

```
Browser Capabilities:
  ✓ WebCodecs
  ✓ Canvas 2D
  ✓ WebGL
  ✓ WebGL 2
```

## 手动使用（高级）

如果需要在其他场景手动配置：

### 单独使用某一层：

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6.webengine_config import (
    configure_webengine_tier1_env,
    configure_webengine_tier2_qputenv,
    configure_webengine_tier3_settings
)

# 在 QApplication 创建前
configure_webengine_tier1_env()
configure_webengine_tier2_qputenv()

# 在 QWebEngineView 创建后
settings = webview.settings()
configure_webengine_tier3_settings(settings)
```

### 使用自定义 Chromium Flags：

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6.webengine_config import (
    configure_webengine_all_tiers
)

# 自定义 flags
custom_flags = [
    '--enable-features=WebCodecs',
    '--enable-gpu',
    '--disable-gpu-sandbox',  # 如果需要完全禁用 GPU 沙箱
]

configure_webengine_all_tiers(
    env_flags=custom_flags,
    qputenv_flags=custom_flags
)
```

### 获取 Chromium 版本信息：

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6.webengine_config import (
    get_chromium_version,
    print_webengine_info
)

# 获取 Chromium 版本
version = get_chromium_version()  # 返回如 "112.0.5615.213"

# 打印完整环境信息
print_webengine_info()
```

## 技术细节

### 为什么需要三层冗余？

1. **环境差异**：不同操作系统、不同 Qt 版本对配置方法的支持不同
2. **时序问题**：某些配置必须在特定时机设置才有效
3. **降级支持**：如果某一层失败，其他层仍可能生效
4. **覆盖全面**：环境变量控制 Chromium 启动，Settings 控制运行时行为

### 配置顺序的重要性

```
1. Tier 1 + Tier 2 (QApplication 创建前)
   ↓
2. QApplication 初始化
   ↓
3. QtWebEngine 初始化 (读取环境变量/qputenv)
   ↓
4. QWebEngineView 创建
   ↓
5. Tier 3 (QWebEngineSettings 配置)
```

**关键**：Tier 1 和 Tier 2 必须在 QApplication 创建前调用，否则无效！

### 已知限制

1. **GPU 沙箱**：某些环境可能需要 `--disable-gpu-sandbox`，但这会降低安全性
2. **硬件支持**：如果系统确实不支持硬件加速，flags 无法创造硬件能力
3. **Chromium 版本**：WebCodecs API 需要 Chromium 94+，旧版本 Qt 可能不支持

## 故障排除

### 问题: 视频仍然无法播放

**排查步骤**：

1. 检查启动日志，确认三层配置都成功
2. 检查 Console 是否有 JavaScript 错误
3. 检查 System Health 页面显示的浏览器能力
4. 尝试在 Chrome 浏览器中打开相同 URL，确认前端代码正确

**常见原因**：

- 后端未正确发送 H.264 视频帧
- 前端 WebSocket 连接失败
- H.264 编码格式不正确（需要 Annex-B 或 AVCC 格式）

### 问题: 配置日志显示失败

**Tier 1 失败**：
- 检查是否在 QApplication 创建后才调用
- 检查环境变量是否被其他代码覆盖

**Tier 2 失败**：
- 检查 PySide6 版本是否过旧
- 检查是否在 QApplication 创建后才调用

**Tier 3 失败**：
- 检查 QWebEngineCore 是否正确导入
- 检查传入的 settings 对象是否为 None

## 文件清单

新增/修改的文件：

```
pycore/pyutils/native_ui/step5_main_ui/pyside6/
├── webengine_config.py          (新增) 三层配置实现
├── framework.py                  (修改) 集成 Tier 1+2 配置
├── webview.py                    (修改) 集成 Tier 3 配置
├── __init__.py                   (修改) 导出 webengine_config
└── WEBENGINE_CONFIG_README.md   (新增) 本文档
```

## 参考资料

- [Chromium Command Line Flags](https://peter.sh/experiments/chromium-command-line-switches/)
- [Qt WebEngine Environment Variables](https://doc.qt.io/qt-6/qtwebengine-platform-notes.html)
- [WebCodecs API Specification](https://w3c.github.io/webcodecs/)

---

**Created**: 2025-12-09
**Author**: Claude Code (core_node project)
**Purpose**: 解决 PySide6 QtWebEngine 中 H.264 视频流和 WebCodecs API 支持问题
