# DOT 截图与识图类库说明

本文档说明 DOT 侧**截图公共类库**与**大图查小图（模板匹配）类库**的能力、与 Python `main.py` 下游逻辑的对应关系，以及流程中的使用方式。实现依据 `DOT_ROSBOT_FLOW_DEVELOPMENT.md` §2.1 与 `pyapps/d3-check/main.py` 所启动的控制器/流程对截图与识图的用法。

**代码规范**：本类库遵循 [DOT_UI_PROJECT_STANDARDS_PROGRESS.md](DOT_UI_PROJECT_STANDARDS_PROGRESS.md)（单例入口、常量集中、英文代码、命名与层次约定）。

---

## 0. 常量与规范入口

- **截图常量**：`ScreenCaptureConstants.DefaultSavePrefix`、`DefaultScreenshotPrefix`、`TimestampFormat`、`DefaultImageExtension`。默认保存前缀与 PY `save_current_screenshot(prefix="d3")` 一致。
- **识图常量**：`TemplateMatcherConstants.DefaultMatchThreshold`（0.8）；`TemplateMatcherService.DefaultThreshold` 与之相同。
- **单例入口**：仅通过 `GetScreenshotProvider()`、`GetTemplateMatcher()` 获取实例，不在他处 new。

---

## 1. 与 main.py 的关系

- **Python**：`main.py` 启动后创建 `D3MacroController`、`HTTPBridgeController`，不直接使用截图/识图；各控制器与流程通过 **`get_screenshot_provider()`** 获取全局截图 Provider，通过 **统一 matcher**（如 `get_d3_scaled_template_matcher()` / `match_battlenet_template`）做识图。
- **DOT**：流程入口（如「开始 ROSBOT」）及 B/C/D/E 各块需截图、识图时，应使用本类库的 **`GetScreenshotProvider()`** 与 **`GetTemplateMatcher()`**，行为与 PY 侧「单例 Provider + 统一 Matcher」一致。

---

## 2. 截图类库（DotCore.ScreenCapture）

**程序集**：`DotCore.ScreenCapture`  
**命名空间**：`DotCore.ScreenCapture`

### 2.1 单例入口（对应 PY `get_screenshot_provider()`）

```csharp
ScreenCaptureService provider = ScreenCaptureService.GetScreenshotProvider();
```

- 全应用唯一实例，与 PY 单例一致。
- 既支持「当前截图共享」（Share/Gen），也支持直接截取（CaptureFullScreen/CaptureWindow/CaptureRegion）。

### 2.2 当前截图共享（对应 PY `share()` / `gen()`）

| 能力 | 方法 | 说明 |
|------|------|------|
| 共享当前截图 | `Share(IntPtr? gameWindowHwnd = null)` | 若有缓存则返回，否则先截屏再返回。可选传入游戏窗口句柄以同时截游戏窗。 |
| 强制重新截屏 | `Gen(IntPtr? gameWindowHwnd = null)` | 清除当前缓存后截全屏；若传入 `gameWindowHwnd` 则同时截该窗口并填入 `ScreenshotData.GameWindowImage`、`GameWindowRect`、`WindowOffset`。 |
| 当前数据 | `CurrentScreenshot` | 当前缓存的 `ScreenshotData`，无则为 null。 |
| 清除缓存 | `ClearScreenshot()` | 释放当前截图内存，与 PY `clear_screenshot()` 一致。 |
| 保存当前截图 | `SaveCurrentScreenshot(outputDir?, prefix?)` | 将当前截图落盘，默认 prefix 为 `ScreenCaptureConstants.DefaultSavePrefix`（"d3"）。无当前截图时返回 null。与 PY `save_current_screenshot()` 一致。 |

### 2.3 截图数据容器 ScreenshotData（对应 PY `ScreenshotData`）

- **FullscreenImage**：全屏位图（可为 null）。
- **GameWindowImage**：游戏窗口裁剪图（可为 null）。
- **GameWindowRect**：游戏窗口屏幕矩形（Left, Top, Right, Bottom）。
- **WindowOffset**：窗口偏移 (X, Y)。
- **FullscreenSize** / **GameWindowSize**：全屏与游戏窗尺寸。
- **Timestamp**：时间戳字符串（用于保存文件名等）。
- **Save(outputDir?, prefix?)**：保存到磁盘，返回 `(FullscreenPath, GameWindowPath)`。

### 2.4 Windows 截图方式与效率（文档结论）

根据 Win32 / 技术文档结论，本类库提供以下两种实现路径，可按场景选择：

| 场景 | 推荐方式 | 本类库方法 | 说明 |
|------|----------|------------|------|
| **全屏** | BitBlt 优于 GDI+ | `CaptureFullScreenBitBlt()` | 直接 P/Invoke gdi32 BitBlt，无 GDI+ 封装开销。Windows.Graphics.Capture 更高频录屏更优，但需 WinRT/UWP，本库未实现。 |
| **全屏** | 常规 | `CaptureFullScreen()` | GDI+ `Graphics.CopyFromScreen`，实现简单，适合非高频。 |
| **应用窗口** | PrintWindow | `CaptureWindowPrintWindow(hwnd, clientOnly?, fullContent?)` | `user32.PrintWindow`，`fullContent=true` 使用 PW_RENDERFULLCONTENT (0x2)，可截被遮挡/最小化窗口（Win10+）。 |
| **应用窗口** | 按坐标 | `CaptureWindow(hwnd)` | 按 GetWindowRect 取窗口矩形后 BitBlt 该区域，窗口被挡则截到的是遮挡内容。 |
| **区域** | BitBlt | `CaptureRegionBitBlt(x,y,w,h)` / `CaptureRegionBitBlt(Rectangle)` | 区域截图效率最高；`CopyFromScreen` 内部即 BitBlt，直接调用可省 .NET 包装。含 CAPTUREBLT 以包含分层窗口。 |
| **区域** | 常规 | `CaptureRegion(x,y,w,h)` | GDI+ CopyFromScreen，代码简洁。 |

- **验证**：上述结论与 Microsoft Learn（BitBlt、PrintWindow、Capturing an Image）及常见性能对比一致。全屏/区域用 BitBlt，窗口用 PrintWindow（PW_RENDERFULLCONTENT）为当前 Win32 桌面应用下的高效方案。

### 2.5 直接截取 API 一览（含高效路径）

| 方法 | 说明 |
|------|------|
| `CaptureFullScreen()` | 主显示器整屏（GDI+）。 |
| `CaptureFullScreenBitBlt()` | 主显示器整屏（BitBlt，高效）。 |
| `CaptureVirtualScreen()` | 多显示器虚拟屏幕（GDI+）。 |
| `CaptureVirtualScreenBitBlt()` | 多显示器虚拟屏幕（BitBlt）。 |
| `CaptureWindow(hwnd)` | 按窗口句柄截取窗口**所在屏幕矩形**（BitBlt 区域）。 |
| `CaptureWindowPrintWindow(hwnd, clientOnly?, fullContent?)` | 按窗口句柄 **PrintWindow** 截取，可截被遮挡窗口（高效）。 |
| `CaptureRegion(x,y,w,h)` / `CaptureRegion(Rectangle)` | 按屏幕矩形截取（GDI+）。 |
| `CaptureRegionBitBlt(x,y,w,h)` / `CaptureRegionBitBlt(Rectangle)` | 按屏幕矩形截取（BitBlt，高效）。 |
| `SaveToFile(Bitmap, string filePath)` | 静态方法，将位图保存到文件。 |

---

## 3. 大图查小图类库（DotCore.TemplateMatcher）

**程序集**：`DotCore.TemplateMatcher`  
**命名空间**：`DotCore.TemplateMatcher`

### 3.1 单例入口（对应 PY 侧统一 matcher）

```csharp
TemplateMatcherService matcher = TemplateMatcherService.GetTemplateMatcher();
```

### 3.2 匹配方法

| 方法 | 说明 |
|------|------|
| `Match(Bitmap sourceImage, Bitmap templateImage, threshold?, templateName?)` | 大图、小图均为内存 Bitmap。 |
| `MatchWithTemplateFile(Bitmap sourceImage, string templateImagePath, ...)` | 大图为 Bitmap（如截图）、模板为文件路径，C3 截屏识图常用。 |
| `MatchFromFiles(string sourceImagePath, string templateImagePath, ...)` | 大图、模板均为文件路径。 |

- **threshold**：默认 `TemplateMatcherService.DefaultThreshold`（0.8），对应 TM_CCOEFF_NORMED 的常用阈值。
- **templateName**：可选，写入结果便于日志/调试。

### 3.3 匹配结果 TemplateMatchResult

- **Success**：是否达到阈值。
- **X, Y**：匹配区域左上角（大图坐标）。
- **Width, Height**：匹配区域宽高（与模板一致）。
- **CenterX, CenterY**：中心点，便于点击。
- **Score**：匹配得分（TM_CCOEFF_NORMED 约 [0,1]）。
- **TemplateName**：传入的模板名。

---

## 4. 在流程中的使用（与 PY 一致）

- **C 块（C3 截屏识图）**：一次截屏、多次识图。  
  - 使用 `GetScreenshotProvider().Gen(gameWindowHwnd)` 或 `Share(...)` 得到 `ScreenshotData`。  
  - 用 `GameWindowImage`（或 `FullscreenImage`）作为大图，配合 `GetTemplateMatcher().MatchWithTemplateFile(...)` 对多个模板做「大图查小图」，根据结果分支（开始游戏/游戏中/连接中/掉线等）。
- **B/D/E**：若需截图（如 D5 图像判断、E5a 图像判断），同样通过 `GetScreenshotProvider()` 获取截图；识图使用 `GetTemplateMatcher()`。

---

## 5. 与 Python 的对应关系

| Python | DOT |
|--------|-----|
| `get_screenshot_provider()` | `ScreenCaptureService.GetScreenshotProvider()` |
| `provider.share()` | `provider.Share(gameWindowHwnd?)` |
| `provider.gen(...)` | `provider.Gen(gameWindowHwnd?)` |
| `provider.current_screenshot` | `provider.CurrentScreenshot` |
| `provider.clear_screenshot()` | `provider.ClearScreenshot()` |
| `provider.save_current_screenshot(...)` | `provider.SaveCurrentScreenshot(...)` |
| `ScreenshotData`（fullscreen_image, game_window_image, ...） | `ScreenshotData`（FullscreenImage, GameWindowImage, ...） |
| 统一 matcher / `match_battlenet_template` / `match_template` | `TemplateMatcherService.GetTemplateMatcher()` + `Match` / `MatchWithTemplateFile` |
| 匹配结果（success, center, score） | `TemplateMatchResult`（Success, CenterX/CenterY, Score） |

---

## 6. 项目引用

- **D3CheckCore** / **d3check** 已引用 `DotCore.ScreenCapture`、`DotCore.TemplateMatcher`，可直接使用上述 API。
