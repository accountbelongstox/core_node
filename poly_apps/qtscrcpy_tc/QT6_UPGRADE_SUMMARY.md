# Qt 6.9 升级总结报告

## 项目信息
- **项目名称**: QtScrcpy_tc
- **升级日期**: 2025-10-13
- **Qt 版本**: Qt 5.x → Qt 6.9
- **升级范围**: 完整项目（主程序 + 测试项目）

---

## 一、升级概述

本次升级将 QtScrcpy_tc 项目从 Qt 5 全面迁移到 Qt 6.9，移除了所有 Qt5 兼容性代码，采用 Qt 6.9 的现代化 API 和最佳实践。

### 关键升级点
1. **C++ 标准**: C++11 → C++17
2. **模块替换**: Qt5::X11Extras → Qt6::Gui (QPlatformNativeInterface)
3. **API 更新**: QRegExp → QRegularExpression
4. **常量命名**: QString::SkipEmptyParts → Qt::SkipEmptyParts
5. **弃用清理**: 移除 QDesktopWidget 等废弃 API

---

## 二、详细更改列表

### 2.1 构建系统更改 (.pro 文件)

#### 主项目文件: `TcUi/17_TcUi.pro`

**修改前:**
```qmake
QT += core gui
QT += network

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets

CONFIG += c++11

#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000
```

**修改后:**
```qmake
QT += core gui
QT += network widgets

CONFIG += c++17

# Disable deprecated APIs before Qt 6.0.0
DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000
```

**关键改变:**
- ✅ 直接添加 `widgets` 模块，移除 `greaterThan(QT_MAJOR_VERSION, 4)` 检查
- ✅ C++ 标准从 c++11 升级到 c++17 (Qt6 最低要求)
- ✅ 启用 `QT_DISABLE_DEPRECATED_BEFORE` 宏以确保不使用旧 API

#### 测试项目文件更新 (18 个文件)

使用自动化脚本批量更新了所有测试项目的 .pro 文件:
- `test/01_mainwindow/qt_learn.pro`
- `test/02_widget/02_widget.pro`
- `test/03_dialog/03_dialog.pro`
- ... (共 18 个文件)

每个文件应用了相同的升级模式。

---

### 2.2 Linux X11 支持升级

#### 文件: `TcUi/util/mousetap/mousetap.pri` 和 `test/16_myTc/util/mousetap/mousetap.pri`

**问题**: Qt5::X11Extras 模块在 Qt6 中已移除

**修改前:**
```qmake
linux {
    HEADERS += $$PWD/xmousetap.h
    SOURCES += $$PWD/xmousetap.cpp
    LIBS    += -lxcb
    QT      += x11extras
}
```

**修改后:**
```qmake
linux {
    HEADERS += $$PWD/xmousetap.h
    SOURCES += $$PWD/xmousetap.cpp
    LIBS    += -lxcb
    # Qt6: x11extras removed, functionality now in QtGui
    # QT      += x11extras
}
```

#### 文件: `TcUi/util/mousetap/xmousetap.cpp`

**问题**: QX11Info 类在 Qt6 中已移除

**修改前:**
```cpp
#include <QX11Info>

void XMouseTap::enableMouseEventTap(QRect rc, bool enabled) {
    xcb_connection_t *dpy = QX11Info::connection();
    // ...
    find_grab_window_recursive(dpy, QX11Info::appRootWindow(QX11Info::appScreen()),
                               rc, 0, 0, &grab_window, &grab_window_size);
}
```

**修改后:**
```cpp
#include <QGuiApplication>
#include <qpa/qplatformnativeinterface.h>

void XMouseTap::enableMouseEventTap(QRect rc, bool enabled) {
    // Qt6: QX11Info replaced with QPlatformNativeInterface
    QPlatformNativeInterface *native = QGuiApplication::platformNativeInterface();
    if (!native) {
        return;
    }

    xcb_connection_t *dpy = static_cast<xcb_connection_t*>(
        native->nativeResourceForIntegration(QByteArrayLiteral("connection")));
    if (!dpy) {
        return;
    }

    // Get root window
    auto rootWindow = static_cast<xcb_window_t>(
        reinterpret_cast<quintptr>(native->nativeResourceForIntegration(QByteArrayLiteral("rootwindow"))));

    find_grab_window_recursive(dpy, rootWindow,
                               rc, 0, 0, &grab_window, &grab_window_size);
}
```

**关键改变:**
- ✅ 使用 `QPlatformNativeInterface` 替代 `QX11Info`
- ✅ 通过 `nativeResourceForIntegration()` 获取 X11 连接和根窗口
- ✅ 添加了空指针检查以提高健壮性

---

### 2.3 正则表达式 API 升级

#### 文件: `TcUi/dialog.cpp`

**问题**: QRegExp 在 Qt6 中已弃用

**修改前:**
```cpp
int Dialog::findDeviceFromeSerialBox(bool wifi) {
    QRegExp regIP("\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}...");
    for (int i = 0; i < ui->serialBox->count(); ++i) {
        bool isWifi = regIP.exactMatch(ui->serialBox->itemText(i));
        // ...
    }
}
```

**修改后:**
```cpp
#include <QRegularExpression>

int Dialog::findDeviceFromeSerialBox(bool wifi) {
    // Qt6: QRegExp replaced with QRegularExpression
    QRegularExpression regIP("\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}...");
    for (int i = 0; i < ui->serialBox->count(); ++i) {
        QRegularExpressionMatch match = regIP.match(ui->serialBox->itemText(i));
        bool isWifi = match.hasMatch() && match.captured(0) == ui->serialBox->itemText(i);
        // ...
    }
}
```

#### 文件: `TcUi/adb/adbprocess.cpp` (3 处修改)

**修改前:**
```cpp
QStringList devicesInfoList = m_standardOutput.split(QRegExp("\r\n|\n"), QString::SkipEmptyParts);
QStringList deviceInfos = deviceInfo.split(QRegExp("\t"), QString::SkipEmptyParts);

QRegExp ipRegExp(strIPExp, Qt::CaseInsensitive);
if (ipRegExp.indexIn(m_standardOutput) != -1) {
    ip = ipRegExp.cap(0);
}
```

**修改后:**
```cpp
#include <QRegularExpression>

// Qt6: QRegExp replaced with QRegularExpression, QString::SkipEmptyParts replaced with Qt::SkipEmptyParts
QStringList devicesInfoList = m_standardOutput.split(QRegularExpression("\r\n|\n"), Qt::SkipEmptyParts);
QStringList deviceInfos = deviceInfo.split(QRegularExpression("\t"), Qt::SkipEmptyParts);

QRegularExpression ipRegExp(strIPExp, QRegularExpression::CaseInsensitiveOption);
QRegularExpressionMatch match = ipRegExp.match(m_standardOutput);
if (match.hasMatch()) {
    ip = match.captured(0);
}
```

**关键改变:**
- ✅ `QRegExp` → `QRegularExpression`
- ✅ `indexIn()` → `match().hasMatch()`
- ✅ `cap()` → `captured()`
- ✅ `Qt::CaseInsensitive` → `QRegularExpression::CaseInsensitiveOption`
- ✅ `QString::SkipEmptyParts` → `Qt::SkipEmptyParts`

---

### 2.4 移除废弃的 Qt Widgets API

#### 文件: `TcUi/device/ui/videoform.cpp`

**问题**: QDesktopWidget 在 Qt6 中已废弃

**修改前:**
```cpp
#include <QDesktopWidget>
```

**修改后:**
```cpp
// Qt6: QDesktopWidget is deprecated, use QScreen instead
// #include <QDesktopWidget>
```

**说明**: 代码中实际已使用 `QScreen` API，只需移除无用的头文件引用。

---

## 三、兼容性与迁移路径

### 3.1 Qt 版本支持
- ✅ **完全支持**: Qt 6.9+
- ❌ **不再支持**: Qt 5.x
- ⚠️ **最低要求**: Qt 6.0 (建议使用 Qt 6.9)

### 3.2 编译器要求
- **最低 C++ 标准**: C++17
- **Windows**: MSVC 2019+ 或 MinGW 8.1.0+
- **Linux**: GCC 7+ 或 Clang 5+
- **macOS**: Xcode 10+

### 3.3 平台特定注意事项

#### Linux X11
- 不再依赖 `Qt5::X11Extras` 包
- 使用 `QPlatformNativeInterface` 直接访问 X11 功能
- 需要安装 libxcb 开发包

#### Windows/macOS
- 无平台特定依赖变化
- 所有修改都是跨平台兼容的

---

## 四、已知问题与限制

### 4.1 条件编译代码
项目中大量使用 `#if 0` 禁用的代码：
```cpp
#if 0
    // 这些代码块在升级过程中被保留但未激活
    // 可能包含旧的 Qt5 API 调用
#endif
```

**建议**: 在启用这些代码块前，需要进行 Qt6 兼容性审查。

### 4.2 测试项目
test 目录中的 18 个测试项目已更新 .pro 文件，但源代码未全面审查：
- 可能仍包含 QRegExp 等废弃 API
- 需要逐个测试编译和运行

---

## 五、升级验证清单

### 5.1 构建验证
- [ ] 主项目 (TcUi) 成功编译
- [ ] 无 Qt5 废弃 API 警告
- [ ] 链接成功，无符号未定义错误
- [ ] 所有测试项目成功编译

### 5.2 功能验证
- [ ] ADB 设备检测功能正常
- [ ] 网络连接功能正常
- [ ] 视频渲染功能正常
- [ ] 鼠标/键盘输入正常
- [ ] Linux X11 输入捕获正常
- [ ] 全屏切换正常
- [ ] 文件拖放安装 APK 正常

### 5.3 平台验证
- [ ] Windows 10/11 测试通过
- [ ] macOS 测试通过
- [ ] Linux (X11) 测试通过

---

## 六、升级脚本

项目包含自动化升级脚本: `upgrade_qt6_script.sh`

**功能:**
- 自动查找并更新所有 .pro 文件
- 备份原始文件为 `.qt5_backup`
- 应用标准 Qt6 升级模式

**使用方法:**
```bash
cd /path/to/qtscrcpy_tc
chmod +x upgrade_qt6_script.sh
./upgrade_qt6_script.sh
```

---

## 七、后续建议

### 7.1 代码质量
1. **启用 Clang-Tidy Qt 检查**:
   ```bash
   clazy --rules=qt6-deprecated-api-fixes,qt6-header-fixes,qt6-qhash-signature
   ```

2. **移除条件编译块**: 清理所有 `#if 0` 代码或更新为 Qt6 兼容

3. **使用现代 C++17 特性**:
   - 结构化绑定
   - `std::optional`
   - `if constexpr`

### 7.2 Qt 6.9 新特性应用

可以考虑利用 Qt 6.9 的新特性:

1. **QString::arg() 支持 UTF-8**:
   ```cpp
   QString::arg(QUtf8StringView)  // 无需转换为 QString
   ```

2. **QHash 新 API**:
   ```cpp
   hash.tryEmplace(key, value);  // 高效插入
   hash.insertOrAssign(key, value);  // 标准库兼容
   ```

3. **QImage::flipped()** (方向参数):
   ```cpp
   image.flipped(Qt::Horizontal);  // 比 mirrored() 更清晰
   ```

### 7.3 性能优化
- 考虑使用 Qt 6.9 的 RHI 改进 (减少 CPU 负载)
- 在 Windows 上利用 vblank 监视线程特性
- 评估是否需要 Qt5Compat 模块作为过渡

---

## 八、参考文档

### Qt 官方升级指南
- [Qt 5 to Qt 6 Migration](https://doc.qt.io/qt-6/portingguide.html)
- [What's New in Qt 6.9](https://doc.qt.io/qt-6/whatsnew69.html)
- [Porting from Qt 5 to Qt 6](https://doc.qt.io/qt-6/portingguide.html)

### 项目内参考文档
- `docs/Qt5toQt6MigrationCriticalSteps.md`
- `docs/WhatsNewInQt6.9.md`
- `docs/Qt5AndQt6compatibility.md`

---

## 九、变更摘要

| 类别 | 修改文件数 | 关键修改 |
|------|-----------|---------|
| 构建配置 | 20 | C++17, 移除Qt5检查, 启用弃用宏 |
| Linux X11 | 3 | QPlatformNativeInterface 替换 |
| 正则表达式 | 2 | QRegularExpression 替换 |
| Widget API | 1 | 移除 QDesktopWidget |
| **总计** | **26** | **全面 Qt6 升级** |

---

## 十、签署与批准

- **升级执行**: Claude AI Assistant
- **升级日期**: 2025-10-13
- **Qt 目标版本**: 6.9
- **项目状态**: ✅ 升级完成，待测试验证

---

**备注**: 本次升级完全移除了 Qt5 支持，项目现在仅支持 Qt 6.9+。所有原始文件已备份为 `.qt5_backup`，可在需要时回滚。
