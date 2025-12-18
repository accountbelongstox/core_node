# Unified GPU Management System

## 概述

统一GPU管理系统提供了一个集中化的GPU检测、自动安装和管理解决方案，支持多种GPU加速方案并自动回退到CPU。

## 核心功能

### 1. 自动GPU检测（优先级顺序）

```
1. NVIDIA GPU (CUDA)
   ├── PyTorch CUDA (模型训练)
   └── OpenCV CUDA (图像处理，可选)

2. AMD GPU (ROCm)
   └── PyTorch ROCm (模型训练)

3. Intel GPU (oneAPI)
   └── 未来支持

4. CPU (回退)
   └── PyTorch CPU版本
```

### 2. 自动安装支持

当启用`auto_install=True`时，系统会自动：

- **NVIDIA GPU检测到时**:
  - 分析驱动版本确定CUDA版本
  - 自动安装对应的PyTorch CUDA版本
  - 提示OpenCV CUDA的安装方法（可选）

- **AMD GPU检测到时**:
  - 自动安装PyTorch ROCm版本

- **无GPU时**:
  - 安装PyTorch CPU版本

### 3. ENCYCLOPEDIA缓存

- GPU检测只运行一次
- 结果缓存在全局ENCYCLOPEDIA中
- 后续调用立即返回缓存结果
- 零性能开销

## 使用方法

### 基础用法

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager, get_device

# 方法1: 获取管理器实例（推荐）
gpu_manager = get_gpu_manager(verbose=True, auto_install=False)
device = gpu_manager.get_device()  # 返回: "cuda" 或 "cpu"

# 方法2: 快速获取设备
device = get_device(verbose=True)  # 直接返回最佳设备

# 方法3: 启用自动安装
gpu_manager = get_gpu_manager(verbose=True, auto_install=True)
```

### 训练时使用

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device
from ultralytics import YOLO

# 自动选择最佳设备
device = get_device(verbose=True)

# 训练
model = YOLO("yolov8n.pt")
results = model.train(
    data="dataset.yaml",
    epochs=300,
    device=device  # 自动使用GPU或CPU
)
```

### 图像处理时使用

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager
from pycore.pyutils.ultralytics.gpu_image_processor import get_gpu_processor

# 获取GPU信息
gpu_manager = get_gpu_manager()
info = gpu_manager.get_info()

# 使用GPU加速的图像处理器
gpu_processor = get_gpu_processor()
resized = gpu_processor.resize(image, (640, 640))
```

### 检查GPU状态

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

manager = get_gpu_manager()

# 打印详细摘要
manager.print_summary()

# 获取完整信息
info = manager.get_info()
print(f"GPU类型: {info['gpu_type']}")
print(f"GPU名称: {info['gpu_name']}")
print(f"PyTorch CUDA: {info['pytorch_cuda_available']}")
print(f"OpenCV CUDA: {info['opencv_cuda_available']}")

# 简单检查
if manager.is_gpu_available():
    print("GPU加速可用!")
else:
    print("使用CPU模式")
```

## OpenCV CUDA 安装指南

### 为什么需要OpenCV CUDA？

- **不需要**: 如果只进行模型训练（PyTorch已经使用GPU）
- **可选**: 如果需要加速大量图像预处理操作
- **推荐**: 对于实时视频处理或大规模数据集生成

### 安装方法

#### 选项1: 标准安装（不含CUDA）

```bash
# 当前你的安装方式
pip install opencv-python
# 或包含contrib模块
pip install opencv-contrib-python
```

**特点**:
- ✅ 安装简单快速
- ✅ 稳定可靠
- ❌ 图像处理使用CPU
- ✅ 适合大多数用户

#### 选项2: 从源代码编译（含CUDA支持）

**仅适合高级用户！需要2-4小时编译时间。**

```bash
# 1. 卸载现有OpenCV
pip uninstall opencv-python opencv-contrib-python -y

# 2. 克隆opencv-python仓库
git clone --recursive https://github.com/opencv/opencv-python.git
cd opencv-python

# 3. 设置编译参数（根据你的GPU调整CUDA_ARCH_BIN）
# RTX 4060 使用 8.9
# 查看你的GPU架构: https://developer.nvidia.com/cuda-gpus
export CMAKE_ARGS="-DWITH_CUDA=ON -DCUDA_ARCH_BIN=8.9 -DWITH_CUBLAS=ON -DWITH_CUFFT=ON"
export ENABLE_CONTRIB=1

# 4. 编译（需要很长时间）
pip wheel . --verbose

# 5. 安装生成的wheel文件
pip install dist/opencv_contrib_python-*.whl
```

**注意事项**:
- 需要安装CUDA Toolkit（与驱动版本匹配）
- 需要CMake 3.15+
- Windows需要Visual Studio 2019+
- Linux需要gcc/g++编译器
- 编译可能需要2-4小时

#### 选项3: 使用预编译包（如果可用）

某些第三方可能提供预编译的OpenCV CUDA包，但要注意：
- 兼容性可能有问题
- 版本可能不是最新的
- 安全性需要自行验证

### CUDA架构版本对照表

| GPU系列 | 计算能力 | CUDA_ARCH_BIN |
|---------|---------|---------------|
| RTX 40系列 (4090/4080/4070/4060) | 8.9 | 8.9 |
| RTX 30系列 (3090/3080/3070/3060) | 8.6 | 8.6 |
| RTX 20系列 (2080/2070/2060) | 7.5 | 7.5 |
| GTX 16系列 (1660/1650) | 7.5 | 7.5 |
| GTX 10系列 (1080/1070/1060) | 6.1 | 6.1 |

查看完整列表: https://developer.nvidia.com/cuda-gpus

## 系统输出示例

### NVIDIA GPU检测到

```
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

### 无GPU检测到

```
================================================================================
[GPU MANAGER] Unified GPU Detection and Setup
================================================================================
[INFO] No GPU detected - Using CPU
       Training will be slower but functional
================================================================================

================================================================================
[GPU MANAGER] Summary
================================================================================
Selected Device:  cpu
Device Type:      CPU

Acceleration Status:
  PyTorch:        [OK] Available
  PyTorch CUDA:   [X] Not available
  OpenCV CUDA:    [X] Not available
================================================================================
```

## 性能对比

### 模型训练 (YOLOv8n, 300 epochs)

| 设备 | 每个epoch时间 | 总训练时间 | 加速比 |
|------|--------------|-----------|--------|
| RTX 4060 (CUDA) | ~20秒 | ~1.7小时 | 10x |
| CPU (i7-12700) | ~200秒 | ~17小时 | 1x |

### 图像处理 (1000张640x640图片)

| 操作 | OpenCV CUDA | OpenCV CPU | 加速比 |
|------|-------------|-----------|--------|
| 缩放 | ~0.5秒 | ~2秒 | 4x |
| 模糊 | ~0.3秒 | ~1.5秒 | 5x |
| 颜色转换 | ~0.2秒 | ~0.8秒 | 4x |

**结论**:
- ✅ PyTorch CUDA对训练至关重要（10x加速）
- ⚠️ OpenCV CUDA对图像处理有帮助但非必需（4-5x加速）

## 故障排除

### 问题1: PyTorch CUDA安装失败

```bash
# 手动检查CUDA版本
nvidia-smi

# 手动安装（根据输出的CUDA版本）
pip uninstall torch torchvision torchaudio -y
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

### 问题2: 虚拟内存不足

症状: 训练时崩溃，错误 "WinError 1455: The paging file is too small"

解决方案:
1. 减少batch_size (从16降到8)
2. 减少workers数量 (从8降到4)
3. 增加Windows虚拟内存到16-32GB

### 问题3: GPU内存不足

症状: CUDA out of memory

解决方案:
```python
# 减少batch size
results = model.train(
    data="dataset.yaml",
    epochs=300,
    batch=8,  # 从16降到8
    device="cuda"
)
```

### 问题4: 多GPU系统选择特定GPU

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

# 获取管理器
manager = get_gpu_manager()

# 手动指定GPU
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '0'  # 使用第一个GPU

# 或在训练时指定
results = model.train(
    data="dataset.yaml",
    device=0  # 使用GPU 0
)
```

## 技术架构

### 组件关系

```
unified_gpu_manager.py (统一管理器)
    ├── 检测GPU硬件
    ├── 自动安装依赖
    └── 提供统一接口
        ↓
device_manager.py (设备管理)
    ├── NVIDIA检测
    ├── AMD检测
    └── 设备选择
        ↓
gpu_image_processor.py (图像处理)
    ├── OpenCV CUDA加速
    └── CPU回退
        ↓
训练和推理代码
```

### ENCYCLOPEDIA缓存流程

```
第一次调用 get_gpu_manager()
    ↓
检查 ENCYCLOPEDIA["unified_gpu_manager_state"]
    ↓
    No → 执行完整检测
        ├── 检测GPU硬件
        ├── 检测PyTorch/OpenCV
        ├── （可选）自动安装
        └── 保存结果到ENCYCLOPEDIA
    ↓
    Yes → 直接从缓存加载
        └── 立即返回（<1ms）
```

## 最佳实践

### 1. 开发环境

```python
# 开发时禁用自动安装，查看完整信息
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

manager = get_gpu_manager(verbose=True, auto_install=False)
manager.print_summary()
```

### 2. 生产环境

```python
# 生产环境启用自动安装
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device

device = get_device(verbose=False)  # 静默模式
```

### 3. CI/CD环境

```bash
# Dockerfile示例
FROM python:3.10

# 安装基础依赖
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# 安装你的应用
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt

# GPU会自动回退到CPU
```

### 4. 多平台支持

```python
# 代码自动适配所有平台
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device

# Windows: CUDA或CPU
# Linux: CUDA, ROCm或CPU
# macOS: CPU (Metal未来支持)
# Docker: 根据容器配置自动选择

device = get_device()  # 自动处理一切
```

## 更新日志

### v1.0.0 (2025-10-17)

**新功能**:
- ✅ 统一GPU管理器
- ✅ NVIDIA CUDA自动检测和安装
- ✅ AMD ROCm自动检测和安装
- ✅ ENCYCLOPEDIA全局缓存
- ✅ 自动回退到CPU
- ✅ PyTorch和OpenCV统一管理

**改进**:
- ✅ 消除重复的依赖检查消息
- ✅ 清晰区分PyTorch CUDA和OpenCV CUDA
- ✅ 详细的安装指导
- ✅ 完整的错误处理

## 贡献指南

欢迎提交问题和改进建议到项目仓库。

## 许可证

与项目主体保持一致。

---

**维护者**: Core Node Team
**最后更新**: 2025-10-17
**文档版本**: 1.0.0
