# 自动组队完整流程规范

## 📋 流程概述

当检测到"寻找队伍"（未组队状态）时，自动执行组队操作。

## 🎯 完整流程

### 步骤0：前置条件
- ✅ 按 'O' 键打开队伍面板
- ✅ 等待下一个TICK
- ✅ OCR识别"寻找队伍"区域

### 步骤1：判断是否需要组队
```
IF OCR结果以"寻找"开头：
    → 未组队，继续步骤2
ELSE:
    → 已组队，跳过
```

### 步骤2：点击"创建队伍"区域
- **区域名称**: "Find Team" / "寻找队伍"
- **操作**: 随机点击区域中间位置
- **方法**: `click_region_center_random(region_name, margin=5)`
- **延迟**: 随机延迟 100-300ms

### 步骤3：设置最低等级
```
1. 点击"最低等级输入框"区域
   - 区域: "Min Level Input"
   - 随机点击
   - 延迟: 100-200ms

2. 输入数字 "80"
   - 方法: type_number(80)
   - 每个字符间延迟: 50-100ms
```

### 步骤4：设置最高等级
```
1. 点击"最高等级输入框"区域
   - 区域: "Max Level Input"
   - 随机点击
   - 延迟: 100-200ms

2. 输入数字 "120"
   - 方法: type_number(120)
   - 每个字符间延迟: 50-100ms
```

### 步骤5：选择组队活动
```
1. 点击"组队活动"下拉框
   - 区域: "Party Activity Dropdown"
   - 随机点击
   - 延迟: 200-300ms
   - 等待下拉菜单展开

2. 计算菜单行位置
   - 获取"活动选择区"区域 (Activity Selection Area)
   - 区域总高度 / 7 = 每行高度
   - 选择倒数第3行 (第5行)

3. 点击第5行
   - 计算坐标:
     row_5_y = region_top + (row_height * 4.5)
     row_x = region_center_x
   - 随机偏移: ±5 pixels
   - 延迟: 100-200ms
```

### 步骤6：确认最低/最高等级
```
注意：点击活动后，会出现新的等级输入区域

1. 点击"活动最低等级输入框"
   - 区域: "Activity Min Level Input"
   - 输入: "80"

2. 点击"活动最高等级输入框"
   - 区域: "Activity Max Level Input"
   - 输入: "120"
```

### 步骤7：提交组队
```
1. 点击"提交组队"按钮
   - 区域: "Submit Party Button"
   - 随机点击
   - 延迟: 200-300ms

2. 等待组队创建完成
   - 等待: 500ms

3. 显示提示
   - 打印: "✓ 自动挂机准备完毕"
```

## 🔧 需要的通用方法

### 1. 区域随机点击
```python
def click_region_center_random(
    region_name: str,
    margin: int = 5,
    delay_ms: tuple = (100, 300)
) -> bool:
    """
    点击区域中心的随机位置

    Args:
        region_name: 区域名称（从detected_regions获取）
        margin: 随机偏移范围（像素）
        delay_ms: 延迟范围（毫秒）

    Returns:
        bool: 是否成功
    """
    # 1. 获取区域坐标
    # 2. 计算中心点
    # 3. 添加随机偏移（±margin）
    # 4. 点击
    # 5. 随机延迟
```

### 2. 文本输入
```python
def type_text(
    text: str,
    char_delay_ms: tuple = (50, 100)
) -> bool:
    """
    逐字符输入文本（带随机延迟）

    Args:
        text: 要输入的文本
        char_delay_ms: 每个字符间延迟范围

    Returns:
        bool: 是否成功
    """
    # 逐字符输入，每个字符间有随机延迟
```

### 3. 数字输入
```python
def type_number(
    number: int,
    char_delay_ms: tuple = (50, 100)
) -> bool:
    """
    输入数字

    Args:
        number: 要输入的数字
        char_delay_ms: 每个字符间延迟范围

    Returns:
        bool: 是否成功
    """
    # 将数字转为字符串后输入
```

### 4. 区域行计算
```python
def calculate_region_row_point(
    region_name: str,
    total_rows: int,
    target_row: int,
    random_offset: int = 5
) -> Optional[Tuple[int, int]]:
    """
    计算区域内某一行的点击坐标

    Args:
        region_name: 区域名称
        total_rows: 总行数
        target_row: 目标行（1-based）
        random_offset: 随机偏移

    Returns:
        (x, y) 坐标或 None
    """
    # 1. 获取区域边界
    # 2. 计算每行高度 = region_height / total_rows
    # 3. 计算目标行的Y坐标
    # 4. 添加随机偏移
```

## 📊 区域定义需求

需要在 `window_region_detector.py` 中定义以下区域：

| 区域ID | 区域名称 | 用途 |
|--------|---------|------|
| `find_team` | Find Team / 寻找队伍 | OCR识别 + 点击创建队伍 |
| `min_level_input` | Min Level Input | 最低等级输入框 |
| `max_level_input` | Max Level Input | 最高等级输入框 |
| `party_activity_dropdown` | Party Activity Dropdown | 组队活动下拉框 |
| `activity_selection_area` | Activity Selection Area | 活动选择下拉菜单 |
| `activity_min_level_input` | Activity Min Level Input | 活动最低等级输入 |
| `activity_max_level_input` | Activity Max Level Input | 活动最高等级输入 |
| `submit_party_button` | Submit Party Button | 提交组队按钮 |

## 🎮 UI坐标参考（标准分辨率 1763x1126）

**注意：这些是示例坐标，实际需要从region_detector动态获取**

```
队伍面板（打开后）:
├─ 寻找队伍区域: (100, 150) -> (300, 200)
├─ 最低等级输入: (100, 250) -> (200, 280)
├─ 最高等级输入: (220, 250) -> (320, 280)
├─ 组队活动下拉: (100, 300) -> (320, 330)
├─ 活动选择区域: (100, 340) -> (320, 550)  ← 7行菜单
│   ├─ 第1行: Y=340-370
│   ├─ 第2行: Y=370-400
│   ├─ 第3行: Y=400-430
│   ├─ 第4行: Y=430-460
│   ├─ 第5行: Y=460-490  ← 倒数第3行，目标
│   ├─ 第6行: Y=490-520
│   └─ 第7行: Y=520-550
├─ 活动最低等级: (100, 560) -> (200, 590)
├─ 活动最高等级: (220, 560) -> (320, 590)
└─ 提交按钮: (100, 620) -> (220, 650)
```

## 🔄 完整代码流程

```python
class AutoTeamFormation:
    """自动组队管理器"""

    def __init__(self):
        self.d4_data = get_d4_interface_data()
        self.operation_base = D4OperationBase()

    def execute(self) -> bool:
        """执行自动组队"""
        try:
            # 步骤1: 判断是否需要组队
            if not self._need_team_formation():
                return True

            ColorPrint.blue("[AutoTeam] Starting auto team formation...")

            # 步骤2: 点击创建队伍
            if not self._click_find_team():
                return False

            # 步骤3: 设置最低等级
            if not self._set_min_level(80):
                return False

            # 步骤4: 设置最高等级
            if not self._set_max_level(120):
                return False

            # 步骤5: 选择组队活动
            if not self._select_party_activity(row=5):
                return False

            # 步骤6: 确认活动等级
            if not self._confirm_activity_levels(80, 120):
                return False

            # 步骤7: 提交组队
            if not self._submit_party():
                return False

            ColorPrint.green("[AutoTeam] ✓ 自动挂机准备完毕")
            return True

        except Exception as e:
            ColorPrint.red(f"[AutoTeam] Error: {e}")
            return False

    def _need_team_formation(self) -> bool:
        """检查是否需要组队"""
        # OCR识别"Find Team"区域
        # 如果文本以"寻找"开头，返回True
        pass

    def _click_find_team(self) -> bool:
        """点击寻找队伍区域"""
        return self.operation_base.click_region_center_random(
            "Find Team",
            margin=5,
            delay_ms=(100, 300)
        )

    def _set_min_level(self, level: int) -> bool:
        """设置最低等级"""
        # 1. 点击输入框
        if not self.operation_base.click_region_center_random("Min Level Input"):
            return False
        # 2. 输入数字
        return self.operation_base.type_number(level)

    def _set_max_level(self, level: int) -> bool:
        """设置最高等级"""
        # 同上
        pass

    def _select_party_activity(self, row: int) -> bool:
        """选择组队活动（倒数第3行）"""
        # 1. 点击下拉框
        if not self.operation_base.click_region_center_random("Party Activity Dropdown"):
            return False

        # 2. 等待展开
        time.sleep(0.3)

        # 3. 计算并点击目标行
        point = self.operation_base.calculate_region_row_point(
            "Activity Selection Area",
            total_rows=7,
            target_row=5  # 倒数第3行
        )
        if not point:
            return False

        return self.operation_base.click_point(point)

    def _confirm_activity_levels(self, min_level: int, max_level: int) -> bool:
        """确认活动等级"""
        # 设置活动最低等级和最高等级
        pass

    def _submit_party(self) -> bool:
        """提交组队"""
        if not self.operation_base.click_region_center_random("Submit Party Button"):
            return False
        time.sleep(0.5)
        return True
```

## 📝 实现优先级

1. ✅ 已完成：基础窗口激活、按键
2. 🔨 实现中：OCR识别队伍状态
3. 🚀 下一步：
   - 扩展 D4OperationBase 添加通用方法
   - 实现 AutoTeamFormation 类
   - 定义UI区域坐标
   - 集成到 TeamFormationChecker

## ⚠️ 注意事项

1. **所有坐标都从 detected_regions 动态获取**
2. **所有延迟都是随机的（模拟人类操作）**
3. **所有点击都有随机偏移（避免精确重复）**
4. **需要等待UI响应（适当的延迟）**
5. **错误处理：每步都要检查返回值**

## 🧪 测试检查清单

- [ ] 窗口激活正常
- [ ] OCR识别"寻找队伍"准确
- [ ] 点击区域位置正确
- [ ] 输入框点击成功
- [ ] 文本输入正常
- [ ] 下拉菜单展开
- [ ] 行计算准确
- [ ] 最终提交成功
- [ ] 错误处理完善

---

**下一步：开始实现通用方法和自动组队类**
