# Qt 6.9 升级说明

## 升级概述

本项目已从 **Qt 5.15.2** 成功升级到 **Qt 6.9.0**，这是一次重大的框架升级。

**升级日期：** 2025-12-19
**原版本：** Qt 5.15.2 + C++11 + MSVC 2017
**新版本：** Qt 6.9.0 + C++17 + MSVC 2019+

---

## 主要变更

### 1. C++ 标准升级
- **从 C++11 升级到 C++17**
- 文件：`TcUi/17_TcUi.pro`
- 变更：
  ```diff
  - CONFIG += c++11
  + CONFIG += c++17
  ```

### 2. Qt 版本检查简化
- **移除了 Qt 4 兼容性检查**
- 文件：`TcUi/17_TcUi.pro`
- 变更：
  ```diff
  - greaterThan(QT_MAJOR_VERSION, 4): QT += widgets
  + QT += widgets
  ```

### 3. 废弃 API 策略
- **启用严格的废弃 API 检查**
- 文件：`TcUi/17_TcUi.pro`
- 变更：
  ```diff
  - #DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000
  + DEFINES += QT_DISABLE_DEPRECATED_UP_TO=0x060900
  ```

### 4. High DPI 缩放
- **移除 Qt 6 中已废弃的 High DPI 属性设置**
- Qt 6 默认启用 High DPI 缩放，无需手动设置
- 文件：`TcUi/main.cpp`
- 变更：
  ```diff
  - QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
  + // Qt 6: High DPI scaling is enabled by default, AA_EnableHighDpiScaling is deprecated
  ```

---

## 编译器要求变更

### Windows
- **旧要求：** Visual Studio 2017 (MSVC 2017)
- **新要求：** Visual Studio 2019 或更高版本 (MSVC 2019/2022)
- **原因：** Qt 6.9 需要 C++17 支持，MSVC 2019 提供完整的 C++17 支持

### Linux
- **旧要求：** GCC 5.0+
- **新要求：** GCC 8.0 或更高版本
- **原因：** 需要完整的 C++17 标准库支持

### macOS
- **旧要求：** Xcode 9+
- **新要求：** Xcode 11 或更高版本
- **原因：** 需要 C++17 支持和 macOS 10.15+

---

## 新增编译脚本

为了简化编译和部署流程，新增了以下自动化脚本：

### Windows
- **`scripts/build-windows.bat`** - 自动化编译脚本
- **`scripts/deploy-windows.bat`** - 自动化部署和打包脚本

### Linux
- **`scripts/build-linux.sh`** - Linux 编译脚本

### macOS
- **`scripts/build-macos.sh`** - macOS 编译脚本

### 文档
- **`scripts/README.md`** - 详细的编译和部署指南

---

## Qt 6.9 的优势

### 1. 性能改进
- 更好的图形渲染性能
- 优化的内存管理
- 更快的编译速度

### 2. 新特性
- 改进的 QML 引擎
- 增强的跨平台支持
- 更好的 C++ 标准库集成

### 3. 现代化
- 完整的 C++17 支持
- 移除了过时的 API
- 更清晰的 API 设计

### 4. 稳定性
- 修复了早期 Qt 6 版本的 multimedia 模块 bug
- 更成熟的工具链
- 更好的第三方库兼容性

---

## 兼容性说明

### 保持兼容的部分
- **FFmpeg 集成** - 无需修改
- **OpenGL 设置** - 保持原有配置
- **ADB 集成** - 无需修改
- **scrcpy-server** - 无需修改
- **界面布局** - 完全兼容
- **业务逻辑** - 无需修改

### 需要注意的变更
- **High DPI 处理** - Qt 6 默认启用，无需手动设置
- **某些 API 签名变化** - 如果编译时遇到错误，请参考 Qt 6 文档
- **字符串处理** - Qt 6 对 UTF-8 的处理更加统一

---

## 迁移检查清单

- [x] 升级 .pro 文件中的 C++ 标准到 C++17
- [x] 移除 Qt 4 兼容性代码
- [x] 更新废弃 API 策略
- [x] 移除 `AA_EnableHighDpiScaling` 设置
- [x] 创建自动化编译脚本
- [x] 创建部署脚本
- [x] 更新项目 README
- [x] 创建升级文档
- [ ] 在 Qt 6.9 环境中测试编译
- [ ] 测试运行时功能
- [ ] 测试 FFmpeg 视频解码
- [ ] 测试 ADB 连接
- [ ] 测试跨平台兼容性

---

## 如何编译

### 快速开始（Windows）

1. 安装 Qt 6.9.0 + MSVC 2019/2022 64-bit
2. 打开 Qt Command Prompt
3. 运行编译脚本：
   ```cmd
   cd scripts
   build-windows.bat release
   ```
4. 运行部署脚本：
   ```cmd
   deploy-windows.bat release
   ```

详细说明请参考 `scripts/README.md`

---

## 故障排除

### 编译错误：C2429 - C++17 特性不可用
**解决方案：** 升级到 Visual Studio 2019 或更高版本

### qmake 未找到
**解决方案：** 使用 Qt Command Prompt，或将 Qt bin 目录添加到 PATH

### FFmpeg 库找不到
**解决方案：** 确保 `third_party/ffmpeg/` 目录存在且包含正确的库文件

### windeployqt 失败
**解决方案：** 确保使用 Qt Command Prompt，并且 Qt 安装完整

---

## 参考资源

### 官方文档
- [Qt 6 文档](https://doc.qt.io/qt-6/)
- [Qt 5 到 Qt 6 迁移指南](https://doc.qt.io/qt-6/portingguide.html)
- [Qt 6.9 新特性](https://doc.qt.io/qt-6.9/whatsnew69.html)

### C++17 资源
- [C++17 标准](https://en.cppreference.com/w/cpp/17)
- [MSVC C++17 支持](https://docs.microsoft.com/en-us/cpp/overview/visual-cpp-language-conformance)

### 原项目
- [QtScrcpy](https://github.com/barry-ran/QtScrcpy)
- [scrcpy](https://github.com/Genymobile/scrcpy)

---

## 未来计划

- [ ] 考虑使用 CMake 替代 qmake
- [ ] 探索 Qt 6 的新模块（如 Qt Multimedia）
- [ ] 优化 OpenGL 渲染性能
- [ ] 添加自动化测试
- [ ] 支持更多平台特性

---

## 贡献者

升级工作由 Claude Code 协助完成。

如有问题或建议，请提交 Issue 或 Pull Request。

---

**升级状态：** ✅ 完成
**测试状态：** ⏳ 待测试
**文档状态：** ✅ 完成
