# Interactive Menu System - 功能说明

## 概述

独立的可复用菜单系统，支持箭头键导航和智能缓存。

## 文件结构

```
scripts/
├── interactive_menu.py          # 菜单库（可复用）
├── template_matching_test.py    # 主测试脚本
├── test_menu.py                 # 菜单测试脚本
└── TEMPLATE_TEST_README.md      # 使用说明
```

## 核心类：InteractiveMenu

### 初始化

```python
from pathlib import Path
from interactive_menu import InteractiveMenu

# 创建菜单实例（带缓存）
cache_file = Path.home() / ".core_node" / ".scripts" / "cache.json"
menu = InteractiveMenu(cache_file=cache_file)
```

### 方法 1: 单选菜单

```python
selected_index = menu.show_single_select_menu(
    title="选择游戏类型",
    items=["Diablo III", "Diablo IV"],
    cache_key="game_type",      # 缓存键
    default_index=0              # 默认选择
)
```

**特性：**
- 自动从缓存恢复上次选择
- 选择后立即保存到缓存
- 光标自动定位到缓存的位置

**控制键：**
- `↑/↓` - 移动光标
- `ENTER` - 确认选择
- `0-9` - 直接跳转

**显示效果：**
```
======================================================================
  选择游戏类型
======================================================================

>>> [*] 0. Diablo III    ← 光标 + 缓存选择
    [ ] 1. Diablo IV

Controls: ↑/↓ Navigate | ENTER Select | 0-9 Jump to item
```

### 方法 2: 多选菜单

```python
selected_indices = menu.show_multi_select_menu(
    title="选择模板",
    items=["All", "Template 1", "Template 2"],
    cache_key="templates",       # 缓存键
    default_indices=[0]          # 默认选择列表
)
```

**特性：**
- 支持同时选择多个项目
- 每次 SPACE 切换后立即保存缓存
- 空选择时自动选择当前光标项

**控制键：**
- `↑/↓` - 移动光标
- `SPACE` - 切换选中状态（立即缓存）
- `ENTER` - 确认所有选择
- `ESC` - 取消并恢复缓存
- `0-9` - 直接跳转

**显示效果：**
```
======================================================================
  选择模板
======================================================================

    [ ] 0. [ALL] - All templates
>>> [X] 1. Template 1             ← 光标 + 已选中
    [X] 2. Template 2             ← 已选中
    [ ] 3. Template 3

Selected: 2 item(s)
Controls: ↑/↓ Navigate | SPACE Toggle | ENTER Confirm | ESC Cancel | 0-9 Jump
```

### 方法 3: 缓存管理

```python
# 获取缓存值
value = menu.get_cached_value("game_type", default=0)

# 设置缓存值
menu.set_cached_value("game_type", 1)

# 清空所有缓存
menu.clear_cache()
```

## 关键特性

### 1. 实时缓存更新

**问题：** 之前的实现只在确认后保存缓存

**解决：** 现在每次操作都立即保存
- 单选：ENTER 时保存
- 多选：每次 SPACE 切换时立即保存

```python
# 多选菜单中的实时缓存
elif key == 'space':
    if current_index in selected_indices:
        selected_indices.remove(current_index)
    else:
        selected_indices.append(current_index)

    # 立即保存！
    self.cache[cache_key] = selected_indices
    self._save_cache()

    render_menu()
```

### 2. 光标和选择分离

**问题：** 之前光标 `>>>` 和选择标记 `[*]` 混在一起

**解决：** 清晰分离
- `>>>` - 当前光标位置（可移动）
- `[*]` - 缓存的选择（单选）
- `[X]` - 已选中（多选）
- `[ ]` - 未选中（多选）

```python
# 正确的显示逻辑
cursor = ">>>" if idx == current_index else "   "
marker = "[*]" if idx == current_index else "   "  # 单选
marker = "[X]" if idx in selected_indices else "[ ]"  # 多选

print(f"{cursor} {marker} {idx}. {item}")
```

### 3. 跨平台键盘输入

支持 Windows 和 Unix 系统：

```python
if os.name == 'nt':  # Windows
    import msvcrt
    # 使用 msvcrt.getch()
else:  # Unix/Linux/Mac
    import tty
    import termios
    # 使用 termios
```

### 4. 缓存文件格式

```json
{
  "game_type": 0,
  "templates": [0, 2, 5]
}
```

## 使用示例

### 完整示例

```python
from pathlib import Path
from interactive_menu import InteractiveMenu

# 1. 初始化菜单
cache_file = Path.home() / ".config" / "myapp_cache.json"
menu = InteractiveMenu(cache_file=cache_file)

# 2. 单选菜单
game_index = menu.show_single_select_menu(
    title="选择游戏",
    items=["D3", "D4"],
    cache_key="game",
    default_index=0
)
print(f"选择了: {game_index}")

# 3. 多选菜单
template_indices = menu.show_multi_select_menu(
    title="选择模板",
    items=["All", "T1", "T2", "T3"],
    cache_key="templates",
    default_indices=[0]
)
print(f"选择了: {template_indices}")

# 4. 下次运行时自动恢复选择！
```

## 测试脚本

运行测试验证菜单功能：

```bash
cd D:\programing\core_node\apps\d3-check\scripts
python test_menu.py
```

测试内容：
1. 单选菜单导航和缓存
2. 多选菜单切换和缓存
3. 缓存持久化验证

## 设计原则

### 1. 单一职责
- `InteractiveMenu` 只负责菜单交互
- 不包含业务逻辑
- 完全可复用

### 2. 即时反馈
- 每次操作立即保存
- 实时视觉更新
- 无需等待确认

### 3. 用户友好
- 多种操作方式（箭头键、数字键）
- 清晰的视觉提示
- ESC 可取消操作

### 4. 跨平台兼容
- Windows/Linux/Mac 统一接口
- 自动检测平台
- 相同的使用体验

## Bug 修复记录

### Bug 1: 光标和选择混淆
**问题：** `[*]` 和 `>>>` 显示在不同行
**原因：** 判断逻辑错误
**修复：** 分离光标和选择的判断逻辑

### Bug 2: 选中状态不切换
**问题：** 按 SPACE 后没有切换
**原因：** 没有实现切换逻辑
**修复：** 添加 toggle 逻辑并实时缓存

### Bug 3: 缓存不更新
**问题：** 第二次打开菜单还是初始状态
**原因：** 只在 ENTER 时保存缓存
**修复：** 每次 SPACE 都立即保存

## 进阶用法

### 自定义缓存策略

```python
# 禁用缓存
menu = InteractiveMenu(cache_file=None)

# 使用自定义缓存位置
cache_file = Path("/custom/path/cache.json")
menu = InteractiveMenu(cache_file=cache_file)

# 手动管理缓存
menu.set_cached_value("custom_key", {"data": "value"})
data = menu.get_cached_value("custom_key")
```

### 集成到其他项目

```python
# 在你的项目中导入
from interactive_menu import InteractiveMenu

# 使用菜单
menu = InteractiveMenu(cache_file=your_cache_path)
choice = menu.show_single_select_menu(...)
```

## 总结

这是一个完全独立、可复用的菜单系统，具有：
- ✅ 箭头键导航
- ✅ 实时缓存
- ✅ 清晰的视觉反馈
- ✅ 跨平台支持
- ✅ 简单的 API
- ✅ 零依赖（仅标准库）

可以直接复制到其他项目使用！
