# GPU集成使用指南

## 概述

现在，GPU检测和安装已经完全集成到pycore的依赖检查系统中！当你导入pycore或运行任何训练脚本时，系统会自动：

1. ✅ 检查并安装基础Python包
2. ✅ 检测GPU硬件（NVIDIA/AMD）
3. ✅ 显示GPU状态和加速能力
4. ✅ （可选）自动安装GPU加速包

## 默认行为

### 启动时输出示例

```bash
$ python apps/d3-check/train.py

[INFO] Checking for required Python packages...
[INFO] Found installed packages: Pillow, mss, numpy, opencv-python, psutil, pyautogui, pygetwindow, pywin32, pywinauto, torch, uiautomation, ultralytics
[INFO] All required packages are available.

================================================================================
[GPU MANAGER] Unified GPU Detection and Setup
================================================================================
[OK] NVIDIA GPU Detected: NVIDIA GeForce RTX 4060 Laptop GPU
     Driver Version: 537.13
     Memory: 7.65 GB
[OK] PyTorch CUDA available

[INFO] OpenCV CUDA not available (optional)
       Image processing will use CPU (slower but functional)
================================================================================

================================================================================
[GPU MANAGER] Summary
================================================================================
Selected Device:  cuda
Device Type:      NVIDIA GPU
GPU Name:         NVIDIA GeForce RTX 4060 Laptop GPU
GPU Memory:       7.65 GB

Acceleration Status:
  PyTorch:        [OK] Available
  PyTorch CUDA:   [OK] Available
  OpenCV CUDA:    [X] Not available
================================================================================
```

## 配置选项

### 环境变量

你可以通过环境变量控制GPU行为：

```bash
# 启用GPU自动安装（检测到GPU但PyTorch CUDA未安装时自动安装）
export PYCORE_AUTO_INSTALL_GPU=true
python train.py

# 禁用GPU检测（仅检查基础包，跳过GPU检测）
export PYCORE_ENABLE_GPU_SETUP=false
python train.py
```

**Windows (CMD)**:
```cmd
set PYCORE_AUTO_INSTALL_GPU=true
python train.py
```

**Windows (PowerShell)**:
```powershell
$env:PYCORE_AUTO_INSTALL_GPU="true"
python train.py
```

### 配置说明

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PYCORE_ENABLE_GPU_SETUP` | `true` | 是否进行GPU检测和显示信息 |
| `PYCORE_AUTO_INSTALL_GPU` | `false` | 是否自动安装GPU加速包 |

## 使用场景

### 场景1: 开发环境（默认）

**行为**:
- ✅ 检测GPU
- ✅ 显示详细信息
- ❌ 不自动安装（需手动确认）

**适用于**:
- 本地开发
- 调试和测试
- 首次安装

```bash
# 默认行为，无需设置环境变量
python train.py
```

### 场景2: 生产环境（自动化）

**行为**:
- ✅ 检测GPU
- ✅ 自动安装缺失的GPU包
- ✅ 完全自动化

**适用于**:
- CI/CD部署
- 自动化脚本
- Docker容器初始化

```bash
# 启用自动安装
export PYCORE_AUTO_INSTALL_GPU=true
python train.py
```

### 场景3: 纯CPU环境

**行为**:
- ❌ 跳过GPU检测
- ✅ 只检查基础包
- ✅ 更快的启动

**适用于**:
- CPU-only服务器
- 不需要GPU的任务
- 快速测试

```bash
# 禁用GPU检测
export PYCORE_ENABLE_GPU_SETUP=false
python train.py
```

## 代码中访问GPU信息

### 方法1: 使用缓存的GPU信息（推荐）

```python
from pycore import get_gpu_info

# 获取缓存的GPU信息（快速，无额外检测）
gpu_info = get_gpu_info()

if gpu_info:
    print(f"GPU类型: {gpu_info['gpu_type']}")
    print(f"GPU名称: {gpu_info['gpu_name']}")
    print(f"设备: {gpu_info['device']}")
    print(f"PyTorch CUDA: {gpu_info['pytorch_cuda_available']}")
else:
    print("GPU信息不可用")
```

### 方法2: 直接使用GPU管理器

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

# 获取GPU管理器（如果需要强制重新检测）
gpu_manager = get_gpu_manager(verbose=False)

# 获取设备
device = gpu_manager.get_device()  # "cuda" 或 "cpu"

# 检查GPU可用性
if gpu_manager.is_gpu_available():
    print("使用GPU训练")
else:
    print("使用CPU训练")
```

### 方法3: 快速获取设备

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device

# 直接获取最佳设备
device = get_device(verbose=False)  # "cuda" 或 "cpu"
```

## 自动安装行为详解

### 当检测到NVIDIA GPU时

如果 `PYCORE_AUTO_INSTALL_GPU=true`：

1. **检查驱动版本**
   ```
   Driver 537.13 → CUDA 12.4 推荐
   ```

2. **卸载现有PyTorch**
   ```bash
   pip uninstall torch torchvision torchaudio -y
   ```

3. **安装对应版本**
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
   ```

4. **验证安装**
   ```python
   import torch
   torch.cuda.is_available()  # True
   ```

### 当检测到AMD GPU时

如果 `PYCORE_AUTO_INSTALL_GPU=true`：

1. **卸载现有PyTorch**
   ```bash
   pip uninstall torch torchvision torchaudio -y
   ```

2. **安装ROCm版本**
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0
   ```

### 当无GPU时

如果 `PYCORE_AUTO_INSTALL_GPU=true`：

1. **安装CPU版本**
   ```bash
   pip install torch torchvision torchaudio
   ```

## 常见问题

### Q: 为什么每次运行都显示GPU信息？

A: 这是正常的！GPU检测只运行一次（使用ENCYCLOPEDIA缓存），但信息会在首次导入pycore时显示。这样你可以确认系统使用的是GPU还是CPU。

### Q: 如何禁用GPU信息输出？

A: 设置环境变量：
```bash
export PYCORE_ENABLE_GPU_SETUP=false
```

或在代码中手动调用：
```python
from pycore import check_and_install_dependencies
check_and_install_dependencies(enable_gpu_setup=False)
```

### Q: 自动安装会覆盖我手动安装的PyTorch吗？

A: 默认情况下不会（`PYCORE_AUTO_INSTALL_GPU=false`）。只有当你显式设置 `PYCORE_AUTO_INSTALL_GPU=true` 时，系统才会自动安装。

### Q: OpenCV CUDA会自动安装吗？

A: 不会。OpenCV CUDA需要从源码编译，非常复杂且耗时（2-4小时）。系统会显示信息提示，但不会自动安装。大多数情况下不需要OpenCV CUDA，因为：
- 模型训练已经使用PyTorch CUDA（主要加速）
- 图像处理使用CPU通常也足够快

### Q: 如何在Docker中使用？

A: 在Dockerfile中设置环境变量：

```dockerfile
FROM python:3.10

# 启用GPU自动安装
ENV PYCORE_AUTO_INSTALL_GPU=true
ENV PYCORE_ENABLE_GPU_SETUP=true

COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt

# pycore会在导入时自动检测并安装GPU包
```

## 性能优化建议

### 1. 虚拟内存设置（Windows）

如果训练时遇到内存错误：

```
控制面板 → 系统 → 高级系统设置 → 性能设置 → 高级 → 虚拟内存
设置为: 16384 - 32768 MB (16-32 GB)
```

### 2. 训练参数优化

```python
# 如果GPU内存不足
results = model.train(
    data="dataset.yaml",
    epochs=300,
    batch=8,      # 减小batch size (默认16)
    workers=4,    # 减少workers (默认8)
    device="cuda"
)
```

### 3. 图像生成优化

```python
# 生成更少的训练图像
trainer.prepare_data(num_images=500)  # 默认1000
```

## 完整工作流程示例

### 开发环境首次安装

```bash
# 1. 克隆项目
git clone <your-repo>
cd project

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 3. 首次运行（会检测GPU并提示）
python train.py
# 输出会显示GPU状态和安装建议

# 4. 如果需要，手动安装PyTorch CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# 5. 再次运行（现在会使用GPU）
python train.py
```

### CI/CD自动化部署

```yaml
# .github/workflows/train.yml
name: Train Model

on: [push]

jobs:
  train:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'

      - name: Install dependencies and train
        env:
          PYCORE_AUTO_INSTALL_GPU: 'true'  # 自动安装
        run: |
          pip install -r requirements.txt
          python train.py
```

### Docker容器

```dockerfile
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

# 安装Python
RUN apt-get update && apt-get install -y python3.10 python3-pip

# 设置环境变量
ENV PYCORE_AUTO_INSTALL_GPU=true
ENV PYCORE_ENABLE_GPU_SETUP=true

# 安装应用
COPY . /app
WORKDIR /app
RUN pip3 install -r requirements.txt

# 运行时GPU会自动配置
CMD ["python3", "train.py"]
```

## 总结

现在GPU管理已经完全自动化：

1. ✅ **自动检测**: 启动时自动检测GPU硬件
2. ✅ **智能回退**: GPU不可用时自动使用CPU
3. ✅ **可选自动安装**: 可配置自动安装GPU加速包
4. ✅ **全局缓存**: 检测只运行一次，零性能开销
5. ✅ **灵活配置**: 通过环境变量控制行为
6. ✅ **完整信息**: 清晰显示GPU状态和建议

**推荐配置**:
- 开发环境: 使用默认设置（不自动安装）
- 生产环境: 设置 `PYCORE_AUTO_INSTALL_GPU=true`
- CPU环境: 设置 `PYCORE_ENABLE_GPU_SETUP=false`

---

**最后更新**: 2025-10-17
**版本**: 1.0.0
