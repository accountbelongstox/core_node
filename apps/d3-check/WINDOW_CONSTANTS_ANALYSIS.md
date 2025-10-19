# Window Constants Analysis Report

## 问题总结

代码中存在**多处重复定义**的窗口常量，导致逻辑不一致。

---

## 常量定义位置

### 1. `share/game_interface_data.py` 第76-89行（模块级常量）

```python
TITLE_BAR_HEIGHT = 31  # Title bar height in pixels (measured)
TITLE_BAR_TOP_OFFSET = -1  # Title bar starts 1px above window rect top

WINDOW_BORDER_LEFT = 9  # Left border width in pixels
WINDOW_BORDER_RIGHT = 7  # Right border width in pixels
WINDOW_BORDER_BOTTOM = 8  # Bottom border width in pixels

WINDOW_BORDER_WIDTH = 8  # DEPRECATED: Use specific border constants instead

CLICK_MARGIN_DEFAULT = 10  # Default safety margin for click operations (pixels)
CLICK_MARGIN_REGION = 5  # Margin for region-based clicks (pixels)
```

**用途**:
- 全局坐标转换函数使用
- `calculate_unified_scaled_coordinate()` 使用
- 游戏UI区域坐标计算

### 2. `share/game_interface_data.py` 第476行（类属性）

```python
class InterfaceDataBase:
    WINDOW_HEIGHT_THRESHOLD = 31
```

**用途**:
- `is_windowed_mode()` 方法：判断是否窗口模式
- D3坐标计算：`update_global_scale()` 函数中用于全屏模式调整

### 3. `share/coordinate_helper.py` 第137-142行（函数内局部常量）

```python
def get_title_bar_random_point():
    LEFT_BORDER = 9
    RIGHT_BORDER = 7
    TOP_OFFSET = -1
    TITLE_BAR_HEIGHT = 31
    margin = 10
```

**用途**: 标题栏点击坐标计算

### 4. `share/coordinate_helper.py` 第191-195行（函数内局部常量）

```python
def debug_show_title_bar_range():
    LEFT_BORDER = 9
    RIGHT_BORDER = 7
    TOP_OFFSET = -1
    TITLE_BAR_HEIGHT = 31
    margin = 10
```

**用途**: Debug调试信息显示

---

## 不一致性分析

### ❌ 问题1: 重复定义相同的值

- `TITLE_BAR_HEIGHT` 定义了 **3次**:
  - 模块级常量: `76行`
  - 类属性: `476行` (as `WINDOW_HEIGHT_THRESHOLD`)
  - 函数内局部: `coordinate_helper.py` 两处

- `WINDOW_BORDER_WIDTH` 定义了 **2次**:
  - 模块级常量: `85行` (值为8)
  - 但实际使用时应该区分左右边框(9和7)

### ❌ 问题2: 语义混乱

`WINDOW_HEIGHT_THRESHOLD = 31` 的语义不清晰：
- 名字暗示是"阈值"，但实际就是 `TITLE_BAR_HEIGHT`
- 在 `is_windowed_mode()` 中用作窗口/全屏判断阈值
- 在 D3 坐标计算中用作尺寸调整值

### ❌ 问题3: 边框值不准确

旧定义使用:
```python
WINDOW_BORDER_WIDTH = 8  # 左右都是8
```

但实测值是:
```python
WINDOW_BORDER_LEFT = 9   # 实际测量
WINDOW_BORDER_RIGHT = 7  # 实际测量
```

这会导致坐标计算偏差！

---

## 引用关系分析

### 模块级常量的引用

#### `TITLE_BAR_HEIGHT` (line 76)

**被以下函数使用**:

1. `calculate_unified_scaled_coordinate()` (line 193, 206, 229)
   ```python
   effective_actual_height = actual_height - (TITLE_BAR_HEIGHT + WINDOW_BORDER_WIDTH)
   scaled_y = int((std_y - TITLE_BAR_HEIGHT) * scale_y + TITLE_BAR_HEIGHT)
   ```

   **影响范围**:
   - 所有游戏UI区域坐标转换
   - Debug Images显示的所有区域框
   - 区域提取 (region_detector.py)
   - 图像标注 (image_annotator.py)

#### `WINDOW_BORDER_WIDTH` (line 85)

**被以下函数使用**:

1. `calculate_unified_scaled_coordinate()` (line 191-194, 205, 228)
   ```python
   effective_actual_width = actual_width - (WINDOW_BORDER_WIDTH + WINDOW_BORDER_WIDTH)
   effective_actual_height = actual_height - (TITLE_BAR_HEIGHT + WINDOW_BORDER_WIDTH)
   scaled_x = int((std_x - WINDOW_BORDER_WIDTH) * scale_x + WINDOW_BORDER_WIDTH)
   ```

   **问题**:
   - 假设左右边框相同 (8+8=16)
   - 但实际是 (9+7=16) ✓ 总宽度巧合正确
   - 但左右偏移计算会有误差！

### 类属性的引用

#### `WINDOW_HEIGHT_THRESHOLD` (line 476)

**被以下方法/函数使用**:

1. `InterfaceDataBase.is_windowed_mode()` (line 504-505)
   ```python
   return (width_diff >= self.WINDOW_HEIGHT_THRESHOLD and
           height_diff >= self.WINDOW_HEIGHT_THRESHOLD)
   ```

   **逻辑**: 如果窗口尺寸与全屏尺寸差距 >= 31像素，判定为窗口模式

   **问题**: 使用标题栏高度作为判断阈值是巧合，不是设计！

2. `update_global_scale()` for D3 (line 1125-1128)
   ```python
   effective_actual_width = actual_width + shared_data.WINDOW_HEIGHT_THRESHOLD
   effective_actual_height = actual_height + shared_data.WINDOW_HEIGHT_THRESHOLD
   ```

   **用途**: D3全屏模式下的尺寸调整

   **问题**: 混用了D4的标题栏高度值！

---

## 坐标计算流程分析

### 游戏UI区域坐标转换 (`calculate_unified_scaled_coordinate`)

```
标准坐标 (1763x1126 分辨率)
    ↓
减去边框/标题栏 (客户区坐标)
    std_x - WINDOW_BORDER_WIDTH (8)  ❌ 应该根据位置用LEFT/RIGHT
    std_y - TITLE_BAR_HEIGHT (31)    ✓ 正确
    ↓
缩放到实际分辨率
    ↓
加回边框/标题栏 (窗口坐标)
    + WINDOW_BORDER_WIDTH (8)        ❌ 应该根据位置用LEFT/RIGHT
    + TITLE_BAR_HEIGHT (31)          ✓ 正确
    ↓
实际窗口坐标
```

**问题**:
- X坐标使用统一的 `WINDOW_BORDER_WIDTH=8`
- 但左边框是9px，右边框是7px
- 导致左侧区域向右偏移1px，右侧区域向左偏移1px

### 标题栏点击坐标转换 (`get_title_bar_random_point`)

```
window_offset (窗口外框位置)
    ↓
加上左边框 + margin
    + LEFT_BORDER (9)       ✓ 正确
    + margin (10)
    ↓
减去右边框 + margin
    + width - RIGHT_BORDER (7) - margin    ✓ 正确
    ↓
调整顶部偏移
    + TOP_OFFSET (-1)       ✓ 正确
    ↓
屏幕坐标
```

**状态**: 此函数使用了正确的左右边框值！

---

## 导致的Bug

### Bug 1: Debug Images 区域向左偏移约1px

**原因**:
- `calculate_unified_scaled_coordinate()` 使用 `WINDOW_BORDER_WIDTH=8`
- 但左边框实际是9px
- 导致所有区域框向左偏移 (9-8) = 1px

### Bug 2: 右侧区域可能偏移

**原因**:
- 右边框实际是7px，但使用8px计算
- 导致右侧区域可能向左偏移 (8-7) = 1px

### Bug 3: D3/D4 常量混用

**原因**:
- D3坐标计算使用 `WINDOW_HEIGHT_THRESHOLD`
- 但这个值实际是D4的 `TITLE_BAR_HEIGHT`
- 如果D3和D4的标题栏高度不同，会出问题

---

## 修复方案

### 方案1: 统一使用模块级常量（推荐）

#### Step 1: 保留并完善模块级常量

```python
# share/game_interface_data.py (line 76-89)

TITLE_BAR_HEIGHT = 31
TITLE_BAR_TOP_OFFSET = -1

WINDOW_BORDER_LEFT = 9
WINDOW_BORDER_RIGHT = 7
WINDOW_BORDER_BOTTOM = 8

# 计算平均值用于对称场景
WINDOW_BORDER_WIDTH = 8  # (9+7)/2 ≈ 8, for symmetric calculations

CLICK_MARGIN_DEFAULT = 10
CLICK_MARGIN_REGION = 5
```

#### Step 2: 修改类属性为引用

```python
# share/game_interface_data.py (line 476)

class InterfaceDataBase:
    # Use module-level constant instead of redefining
    WINDOW_HEIGHT_THRESHOLD = TITLE_BAR_HEIGHT  # Reference to module constant
```

#### Step 3: 修改 coordinate_helper.py 引用常量

```python
# share/coordinate_helper.py

from share.game_interface_data import (
    TITLE_BAR_HEIGHT,
    TITLE_BAR_TOP_OFFSET,
    WINDOW_BORDER_LEFT,
    WINDOW_BORDER_RIGHT,
    CLICK_MARGIN_DEFAULT
)

def get_title_bar_random_point():
    # Use imported constants directly
    # No local redefinition
```

#### Step 4: 修正 calculate_unified_scaled_coordinate

```python
# 需要根据坐标位置判断使用LEFT还是RIGHT边框
# 这是一个更复杂的改动，需要传入额外参数
```

---

## 优先级

### 🔴 高优先级（必须修复）

1. **统一常量定义**: 移除所有重复定义
2. **修复 coordinate_helper.py**: 使用导入的常量

### 🟡 中优先级（建议修复）

3. **修正左右边框计算**: 更新 `calculate_unified_scaled_coordinate()`
4. **重命名 WINDOW_HEIGHT_THRESHOLD**: 改为 `TITLE_BAR_HEIGHT` 引用

### 🟢 低优先级（优化）

5. **添加文档**: 说明常量用途和测量方法
6. **添加单元测试**: 验证坐标计算正确性

---

## 结论

当前代码存在**严重的常量重复定义**问题，导致：
- 维护困难（改一处要改多处）
- 容易出错（不同地方可能用不同值）
- 坐标计算有偏差（左右边框不对称）

**必须立即统一所有常量定义到模块级，并让所有代码引用同一份常量。**
