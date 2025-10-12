# QtScrcpy Automation & Control Capabilities Analysis

**Analysis Date**: 2025-10-10
**Project**: QtScrcpy - Android Control & Automation Features

---

## Executive Summary

### ⚠️ 重要发现

**QtScrcpy 不仅仅是投屏软件！**

它包含了丰富的手机控制和半自动化功能，但**不是完整的自动化测试框架**。

```
功能定位:
✅ 投屏显示           (Screen Mirroring)
✅ 实时控制           (Real-time Control)
✅ 脚本化按键映射     (Scriptable Keymap)
✅ 批量控制           (Batch Control)
✅ ADB 命令执行       (ADB Command Execution)
❌ 完整自动化框架     (NOT a Full Automation Framework)
❌ 类 Appium API      (NOT Appium-like API)
❌ UI 元素识别        (No UI Element Detection)
```

---

## 1. 手机控制模块详解

### 1.1 核心控制能力

QtScrcpy 提供了**三层控制架构**：

```
┌─────────────────────────────────────────────────────────┐
│             三层控制架构                                 │
└─────────────────────────────────────────────────────────┘

第一层: 基础输入控制
├── 键盘输入 (KeyEvent)
├── 鼠标控制 (MotionEvent)
├── 触摸屏幕 (Touch)
├── 多点触控 (Multi-touch)
└── 文本输入 (Text Input)

第二层: 系统命令控制
├── Home 键
├── Back 键
├── Menu 键
├── Power 键
├── Volume +/-
├── 应用切换 (App Switch)
├── 通知栏 (Notification Panel)
└── 屏幕开关 (Display Power)

第三层: 高级功能
├── 剪贴板同步 (Clipboard Sync)
├── 文件传输 (File Push/Pull)
├── APK 安装 (Install APK)
├── 截图 (Screenshot)
└── 屏幕录制 (Screen Recording)
```

### 1.2 GroupController - 批量控制模块

**位置**: `QtScrcpy/groupcontroller/groupcontroller.h`

**功能**: 将控制指令**同步广播**到多台设备

```cpp
class GroupController : public QObject, public qsc::DeviceObserver
{
    // 支持的批量操作
    void mouseEvent(...)        // 鼠标事件 → 所有设备
    void wheelEvent(...)        // 滚轮事件 → 所有设备
    void keyEvent(...)          // 键盘事件 → 所有设备
    void postGoBack()           // Back键 → 所有设备
    void postGoHome()           // Home键 → 所有设备
    void installApkRequest()    // APK安装 → 所有设备
    void pushFileRequest()      // 文件传输 → 所有设备
    // ... 更多
};
```

**使用场景**:
- ✅ 批量安装 APK
- ✅ 批量传输文件
- ✅ 批量执行相同操作
- ✅ 同步控制多台设备（如游戏多开）

**限制**:
- ❌ 无法针对不同设备执行不同操作
- ❌ 无条件判断（if-else）
- ❌ 无循环（for/while）

---

## 2. 脚本化按键映射系统

### 2.1 功能概述

**这是 QtScrcpy 最接近"自动化"的功能！**

可以通过 **JSON 脚本**定义复杂的按键映射规则。

**核心文件**: `keymap/*.json`

### 2.2 支持的映射类型

```json
{
  "SwitchKey": "~",        // 切换按键
  "mouseMoveMap": {...},   // 鼠标移动映射
  "keyMapNodes": [         // 按键映射数组
    {
      "type": "KMT_CLICK",           // 普通点击
      "key": "A",
      "pos": {"x": 0.1, "y": 0.5}
    },
    {
      "type": "KMT_CLICK_TWICE",     // 双击
      "key": "B",
      "pos": {"x": 0.2, "y": 0.6}
    },
    {
      "type": "KMT_CLICK_MULTI",     // 多次点击
      "clickNodes": [
        {"delay": 100, "pos": {"x": 0.3, "y": 0.7}},
        {"delay": 200, "pos": {"x": 0.4, "y": 0.8}}
      ]
    },
    {
      "type": "KMT_DRAG",            // 拖拽
      "key": "C",
      "startPos": {"x": 0.5, "y": 0.5},
      "endPos": {"x": 0.7, "y": 0.7},
      "dragSpeed": 1.0
    },
    {
      "type": "KMT_STEER_WHEEL",     // 方向盘控制
      "centerPos": {"x": 0.15, "y": 0.75},
      "leftKey": "A",
      "rightKey": "D",
      "upKey": "W",
      "downKey": "S"
    }
  ]
}
```

### 2.3 实际示例 - 抖音控制

**文件**: `keymap/tiktok.json`

```json
{
  "SwitchKey": "~",
  "keyMapNodes": [
    {
      "comment": "上滑 - 下一个视频",
      "type": "KMT_DRAG",
      "key": "Key_Up",
      "startPos": {"x": 0.5, "y": 0.8},
      "endPos": {"x": 0.5, "y": 0.2},
      "dragSpeed": 0.5
    },
    {
      "comment": "下滑 - 上一个视频",
      "type": "KMT_DRAG",
      "key": "Key_Down",
      "startPos": {"x": 0.5, "y": 0.2},
      "endPos": {"x": 0.5, "y": 0.8},
      "dragSpeed": 0.5
    },
    {
      "comment": "双击 - 点赞",
      "type": "KMT_CLICK_TWICE",
      "key": "Key_L",
      "pos": {"x": 0.5, "y": 0.5}
    }
  ]
}
```

### 2.4 按键映射的能力边界

| 功能 | 支持程度 | 说明 |
|------|---------|------|
| **基础点击** | ✅ 完全支持 | 单击、双击、多次点击 |
| **拖拽操作** | ✅ 完全支持 | 支持速度控制、延迟 |
| **坐标映射** | ✅ 完全支持 | 相对坐标 (0-1) |
| **多点触控** | ⚠️ 部分支持 | 通过多个映射组合实现 |
| **条件判断** | ❌ 不支持 | 无 if-else |
| **循环** | ❌ 不支持 | 无 for/while |
| **变量** | ❌ 不支持 | 无状态存储 |
| **OCR/图像识别** | ❌ 不支持 | 无 UI 元素识别 |
| **等待特定界面** | ❌ 不支持 | 无界面判断 |

**结论**: 这是一个**静态脚本系统**，适合固定流程的操作映射，**不是编程语言**。

---

## 3. ADB 命令执行模块

### 3.1 功能描述

**位置**: `QtScrcpy/ui/dialog.cpp`

可以通过界面执行**自定义 ADB 命令**。

```cpp
// 代码示例
m_adb.execute(serial, cmd.split(" "));

// 内置命令示例
adbArgs << "shell" << "ip" << "-f" << "inet" << "addr" << "show" << "wlan0";
m_adb.execute(serial, adbArgs);
```

### 3.2 支持的 ADB 操作

```bash
# 设备信息
adb devices
adb shell ip addr show wlan0
adb shell getprop

# 文件操作
adb push <local> <remote>
adb pull <remote> <local>

# 应用管理
adb install <apk>
adb uninstall <package>
adb shell am start <activity>

# 系统控制
adb shell input tap <x> <y>
adb shell input swipe <x1> <y1> <x2> <y2>
adb shell input text "hello"
adb shell input keyevent <keycode>

# 截图录屏
adb shell screencap /sdcard/screen.png
adb shell screenrecord /sdcard/demo.mp4
```

### 3.3 限制

```
⚠️ 当前限制:
- 不支持阻塞命令 (如 adb shell 交互)
- 不支持自动化脚本执行
- 需要手动在界面输入
- 无命令序列/批处理功能
```

---

## 4. 自动化能力对比

### 4.1 与专业自动化工具对比

| 功能 | Appium | UIAutomator | QtScrcpy |
|------|--------|-------------|----------|
| **UI 元素定位** | ✅ XPath/ID | ✅ Selector | ❌ 无 |
| **条件判断** | ✅ if-else | ✅ if-else | ❌ 无 |
| **循环控制** | ✅ for/while | ✅ for/while | ❌ 无 |
| **等待机制** | ✅ Wait Until | ✅ Wait For | ❌ 无 |
| **断言验证** | ✅ Assert | ✅ Assert | ❌ 无 |
| **脚本语言** | ✅ Python/Java | ✅ Java | ⚠️ JSON (静态) |
| **实时控制** | ⚠️ 延迟高 | ⚠️ 延迟高 | ✅ 低延迟 |
| **屏幕显示** | ❌ 无 | ❌ 无 | ✅ 实时显示 |
| **批量设备** | ⚠️ 复杂 | ⚠️ 复杂 | ✅ 简单 |

### 4.2 定位分析

```
┌─────────────────────────────────────────────────────┐
│           QtScrcpy 的定位                            │
└─────────────────────────────────────────────────────┘

✅ 适合场景:
- 手动测试 + 投屏显示
- 游戏控制 (键盘映射到触摸)
- 演示/教学录制
- 批量安装 APK/传文件
- 多设备同步操作

❌ 不适合场景:
- 复杂的自动化测试流程
- UI 自动化测试
- 需要条件判断的自动化
- 需要 OCR/图像识别
- 持续集成 (CI/CD) 自动化测试
```

---

## 5. 扩展自动化的可能性

### 5.1 现有可扩展点

虽然 QtScrcpy 本身不是自动化框架，但可以作为**底层控制引擎**配合其他工具：

#### 方案 A: Python + ADB 脚本
```python
import subprocess
import time

def auto_tiktok():
    # 使用 QtScrcpy 投屏显示
    # 使用 Python 脚本通过 ADB 控制

    for i in range(10):
        # 滑动到下一个视频
        subprocess.run([
            "adb", "shell", "input", "swipe",
            "500", "800", "500", "200"
        ])
        time.sleep(5)

        # 双击点赞
        subprocess.run([
            "adb", "shell", "input", "tap",
            "540", "960"
        ])
        subprocess.run([
            "adb", "shell", "input", "tap",
            "540", "960"
        ])
        time.sleep(1)
```

#### 方案 B: 配合 Appium
```python
# 使用 QtScrcpy 观察屏幕
# 使用 Appium 执行自动化

from appium import webdriver

caps = {
    "platformName": "Android",
    "deviceName": "serial",
    "appPackage": "com.example",
    "appActivity": ".MainActivity"
}

driver = webdriver.Remote("http://localhost:4723/wd/hub", caps)

# 自动化操作
driver.find_element_by_id("login_button").click()
```

#### 方案 C: OpenCV 图像识别
```python
import cv2
import numpy as np
import subprocess

# 使用 QtScrcpy 获取屏幕截图
subprocess.run(["adb", "shell", "screencap", "/sdcard/screen.png"])
subprocess.run(["adb", "pull", "/sdcard/screen.png"])

# OpenCV 图像识别
img = cv2.imread("screen.png")
template = cv2.imread("button.png")
result = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED)
loc = np.where(result >= 0.8)

# 点击识别到的位置
if len(loc[0]) > 0:
    x, y = loc[1][0], loc[0][0]
    subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)])
```

### 5.2 二次开发可能性

QtScrcpy 的架构允许扩展：

```cpp
// 可以扩展的模块
class AutomationEngine {
public:
    // 添加脚本引擎 (Lua/Python)
    void executeScript(const QString& script);

    // 添加图像识别
    QPoint findElement(const QImage& template);

    // 添加条件判断
    bool waitForElement(const QString& elementId, int timeout);

    // 添加批处理
    void executeBatchCommands(const QList<Command>& commands);
};
```

**技术栈建议**:
- **脚本引擎**: Qt Script / QJSEngine (JavaScript)
- **图像识别**: OpenCV
- **OCR**: Tesseract
- **录制回放**: 记录 InputEvent 序列

---

## 6. 实际应用场景

### 6.1 当前可实现的"自动化"

#### ✅ 游戏辅助
```
场景: 和平精英、王者荣耀
实现: 按键映射脚本
能力: WASD移动 + 鼠标瞄准 + 技能快捷键
限制: 无法自动瞄准、无法自动走位
```

#### ✅ 批量操作
```
场景: 100 台设备同时安装 APK
实现: GroupController 批量控制
能力: 同步推送文件、安装应用
限制: 无法针对不同设备执行不同操作
```

#### ✅ 手动测试辅助
```
场景: App 测试
实现: 投屏 + 键盘快捷键
能力: 快速截图、录屏、重启应用
限制: 需要人工判断和操作
```

#### ✅ 演示录制
```
场景: 教学视频、产品演示
实现: 屏幕录制 + 按键映射
能力: 流畅录制 + 键盘控制
限制: 无自动化流程
```

### 6.2 无法实现的场景

#### ❌ UI 自动化测试
```
需求: 自动登录 → 浏览商品 → 加购物车 → 下单
问题: 无 UI 元素识别、无条件判断
建议: 使用 Appium / UIAutomator
```

#### ❌ 压力测试
```
需求: 循环执行 1000 次操作并记录结果
问题: 无循环、无结果记录
建议: 使用 JMeter + ADB 脚本
```

#### ❌ 监控和告警
```
需求: 检测到特定界面时发送通知
问题: 无界面识别、无条件触发
建议: 使用 Python + OpenCV
```

---

## 7. 总结与建议

### 7.1 核心结论

```
QtScrcpy 定位:
╔═══════════════════════════════════════════════════╗
║  投屏显示 + 实时控制 + 脚本化按键映射             ║
║  (Screen Mirroring + Control + Keymap Scripting)  ║
╚═══════════════════════════════════════════════════╝

NOT:
╔═══════════════════════════════════════════════════╗
║  完整的自动化测试框架                             ║
║  (Full Automation Testing Framework)              ║
╚═══════════════════════════════════════════════════╝
```

### 7.2 功能矩阵

| 能力维度 | 评分 (1-5) | 说明 |
|---------|-----------|------|
| **投屏显示** | ⭐⭐⭐⭐⭐ | 低延迟、高质量 |
| **实时控制** | ⭐⭐⭐⭐⭐ | 键鼠映射优秀 |
| **批量操作** | ⭐⭐⭐⭐ | 支持多设备同步 |
| **脚本能力** | ⭐⭐⭐ | JSON 静态脚本 |
| **自动化测试** | ⭐ | 缺乏条件/循环/识别 |
| **二次开发** | ⭐⭐⭐⭐ | 架构清晰，可扩展 |

### 7.3 使用建议

#### 如果你需要:

**1. 游戏控制 / 手动测试**
```
✅ 使用 QtScrcpy
- 低延迟投屏
- 自定义按键映射
- 实时操作反馈
```

**2. 自动化测试 / UI 测试**
```
❌ 不推荐 QtScrcpy
✅ 推荐组合:
   QtScrcpy (观察屏幕) + Appium/UIAutomator (自动化)
```

**3. 批量设备管理**
```
✅ 使用 QtScrcpy GroupController
- 批量安装 APK
- 批量推送文件
- 同步操作

⚠️ 限制: 所有设备执行相同操作
```

**4. 复杂自动化流程**
```
✅ 推荐自行扩展:
   QtScrcpy (底层控制) + Python脚本 + OpenCV
```

### 7.4 未来改进方向

如果要增强自动化能力，建议添加：

```
1. 脚本引擎
   - 集成 JavaScript/Lua 引擎
   - 支持条件、循环、变量

2. 图像识别
   - OpenCV 集成
   - 模板匹配

3. OCR 能力
   - Tesseract 集成
   - 文字识别和点击

4. 录制回放
   - 录制用户操作
   - 回放操作序列

5. API 接口
   - HTTP REST API
   - WebSocket 实时控制
```

---

## 8. 参考资料

- **QtScrcpy 源码**: https://github.com/barry-ran/QtScrcpy
- **按键映射文档**: `docs/KeyMapDes_zh.md`
- **批量控制**: `QtScrcpy/groupcontroller/`
- **ADB 文档**: https://developer.android.com/studio/command-line/adb

---

**文档版本**: 1.0
**分析日期**: 2025-10-10
**分析者**: Technical Analysis Team

---

## License

Same as QtScrcpy - Apache License 2.0
