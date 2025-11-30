# QtScrcpy_tc 开发文档索引

**项目名称**: 灿烂传媒-智云矩阵
**基于**: QtScrcpy
**开发日期**: 2025-10-14
**文档版本**: 1.0

---

## 📚 文档列表

### 1. [架构分析文档](./01_architecture_analysis.md)
**文件**: `01_architecture_analysis.md`
**内容**:
- 项目结构和组件层次
- 24个核心文件的详细分析
- Device和DeviceManage的架构设计
- 组件销毁顺序和关键代码路径
- 配置系统和ADB集成
- 潜在风险和注意事项

**适用人群**: 新开发者、架构师、需要深入了解项目结构的人

---

### 2. [自定义标题栏设计文档](./02_custom_titlebar_design.md)
**文件**: `02_custom_titlebar_design.md`
**内容**:
- CustomTitleBar类的详细设计
- UI规格和颜色方案
- 窗口拖动实现细节
- 完整关闭和重启逻辑设计
- 全屏修复方案对比
- 实现步骤和测试计划

**适用人群**: UI开发者、功能实现者、测试人员

---

### 3. [实现总结文档](./03_implementation_summary.md)
**文件**: `03_implementation_summary.md`
**内容**:
- 完整的实现概述
- 新增和修改文件的详细列表
- Qt 6.9.3兼容性处理
- 用户交互流程图
- 已知限制和TODO列表
- 测试清单和构建说明
- 代码统计和关键位置索引

**适用人群**: 所有团队成员、测试人员、运维人员

---

### 4. [本README文档](./README.md)
**文件**: `README.md`
**内容**: 文档索引和快速导航

---

## 🎯 快速查找

### 按任务类型查找

| 任务 | 文档 | 章节 |
|------|------|------|
| 了解项目架构 | 01_architecture_analysis.md | § 2 核心组件层次结构 |
| 理解组件关系 | 01_architecture_analysis.md | § 2.2 Device组件详细结构 |
| 查看关闭顺序 | 01_architecture_analysis.md | § 3.1 组件销毁顺序 |
| 设计UI组件 | 02_custom_titlebar_design.md | § 2 UI设计规格 |
| 实现窗口拖动 | 02_custom_titlebar_design.md | § 4.1 窗口拖动实现 |
| 实现关闭逻辑 | 02_custom_titlebar_design.md | § 6 完整关闭逻辑设计 |
| 实现重启逻辑 | 02_custom_titlebar_design.md | § 7 重启逻辑设计 |
| 修复全屏问题 | 02_custom_titlebar_design.md | § 8 全屏修复方案 |
| 查看实现细节 | 03_implementation_summary.md | § 4 技术实现细节 |
| 了解代码位置 | 03_implementation_summary.md | § 11 关键代码位置索引 |
| 构建和运行 | 03_implementation_summary.md | § 9 构建和运行 |
| 测试功能 | 03_implementation_summary.md | § 8 测试清单 |
| 查看未来计划 | 03_implementation_summary.md | § 15 下一步计划 |

### 按角色查找

#### 🔨 新开发者
1. 先读: `01_architecture_analysis.md` - 了解整体架构
2. 再读: `03_implementation_summary.md § 11` - 找到关键代码位置
3. 然后读: `02_custom_titlebar_design.md` - 理解功能设计

#### 🎨 UI设计师
1. 先读: `02_custom_titlebar_design.md § 2` - UI设计规格
2. 再读: `02_custom_titlebar_design.md § 4.4` - 样式表设计
3. 然后读: `03_implementation_summary.md § 12.2` - 未来优化(主题支持)

#### 🧪 测试人员
1. 先读: `03_implementation_summary.md § 8` - 测试清单
2. 再读: `03_implementation_summary.md § 6` - 用户交互流程
3. 然后读: `03_implementation_summary.md § 7` - 已知限制

#### 👨‍💻 维护人员
1. 先读: `03_implementation_summary.md § 3` - 修改文件列表
2. 再读: `03_implementation_summary.md § 11` - 代码位置索引
3. 然后读: `03_implementation_summary.md § 12` - 调试信息

---

## 📝 最近更新内容

### ✅ 已完成 (2025-10-14)

1. **项目架构分析** - 分析了24个核心文件
2. **CustomTitleBar类** - 实现自定义标题栏
3. **窗口控制功能** - 最小化、最大化、还原
4. **应用关闭逻辑** - 完整的组件清理流程
5. **应用重启功能** - 支持保留参数重启
6. **全屏显示优化** - 改用showMaximized()
7. **文档体系** - 创建3个详细文档

### 🔄 进行中

1. **构建测试** - 正在编译新代码
2. **功能测试** - 等待构建完成后测试

### 📋 待办事项

1. **设备管理集成** - 完善hasActiveDevices()和设备断开
2. **UI优化** - 响应式布局测试和调整
3. **性能优化** - 减少关闭延迟、优化拖动
4. **功能增强** - 窗口位置记忆、主题切换、动画

---

## 🔍 代码统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 新增C++文件 | 2 | customtitlebar.h/cpp |
| 修改C++文件 | 3 | mainwindow.h/cpp, main.cpp |
| 新增文档 | 3 | 架构分析、设计、实现总结 |
| 修改配置文件 | 2 | SmartMatrix.pro |
| 总代码行数 | ~2568 | 包含注释和文档 |

---

## 🚀 快速开始

### 对于新开发者

```bash
# 1. 阅读架构文档
cat dev_docs/01_architecture_analysis.md

# 2. 阅读实现文档
cat dev_docs/03_implementation_summary.md

# 3. 查看关键代码
# - CustomTitleBar: SmartMatrix/ui/customtitlebar.{h,cpp}
# - MainWindow集成: SmartMatrix/mainwindow.{h,cpp}
# - 应用启动: SmartMatrix/main.cpp

# 4. 构建项目
cd D:\programing\core_node\poly_apps\qtscrcpy_tc
.\build.bat -Clean -BuildType Release

# 5. 运行测试
.\output\win\x64\release\SmartMatrix.exe
```

### 对于测试人员

```bash
# 1. 阅读测试清单
cat dev_docs/03_implementation_summary.md | grep -A 50 "## 8. 测试清单"

# 2. 运行应用
.\output\win\x64\release\SmartMatrix.exe

# 3. 测试功能
# - 标题栏显示
# - 窗口拖动
# - 最小化/最大化
# - 重启功能
# - 关闭功能

# 4. 报告问题
# 创建issue或更新文档
```

---

## 📖 术语表

| 术语 | 说明 |
|------|------|
| **CustomTitleBar** | 自定义标题栏类，提供窗口控制按钮 |
| **Device** | 代表一个连接的Android设备 |
| **DeviceManage** | 管理多个Device实例 |
| **Stream** | 视频流处理线程 |
| **Decoder** | FFmpeg视频解码器 |
| **Controller** | 输入控制器(键鼠→Android) |
| **Server** | ADB通信和scrcpy-server管理 |
| **VideoForm** | 视频显示窗口 |
| **MouseTap** | 鼠标事件捕获(Windows/macOS) |
| **ADB** | Android Debug Bridge |

---

## 🔗 相关资源

### 项目资源
- **项目根目录**: `D:\programing\core_node\poly_apps\qtscrcpy_tc\`
- **构建脚本**: `scripts/build.ps1`
- **输出目录**: `output/win/x64/release/`
- **配置文件**: `SmartMatrix/config/config.ini`

### 外部资源
- [Qt 6.9.3 文档](https://doc.qt.io/qt-6/)
- [scrcpy 项目](https://github.com/Genymobile/scrcpy)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)

---

## 📞 联系方式

- **项目维护**: 灿烂传媒技术团队
- **文档作者**: Claude (AI Assistant)
- **最后更新**: 2025-10-14

---

## 📜 变更历史

### Version 1.0 (2025-10-14)
- ✅ 初始文档创建
- ✅ 完成架构分析
- ✅ 完成设计文档
- ✅ 完成实现总结
- ✅ 实现CustomTitleBar
- ✅ 实现完整关闭/重启逻辑
- 🔄 进行构建测试

---

**提示**: 此文档会随着项目发展持续更新，请定期查看最新版本。
