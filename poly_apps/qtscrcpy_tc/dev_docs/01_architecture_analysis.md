# QtScrcpy_tc 项目架构分析

**日期**: 2025-10-14
**分析文件数**: 24个核心文件
**目的**: 为实现自定义标题栏、全屏修复、完整关闭和重启功能做准备

---

## 1. 项目概述

QtScrcpy_tc 是一个基于 Qt 6.9.3 和 scrcpy 的 Android 设备屏幕镜像和控制应用。

**应用名称**: 灿烂传媒-智云矩阵
**主要功能**:
- 多设备同时连接和控制
- Android 设备屏幕实时镜像
- 键盘鼠标输入转发
- 文件传输和APK安装
- 屏幕录制
- 设备分组管理

---

## 2. 核心组件层次结构

### 2.1 应用层次

```
QApplication (main.cpp)
│
├── MainWindow (mainwindow.h/cpp)
│   ├── UI (mainwindow.ui)
│   │   ├── 顶部工具栏 (topwidget)
│   │   ├── 设备树 (CustomTreeWidget)
│   │   └── 中央显示区 (centerwidget - QGridLayout)
│   │
│   ├── DeviceManage (单例)
│   │   └── QMap<QString, Device*> m_devices
│   │
│   └── Dialog (设置对话框 - 大部分功能已禁用)
│
└── 全局资源
    ├── Stream::init()/deInit() (全局FFmpeg初始化)
    └── MouseTap (Windows/macOS鼠标事件捕获)
```

### 2.2 Device组件详细结构

每个 `Device` 对象代表一个连接的Android设备，包含以下子组件:

```
Device (device.h/cpp)
│
├── Server (server.h) - ADB通信和scrcpy-server管理
│   ├── TcpServer - TCP服务器
│   └── VideoSocket - 视频数据接收
│
├── Stream (stream.h) - 视频流处理线程
│   └── Demuxer - 数据解复用
│
├── Decoder (decoder.h) - 视频解码
│   ├── AVCodecContext - FFmpeg解码器上下文
│   └── AVFrameConvert - 帧格式转换
│
├── Controller (controller.h) - 输入控制
│   ├── ControlMsg - 控制消息封装
│   ├── InputConvertBase - 输入转换基类
│   ├── InputConvertNormal - 普通模式输入
│   └── InputConvertGame - 游戏模式输入
│
├── VideoBuffer (videobuffer.h) - 视频帧缓冲
│   └── FpsCounter - FPS计数器
│
├── VideoForm (videoform.h/cpp) - 视频显示UI
│   ├── QYUVOpenGLWidget - OpenGL渲染
│   ├── ToolForm - 工具栏
│   └── 全屏支持
│
├── FileHandler (filehandler.h) - 文件操作
│   ├── Push - 文件推送到设备
│   └── Install - APK安装
│
└── Recorder (recorder.h) - 可选屏幕录制
    ├── AVFormatContext - FFmpeg输出上下文
    └── 支持MP4/MKV格式
```

---

## 3. 关键发现

### 3.1 组件销毁顺序 (至关重要!)

根据 `Device::~Device()` 的实现 (device.cpp:63-85)，正确的关闭顺序是:

```cpp
1. m_server->stop()           // 停止ADB服务器
2. m_stream->stopDecode()     // 停止视频流 (必须在decoder之前!)
3. delete m_recorder          // 删除录制器
4. m_vb->deInit() + delete    // 反初始化并删除视频缓冲
5. m_videoForm->close() + delete  // 关闭并删除视频窗口
```

**重要注释**: 代码中明确指出 "server must stop before decoder, because decoder block main thread"

### 3.2 全局资源清理

在应用退出时 (main.cpp:118-124):

```cpp
1. MouseTap::getInstance()->quitMouseEventTap()  // Windows/macOS
2. Stream::deInit()  // 全局FFmpeg清理
```

### 3.3 多设备管理

`DeviceManage::disconnectAllDevice()` (devicemanage.cpp:110-120):
- 遍历 m_devices map
- 依次 delete 每个 Device 对象
- 自动触发 Device::~Device() 完成清理

---

## 4. 分析的文件列表

### 主要文件 (24个)

1. **qtscrcpy_tc_tree.md** - 项目结构树
2. **mainwindow.h/cpp** - 主窗口 (54行,非常简单)
3. **mainwindow.ui** - UI布局定义
4. **device.h/cpp** - 核心设备类
5. **devicemanage.h/cpp** - 设备管理器
6. **dialog.h/cpp** - 设置对话框
7. **server.h** - ADB服务器
8. **decoder.h** - 视频解码器
9. **controller.h** - 输入控制器
10. **stream.h** - 视频流线程
11. **videoform.h/cpp** - 视频显示窗口
12. **main.cpp** - 应用入口
13. **adbprocess.h/cpp** - ADB进程管理
14. **filehandler.h** - 文件处理
15. **recorder.h** - 屏幕录制
16. **config.h/cpp** - 配置管理
17. **toolform.h** - 工具栏
18. **config.ini** - 配置文件
19. **.gitignore** - Git忽略规则
20. **scripts/README.md** - 构建脚本文档

### 关键代码段

#### 当前全屏实现 (main.cpp:114-116)
```cpp
w.setWindowFlags(Qt::Window | Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint);
w.setWindowState(Qt::WindowFullScreen);
w.show();
```

**问题**: 用户反馈此实现不能覆盖Windows任务栏

#### UI布局结构 (mainwindow.ui)
```
MainWindow (1280x720, 最小800x600)
├── centralwidget
│   └── verticalLayout (拉伸比: 1,0,15)
│       ├── topwidget (顶部区域)
│       │   ├── pushButton_3 (显示标题)
│       │   ├── shortcutwidget (ToolForm)
│       │   └── configbutton (设置按钮)
│       ├── line (水平分隔线)
│       └── middlewidget (中间主区域)
│           ├── leftwidget (设备树)
│           ├── line_2 (垂直分隔线)
│           └── centerwidget (设备显示区 - gridLayout)
├── menubar
└── statusbar
```

---

## 5. 待实现功能分析

### 5.1 自定义标题栏需求

用户要求在UI顶部添加自定义标题栏,包含:
- 应用标题显示
- 最小化按钮
- 最大化/还原按钮
- 重启按钮
- 关闭按钮

**实现策略**:
- 创建 CustomTitleBar 类继承自 QWidget
- 使用 Qt::FramelessWindowHint 隐藏系统标题栏
- 实现拖动、双击最大化等交互
- 集成到 MainWindow 的 topwidget

### 5.2 完整关闭逻辑

需要按顺序关闭:

```
1. 所有 Device 组件:
   DeviceManage::disconnectAllDevice()
   └─> 触发每个 Device::~Device()
       ├─> Server::stop()
       ├─> Stream::stopDecode()
       ├─> Recorder cleanup
       ├─> VideoBuffer::deInit()
       └─> VideoForm::close()

2. 全局资源:
   ├─> MouseTap::quitMouseEventTap() (Windows/macOS)
   └─> Stream::deInit()

3. 主窗口:
   └─> MainWindow::close()
```

### 5.3 重启逻辑

两种实现方案:

**方案A: QProcess重启**
```cpp
QProcess::startDetached(QApplication::applicationFilePath(),
                        QApplication::arguments());
QApplication::quit();
```

**方案B: 退出码重启**
```cpp
// main.cpp
int main() {
    int exitCode;
    do {
        QApplication app;
        MainWindow w;
        exitCode = app.exec();
    } while (exitCode == RESTART_CODE);
}
```

### 5.4 真正的全屏修复

需要研究的方向:
- 使用 `Qt::WindowFullScreen` + `setGeometry(QApplication::primaryScreen()->geometry())`
- Windows特定: 检查是否需要禁用Windows Aero效果
- 研究VideoForm的全屏实现 (videoform.cpp:474-520)
- 可能需要在不同窗口状态间切换时调整

---

## 6. 配置系统

### Config类功能
- 读取 config/config.ini (应用配置)
- 读取 config/userdata.ini (用户数据)
- Qt 6兼容: 使用UTF-8编码 (不再使用setIniCodec)

### 重要配置项
- **WindowTitle**: "灿烂传媒-智云矩阵"
- **MaxFps**: 60
- **ServerVersion**: "1.17"
- **UseDesktopOpenGL**: -1 (自动)
- **AdbPath**: 可自定义ADB路径

---

## 7. ADB集成

### AdbProcess类
- 继承自 QProcess
- 管理ADB命令执行
- 支持: devices, forward, reverse, push, install, shell等

### 重要功能
- 自动检测ADB路径 (环境变量 → config → 应用目录)
- Qt 6迁移: QRegExp → QRegularExpression
- 信号驱动的异步执行

---

## 8. 技术栈总结

- **Qt版本**: 6.9.3
- **编译器**: MSVC 2022 / MinGW
- **视频编解码**: FFmpeg
- **ADB版本**: 与Android SDK兼容
- **OpenGL**: 用于视频渲染 (QYUVOpenGLWidget)
- **多线程**: QThread用于视频流处理
- **网络**: QTcpSocket/QTcpServer用于设备通信
- **配置**: QSettings (INI格式)

---

## 9. 下一步开发计划

1. ✅ **架构分析** (已完成 - 24个文件)
2. **创建CustomTitleBar组件**
   - 设计UI布局
   - 实现窗口拖动
   - 实现按钮功能
3. **修复全屏问题**
   - 研究Windows任务栏覆盖
   - 测试不同显示器配置
4. **实现完整关闭逻辑**
   - 创建 shutdownApplication() 方法
   - 确保所有组件正确清理
5. **实现重启功能**
   - 选择最佳重启方案
   - 测试重启流程
6. **UI美化和响应式优化**
7. **全面测试**

---

## 10. 潜在风险和注意事项

### 风险1: 组件关闭顺序
- **风险**: 不正确的关闭顺序可能导致崩溃或死锁
- **缓解**: 严格遵循 Device::~Device() 中的顺序

### 风险2: FFmpeg资源泄漏
- **风险**: 视频解码资源未正确释放
- **缓解**: 确保 Stream::deInit() 在应用退出前调用

### 风险3: 多线程同步
- **风险**: Stream线程可能阻塞主线程
- **缓解**: 注释提示 "decoder block main thread"，需要先停止server

### 风险4: QPointer空指针
- **风险**: 组件已删除但指针未检查
- **缓解**: 所有组件使用QPointer包装，删除前检查

### 风险5: 全屏显示兼容性
- **风险**: 不同Windows版本/显示配置表现不一致
- **缓解**: 需要在多种环境下测试

---

## 11. 代码质量观察

### 优点
- 清晰的组件层次结构
- 使用Qt智能指针 (QPointer)
- 信号槽解耦设计
- 详细的代码注释 (中英文)

### 改进空间
- MainWindow过于简单 (仅54行)，缺少应用级管理
- Dialog功能大量被禁用 (#if 0)
- 缺少统一的错误处理机制
- 缺少日志系统 (虽然Config有LogLevel)

---

**文档作者**: Claude (AI Assistant)
**下次更新**: 完成CustomTitleBar设计后
