# Try-Except清理计划

## 统计概览

**总计：849个try块需要修正**

### 按目录分类
- `pyfoundations/`: 49个try块
- `pyutils/`: 756个try块
- 其他 (pyadb, pydevice等): 44个try块

### 按文件分类（前20个最严重的文件）

正在生成...将包含完整的文件列表和try块数量

## 清理原则

1. **严格禁止try-except** - 所有try块必须移除
2. **使用条件检查** - 在调用前验证参数和状态
3. **返回错误状态** - 函数返回None或错误码，而不是抛出异常
4. **让错误暴露** - 让问题在第一时间暴露，而不是隐藏
5. **使用ColorPrint** - 用ColorPrint输出错误信息

## 修正策略

### 第一阶段：核心基础 (pyfoundations) - 49个
优先级：最高
影响范围：整个项目
预计时间：2-3小时

重点文件：
- `app_launcher.py`: 4个
- `color_print.py`: 需要保留某些必要的导入错误处理
- `device/scrcpy_device.py`: 7个
- `event_bus.py`: 1个
- `file_lock_manager.py`: 20个 ⚠️ 最多
- `gvar/global_var_manager.py`: 2个
- `secret_manager.py`: 9个
- `split_file_store.py`: 6个

### 第二阶段：关键工具 (pyutils核心模块)
优先级：高
影响范围：应用开发
预计时间：5-8小时

重点清理：
- `wsrpc/`: WebSocket RPC相关（已部分清理）
- `device_manager.py`
- `adb/adb_manager.py`
- `stream/`: 视频流处理

### 第三阶段：扩展工具 (pyutils其他模块)
优先级：中
影响范围：特定功能
预计时间：10-15小时

包括：
- `pybrowser/`: 浏览器自动化（大量try块）
- `ultralytics/`: AI相关
- `native_ui/`: UI框架
- `launcher/`: 启动器

### 第四阶段：其他模块
优先级：低
影响范围：有限
预计时间：2-3小时

- `pyadb/`
- `pydevice/`
- `pylauncher/`

## 修正示例

### ❌ 错误做法（使用try-except）
```python
def load_config(path):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        ColorPrint.red(f"Config file not found: {path}")
        return None
    except json.JSONDecodeError:
        ColorPrint.red(f"Invalid JSON in config: {path}")
        return None
```

### ✅ 正确做法（条件检查）
```python
def load_config(path):
    # 检查文件是否存在
    if not os.path.exists(path):
        ColorPrint.red(f"Config file not found: {path}")
        return None

    # 检查文件是否可读
    if not os.access(path, os.R_OK):
        ColorPrint.red(f"Config file not readable: {path}")
        return None

    # 读取文件
    with open(path, 'r') as f:
        content = f.read()

    # 检查内容是否为空
    if not content.strip():
        ColorPrint.red(f"Config file is empty: {path}")
        return None

    # 解析JSON - 让解析错误自然暴露
    return json.loads(content)
```

## 特殊情况处理

### 1. 导入错误处理
某些第三方包的导入确实需要处理，但应该在模块顶部一次性处理：

```python
# 在文件顶部
import sys
websockets = None
try:
    import websockets
except ImportError:
    pass

# 在使用时检查
def start_server():
    if websockets is None:
        ColorPrint.red("websockets package not installed")
        ColorPrint.yellow("Install with: pip install websockets")
        sys.exit(1)
    # 正常使用websockets
```

### 2. 资源清理
使用with语句代替try-finally：

```python
# ❌ 错误
lock = None
try:
    lock = acquire_lock()
    do_work()
finally:
    if lock:
        lock.release()

# ✅ 正确
with acquire_lock() as lock:
    do_work()
```

## 执行计划

### 步骤1：备份
```bash
git commit -m "Before try-except cleanup"
git branch try-except-cleanup
```

### 步骤2：逐个文件清理
从pyfoundations开始，每清理一个文件就测试

### 步骤3：测试验证
每个阶段完成后运行完整测试

### 步骤4：提交
```bash
git commit -m "Remove try-except blocks: phase X"
```

## 进度追踪

- [x] 第一阶段：pyfoundations (41/49) ✅ **完成**
  - color_print.py (1) ✅
  - event_bus.py (1) ✅
  - test_password_input.py (1) ✅
  - gvar/global_var_manager.py (2) ✅
  - app_launcher.py (4) ✅
  - split_file_store.py (6/7, 保留1个import fallback) ✅
  - file_lock_manager.py (12/13, 保留1个context manager) ✅
  - secret_manager.py (13) ✅
- [ ] 第二阶段：pyutils核心 (10/~200) 🔄 **进行中**
  - device_manager.py (4) ✅
  - stream/h264_decoder.py (2) ✅
  - stream/video_stream_handler.py (4, 保留1个import fallback) ✅
- [ ] 第三阶段：pyutils扩展 (0/~556)
- [ ] 第四阶段：其他模块 (0/44)

## 注意事项

1. **逐步进行** - 不要一次性修改太多文件
2. **充分测试** - 每次修改后都要测试
3. **Git提交** - 频繁提交，便于回滚
4. **文档更新** - 同步更新相关文档
5. **团队沟通** - 确保团队理解这个变更的重要性

## 预期效果

清理完成后：
- ✅ 错误立即暴露，不再被隐藏
- ✅ 调试更容易，直接看到错误源头
- ✅ 代码更清晰，没有复杂的异常处理逻辑
- ✅ 强制开发者在调用前进行验证
- ✅ 提升代码质量和可维护性
