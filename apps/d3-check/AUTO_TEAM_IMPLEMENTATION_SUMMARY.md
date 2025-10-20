# 自动组队功能实现总结

## ✅ 已完成的工作

### 1. 扩展 D4OperationBase 基类 (d4utils/d4_operation_base.py)

添加了以下通用方法（lines 298-480）：

#### `_get_region_info(region_name)`
- **功能**: 从 detected_regions 获取区域信息
- **返回**: `{'coords': (x1, y1, x2, y2)}` 或 None

#### `click_region_center_random(region_name, margin=5, delay_ms=(100,300))`
- **功能**: 点击区域中心的随机位置
- **参数**:
  - region_name: 区域名称（从 detected_regions 获取）
  - margin: 随机偏移范围（像素）
  - delay_ms: 延迟范围（毫秒）
- **返回**: bool (成功/失败)

#### `type_text(text, char_delay_ms=(50,100))`
- **功能**: 逐字符输入文本，带随机延迟
- **参数**:
  - text: 要输入的文本
  - char_delay_ms: 每个字符间延迟范围
- **返回**: bool (成功/失败)

#### `type_number(number, char_delay_ms=(50,100))`
- **功能**: 输入数字（转换为字符串后输入）
- **参数**:
  - number: 要输入的数字
  - char_delay_ms: 每个字符间延迟范围
- **返回**: bool (成功/失败)

#### `calculate_region_row_point(region_name, total_rows, target_row, random_offset=5)`
- **功能**: 计算区域内某一行的点击坐标（用于下拉菜单）
- **参数**:
  - region_name: 区域名称
  - total_rows: 总行数
  - target_row: 目标行（1-based）
  - random_offset: 随机偏移
- **返回**: (x, y) 坐标或 None

---

### 2. 创建 AutoTeamFormation 类 (d4utils/auto_team_formation.py)

**完整的7步自动组队工作流**:

#### 步骤1: `_need_team_formation()` - 检查是否需要组队
- 从 detected_regions 的 ocr_results 中读取 "Find Team" OCR结果
- 如果文本以 "寻找" 开头，返回 True

#### 步骤2: `_click_find_team()` - 点击"寻找队伍"区域
- 使用 `click_region_center_random("Find Team")`
- 随机延迟 100-300ms

#### 步骤3: `_set_min_level(80)` - 设置最低等级
- 点击 "Min Level Input" 区域
- 输入数字 80

#### 步骤4: `_set_max_level(120)` - 设置最高等级
- 点击 "Max Level Input" 区域
- 输入数字 120

#### 步骤5: `_select_party_activity(row=5)` - 选择组队活动
- 点击 "Party Activity Dropdown" 打开下拉菜单
- 等待 300ms 让菜单展开
- **使用用户提供的坐标**: (315, 445, 640, 700) - 7行菜单
- 计算第5行（倒数第3行）的坐标
- 点击计算出的坐标

#### 步骤6: `_confirm_activity_levels(80, 120)` - 确认活动等级
- 点击 "Activity Min Level Input" 并输入 80
- 点击 "Activity Max Level Input" 并输入 120

#### 步骤7: `_submit_party()` - 提交组队
- 点击 "Submit Party Button"
- 等待 500ms
- 显示 "✓ 自动挂机准备完毕"

---

### 3. 集成到 TeamFormationChecker (d4utils/team_formation_checker.py)

修改了 `execute()` 方法的工作流：

```python
def execute(self) -> bool:
    # 1. 按 'O' 打开队伍面板
    # 2. 等待 next tick
    # 3. OCR 识别 "Find Team" 区域
    # 4. 检查文本是否以 "寻找" 开头

    if has_team:
        # 已有队伍 - 关闭面板
        self._press_key('o')
        return True
    else:
        # 未组队 - 触发自动组队
        from d4utils.auto_team_formation import get_auto_team_formation
        auto_team = get_auto_team_formation()
        formation_result = auto_team.execute()

        if formation_result:
            self.d4_data.has_team = True

        # 关闭面板
        self._press_key('o')
        return formation_result
```

---

## 📊 区域坐标需求

### ✅ 所有坐标已从 D4StandardCoordinates 获取

| 区域/点 | 坐标 (标准分辨率 1763x1126) | 来源 | 状态 |
|---------|---------------------------|------|------|
| Find Team | (155, 94, 275, 129) | D4StandardCoordinates.find_team_region | ✅ |
| Form Team | (292, 73, 406, 126) | D4StandardCoordinates.form_team_region | ✅ |
| Min Level Input | (410, 550) | D4StandardCoordinates.idle_team_min_tier | ✅ |
| Max Level Input | (805, 550) | D4StandardCoordinates.idle_team_max_tier | ✅ |
| Activity Dropdown | (375, 456) | D4StandardCoordinates.idle_activity_selection | ✅ |
| Activity Selection Area | (315, 445, 640, 700) | 用户提供 | ✅ |
| Confirm Team Button | (728, 861, 831, 879) | D4StandardCoordinates.confirm_team_button | ✅ |
| Edit Team Button | (950, 265) | D4StandardCoordinates.edit_team_button | ✅ |
| Confirm Edit Team | (730, 950) | D4StandardCoordinates.confirm_edit_team | ✅ |

**注意**: 活动最低/最高等级输入使用相同的 Min/Max Level Input 坐标（UI可能重用相同的输入框）

---

## 🔄 完整数据流

```
用户点击 "启动挂机经验"
  ↓
d4_panel.py: _start_exp_farming()
  ↓
【修复后新增】捕获截图初始化 D4 数据
  ├─ screenshot_handler.capture_and_collect_info(d4_data)
  ├─ 更新 fullscreen_size, game_window_size, window_offset
  └─ is_windowed_mode() = True ✅
  ↓
创建 TeamFormationChecker 实例
  ↓
team_checker.run()
  ├─ _ensure_window_active()
  │   ├─ 检查 is_windowed_mode() = True
  │   ├─ 调用 _click_title_bar()
  │   │   └─ 点击标题栏激活窗口 ✅
  │   └─ _window_activated = True
  ↓
team_checker.execute()
  ├─ 按 'O' 键打开队伍面板
  ├─ 等待 next tick
  ├─ OCR 识别 "Find Team" 区域
  ├─ 检查文本: "寻找队伍"
  │
  ├─ IF 已有队伍:
  │   ├─ 按 'O' 关闭面板
  │   └─ 返回 True
  │
  └─ IF 未组队 (文本以"寻找"开头):
      ↓
      【触发自动组队】auto_team.execute()
        ├─ 点击 "Find Team" 区域
        ├─ 设置最低等级 80
        ├─ 设置最高等级 120
        ├─ 选择组队活动（第5行/7行）
        ├─ 确认活动等级 80-120
        ├─ 提交组队
        └─ 显示 "✓ 自动挂机准备完毕"
      ↓
      按 'O' 关闭面板
      ↓
      更新 d4_data.has_team = True
      ↓
      返回 True
```

---

## 🧪 测试检查清单

### 前置条件
- [x] 窗口激活正常（已修复）
- [x] D4 数据初始化正确（已修复）
- [ ] 所有UI区域坐标已定义（待完成）

### 自动组队流程
- [ ] OCR识别 "寻找队伍" 准确
- [ ] 点击 "Find Team" 区域成功
- [ ] 最低等级输入框点击成功
- [ ] 文本输入正常（80, 120）
- [ ] 下拉菜单展开
- [ ] 行计算准确（第5行/7行）
- [ ] 点击活动选项成功
- [ ] 活动等级输入成功
- [ ] 提交按钮点击成功
- [ ] 最终显示 "✓ 自动挂机准备完毕"

### 错误处理
- [ ] OCR失败时的处理
- [ ] 区域不可用时的处理
- [ ] 每步失败时的错误日志
- [ ] 面板关闭逻辑正确

---

## 📝 下一步工作

### ✅ 1. UI区域坐标 - 已完成

所有坐标已从 `D4StandardCoordinates` 获取并集成到 `AutoTeamFormation.REGION_COORDS`。

### 2. 测试完整流程 ⚠️ 待测试

**测试步骤**:
1. 启动游戏（窗口模式）
2. 确保没有组队（"寻找队伍"状态）
3. 点击 "启动挂机经验" 按钮
4. 观察控制台日志输出
5. 验证自动组队流程执行：
   - 窗口激活（标题栏点击）
   - 按 'O' 打开队伍面板
   - OCR识别 "寻找队伍"
   - 自动组队流程执行
   - 最终显示 "✓ 自动挂机准备完毕"
6. 检查最终队伍状态

**预期日志**:
```
[D4] Checking team status before starting EXP farming
[D4] Capturing screenshot to initialize window data...
[D4] Window data initialized: fullscreen=(2560, 1600), window=(1826, 1031), windowed=True
[D4Operation] Windowed mode detected, will click title bar
[D4Operation] ✓ Title bar clicked successfully
[TeamFormationChecker] Starting team formation check...
[TeamFormationChecker] OCR result: '寻找队伍'
[TeamFormationChecker] ✗ Player has NO team
[TeamFormationChecker] Triggering automatic team formation...
[AutoTeamFormation] Starting auto team formation workflow...
[AutoTeamFormation] Step 2: Clicking Find Team region...
[AutoTeamFormation] Step 3: Setting min level to 80...
[AutoTeamFormation] Step 4: Setting max level to 120...
[AutoTeamFormation] Step 5: Selecting party activity (row 5/7)...
[AutoTeamFormation] Step 6: Confirming activity levels (80-120)...
[AutoTeamFormation] Step 7: Submitting party...
[AutoTeamFormation] ✓ 自动挂机准备完毕
```

### 3. 可能需要的调整

根据实际测试结果，可能需要：
- 调整延迟时间（如果UI响应较慢）
- 调整坐标偏移（如果点击位置不准确）
- 添加额外的等待逻辑（如果UI动画较长）
- 调整OCR识别逻辑（如果文本识别不准确）

### 4. 错误处理优化（可选）

- 添加重试机制（如果某步失败）
- 添加超时保护
- 添加截图保存（失败时）
- 添加更详细的错误日志

---

## 🎯 关键技术点

### 1. 随机行为模拟

所有操作都包含随机延迟和随机偏移，模拟人类操作：
- 点击位置：±5 像素随机偏移
- 点击延迟：100-300ms 随机
- 字符输入延迟：50-100ms 随机
- 下拉菜单等待：300ms

### 2. 动态数据获取

所有窗口位置和大小都从 shared data 动态获取：
- `d4_data.fullscreen_size` - 屏幕分辨率
- `d4_data.game_window_size` - 游戏窗口大小
- `d4_data.window_offset` - 窗口在屏幕上的偏移
- `d4_data.detected_regions` - 检测到的UI区域

### 3. 坐标转换

使用 `coordinate_helper.py` 进行坐标转换：
- 标准分辨率 (1763x1126) → 实际游戏坐标
- 游戏坐标 → 屏幕坐标
- 支持窗口模式和全屏模式

### 4. OCR集成

使用 CnOCR 引擎识别UI文本：
- 识别 "寻找队伍" vs "已组队"
- 配置在 `controller/d4func/ocr_config.py`

---

## 📂 相关文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `d4utils/d4_operation_base.py` | 扩展 | 添加通用方法（lines 298-480） |
| `d4utils/auto_team_formation.py` | 新建 | 自动组队管理器 |
| `d4utils/team_formation_checker.py` | 修改 | 集成自动组队流程 |
| `ui/panels/d4_panel.py` | 已修复 | 数据初始化时机修复 |
| `AUTO_TEAM_FORMATION_SPEC.md` | 已创建 | 流程规范文档 |
| `AUTO_TEAM_IMPLEMENTATION_SUMMARY.md` | 本文件 | 实现总结文档 |

---

## ✅ 实现完成度

- [x] D4OperationBase 扩展（100%）
- [x] AutoTeamFormation 类（100%）
- [x] TeamFormationChecker 集成（100%）
- [x] UI区域坐标定义（100% - 已从 D4StandardCoordinates 获取）
- [ ] 完整流程测试（0% - 待测试）

**总体完成度**: ~95%

**待完成项**: 实际测试验证

---

## 📋 坐标映射总结

所有坐标均已从 `share/game_interface_data.py` 的 `D4StandardCoordinates` 类获取：

```python
# AutoTeamFormation.REGION_COORDS
{
    'Find Team': (155, 94, 275, 129),           # find_team_region_start/end
    'Form Team': (292, 73, 406, 126),           # form_team_region_start/end
    'Min Level Input': (410, 550),              # idle_team_min_tier
    'Max Level Input': (805, 550),              # idle_team_max_tier
    'Activity Dropdown': (375, 456),            # idle_activity_selection
    'Activity Selection Area': (315, 445, 640, 700),  # User provided
    'Confirm Team Button': (728, 861, 831, 879),     # confirm_team_button_start/end
    'Edit Team Button': (950, 265),             # edit_team_button
    'Confirm Edit Team': (730, 950),            # confirm_edit_team
}
```

**下一步建议**: 在游戏中测试完整流程，根据实际表现调整延迟和坐标偏移。
