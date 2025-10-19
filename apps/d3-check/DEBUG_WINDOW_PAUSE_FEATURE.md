# Debug Window 暂停/继续功能

## 📋 功能描述

为Debug Window添加了暂停/继续功能,允许用户冻结当前显示的图像进行查看,而不影响D4Controller的tick运行。

## ✨ 功能特性

### 核心特性
- ✅ **暂停图像更新**: 点击按钮后冻结当前显示的所有区域图像
- ✅ **不影响tick**: D4Controller继续正常运行,只是不更新debug_window的图像
- ✅ **通过share共享状态**: 使用`d4_data.debug_window_paused`标志控制
- ✅ **视觉反馈**: 按钮颜色和文字根据状态动态变化

### 用户体验
- **初始状态**: 按钮显示 "Pause Updates" (黄色 - warning)
- **暂停后**: 按钮显示 "Continue Updates" (绿色 - success)
- **继续后**: 按钮恢复为 "Pause Updates" (黄色 - warning)

## 🔧 实现细节

### 1. Share模块 - 添加控制标志

**文件**: `D:\programing\core_node\apps\d3-check\share\game_interface_data.py`

```python
class D4InterfaceData:
    # Debug window state
    debug_window_open: bool = False
    debug_window_paused: bool = False  # ✅ 新增: 控制debug window图像更新暂停
```

**位置**: Line 1166-1167

### 2. Debug Window - UI改造

**文件**: `D:\programing\core_node\apps\d3-check\ui\components\debug_window.py`

#### 变更1: 按钮定义 (Line 93-100)

```python
# ❌ 修改前: Refresh按钮
refresh_btn = tk.Button(button_frame,
                       text="Refresh Images",
                       bg=UnifiedStyles.COLORS['btn_primary'],
                       fg=UnifiedStyles.COLORS['text_primary'],
                       font=UnifiedStyles.FONTS['button'],
                       command=self._refresh_images)

# ✅ 修改后: Pause/Continue按钮
self.pause_btn = tk.Button(button_frame,
                           text="Pause Updates",
                           bg=UnifiedStyles.COLORS['btn_warning'],  # 黄色
                           fg=UnifiedStyles.COLORS['text_primary'],
                           font=UnifiedStyles.FONTS['button'],
                           command=self._toggle_pause)
```

#### 变更2: 新增toggle方法 (Line 247-272)

```python
def _toggle_pause(self):
    """Toggle pause/continue state for image updates"""
    # Toggle pause state in shared data
    self.d4_data.debug_window_paused = not self.d4_data.debug_window_paused

    # Update button appearance based on state
    if self.d4_data.debug_window_paused:
        # Paused state - show "Continue Updates" in green
        self.pause_btn.config(
            text="Continue Updates",
            bg=UnifiedStyles.COLORS['btn_success']  # 绿色
        )
        ColorPrint.yellow("[DebugWindow] Image updates PAUSED")
    else:
        # Running state - show "Pause Updates" in yellow
        self.pause_btn.config(
            text="Pause Updates",
            bg=UnifiedStyles.COLORS['btn_warning']  # 黄色
        )
        ColorPrint.green("[DebugWindow] Image updates RESUMED")
```

### 3. Region Detector - 拦截更新

**文件**: `D:\programing\core_node\apps\d3-check\controller\d4func\region_detector.py`

**位置**: Line 113-116

```python
def _extract_all_regions_to_share(self, screenshot_data):
    """
    Extract all regions and store in detected_regions

    Note: Respects debug_window_paused flag - if paused, skips extraction.
    """
    # ✅ 核心拦截逻辑: 检查暂停标志
    if self.d4_data.debug_window_paused:
        ColorPrint.gray("[RegionDetector] Debug window paused - skipping region extraction")
        return  # 直接返回,不更新detected_regions

    # ... 正常的区域提取逻辑
```

## 📊 数据流说明

### 正常运行流程 (debug_window_paused = False)
```
D4Controller.tick()
    ↓
screenshot_handler.capture_and_collect_info()
    ↓
region_detector.detect_regions_from_shared_data()
    ↓
region_detector._extract_all_regions_to_share()
    ├─ 检查: debug_window_paused = False ✅
    ├─ 提取所有区域图像
    └─ 更新: d4_data.detected_regions['region_images']
         ↓
debug_window.update_images()
    └─ 显示最新的区域图像 ✅
```

### 暂停状态流程 (debug_window_paused = True)
```
D4Controller.tick()  ← 继续运行 ✅
    ↓
screenshot_handler.capture_and_collect_info()  ← 继续截图 ✅
    ↓
region_detector.detect_regions_from_shared_data()  ← 继续检测 ✅
    ↓
region_detector._extract_all_regions_to_share()
    ├─ 检查: debug_window_paused = True ❌
    └─ return (跳过区域提取) ← 拦截点
         ↓
debug_window.update_images()
    └─ 显示之前冻结的图像 ← 不变 ✅
```

## 🎯 功能验证

### 测试步骤

1. **启动程序并打开Debug Window**
   - 验证按钮显示 "Pause Updates" (黄色)
   - 验证图像正常更新

2. **点击暂停按钮**
   - 验证按钮变为 "Continue Updates" (绿色)
   - 验证控制台输出: `[DebugWindow] Image updates PAUSED`
   - 验证图像冻结不再更新
   - 验证每个tick输出: `[RegionDetector] Debug window paused - skipping region extraction`

3. **验证Controller继续运行**
   - 验证D4Controller的tick继续执行
   - 验证截图继续捕获
   - 验证其他功能正常(只是不更新debug window的图像)

4. **点击继续按钮**
   - 验证按钮恢复为 "Pause Updates" (黄色)
   - 验证控制台输出: `[DebugWindow] Image updates RESUMED`
   - 验证图像恢复更新

## 📁 修改的文件

1. **share/game_interface_data.py**
   - 添加 `debug_window_paused` 标志
   - Line 1167, 1222

2. **ui/components/debug_window.py**
   - 将Refresh按钮改为Pause/Continue按钮
   - 添加 `_toggle_pause()` 方法
   - 移除 `_refresh_images()` 方法
   - Line 93-100, 247-272

3. **controller/d4func/region_detector.py**
   - 在 `_extract_all_regions_to_share()` 中添加暂停检查
   - Line 113-116

## 🎨 UI颜色说明

使用UnifiedStyles中已定义的颜色:
- **btn_warning** (`#EBCB8B`): 黄色 - 表示可以暂停
- **btn_success** (`#A3BE8C`): 绿色 - 表示可以继续
- **btn_danger** (`#BF616A`): 红色 - Close按钮

## ⚙️ 设计原则

1. **最小侵入性**: 只在region_detector的提取阶段拦截,不影响其他逻辑
2. **状态共享**: 使用share模块统一管理状态,避免硬编码
3. **视觉清晰**: 按钮颜色和文字明确表达当前状态
4. **性能优化**: 暂停时跳过图像提取,减少CPU/内存使用

## 📝 注意事项

1. **暂停只影响debug window显示**: Controller的其他功能(如EXP Farming)不受影响
2. **暂停时仍会截图**: screenshot_handler继续工作,只是不提取区域图像
3. **图像保持冻结**: 暂停期间,debug_window显示的是暂停那一刻的图像快照
4. **状态持久化**: 关闭debug window后,暂停状态会重置为False

---

**实现时间**: 2025-10-19
**状态**: ✅ 已完成并可用
