# Template Matching Test Script

## 功能概述

这是一个功能完整的模板匹配测试工具，支持 D3 和 D4 游戏的模板测试。

## 主要功能

### 1. 交互式菜单系统（全新设计）
- **箭头键导航**: 使用 ↑/↓ 键浏览菜单
- **实时缓存**: 每次选择立即保存，下次自动恢复
- **可复用设计**: 独立的 `interactive_menu.py` 菜单库
- **跨平台支持**: Windows/Linux/Mac 完美支持
- **视觉反馈**:
  - `>>>` 光标显示当前位置
  - `[*]` 显示缓存的选择（单选）
  - `[X]` 已选中，`[ ]` 未选中（多选）

### 2. 6种匹配方法
- **TM_CCOEFF_NORMED**: 相关系数模板匹配
- **TM_CCORR_NORMED**: 归一化相关模板匹配
- **TM_SQDIFF_NORMED**: 平方差模板匹配
- **SIFT**: 尺度不变特征变换
- **ORB**: 快速特征点匹配
- **AKAZE**: 加速非线性扩散滤波特征匹配

### 3. 自动化功能
- 自动获取用户名
- 自动扫描截图目录
- 自动计算缩放比例
- 自动生成测试报告

### 4. 详细统计
- 每个方法的成功率
- 整体匹配统计
- 带标注的结果图片
- JSON格式详细报告

## 使用方法

### 准备工作

1. **准备截图文件**
   - D3 截图放在: `C:\Users\{用户名}\.core_node\pytools\tmp\d3_screenshots`
   - D4 截图放在: `C:\Users\{用户名}\.core_node\pytools\tmp\d4_screenshots`

2. **确保模板文件存在**
   - D3 模板: `D:\programing\core_node\apps\d3-check\images\`
   - D4 模板: `D:\programing\core_node\apps\d3-check\images\d4\`

### 运行脚本

```bash
cd D:\programing\core_node\apps\d3-check
python scripts/template_matching_test.py
```

### 菜单操作（交互式箭头键导航）

#### 步骤 1: 选择游戏类型
```
======================================================================
  Template Matching Test - Game Type Selection
======================================================================

>>> [*] 0. Diablo III
    [ ] 1. Diablo IV

Controls: ↑/↓ Navigate | ENTER Select
```

**控制方式：**
- **↑/↓ 方向键**: 上下移动光标（`>>>` 标记）
- **ENTER**: 确认选择
- **数字键 0-9**: 直接跳转到对应项并选择
- **[*]**: 表示缓存的上次选择（自动预选）

#### 步骤 2: 选择模板（多选）
```
======================================================================
  Template Selection - D3
======================================================================

>>> [X] 0. [ALL] - Test all templates
    [ ] 1. [bag                 ] bag_opened_indicator        (threshold=0.80, method=ORB)
    [X] 2. [interface_indicator] blacksmith_indicator_1      (threshold=0.85, method=ORB)
    [X] 3. [interface_indicator] blacksmith_indicator_2      (threshold=0.85, method=ORB)

Controls: ↑/↓ Navigate | SPACE Toggle | ENTER Confirm | ESC Cancel
```

**控制方式：**
- **↑/↓ 方向键**: 上下移动光标（`>>>` 标记）
- **SPACE 空格键**: 切换当前项的选中状态（`[X]` 或 `[ ]`）
- **ENTER**: 确认所有选择
- **ESC**: 取消并使用缓存的选择
- **数字键 0-9**: 直接跳转到对应项并切换选中状态
- **[X]**: 表示已选中的项
- **[ ]**: 表示未选中的项

#### 步骤 3: 自动测试
脚本会自动：
1. 扫描截图目录
2. 对每张截图使用所有6种方法测试
3. 生成带标注的结果图片
4. 保存详细的 JSON 报告

## 输出结果

### 结果目录
所有输出保存在: `C:\Users\{用户名}\.core_node\pytools\tmp\multi_scale_result`

### 文件类型

1. **结果图片** (带标注)
   - 文件名格式: `{游戏类型}_{截图名}_{时间戳}.jpg`
   - 包含匹配框、置信度、方法名
   - 左上角显示测试摘要信息

2. **JSON 报告**
   - 文件名格式: `test_report_{游戏类型}_{时间戳}.json`
   - 包含所有测试详情
   - 每个模板的所有方法测试结果
   - 详细的统计数据

### JSON 报告结构
```json
{
  "game_type": "d3",
  "templates_tested": ["blacksmith_indicator_1", "blacksmith_indicator_2"],
  "screenshots_tested": 5,
  "timestamp": "2025-01-01T12:00:00",
  "statistics": {
    "total_tests": 10,
    "total_found": 8,
    "success_rate": "80.00%",
    "method_statistics": {
      "TM_CCOEFF_NORMED": {"found": 7, "total": 10},
      "SIFT": {"found": 8, "total": 10},
      "ORB": {"found": 9, "total": 10},
      ...
    }
  },
  "results": [...]
}
```

## 控制台输出示例

```
======================================================================
Testing: screenshot_001.png
======================================================================
[INFO] Screenshot size: 2560x1440
[INFO] Scale factor: X=1.402, Y=1.107

[TEMPLATE] blacksmith_indicator_1
  Testing with all 6 methods:
    [TM_CCOEFF_NORMED   ] FOUND (conf: 0.923)
    [TM_CCORR_NORMED    ] FOUND (conf: 0.891)
    [TM_SQDIFF_NORMED   ] FOUND (conf: 0.887)
    [SIFT               ] FOUND (conf: 0.756)
    [ORB                ] FOUND (conf: 0.812)
    [AKAZE              ] FOUND (conf: 0.734)
  [PRIMARY ORB] FOUND - Confidence: 0.812, Position: (1234, 567)

[SAVED] Result image: d3_screenshot_001_20250101_120000.jpg
```

## 缓存文件

菜单选择缓存在: `C:\Users\{用户名}\.core_node\.scripts\template_test_cache.json`

示例内容:
```json
{
  "game_type_index": 0,
  "template_indices": [2, 3]
}
```

## 高级功能

### 自动缩放
- 脚本会根据参考分辨率自动计算缩放比例
- D3 参考分辨率: 1826x1301
- D4 参考分辨率: 1763x1126
- 模板会自动缩放以匹配截图尺寸

### Alpha 通道支持
- 自动检测 PNG 模板的 alpha 通道
- 支持透明度的模板匹配

### 错误处理
- 自动跳过损坏的图片
- 记录错误但继续测试
- 提供详细的错误信息

## 故障排除

### 问题: 找不到截图
**解决方案**: 确保截图放在正确的目录
- D3: `~\.core_node\pytools\tmp\d3_screenshots`
- D4: `~\.core_node\pytools\tmp\d4_screenshots`

### 问题: 找不到模板
**解决方案**: 检查 `providor_index.py` 中的模板路径配置

### 问题: 所有方法都不匹配
**解决方案**:
1. 检查阈值设置是否过高
2. 验证模板和截图是否来自同一游戏版本
3. 尝试调整缩放比例

## 技术细节

### 匹配方法对比

| 方法 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| TM_CCOEFF_NORMED | 精确、快速 | 对缩放敏感 | 固定尺寸匹配 |
| TM_CCORR_NORMED | 快速 | 对亮度敏感 | 颜色一致场景 |
| TM_SQDIFF_NORMED | 精确 | 对噪声敏感 | 干净图像 |
| SIFT | 尺度不变、旋转不变 | 较慢 | 复杂场景 |
| ORB | 快速、效果好 | 特征点少时不稳定 | 一般场景 |
| AKAZE | 适合非均匀缩放 | 中等速度 | 拉伸变形场景 |

## 更新日志

### Version 1.0 (2025-01-18)
- 初始版本
- 支持 D3 和 D4 模板测试
- 6种匹配方法
- 交互式菜单系统
- 智能缓存
- 详细统计报告
