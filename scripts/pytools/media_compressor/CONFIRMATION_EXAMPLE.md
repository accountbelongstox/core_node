# Multi-threaded Confirmation Prompt

## 功能说明

在启动多线程批处理之前，系统会：

1. **显示硬件信息**
   - GPU 型号和显存
   - NVENC 硬件编码支持
   - 多线程状态

2. **显示线程配置**
   - 工作线程数量
   - 并发任务数量

3. **等待用户确认**
   - 按 `y` 或 `Enter` 继续
   - 按其他键取消

---

## 示例输出

### 场景 1: GPU 多线程模式 (RTX 4060)

```
============================================================
Auto Mode: Multi-threaded Batch Processing
GPU: NVIDIA GeForce RTX 4060 Laptop GPU
GPU Memory: 8.0 GB
NVENC Support: Yes

[*] Multi-threading: ENABLED
    Worker Threads: 4
    Concurrent Tasks: Up to 4 files simultaneously
============================================================

This will use 4 parallel worker threads.
Press 'y' or Enter to continue, any other key to cancel...
Continue? [Y/n]: y

[OK] Starting multi-threaded batch processing with 4 workers...

Scanning directory: D:\BaiduNetdiskDownload
Found 1500 media files...
...
```

### 场景 2: CPU 多线程模式 (无 GPU)

```
============================================================
Auto Mode: CPU Multi-threaded Processing

[*] Multi-threading: ENABLED
    Worker Threads: 2
    Concurrent Tasks: Up to 2 files simultaneously
============================================================

This will use 2 parallel worker threads.
Press 'y' or Enter to continue, any other key to cancel...
Continue? [Y/n]:
(按 Enter)

[OK] Starting multi-threaded batch processing with 2 workers...

Scanning directory: D:\BaiduNetdiskDownload
...
```

### 场景 3: 单线程模式 (降级)

```
============================================================
Auto Mode: Multi-threaded Batch Processing
GPU: NVIDIA GeForce RTX 4060 Laptop GPU
GPU Memory: 8.0 GB
NVENC Support: Yes

[!] Multi-threading: DISABLED (single worker)
============================================================

Scanning directory: D:\BaiduNetdiskDownload
(直接开始，不需要确认)
...
```

### 场景 4: 用户取消

```
============================================================
Auto Mode: Multi-threaded Batch Processing
GPU: NVIDIA GeForce RTX 4060 Laptop GPU
GPU Memory: 8.0 GB
NVENC Support: Yes

[*] Multi-threading: ENABLED
    Worker Threads: 4
    Concurrent Tasks: Up to 4 files simultaneously
============================================================

This will use 4 parallel worker threads.
Press 'y' or Enter to continue, any other key to cancel...
Continue? [Y/n]: n

Operation cancelled by user

Press Enter to continue...
```

---

## 用户交互流程

```
选择菜单选项 1
    ↓
系统检测硬件
    ↓
显示配置信息
    ↓
[判断] 是否多线程？
    ├─ Yes (workers > 1)
    │   ↓
    │   显示确认提示
    │   ↓
    │   等待用户输入
    │   ↓
    │   [判断] 用户选择？
    │       ├─ 'y' 或 Enter → 继续执行
    │       └─ 其他 → 取消操作
    │
    └─ No (workers = 1)
        ↓
        直接开始处理 (无需确认)
```

---

## 技术实现

```python
# 检测模式
if self.unified_compressor:
    status = self.unified_compressor.get_status_info()
    workers = status.get('max_workers', 1)
    is_multithreaded = workers > 1

# 显示信息
if is_multithreaded:
    print(f"[*] Multi-threading: ENABLED")
    print(f"    Worker Threads: {workers}")
    print(f"    Concurrent Tasks: Up to {workers} files simultaneously")

# 用户确认
if is_multithreaded:
    choice = input("Continue? [Y/n]: ").strip().lower()
    if choice and choice not in ['y', 'yes', '']:
        print("Operation cancelled by user")
        return
```

---

## 线程数量对照表

| GPU 显存 | 工作线程 | 说明 |
|---------|---------|------|
| >= 8 GB | 4-6 | 高端 GPU (RTX 4060/3060 Ti+) |
| 4-8 GB  | 3-4 | 中端 GPU (GTX 1660/RTX 3050) |
| < 4 GB  | 2 | 低端 GPU |
| 无 GPU  | 2-4 | CPU 模式 (核心数/2) |

---

## 确认提示的好处

### 1. **透明度**
- 用户清楚知道将使用多少线程
- 了解 GPU 是否被使用
- 明确并发处理数量

### 2. **控制权**
- 可以在开始前取消
- 避免意外启动大量线程
- 给用户决策时间

### 3. **安全性**
- 防止在不合适的时候启动
- 避免资源冲突
- 允许检查系统状态

### 4. **用户体验**
- 简单明了的提示
- Enter 键快速确认
- 清晰的状态反馈

---

## 常见问题

### Q: 为什么单线程模式不需要确认？
**A**: 单线程模式资源占用低，不会对系统造成明显影响，因此可以直接开始。

### Q: 可以跳过确认吗？
**A**: 目前多线程模式必须确认。如需自动运行，可以修改代码移除确认步骤。

### Q: 按 Enter 和按 'y' 有区别吗？
**A**: 没有区别，两者都表示确认继续。

### Q: 取消后如何重新开始？
**A**: 返回主菜单，重新选择选项 1。

---

*实现版本: v2.0*
*支持平台: Windows/Linux/macOS*
