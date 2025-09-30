# 屏幕截图性能测试说明

## 📁 文件说明

### 测试脚本（标准库版本）
- `screenshot_performance_test_standard.py` - 完整性能测试（50次截图）
- `quick_screenshot_test_standard.py` - 快速测试（5次截图）
- `simple_screenshot_test.py` - 简化测试（10次截图，只测试PIL ImageGrab）

### 测试脚本（第三方库版本）
- `screenshot_performance_test.py` - 完整性能测试（100次截图，需要mss和dxcam）
- `quick_screenshot_test.py` - 快速测试（10次截图，需要mss和dxcam）

### 批处理文件
- `run_screenshot_test.bat` - 运行完整测试（标准库版本）
- `run_quick_test.bat` - 运行快速测试（标准库版本）
- `run_simple_test.bat` - 运行简化测试（推荐）

## 🎯 测试方法（标准库版本）

### 1. PIL ImageGrab 基础版本
- 使用 `PIL.ImageGrab` 进行全屏截图
- 保存原始分辨率图像

### 2. PIL ImageGrab 优化版本
- 使用 `PIL.ImageGrab` 进行全屏截图
- 在内存中缩放到720p分辨率
- 保持宽高比

### 3. Win32 BitBlt 基础版本
- 使用 `win32gui` 和 `win32ui` 进行全屏截图
- 保存原始分辨率图像

### 4. Win32 BitBlt 优化版本
- 使用 `win32gui` 和 `win32ui` 进行全屏截图
- 在内存中缩放到720p分辨率
- 保持宽高比

### 5. Win32 PrintWindow 基础版本
- 使用 `win32gui.PrintWindow` 进行全屏截图
- 保存原始分辨率图像

### 6. Win32 PrintWindow 优化版本
- 使用 `win32gui.PrintWindow` 进行全屏截图
- 在内存中缩放到720p分辨率
- 保持宽高比

## 🎯 测试方法（第三方库版本）

### 1. MSS 基础版本
- 使用 `mss` 库进行全屏截图
- 保存原始分辨率图像

### 2. MSS 优化版本
- 使用 `mss` 库进行全屏截图
- 在内存中缩放到720p分辨率
- 保持宽高比

### 3. DXCAM 基础版本
- 使用 `dxcam` 库进行全屏截图
- 保存原始分辨率图像

### 4. DXCAM 优化版本
- 使用 `dxcam` 库进行全屏截图
- 在内存中缩放到720p分辨率
- 保持宽高比

## 📊 输出结果

### 截图文件
所有截图保存在：`C:\Users\用户名\.core_node\.d3check\screen_test\`

#### 标准库版本示例文件：
- `pil_imagegrab_basic_sample.png` - PIL ImageGrab基础版本示例
- `pil_imagegrab_optimized_sample.png` - PIL ImageGrab优化版本示例（720p）
- `pil_imagegrab_480p_sample.png` - PIL ImageGrab优化版本示例（480p）
- `win32_bitblt_basic_sample.bmp` - Win32 BitBlt基础版本示例
- `win32_bitblt_optimized_sample.png` - Win32 BitBlt优化版本示例

#### 第三方库版本示例文件：
- `mss_basic_sample.png` - MSS基础版本示例
- `mss_optimized_sample.png` - MSS优化版本示例
- `dxcam_basic_sample.png` - DXCAM基础版本示例
- `dxcam_optimized_sample.png` - DXCAM优化版本示例

### 性能报告
- `simple_test_results.txt` - 简化测试结果（推荐）
- `standard_performance_results.txt` - 标准库完整测试结果
- `quick_standard_test_results.txt` - 标准库快速测试结果
- `performance_results.txt` - 第三方库完整测试结果
- `quick_test_results.txt` - 第三方库快速测试结果

## 🚀 使用方法

### 标准库版本（推荐，无需额外安装）

#### 简化测试（最推荐）
```bash
# 双击运行
run_simple_test.bat

# 或命令行运行
cd "D:\programing\core_node\apps\d3check"
python scripts\simple_screenshot_test.py
```

#### 快速测试
```bash
# 双击运行
run_quick_test.bat

# 或命令行运行
cd "D:\programing\core_node\apps\d3check"
python scripts\quick_screenshot_test_standard.py
```

#### 完整测试
```bash
# 双击运行
run_screenshot_test.bat

# 或命令行运行
cd "D:\programing\core_node\apps\d3check"
python scripts\screenshot_performance_test_standard.py
```

### 第三方库版本（需要安装额外依赖）

#### 快速测试
```bash
# 或命令行运行
cd "D:\programing\core_node\apps\d3check"
python scripts\quick_screenshot_test.py
```

#### 完整测试
```bash
# 或命令行运行
cd "D:\programing\core_node\apps\d3check"
python scripts\screenshot_performance_test.py
```

## 📈 性能指标

测试会显示以下性能指标：
- 总耗时（秒）
- 平均每张截图耗时（毫秒）
- 性能排名（从快到慢）
- 性能提升百分比
- 最快方法相对于最慢方法的倍数

## 🔧 依赖要求

### 标准库版本（推荐）
只需要系统自带的库：
- `PIL` (Pillow) - 图像处理
- `win32gui`, `win32ui`, `win32con`, `win32api` - Windows API

### 第三方库版本
需要安装以下Python包：
```bash
pip install mss dxcam pillow numpy
```

## 📝 注意事项

1. **权限要求**：某些截图方法可能需要管理员权限
2. **显卡驱动**：DXCAM需要支持DirectX的显卡
3. **测试环境**：建议在游戏运行时进行测试以获得真实性能
4. **内存使用**：优化版本会使用更多内存进行图像缩放

## 🎯 推荐使用

### 标准库版本推荐：
- **最佳性能**：PIL ImageGrab 优化版本（480p）
- **平衡性能**：PIL ImageGrab 基础版本（全分辨率）
- **中等性能**：PIL ImageGrab 优化版本（720p）
- **高精度需求**：PIL ImageGrab 基础版本（全分辨率）

### 第三方库版本推荐：
- **游戏内使用**：推荐DXCAM优化版本（720p）
- **高精度需求**：推荐DXCAM基础版本（全分辨率）
- **兼容性优先**：推荐MSS基础版本
- **平衡性能**：推荐MSS优化版本（720p）

## 📊 预期结果

### 标准库版本性能排名（从快到慢）：
1. PIL ImageGrab Optimized (480p)
2. PIL ImageGrab Basic (全分辨率)
3. PIL ImageGrab Optimized (720p)

### 第三方库版本性能排名（从快到慢）：
1. DXCAM Optimized (720p)
2. DXCAM Basic (全分辨率)
3. MSS Optimized (720p)
4. MSS Basic (全分辨率)

实际结果可能因硬件配置而异。
