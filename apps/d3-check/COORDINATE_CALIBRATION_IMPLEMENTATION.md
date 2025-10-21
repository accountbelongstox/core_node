# Coordinate Calibration Panel Implementation

## Overview
已完成的坐标效准（Coordinate Calibration）功能是一个完整的游戏窗口坐标拾取和分析工具。用户可以对游戏窗口进行截图，然后通过交互式界面选择特定的坐标、矩形范围或圆形区域，最后将收集到的数据保存为JSON格式。

## Completed Components

### 1. Main Panel: `coordinate_calibration_panel.py`
位置：`ui/panels/coordinate_calibration_panel.py`

**主要功能：**
- D3和D4游戏模式选择
- 可选的截图保存和压缩功能
- 游戏窗口截图捕获
- 坐标历史记录管理（Treeview表格显示）
- 多语言支持（英文和中文）

**核心方法：**
- `_on_capture_screenshot()` - 捕获游戏窗口截图
- `_open_calibration_window()` - 打开坐标拾取窗口
- `_on_picks_updated()` - 处理拾取的坐标
- `_on_export_history()` - 导出历史记录为JSON
- `_on_rename_item()` - 重命名历史记录项
- `_on_delete_item()` - 删除历史记录项
- `_on_clear_history()` - 清除所有历史记录

### 2. Coordinate Picker Component: `coordinate_picker_window.py`
位置：`ui/components/coordinate_picker_window.py`

**主要功能：**
- 大屏幕截图显示（自适应缩放）
- 三种拾取类型：点（Point）、矩形（Rectangle）、圆形（Circle）
- 左侧菜单面板，包含拾取工具选择
- 参数设置（宽度、高度、半径）
- 撤销（Undo）功能
- 实时拾取计数显示

**拾取类型：**
- **Point**: 单击坐标点，立即记录 (x, y)
- **Rectangle**: 两次点击定义矩形范围，记录 (x, y, width, height)
- **Circle**: 两次点击定义圆形（中心和半径），记录 (x, y, radius)

### 3. UI Integration
在主UI文件中进行了以下集成：
- 导入 `CoordinateCalibrationPanel`
- 添加 `_create_coordinate_calibration_tab()` 方法
- 在主notebook中添加新标签页
- 更新UI重建逻辑以包含新标签

**文件：** `ui/diablo3_macro_ui.py`

### 4. Multi-language Support
创建了两个新的i18n配置文件：
- `providor/i18n/i18n_coordinate_calibration_en.json` - 英文翻译
- `providor/i18n/i18n_coordinate_calibration_zh.json` - 中文翻译

**i18n密钥包括：**
- `ui.coord_calibration.*` - 主面板的文本
- `ui.coord_picker.*` - 坐标拾取窗口的文本

同时更新了：
- `providor/i18n/i18n_main_window_en.json` - 添加 "Coordinate Calibration" 标签
- `providor/i18n/i18n_main_window_zh.json` - 添加 "坐标效准" 标签
- `providor/i18n_config.json` - 添加新标签页配置

## Features

### 1. Game Window Detection
- 使用 `WindowScreenshot` 工具检测并捕获游戏窗口
- 如果未检测到游戏窗口，显示友好的错误消息

### 2. Screenshot Management
- 可选择保存截图到 `screenshots/calibration/` 目录
- 可选择压缩截图（参数已准备，实现可扩展）
- 每个截图文件名包含时间戳

### 3. Coordinate Picking
- 支持三种几何形状的拾取
- 每次拾取自动记录时间戳和游戏模式
- 支持自定义拾取项名称（重命名功能）

### 4. History Management
- 完整的历史记录显示（Treeview）
- 显示列：ID、Type、Coordinates、GameMode、Timestamp
- 支持右键菜单操作：重命名、删除
- 清除所有历史记录功能

### 5. Data Export
- 导出为JSON格式
- JSON结构包含：
  - timestamp：导出时间
  - total_picks：拾取总数
  - picks：拾取数据数组
- 自动创建导出目录 `exports/calibration/`

## File Structure

```
apps/d3-check/
├── ui/
│   ├── panels/
│   │   └── coordinate_calibration_panel.py  [新文件]
│   ├── components/
│   │   ├── __init__.py                      [新文件]
│   │   └── coordinate_picker_window.py      [新文件]
│   ├── diablo3_macro_ui.py                  [已修改]
│   └── unified_styles.py                    [使用现有样式]
├── providor/
│   ├── i18n/
│   │   ├── i18n_coordinate_calibration_en.json  [新文件]
│   │   ├── i18n_coordinate_calibration_zh.json  [新文件]
│   │   ├── i18n_main_window_en.json             [已修改]
│   │   └── i18n_main_window_zh.json             [已修改]
│   └── i18n_config.json                    [已修改]
└── COORDINATE_CALIBRATION_IMPLEMENTATION.md [本文件]
```

## Usage Guide

### 1. 打开坐标效准面板
- 启动应用后，在主界面选择 "Coordinate Calibration" 标签页

### 2. 拾取坐标
```
1. 选择游戏模式（D3或D4）
2. 设置选项（保存截图、压缩）
3. 点击 "Capture Screenshot" 按钮
4. 在弹出的大屏幕窗口中：
   a. 选择拾取类型（Point/Rectangle/Circle）
   b. 设置相应的参数（如矩形的宽度、高度）
   c. 点击 "Start Picking"
   d. 在图像上点击以进行拾取
   e. 点击 "Stop Picking" 停止
5. 点击 "Close" 关闭拾取窗口，数据自动添加到历史
```

### 3. 管理历史记录
- **重命名**：右键点击历史项，选择 "Rename"
- **删除**：右键点击历史项，选择 "Delete"
- **清除全部**：点击 "Clear History" 按钮

### 4. 导出数据
- 点击 "Export to JSON" 按钮
- 文件自动保存到 `exports/calibration/` 目录
- 文件名包含时间戳

## Data Format

### 拾取数据结构（JSON）
```json
{
  "timestamp": "2025-10-21T10:30:45.123456",
  "total_picks": 3,
  "picks": [
    {
      "type": "point",
      "x": 100,
      "y": 200,
      "name": "Point 1",
      "timestamp": "2025-10-21T10:30:45.123456",
      "game_mode": "d3"
    },
    {
      "type": "rect",
      "x": 150,
      "y": 200,
      "width": 100,
      "height": 80,
      "name": "Rect 1",
      "timestamp": "2025-10-21T10:30:50.123456",
      "game_mode": "d3"
    },
    {
      "type": "circle",
      "x": 300,
      "y": 300,
      "radius": 50,
      "name": "Circle 1",
      "timestamp": "2025-10-21T10:30:55.123456",
      "game_mode": "d4"
    }
  ]
}
```

## Technical Details

### Dependencies Used
- `tkinter` - GUI框架
- `PIL (Pillow)` - 图像处理
- `pycore.WindowScreenshot` - 游戏窗口截图
- 现有的多语言系统（i18n_manager）
- 现有的UI样式系统（UnifiedStyles）

### Code Standards Followed
- ✅ 所有代码为英文
- ✅ 所有导入在文件头部
- ✅ 使用多语言系统，无硬编码语言文本
- ✅ 遵循现有代码风格和命名规范
- ✅ 使用common_imports进行公共导入
- ✅ 整合到现有UI框架

### Architecture
- **模块化设计**：主面板和拾取窗口分离
- **解耦UI**：使用回调函数处理数据更新
- **可扩展**：坐标类型和参数设置易于扩展
- **多语言**：完整支持英文和中文

## Future Enhancements

可能的改进方向：
1. **图像注解**：在截图上绘制已拾取的点/矩形/圆
2. **批量导入**：从JSON导入历史记录
3. **更多拾取类型**：多边形、线段等
4. **坐标转换**：支持不同分辨率的坐标映射
5. **实时预览**：在拾取过程中实时显示几何形状
6. **撤销/重做**：更完整的历史管理
7. **快捷键**：快速键盘操作

## Verification Checklist

- ✅ 代码通过Python语法检查
- ✅ 模块导入正确
- ✅ UI集成完成
- ✅ 多语言文件创建
- ✅ 遵循代码规范
- ✅ 文件结构完整
- ✅ 注释清晰
- ✅ 无硬编码语言文本

## Notes

1. **截图保存路径**：`D:\programing\core_node\apps\d3-check\screenshots\calibration\`
2. **导出保存路径**：`D:\programing\core_node\apps\d3-check\exports\calibration\`
3. **多语言配置**：如需添加新语言，参考现有的i18n文件结构
4. **扩展拾取类型**：在CoordinatePicker的`_on_canvas_click`方法中添加新的elif分支

## Contact & Support

如有问题或需要进一步改进，请参考项目文档或反馈。
